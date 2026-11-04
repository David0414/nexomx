-- Demos individuales que crea el administrador: duran unos minutos desde el primer uso y
-- dejan ver unas cuantas empresas. Del resto, el servidor nunca entrega los datos reales.

alter table public.perfiles
  add column demo boolean not null default false,
  add column demo_minutos integer not null default 15 check (demo_minutos > 0),
  add column demo_empresas integer not null default 10 check (demo_empresas >= 0),
  add column demo_inicio timestamptz;

create table public.demo_desbloqueos (
  usuario_id  uuid not null references public.perfiles (id) on delete cascade,
  empresa_id  bigint not null references public.empresas (id) on delete cascade,
  creado_el   timestamptz not null default now(),
  primary key (usuario_id, empresa_id)
);

alter table public.demo_desbloqueos enable row level security;
revoke all on public.demo_desbloqueos from anon, authenticated;

create or replace function public.empresa_bloqueada(p_empresa_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles p where p.id = auth.uid() and p.demo)
    and not exists (
      select 1 from public.demo_desbloqueos d
      where d.usuario_id = auth.uid() and d.empresa_id = p_empresa_id
    )
$$;

create or replace function public.exigir_cuenta()
returns void language plpgsql stable security definer set search_path = '' as $$
declare
  v_perfil public.perfiles;
begin
  select * into v_perfil from public.perfiles where id = auth.uid();
  if not found or not v_perfil.activo then
    raise exception 'cuenta_inactiva' using errcode = 'P0001';
  end if;
  if v_perfil.demo and v_perfil.demo_inicio is not null
     and now() > v_perfil.demo_inicio + make_interval(mins => v_perfil.demo_minutos) then
    raise exception 'demo_terminada' using errcode = 'P0001';
  end if;
  if v_perfil.rol <> 'admin' and v_perfil.vence_el is not null
     and v_perfil.vence_el < (now() at time zone 'America/Mexico_City')::date then
    raise exception 'cuenta_vencida' using errcode = 'P0001';
  end if;
end;
$$;

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

    if v_perfil.demo and v_perfil.demo_inicio is not null
       and now() > v_perfil.demo_inicio + make_interval(mins => v_perfil.demo_minutos) then
      raise exception 'demo_terminada' using errcode = 'P0001';
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

  update public.perfiles
  set ultimo_acceso = now(), demo_inicio = case when demo then coalesce(demo_inicio, now()) end
  where id = auth.uid();
end;
$$;

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
    select *, public.empresa_bloqueada(empresa_id) as bloqueada from base
    order by empresa, nombre nulls last, id
    limit 25 offset pagina * 25
  )
  select
    (select count(*) from base),
    coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'empresa_id', p.empresa_id, 'empresa', p.empresa, 'estado', p.estado, 'area', p.area, 'giro', p.giro, 'web', p.web, 'bloqueada', p.bloqueada,
      'nombre', case when p.bloqueada then 'Nombre del contacto' else p.nombre end,
      'puesto', case when p.bloqueada then 'Puesto del contacto' else p.puesto end,
      'correo', case when p.bloqueada then 'contacto@empresa.com' else p.correo end,
      'telefono', case when p.bloqueada then '+52 000 000 0000' else coalesce(p.telefono_directo, p.telefono_empresa) end,
      'telefono_directo', not p.bloqueada and p.telefono_directo is not null
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
    select *, public.empresa_bloqueada(id) as bloqueada from base order by nombre, id limit 25 offset pagina * 25
  )
  select
    (select count(*) from base),
    coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'nombre', p.nombre, 'estado', p.estado, 'ubicacion', p.ubicacion,
      'telefono', case when p.bloqueada then '+52 000 000 0000' else p.telefono end,
      'web', p.web, 'giro', p.giro, 'num_contactos', p.num_contactos, 'bloqueada', p.bloqueada
    ) order by p.nombre, p.id) from pagina_actual p), '[]')
  into v_total, v_filas;

  perform public.validar_y_registrar('empresas',
    jsonb_build_object('q', q, 'estado', p_estado, 'area', p_area, 'giro', p_giro, 'pagina', pagina),
    jsonb_array_length(v_filas));

  return jsonb_build_object('total', v_total, 'filas', v_filas);
end;
$$;

