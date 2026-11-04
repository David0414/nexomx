-- Panel del administrador: control de empresas y analíticas.
-- Las analíticas cuentan solo clientes: tus propias revisiones no las inflan.

drop function if exists public.admin_actividad();

create or replace function public.admin_empresas(
  q text default '', p_estado text default null, p_filtro text default 'todas', pagina integer default 0
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
      'sin_estado', count(*) filter (where estado = 'Sin estado')
    ) from base),
    (select count(*) from filtrada),
    coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'nombre', p.nombre, 'estado', p.estado, 'ubicacion', p.ubicacion, 'telefono', p.telefono,
      'web', p.web, 'enlace_origen', p.enlace_origen, 'num_contactos', p.num_contactos, 'con_correo', p.con_correo
    ) order by p.nombre, p.id) from pagina_actual p), '[]')
  into v_conteos, v_total, v_filas;

  return jsonb_build_object('total', v_total, 'filas', v_filas, 'conteos', v_conteos);
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
    select activo, vence_el from public.perfiles where rol = 'cliente'
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

revoke execute on function
  public.admin_empresas(text, text, text, integer), public.admin_analitica(integer)
from public, anon, authenticated;

grant execute on function
  public.admin_empresas(text, text, text, integer), public.admin_analitica(integer)
to authenticated;
