-- Edición manual del directorio. Lo que el administrador toca queda protegido:
-- volver a cargar el Excel no sobrescribe sus cambios ni revive lo que borró.

alter table public.empresas add column protegida boolean not null default false;

create table public.empresas_borradas (
  enlace_origen  text primary key,
  borrada_el     timestamptz not null default now()
);

alter table public.empresas_borradas enable row level security;
revoke all on public.empresas_borradas from anon, authenticated;

create or replace function public.limpio(texto text)
returns text language sql immutable parallel safe as $$
  select nullif(btrim(texto), '')
$$;

create or replace function public.admin_guardar_empresa(
  p_id bigint, p_nombre text, p_web text, p_estado text, p_ubicacion text, p_telefono text
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

  if p_id is null then
    insert into public.empresas (enlace_origen, nombre, web, estado, ubicacion, telefono, protegida)
    values (
      'manual:' || gen_random_uuid(), public.limpio(p_nombre), public.limpio(p_web),
      coalesce(public.limpio(p_estado), 'Sin estado'), public.limpio(p_ubicacion), public.limpio(p_telefono), true
    )
    returning id into v_id;
  else
    update public.empresas set
      nombre = public.limpio(p_nombre), web = public.limpio(p_web),
      estado = coalesce(public.limpio(p_estado), 'Sin estado'),
      ubicacion = public.limpio(p_ubicacion), telefono = public.limpio(p_telefono), protegida = true
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'empresa_no_encontrada' using errcode = 'P0001';
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.admin_borrar_empresa(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_enlace text;
begin
  if not public.es_admin() then
    raise exception 'solo_admin' using errcode = 'P0001';
  end if;

  delete from public.empresas where id = p_id returning enlace_origen into v_enlace;
  if v_enlace is null then
    raise exception 'empresa_no_encontrada' using errcode = 'P0001';
  end if;

  if v_enlace not like 'manual:%' then
    insert into public.empresas_borradas (enlace_origen) values (v_enlace)
    on conflict (enlace_origen) do nothing;
  end if;
end;
$$;

create or replace function public.admin_guardar_contacto(
  p_id bigint, p_empresa_id bigint, p_nombre text, p_puesto text, p_area text, p_correo text, p_telefono text
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_id     bigint;
  v_correo text := lower(public.limpio(p_correo));
begin
  if not public.es_admin() then
    raise exception 'solo_admin' using errcode = 'P0001';
  end if;
  if public.limpio(p_nombre) is null and v_correo is null then
    raise exception 'contacto_incompleto' using errcode = 'P0001';
  end if;
  if v_correo is not null and v_correo !~ '^\S+@\S+\.\S+$' then
    raise exception 'correo_invalido' using errcode = 'P0001';
  end if;
  if p_area not in ('compras', 'ventas', 'ingenieria', 'rh', 'logistica', 'direccion', 'calidad', 'finanzas', 'otro') then
    raise exception 'datos_invalidos' using errcode = 'P0001';
  end if;

  begin
    if p_id is null then
      insert into public.contactos (empresa_id, nombre, puesto, area, correo, telefono_directo)
      values (p_empresa_id, public.limpio(p_nombre), public.limpio(p_puesto), p_area, v_correo, public.limpio(p_telefono))
      returning id into v_id;
    else
      update public.contactos set
        nombre = public.limpio(p_nombre), puesto = public.limpio(p_puesto), area = p_area,
        correo = v_correo, telefono_directo = public.limpio(p_telefono)
      where id = p_id and empresa_id = p_empresa_id
      returning id into v_id;
    end if;
  exception
    when unique_violation then
      raise exception 'contacto_duplicado' using errcode = 'P0001';
    when foreign_key_violation then
      raise exception 'empresa_no_encontrada' using errcode = 'P0001';
  end;

  if v_id is null then
    raise exception 'contacto_no_encontrado' using errcode = 'P0001';
  end if;

  update public.empresas set protegida = true where id = p_empresa_id;
  return v_id;
end;
$$;

create or replace function public.admin_borrar_contacto(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_empresa bigint;
begin
  if not public.es_admin() then
    raise exception 'solo_admin' using errcode = 'P0001';
  end if;

  delete from public.contactos where id = p_id returning empresa_id into v_empresa;
  if v_empresa is null then
    raise exception 'contacto_no_encontrado' using errcode = 'P0001';
  end if;

  update public.empresas set protegida = true where id = v_empresa;
end;
$$;

revoke execute on function
  public.limpio(text),
  public.admin_guardar_empresa(bigint, text, text, text, text, text),
  public.admin_borrar_empresa(bigint),
  public.admin_guardar_contacto(bigint, bigint, text, text, text, text, text),
  public.admin_borrar_contacto(bigint)
from public, anon, authenticated;

grant execute on function
  public.admin_guardar_empresa(bigint, text, text, text, text, text),
  public.admin_borrar_empresa(bigint),
  public.admin_guardar_contacto(bigint, bigint, text, text, text, text, text),
  public.admin_borrar_contacto(bigint)
to authenticated;