create or replace function public.detalle_empresa(p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_empresa   jsonb;
  v_contactos jsonb;
  v_bloqueada boolean := public.empresa_bloqueada(p_id);
begin
  select to_jsonb(s) into v_empresa
  from (select id, nombre, web, estado, giro, ubicacion,
    case when v_bloqueada then '+52 000 000 0000' else telefono end as telefono
  from public.empresas where id = p_id) s;
  if v_empresa is null then
    raise exception 'empresa_no_encontrada' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.nombre nulls last), '[]') into v_contactos
  from (
    select id, area,
      case when v_bloqueada then 'Nombre del contacto' else nombre end as nombre,
      case when v_bloqueada then 'Puesto del contacto' else puesto end as puesto,
      case when v_bloqueada then 'contacto@empresa.com' else correo end as correo,
      case when v_bloqueada then null else telefono_directo end as telefono_directo
    from public.contactos where empresa_id = p_id limit 100
  ) s;

  perform public.validar_y_registrar('empresa', jsonb_build_object('empresa_id', p_id), jsonb_array_length(v_contactos));

  return jsonb_build_object('empresa', v_empresa, 'contactos', v_contactos, 'bloqueada', v_bloqueada);
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
  perform public.exigir_cuenta();

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

create or replace function public.alternar_favorito(p_empresa_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_cuenta();

  if exists (select 1 from public.perfiles where id = auth.uid() and demo) then
    raise exception 'demo_favoritos' using errcode = 'P0001';
  end if;

  delete from public.favoritos where usuario_id = auth.uid() and empresa_id = p_empresa_id;
  if found then
    return false;
  end if;

  if not exists (select 1 from public.empresas where id = p_empresa_id) then
    raise exception 'empresa_no_encontrada' using errcode = 'P0001';
  end if;

  if (select count(*) from public.favoritos where usuario_id = auth.uid()) >= 200 then
    raise exception 'limite_favoritos' using errcode = 'P0001';
  end if;

  insert into public.favoritos (usuario_id, empresa_id) values (auth.uid(), p_empresa_id);
  return true;
end;
$$;

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
      p.demo, p.demo_minutos, p.demo_empresas, p.demo_inicio,
      (select count(*) from public.demo_desbloqueos d where d.usuario_id = p.id)::integer as demo_usadas,
      case when p.demo_inicio is null then null
        else greatest(extract(epoch from p.demo_inicio + make_interval(mins => p.demo_minutos) - now()), 0)::integer end as demo_restante,
      coalesce((select sum(c.resultados) from public.consultas c where c.usuario_id = p.id and c.creado_el >= v_inicio), 0)::integer as uso_hoy
    from public.perfiles p
    where p.rol = 'cliente'
  ) s;

  return v_filas;
end;
$$;

