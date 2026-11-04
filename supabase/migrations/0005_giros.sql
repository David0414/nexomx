-- Giro de cada empresa. Se llena con scripts/clasificar.py y el administrador puede corregirlo.

create table public.giros (id text primary key);

insert into public.giros (id) values
  ('armadoras'), ('autopartes'), ('plasticos'), ('metalmecanica'), ('electrica'), ('automatizacion'),
  ('quimicos'), ('empaque'), ('logistica'), ('construccion'), ('servicios_industriales'),
  ('servicios_profesionales'), ('comercializadoras'), ('manufactura'), ('sin_clasificar');

alter table public.giros enable row level security;
revoke all on public.giros from anon, authenticated;

alter table public.empresas
  add column giro text not null default 'sin_clasificar' references public.giros (id);

create index empresas_giro_idx on public.empresas (giro);

drop function public.buscar_contactos(text, text, text, boolean, boolean, integer);
drop function public.buscar_empresas(text, text, text, boolean, boolean, integer);
drop function public.conteos(text, text, text, boolean, boolean);
drop function public.admin_empresas(text, text, text, integer);
drop function public.admin_guardar_empresa(bigint, text, text, text, text, text);

create or replace function public.buscar_contactos(
  q text default '', p_estado text default null, p_area text default null,
  con_correo boolean default false, con_telefono boolean default false, pagina integer default 0,
  p_giro text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_total bigint;
  v_filas jsonb;
begin
  pagina := greatest(pagina, 0);

  with base as (
    select c.*, e.nombre as empresa, e.estado, e.web, e.giro, e.telefono as telefono_empresa
    from public.contactos c
    join public.empresas e on e.id = c.empresa_id
    where (p_estado is null or e.estado = p_estado)
      and (p_giro is null or e.giro = p_giro)
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
      'puesto', p.puesto, 'area', p.area, 'giro', p.giro, 'correo', p.correo, 'web', p.web,
      'telefono', coalesce(p.telefono_directo, p.telefono_empresa),
      'telefono_directo', p.telefono_directo is not null
    ) order by p.empresa, p.nombre nulls last, p.id) from pagina_actual p), '[]')
  into v_total, v_filas;

  perform public.validar_y_registrar('personas',
    jsonb_build_object('q', q, 'estado', p_estado, 'area', p_area, 'giro', p_giro, 'pagina', pagina),
    jsonb_array_length(v_filas));

  return jsonb_build_object('total', v_total, 'filas', v_filas);
end;
$$;

create or replace function public.buscar_empresas(
  q text default '', p_estado text default null, p_area text default null,
  con_correo boolean default false, con_telefono boolean default false, pagina integer default 0,
  p_giro text default null
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
      and (p_giro is null or e.giro = p_giro)
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
      'telefono', p.telefono, 'web', p.web, 'giro', p.giro, 'num_contactos', p.num_contactos
    ) order by p.nombre, p.id) from pagina_actual p), '[]')
  into v_total, v_filas;

  perform public.validar_y_registrar('empresas',
    jsonb_build_object('q', q, 'estado', p_estado, 'area', p_area, 'giro', p_giro, 'pagina', pagina),
    jsonb_array_length(v_filas));

  return jsonb_build_object('total', v_total, 'filas', v_filas);
end;
$$;

