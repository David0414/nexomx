-- Favoritos e inicio. Máximo 200 favoritos por cuenta: guardar empresas no debe
-- servir para sacar el directorio sin pasar por el límite diario.

create table public.favoritos (
  usuario_id  uuid not null references public.perfiles (id) on delete cascade,
  empresa_id  bigint not null references public.empresas (id) on delete cascade,
  creado_el   timestamptz not null default now(),
  primary key (usuario_id, empresa_id)
);

create index favoritos_empresa_idx on public.favoritos (empresa_id);

alter table public.favoritos enable row level security;
revoke all on public.favoritos from anon, authenticated;

create or replace function public.exigir_cuenta()
returns void language plpgsql stable security definer set search_path = '' as $$
declare
  v_perfil public.perfiles;
begin
  select * into v_perfil from public.perfiles where id = auth.uid();
  if not found or not v_perfil.activo then
    raise exception 'cuenta_inactiva' using errcode = 'P0001';
  end if;
  if v_perfil.rol <> 'admin' and v_perfil.vence_el is not null
     and v_perfil.vence_el < (now() at time zone 'America/Mexico_City')::date then
    raise exception 'cuenta_vencida' using errcode = 'P0001';
  end if;
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
    select e.id, e.nombre, e.estado, e.ubicacion, e.telefono, e.web, f.creado_el,
      (select count(*) from public.contactos c where c.empresa_id = e.id) as num_contactos
    from public.favoritos f
    join public.empresas e on e.id = f.empresa_id
    where f.usuario_id = auth.uid()
  ) s;

  return v_filas;
end;
$$;

create or replace function public.alternar_favorito(p_empresa_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform public.exigir_cuenta();

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

-- Portada del inicio. No entrega teléfonos ni correos, por eso no descuenta del límite.
create or replace function public.empresas_destacadas()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_filas jsonb;
begin
  perform public.exigir_cuenta();

  select coalesce(jsonb_agg(to_jsonb(s) order by s.num_contactos desc, s.nombre), '[]') into v_filas
  from (
    select e.id, e.nombre, e.estado, e.web, count(c.id) as num_contactos
    from public.empresas e
    join public.contactos c on c.empresa_id = e.id
    group by e.id
    order by num_contactos desc, e.nombre
    limit 8
  ) s;

  return v_filas;
end;
$$;

revoke execute on function
  public.exigir_cuenta(), public.mis_favoritos(), public.alternar_favorito(bigint), public.empresas_destacadas()
from public, anon, authenticated;

grant execute on function
  public.mis_favoritos(), public.alternar_favorito(bigint), public.empresas_destacadas()
to authenticated;