create or replace function public.admin_analitica(p_dias integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_hoy    date := (now() at time zone 'America/Mexico_City')::date;
  v_desde  date;
  v_inicio timestamptz;
  v_salida jsonb;
begin
  if not public.es_admin() then
    raise exception 'solo_admin' using errcode = 'P0001';
  end if;

  p_dias := least(greatest(p_dias, 1), 365);
  v_desde := v_hoy - (p_dias - 1);
  v_inicio := v_desde::timestamp at time zone 'America/Mexico_City';

  with periodo as (
    select c.*, (c.creado_el at time zone 'America/Mexico_City')::date as dia,
      coalesce((c.filtros ->> 'pagina')::integer, 0) as pag,
      lower(btrim(coalesce(c.filtros ->> 'q', ''))) as texto
    from public.consultas c
    join public.perfiles p on p.id = c.usuario_id
    where p.rol = 'cliente' and c.creado_el >= v_inicio
  ), busquedas as (
    -- Pasar de página no es una búsqueda nueva.
    select * from periodo where tipo in ('personas', 'empresas') and pag = 0
  ), textos as (
    select * from busquedas where length(texto) >= 3
  ), clientes as (
    select activo, vence_el from public.perfiles where rol = 'cliente' and not demo
  )
  select jsonb_build_object(
    'clientes', (select jsonb_build_object(
      'total', count(*),
      'activos', count(*) filter (where activo and (vence_el is null or vence_el >= v_hoy)),
      'por_vencer', count(*) filter (where activo and vence_el between v_hoy and v_hoy + 15),
      'vencidos', count(*) filter (where activo and vence_el < v_hoy),
      'suspendidos', count(*) filter (where not activo)
    ) from clientes),
    'usuarios_activos', (select count(distinct usuario_id) from periodo),
    'consultas', (select count(*) from busquedas),
    'fichas', (select count(*) from periodo where tipo = 'empresa'),
    'resultados', (select coalesce(sum(resultados), 0) from periodo),
    'por_dia', (
      select jsonb_agg(jsonb_build_object('dia', d.dia, 'consultas', (select count(*) from busquedas b where b.dia = d.dia)) order by d.dia)
      from (select generate_series(v_desde, v_hoy, interval '1 day')::date as dia) d
    ),
    'busquedas', coalesce((select jsonb_agg(s) from (
      select texto as q, count(*) as veces, count(distinct usuario_id) as usuarios
      from textos group by 1 order by veces desc, q limit 10
    ) s), '[]'),
    'sin_resultados', coalesce((select jsonb_agg(s) from (
      select texto as q, count(*) as veces
      from textos where resultados = 0 group by 1 order by veces desc, q limit 6
    ) s), '[]'),
    'estados', coalesce((select jsonb_agg(s) from (
      select filtros ->> 'estado' as estado, count(*) as veces
      from busquedas where filtros ->> 'estado' is not null group by 1 order by veces desc, estado limit 8
    ) s), '[]'),
    'areas', coalesce((select jsonb_agg(s) from (
      select filtros ->> 'area' as area, count(*) as veces
      from busquedas where filtros ->> 'area' is not null group by 1 order by veces desc, area limit 8
    ) s), '[]'),
    'empresas', coalesce((select jsonb_agg(s) from (
      select e.id, e.nombre, count(*) as veces
      from periodo c
      join public.empresas e on e.id = (c.filtros ->> 'empresa_id')::bigint
      where c.tipo = 'empresa'
      group by e.id, e.nombre order by veces desc, e.nombre limit 8
    ) s), '[]'),
    'uso', coalesce((select jsonb_agg(s) from (
      select p.id, p.nombre, p.empresa,
        count(*) filter (where c.tipo in ('personas', 'empresas') and c.pag = 0) as consultas,
        coalesce(sum(c.resultados), 0) as resultados,
        max(c.creado_el) as ultima
      from public.perfiles p
      left join periodo c on c.usuario_id = p.id
      where p.rol = 'cliente'
      group by p.id, p.nombre, p.empresa
      order by resultados desc, p.nombre
    ) s), '[]'),
    'recientes', coalesce((select jsonb_agg(s) from (
      select c.id, c.tipo, c.filtros, c.resultados, c.creado_el, p.nombre, p.empresa,
        (select e.nombre from public.empresas e where e.id = (c.filtros ->> 'empresa_id')::bigint) as empresa_vista
      from periodo c
      join public.perfiles p on p.id = c.usuario_id
      where c.tipo = 'empresa' or c.pag = 0
      order by c.creado_el desc
      limit 25
    ) s), '[]')
  ) into v_salida;

  return v_salida;
end;
$$;

create or replace function public.demo_estado()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_perfil public.perfiles;
begin
  -- El reloj arranca la primera vez que la demo entra a la plataforma.
  update public.perfiles set demo_inicio = coalesce(demo_inicio, now())
  where id = auth.uid() and demo
  returning * into v_perfil;

  if v_perfil.id is null then
    raise exception 'solo_demo' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'restante', greatest(extract(epoch from v_perfil.demo_inicio + make_interval(mins => v_perfil.demo_minutos) - now()), 0)::integer,
    'usadas', (select count(*) from public.demo_desbloqueos d where d.usuario_id = auth.uid()),
    'limite', v_perfil.demo_empresas
  );
end;
$$;

create or replace function public.demo_desbloquear(p_empresa_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_limite integer;
begin
  perform public.exigir_cuenta();

  select demo_empresas into v_limite from public.perfiles where id = auth.uid() and demo for update;
  if v_limite is null then
    raise exception 'solo_demo' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.empresas where id = p_empresa_id) then
    raise exception 'empresa_no_encontrada' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.demo_desbloqueos where usuario_id = auth.uid() and empresa_id = p_empresa_id) then
    return;
  end if;
  if (select count(*) from public.demo_desbloqueos where usuario_id = auth.uid()) >= v_limite then
    raise exception 'demo_sin_empresas' using errcode = 'P0001';
  end if;

  insert into public.demo_desbloqueos (usuario_id, empresa_id) values (auth.uid(), p_empresa_id);
end;
$$;

create or replace function public.admin_marcar_demo(p_id uuid, p_minutos integer, p_empresas integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'solo_admin' using errcode = 'P0001';
  end if;
  if p_minutos is null or p_minutos < 1 or p_minutos > 1440 or p_empresas is null or p_empresas < 0 or p_empresas > 500 then
    raise exception 'datos_invalidos' using errcode = 'P0001';
  end if;

  update public.perfiles
  set demo = true, demo_minutos = p_minutos, demo_empresas = p_empresas, demo_inicio = null
  where id = p_id and rol = 'cliente';
end;
$$;

create or replace function public.admin_reiniciar_demo(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'solo_admin' using errcode = 'P0001';
  end if;

  update public.perfiles set demo_inicio = null where id = p_id and demo;
  delete from public.demo_desbloqueos where usuario_id = p_id;
end;
$$;

revoke execute on function
  public.empresa_bloqueada(bigint), public.demo_estado(), public.demo_desbloquear(bigint),
  public.admin_marcar_demo(uuid, integer, integer), public.admin_reiniciar_demo(uuid)
from public, anon, authenticated;

grant execute on function
  public.demo_estado(), public.demo_desbloquear(bigint),
  public.admin_marcar_demo(uuid, integer, integer), public.admin_reiniciar_demo(uuid)
to authenticated;
