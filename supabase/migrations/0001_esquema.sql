-- NexoMx: esquema, seguridad y consultas.
-- Regla central: ningún cliente lee las tablas directo. Todo pasa por funciones
-- que validan la cuenta, limitan a 25 filas por página y registran el consumo.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create type public.rol_usuario as enum ('admin', 'cliente');

create or replace function public.normalizar(texto text)
returns text language sql immutable parallel safe as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(texto, '')))
$$;

-- ---------------------------------------------------------------- Tablas

create table public.perfiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  nombre         text not null,
  empresa        text,
  correo         text not null,
  rol            public.rol_usuario not null default 'cliente',
  activo         boolean not null default true,
  vence_el       date,
  limite_diario  integer not null default 1000 check (limite_diario >= 0),
  ultimo_acceso  timestamptz,
  creado_el      timestamptz not null default now()
);

create table public.empresas (
  id             bigint generated always as identity primary key,
  enlace_origen  text not null unique,
  nombre         text not null,
  web            text,
  estado         text not null default 'Sin estado',
  ubicacion      text,
  telefono       text,
  busqueda       text generated always as (public.normalizar(nombre || ' ' || coalesce(ubicacion, ''))) stored
);

create table public.contactos (
  id                bigint generated always as identity primary key,
  empresa_id        bigint not null references public.empresas (id) on delete cascade,
  nombre            text,
  puesto            text,
  area              text not null default 'otro',
  correo            text,
  telefono_directo  text,
  busqueda          text generated always as (public.normalizar(coalesce(nombre, '') || ' ' || coalesce(puesto, '') || ' ' || coalesce(correo, ''))) stored,
  unique nulls not distinct (empresa_id, nombre, correo)
);

create table public.consultas (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null references public.perfiles (id) on delete cascade,
  tipo        text not null,
  filtros     jsonb not null default '{}',
  resultados  integer not null default 0,
  creado_el   timestamptz not null default now()
);

create index empresas_estado_idx on public.empresas (estado);
create index empresas_busqueda_idx on public.empresas using gin (busqueda extensions.gin_trgm_ops);
create index contactos_empresa_idx on public.contactos (empresa_id);
create index contactos_area_idx on public.contactos (area);
create index contactos_busqueda_idx on public.contactos using gin (busqueda extensions.gin_trgm_ops);
create index consultas_usuario_fecha_idx on public.consultas (usuario_id, creado_el desc);

-- ---------------------------------------------------------------- Permisos

alter table public.perfiles  enable row level security;
alter table public.empresas  enable row level security;
alter table public.contactos enable row level security;
alter table public.consultas enable row level security;

revoke all on public.empresas, public.contactos, public.consultas, public.perfiles from anon, authenticated;
grant select on public.perfiles to authenticated;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin' and activo
  )
$$;

create policy "cada quien ve su perfil, el admin todos"
  on public.perfiles for select to authenticated
  using (id = auth.uid() or public.es_admin());

