-- Cuenta de prueba compartida. Cada ingreso tiene su propio cupo de consultas y hay un
-- tope diario para toda la cuenta. Puede ocultar parte de correos y teléfonos.

alter table public.perfiles
  add column demo boolean not null default false,
  add column ocultar_contacto boolean not null default false,
  add column limite_consultas integer not null default 10 check (limite_consultas >= 0);

create unique index perfiles_una_demo_idx on public.perfiles (demo) where demo;

alter table public.consultas
  add column sesion text,
  add column clave_demo text;

create index consultas_demo_idx on public.consultas (sesion, creado_el) where clave_demo is not null;

create or replace function public.mascara_correo(correo text)
returns text language sql immutable parallel safe as $$
  select case when correo is null then null
    else left(split_part(correo, '@', 1), 2) || '***@' || split_part(correo, '@', 2) end
$$;

create or replace function public.mascara_telefono(telefono text)
returns text language sql immutable parallel safe as $$
  select case when telefono is null then null else left(telefono, 3) || ' *** ****' end
$$;

create or replace function public.ocultar_contacto()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.ocultar_contacto from public.perfiles p where p.id = auth.uid()), false)
$$;

create or replace function public.sesion_actual()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'session_id', auth.uid()::text)
$$;

create or replace function public.validar_y_registrar(p_tipo text, p_filtros jsonb, p_resultados integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_perfil public.perfiles;
  v_hoy    integer;
  v_inicio timestamptz := date_trunc('day', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City';
  v_sesion text := public.sesion_actual();
  v_clave  text;
  v_tope   constant integer := 300;
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

    if v_perfil.demo then
      if p_tipo <> 'empresa' and coalesce((p_filtros ->> 'pagina')::integer, 0) > 0 then
        raise exception 'demo_pagina' using errcode = 'P0001';
      end if;

      -- Abrir el directorio sin filtros y repetir una búsqueda no gastan consulta.
      if p_tipo = 'empresa' or coalesce(p_filtros ->> 'q', '') <> '' or p_filtros ->> 'estado' is not null
         or p_filtros ->> 'area' is not null or p_filtros ->> 'giro' is not null then
        v_clave := md5(p_tipo || (p_filtros - 'pagina')::text);

        if not exists (
          select 1 from public.consultas
          where usuario_id = auth.uid() and sesion = v_sesion and clave_demo = v_clave and creado_el >= v_inicio
        ) then
          if (select count(distinct clave_demo) from public.consultas
              where usuario_id = auth.uid() and sesion = v_sesion and creado_el >= v_inicio) >= v_perfil.limite_consultas
          or (select count(*) from public.consultas
              where usuario_id = auth.uid() and clave_demo is not null and creado_el >= v_inicio) >= v_tope then
            raise exception 'demo_agotada' using errcode = 'P0001';
          end if;
        end if;
      end if;
    else
      select coalesce(sum(resultados), 0) into v_hoy
      from public.consultas
      where usuario_id = auth.uid() and creado_el >= v_inicio;

      if v_hoy + p_resultados > v_perfil.limite_diario then
        raise exception 'limite_diario' using errcode = 'P0001';
      end if;
    end if;
  end if;

  insert into public.consultas (usuario_id, tipo, filtros, resultados, sesion, clave_demo)
  values (auth.uid(), p_tipo, p_filtros, p_resultados, v_sesion, v_clave);

  update public.perfiles set ultimo_acceso = now() where id = auth.uid();
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
  v_ocultar boolean := public.ocultar_contacto();
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
      'puesto', p.puesto, 'area', p.area, 'giro', p.giro, 'web', p.web,
      'correo', case when v_ocultar then public.mascara_correo(p.correo) else p.correo end,
      'telefono', case when v_ocultar then public.mascara_telefono(coalesce(p.telefono_directo, p.telefono_empresa)) else coalesce(p.telefono_directo, p.telefono_empresa) end,
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
  v_ocultar boolean := public.ocultar_contacto();
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
      'telefono', case when v_ocultar then public.mascara_telefono(p.telefono) else p.telefono end, 'web', p.web, 'giro', p.giro, 'num_contactos', p.num_contactos
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
  v_ocultar   boolean := public.ocultar_contacto();
begin
  select to_jsonb(s) into v_empresa
  from (select id, nombre, web, estado, giro, ubicacion,
    case when v_ocultar then public.mascara_telefono(telefono) else telefono end as telefono
  from public.empresas where id = p_id) s;
  if v_empresa is null then
    raise exception 'empresa_no_encontrada' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.nombre nulls last), '[]') into v_contactos
  from (
    select id, nombre, puesto, area,
      case when v_ocultar then public.mascara_correo(correo) else correo end as correo,
      case when v_ocultar then public.mascara_telefono(telefono_directo) else telefono_directo end as telefono_directo
    from public.contactos where empresa_id = p_id limit 100
  ) s;

  perform public.validar_y_registrar('empresa', jsonb_build_object('empresa_id', p_id), jsonb_array_length(v_contactos));

  return jsonb_build_object('empresa', v_empresa, 'contactos', v_contactos);
end;
$$;

create or replace function public.alternar_favorito(p_empresa_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_cuenta();

  -- Una cuenta compartida no debe mezclar los favoritos de quienes la prueban.
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
      p.demo, p.ocultar_contacto, p.limite_consultas,
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
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_limite integer;
  v_inicio timestamptz := date_trunc('day', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City';
begin
  select limite_consultas into v_limite from public.perfiles where id = auth.uid() and demo;
  if v_limite is null then
    raise exception 'solo_demo' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'limite', v_limite,
    'usadas', (select count(distinct clave_demo) from public.consultas
               where usuario_id = auth.uid() and sesion = public.sesion_actual() and creado_el >= v_inicio)
  );
end;
$$;

create or replace function public.admin_demo(p_limite integer, p_ocultar boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_admin() then
    raise exception 'solo_admin' using errcode = 'P0001';
  end if;
  if p_limite is null or p_limite < 0 or p_limite > 1000 then
    raise exception 'datos_invalidos' using errcode = 'P0001';
  end if;

  update public.perfiles set limite_consultas = p_limite, ocultar_contacto = p_ocultar where demo;
end;
$$;

revoke execute on function
  public.mascara_correo(text), public.mascara_telefono(text), public.ocultar_contacto(), public.sesion_actual(),
  public.demo_estado(), public.admin_demo(integer, boolean)
from public, anon, authenticated;

grant execute on function public.demo_estado(), public.admin_demo(integer, boolean) to authenticated;