create or replace function public.conteos(
  q text default '', p_estado text default null, p_area text default null,
  con_correo boolean default false, con_telefono boolean default false, p_giro text default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_resultado jsonb;
begin
  if not exists (select 1 from public.perfiles where id = auth.uid() and activo) then
    raise exception 'cuenta_inactiva' using errcode = 'P0001';
  end if;

  with c as (
    select e.estado, e.giro, k.area
    from public.contactos k
    join public.empresas e on e.id = k.empresa_id
    where (not con_correo or k.correo is not null)
      and (not con_telefono or coalesce(k.telefono_directo, e.telefono) is not null)
      and public.coincide(k.busqueda || ' ' || e.busqueda, q)
  ), m as (
    select e.estado, e.giro
    from public.empresas e
    where (not con_telefono or e.telefono is not null)
      and (p_area is null or exists (select 1 from public.contactos k where k.empresa_id = e.id and k.area = p_area))
      and (not con_correo or exists (select 1 from public.contactos k where k.empresa_id = e.id and k.correo is not null))
      and public.coincide(e.busqueda, q)
  )
  select jsonb_build_object(
    'personas', (select count(*) from c where (p_estado is null or estado = p_estado) and (p_area is null or area = p_area) and (p_giro is null or giro = p_giro)),
    'empresas', (select count(*) from m where (p_estado is null or estado = p_estado) and (p_giro is null or giro = p_giro)),
    'estados_personas', coalesce((select jsonb_object_agg(estado, n) from (select estado, count(*) n from c where (p_area is null or area = p_area) and (p_giro is null or giro = p_giro) group by 1) s), '{}'),
    'estados_empresas', coalesce((select jsonb_object_agg(estado, n) from (select estado, count(*) n from m where (p_giro is null or giro = p_giro) group by 1) s), '{}'),
    'giros', coalesce((select jsonb_object_agg(giro, n) from (select giro, count(*) n from m where (p_estado is null or estado = p_estado) group by 1) s), '{}'),
    'areas', coalesce((select jsonb_object_agg(area, n) from (select area, count(*) n from c where (p_estado is null or estado = p_estado) and (p_giro is null or giro = p_giro) group by 1) s), '{}')
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
  from (select id, nombre, web, estado, giro, ubicacion, telefono from public.empresas where id = p_id) s;
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

create or replace function public.mis_favoritos()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_filas jsonb;
begin
  perform public.exigir_cuenta();

  select coalesce(jsonb_agg(to_jsonb(s) order by s.creado_el desc), '[]') into v_filas
  from (
    select e.id, e.nombre, e.estado, e.giro, e.ubicacion, e.telefono, e.web, f.creado_el,
      (select count(*) from public.contactos c where c.empresa_id = e.id) as num_contactos
    from public.favoritos f
    join public.empresas e on e.id = f.empresa_id
    where f.usuario_id = auth.uid()
  ) s;

  return v_filas;
end;
$$;

create or replace function public.empresas_destacadas()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_filas jsonb;
begin
  perform public.exigir_cuenta();

  select coalesce(jsonb_agg(to_jsonb(s) order by s.num_contactos desc, s.nombre), '[]') into v_filas
  from (
    select e.id, e.nombre, e.estado, e.giro, e.web, count(c.id) as num_contactos
    from public.empresas e
    join public.contactos c on c.empresa_id = e.id
    group by e.id
    order by num_contactos desc, e.nombre
    limit 8
  ) s;

  return v_filas;
end;
$$;

create or replace function public.admin_empresas(
  q text default '', p_estado text default null, p_filtro text default 'todas', pagina integer default 0,
  p_giro text default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_conteos jsonb;
  v_total   bigint;
  v_filas   jsonb;
begin
  if not public.es_admin() then
    raise exception 'solo_admin' using errcode = 'P0001';
  end if;

  pagina := greatest(pagina, 0);

  with base as (
    select e.*,
      (select count(*) from public.contactos c where c.empresa_id = e.id) as num_contactos,
      (select count(*) from public.contactos c where c.empresa_id = e.id and c.correo is not null) as con_correo
    from public.empresas e
    where (p_estado is null or e.estado = p_estado)
      and (p_giro is null or e.giro = p_giro)
      and (
        public.coincide(e.busqueda, q)
        or exists (select 1 from public.contactos c where c.empresa_id = e.id and public.coincide(c.busqueda, q))
      )
  ), filtrada as (
    select * from base
    where case p_filtro
      when 'con_personas' then num_contactos > 0
      when 'sin_personas' then num_contactos = 0
      when 'sin_telefono' then telefono is null
      when 'sin_web' then web is null
      when 'sin_estado' then estado = 'Sin estado'
      when 'sin_giro' then giro = 'sin_clasificar'
      else true
    end
  ), pagina_actual as (
    select * from filtrada order by nombre, id limit 50 offset pagina * 50
  )
  select
    (select jsonb_build_object(
      'todas', count(*),
      'con_personas', count(*) filter (where num_contactos > 0),
      'sin_personas', count(*) filter (where num_contactos = 0),
      'sin_telefono', count(*) filter (where telefono is null),
      'sin_web', count(*) filter (where web is null),
      'sin_estado', count(*) filter (where estado = 'Sin estado'),
      'sin_giro', count(*) filter (where giro = 'sin_clasificar')
    ) from base),
    (select count(*) from filtrada),
    coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'nombre', p.nombre, 'estado', p.estado, 'ubicacion', p.ubicacion, 'telefono', p.telefono,
      'web', p.web, 'giro', p.giro, 'enlace_origen', p.enlace_origen, 'num_contactos', p.num_contactos, 'con_correo', p.con_correo
    ) order by p.nombre, p.id) from pagina_actual p), '[]')
  into v_conteos, v_total, v_filas;

  return jsonb_build_object('total', v_total, 'filas', v_filas, 'conteos', v_conteos);