-- Valida la cuenta y descuenta del límite diario. Falla antes de entregar datos.
create or replace function public.validar_y_registrar(p_tipo text, p_filtros jsonb, p_resultados integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_perfil public.perfiles;
  v_hoy    integer;
  v_inicio timestamptz := date_trunc('day', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City';
begin
  select * into v_perfil from public.perfiles where id = auth.uid() for update;
  if not found or not v_perfil.activo then
    raise exception 'cuenta_inactiva' using errcode = 'P0001';
  end if;

  if v_perfil.rol <> 'admin' then
    if v_perfil.vence_el is not null
       and v_perfil.vence_el < (now() at time zone 'America/Mexico_City')::date then
      raise exception 'cuenta_vencida' using errcode = 'P0001';
    end if;

    select coalesce(sum(resultados), 0) into v_hoy
    from public.consultas
    where usuario_id = auth.uid() and creado_el >= v_inicio;

    if v_hoy + p_resultados > v_perfil.limite_diario then
      raise exception 'limite_diario' using errcode = 'P0001';
    end if;
  end if;

  insert into public.consultas (usuario_id, tipo, filtros, resultados)
  values (auth.uid(), p_tipo, p_filtros, p_resultados);

  update public.perfiles set ultimo_acceso = now() where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------- Búsqueda

create or replace function public.coincide(busqueda text, q text)
returns boolean language sql immutable parallel safe as $$
  select not exists (
    select 1
    from unnest(regexp_split_to_array(btrim(public.normalizar(q)), '\s+')) as termino
    where termino <> ''
      and strpos(busqueda, termino) = 0
  )
$$;

create or replace function public.buscar_contactos(
  q text default '', p_estado text default null, p_area text default null,
  con_correo boolean default false, con_telefono boolean default false, pagina integer default 0
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_total bigint;
  v_filas jsonb;
begin
  pagina := greatest(pagina, 0);

  with base as (
    select c.*, e.nombre as empresa, e.estado, e.web, e.telefono as telefono_empresa
    from public.contactos c
    join public.empresas e on e.id = c.empresa_id
    where (p_estado is null or e.estado = p_estado)
      and (p_area is null or c.area = p_area)
      and (not con_correo or c.correo is not null)
      and (not con_telefono or coalesce(c.telefono_directo, e.telefono) is not null)
      and public.coincide(c.busqueda || ' ' || e.busqueda, q)
  ), pagina_actual as (
    select * from base
    order by empresa, nombre nulls last, id
    limit 25 offset pagina * 25
  )
  select
    (select count(*) from base),
    coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'empresa_id', p.empresa_id, 'empresa', p.empresa, 'estado', p.estado, 'nombre', p.nombre,
      'puesto', p.puesto, 'area', p.area, 'correo', p.correo, 'web', p.web,
      'telefono', coalesce(p.telefono_directo, p.telefono_empresa),
      'telefono_directo', p.telefono_directo is not null
    ) order by p.empresa, p.nombre nulls last, p.id) from pagina_actual p), '[]')
  into v_total, v_filas;

  perform public.validar_y_registrar('personas',
    jsonb_build_object('q', q, 'estado', p_estado, 'area', p_area, 'pagina', pagina),
    jsonb_array_length(v_filas));

  return jsonb_build_object('total', v_total, 'filas', v_filas);
end;
$$;

create or replace function public.buscar_empresas(
  q text default '', p_estado text default null, p_area text default null,
  con_correo boolean default false, con_telefono boolean default false, pagina integer default 0
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_total bigint;
  v_filas jsonb;
begin
  pagina := greatest(pagina, 0);

  with base as (
    select e.*,
      (select count(*) from public.contactos c where c.empresa_id = e.id) as num_contactos
    from public.empresas e
    where (p_estado is null or e.estado = p_estado)
      and (not con_telefono or e.telefono is not null)
      and (p_area is null or exists (select 1 from public.contactos c where c.empresa_id = e.id and c.area = p_area))
      and (not con_correo or exists (select 1 from public.contactos c where c.empresa_id = e.id and c.correo is not null))
      and public.coincide(e.busqueda, q)
  ), pagina_actual as (
    select * from base order by nombre, id limit 25 offset pagina * 25
  )
  select
    (select count(*) from base),
    coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'nombre', p.nombre, 'estado', p.estado, 'ubicacion', p.ubicacion,
      'telefono', p.telefono, 'web', p.web, 'num_contactos', p.num_contactos
    ) order by p.nombre, p.id) from pagina_actual p), '[]')
  into v_total, v_filas;

  perform public.validar_y_registrar('empresas',
    jsonb_build_object('q', q, 'estado', p_estado, 'area', p_area, 'pagina', pagina),
    jsonb_array_length(v_filas));

  return jsonb_build_object('total', v_total, 'filas', v_filas);
end;
$$;

-- Conteos para el mapa y las áreas. El mapa ignora el filtro de estado y la lista
-- de áreas ignora el filtro de área, para que siempre muestren las alternativas.
create or replace function public.conteos(
  q text default '', p_estado text default null, p_area text default null,
  con_correo boolean default false, con_telefono boolean default false
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_resultado jsonb;
begin
  if not exists (select 1 from public.perfiles where id = auth.uid() and activo) then
    raise exception 'cuenta_inactiva' using errcode = 'P0001';
  end if;

  with c as (
    select e.estado, k.area
    from public.contactos k
    join public.empresas e on e.id = k.empresa_id
    where (not con_correo or k.correo is not null)
      and (not con_telefono or coalesce(k.telefono_directo, e.telefono) is not null)
      and public.coincide(k.busqueda || ' ' || e.busqueda, q)
  ), m as (
    select e.estado
    from public.empresas e
    where (not con_telefono or e.telefono is not null)
      and (p_area is null or exists (select 1 from public.contactos k where k.empresa_id = e.id and k.area = p_area))
      and (not con_correo or exists (select 1 from public.contactos k where k.empresa_id = e.id and k.correo is not null))
      and public.coincide(e.busqueda, q)
  )
  select jsonb_build_object(
    'personas', (select count(*) from c where (p_estado is null or estado = p_estado) and (p_area is null or area = p_area)),
    'empresas', (select count(*) from m where (p_estado is null or estado = p_estado)),
    'estados_personas', coalesce((select jsonb_object_agg(estado, n) from (select estado, count(*) n from c where (p_area is null or area = p_area) group by 1) s), '{}'),
    'estados_empresas', coalesce((select jsonb_object_agg(estado, n) from (select estado, count(*) n from m group by 1) s), '{}'),
    'areas', coalesce((select jsonb_object_agg(area, n) from (select area, count(*) n from c where (p_estado is null or estado = p_estado) group by 1) s), '{}')
  ) into v_resultado;

  return v_resultado;
end;
$$;

create or replace function public.detalle_empresa(p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_empresa   jsonb;
  v_contactos jsonb;
begin
  select to_jsonb(s) into v_empresa
  from (select id, nombre, web, estado, ubicacion, telefono from public.empresas where id = p_id) s;
  if v_empresa is null then
    raise exception 'empresa_no_encontrada' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.nombre nulls last), '[]') into v_contactos
  from (
    select id, nombre, puesto, area, correo, telefono_directo
    from public.contactos where empresa_id = p_id limit 100
  ) s;

  perform public.validar_y_registrar('empresa', jsonb_build_object('empresa_id', p_id), jsonb_array_length(v_contactos));

  return jsonb_build_object('empresa', v_empresa, 'contactos', v_contactos);
end;
$$;

create or replace function public.uso_hoy()
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(sum(resultados), 0)::integer
  from public.consultas
  where usuario_id = auth.uid()
    and creado_el >= date_trunc('day', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City'
$$;

-- ---------------------------------------------------------------- Administración

create or replace function public.admin_clientes()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_inicio timestamptz := date_trunc('day', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City';
  v_filas  jsonb;
begin
  if not public.es_admin() then
    raise exception 'solo_admin' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.creado_el desc), '[]') into v_filas
  from (
    select p.id, p.nombre, p.empresa, p.correo, p.activo, p.vence_el, p.limite_diario, p.ultimo_acceso, p.creado_el,
      coalesce((select sum(c.resultados) from public.consultas c where c.usuario_id = p.id and c.creado_el >= v_inicio), 0)::integer as uso_hoy
    from public.perfiles p
    where p.rol = 'cliente'
  ) s;

  return v_filas;
end;
$$;

create or replace function public.admin_actividad()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_filas jsonb;
begin
  if not public.es_admin() then
    raise exception 'solo_admin' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.creado_el desc), '[]') into v_filas
  from (
    select c.id, c.tipo, c.filtros, c.resultados, c.creado_el, p.nombre, p.empresa
    from public.consultas c
    join public.perfiles p on p.id = c.usuario_id
    order by c.creado_el desc
    limit 200
  ) s;

  return v_filas;
end;
$$;

-- Supabase da permiso de ejecución a todos por defecto: se quita y se abre solo lo necesario.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.normalizar(text) to service_role;  -- la usan las columnas generadas al importar
grant execute on function
  public.buscar_contactos(text, text, text, boolean, boolean, integer),
  public.buscar_empresas(text, text, text, boolean, boolean, integer),
  public.conteos(text, text, text, boolean, boolean),
  public.detalle_empresa(bigint),
  public.uso_hoy(),
  public.admin_clientes(),
  public.admin_actividad()
to authenticated;