end;
$$;

create or replace function public.admin_guardar_empresa(
  p_id bigint, p_nombre text, p_web text, p_estado text, p_ubicacion text, p_telefono text, p_giro text
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint;
begin
  if not public.es_admin() then
    raise exception 'solo_admin' using errcode = 'P0001';
  end if;
  if public.limpio(p_nombre) is null then
    raise exception 'nombre_requerido' using errcode = 'P0001';
  end if;

  if p_giro not in (select id from public.giros) then
    raise exception 'datos_invalidos' using errcode = 'P0001';
  end if;

  if p_id is null then
    insert into public.empresas (enlace_origen, nombre, web, estado, ubicacion, telefono, giro, protegida)
    values (
      'manual:' || gen_random_uuid(), public.limpio(p_nombre), public.limpio(p_web),
      coalesce(public.limpio(p_estado), 'Sin estado'), public.limpio(p_ubicacion), public.limpio(p_telefono), p_giro, true
    )
    returning id into v_id;
  else
    update public.empresas set
      nombre = public.limpio(p_nombre), web = public.limpio(p_web),
      estado = coalesce(public.limpio(p_estado), 'Sin estado'),
      ubicacion = public.limpio(p_ubicacion), telefono = public.limpio(p_telefono), giro = p_giro, protegida = true
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'empresa_no_encontrada' using errcode = 'P0001';
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.admin_giros_consultados(p_dias integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_filas jsonb;
begin
  if not public.es_admin() then
    raise exception 'solo_admin' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(s), '[]') into v_filas
  from (
    select c.filtros ->> 'giro' as giro, count(*) as veces
    from public.consultas c
    join public.perfiles p on p.id = c.usuario_id
    where p.rol = 'cliente'
      and c.tipo in ('personas', 'empresas')
      and c.filtros ->> 'giro' is not null
      and coalesce((c.filtros ->> 'pagina')::integer, 0) = 0
      and c.creado_el >= now() - make_interval(days => least(greatest(p_dias, 1), 365))
    group by 1
    order by veces desc, giro
    limit 8
  ) s;

  return v_filas;
end;
$$;

revoke execute on function
  public.buscar_contactos(text, text, text, boolean, boolean, integer, text),
  public.buscar_empresas(text, text, text, boolean, boolean, integer, text),
  public.conteos(text, text, text, boolean, boolean, text),
  public.admin_empresas(text, text, text, integer, text),
  public.admin_guardar_empresa(bigint, text, text, text, text, text, text),
  public.admin_giros_consultados(integer)
from public, anon, authenticated;

grant execute on function
  public.buscar_contactos(text, text, text, boolean, boolean, integer, text),
  public.buscar_empresas(text, text, text, boolean, boolean, integer, text),
  public.conteos(text, text, text, boolean, boolean, text),
  public.admin_empresas(text, text, text, integer, text),
  public.admin_guardar_empresa(bigint, text, text, text, text, text, text),
  public.admin_giros_consultados(integer)
to authenticated;
