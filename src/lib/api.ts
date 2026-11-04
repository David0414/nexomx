import { createClient } from '@supabase/supabase-js'
import type { Api, Filtros, Perfil } from './types'

export const TAM_PAGINA = 25

const MENSAJES: Record<string, string> = {
  cuenta_inactiva: 'Tu cuenta está suspendida. Escríbele a tu asesor de NexoMx.',
  cuenta_vencida: 'Tu acceso venció. Escríbele a tu asesor de NexoMx para renovarlo.',
  limite_diario: 'Llegaste a tu límite de hoy. Se renueva a medianoche.',
  solo_admin: 'Esta sección es solo para administradores.',
  correo_duplicado: 'Ya existe una cuenta con ese correo.',
  datos_invalidos: 'Revisa los datos: el correo y el nombre son obligatorios.',
  credenciales: 'El correo o la contraseña no coinciden.',
  sin_perfil: 'Esta cuenta no tiene acceso a NexoMx.',
  empresa_no_encontrada: 'Esa empresa ya no está en el directorio.',
  limite_favoritos: 'Llegaste a 200 favoritos. Quita alguno para guardar otro.',
  demo_agotada: 'Terminaste tus consultas de prueba. Escríbele a tu asesor de NexoMx para activar tu cuenta.',
  demo_pagina: 'La cuenta de prueba muestra solo los primeros resultados.',
  demo_favoritos: 'Los favoritos se activan con tu cuenta.',
  nombre_requerido: 'Escribe el nombre de la empresa.',
  contacto_incompleto: 'Escribe al menos el nombre o el correo de la persona.',
  correo_invalido: 'Revisa el correo: parece incompleto.',
  contacto_duplicado: 'Esa persona ya está registrada en esta empresa.',
  contacto_no_encontrado: 'Esa persona ya no está en el directorio.',
}

export class ErrorApp extends Error {
  constructor(public codigo: string) {
    super(MENSAJES[codigo] ?? 'No se pudo completar. Intenta de nuevo.')
  }
}

function crearApiSupabase(url: string, anon: string): Api {
  const supabase = createClient(url, anon)

  const rpc = async <T,>(nombre: string, parametros?: Record<string, unknown>) => {
    const { data, error } = await supabase.rpc(nombre, parametros)
    if (error) throw new ErrorApp(error.message)
    return data as T
  }

  const admin = async <T,>(cuerpo: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('admin-clientes', { body: cuerpo })
    if (error) {
      const detalle = await (error as { context?: Response }).context?.json?.().catch(() => null)
      throw new ErrorApp(detalle?.error ?? 'desconocido')
    }
    return data as T
  }

  const parametros = (f: Filtros) => ({
    q: f.q, p_estado: f.estado, p_area: f.area, p_giro: f.giro, con_correo: f.conCorreo, con_telefono: f.conTelefono,
  })

  const perfilDe = async (id: string) => {
    const { data } = await supabase
      .from('perfiles')
      .select('id, nombre, empresa, correo, rol, activo, vence_el, limite_diario, demo, ocultar_contacto, limite_consultas')
      .eq('id', id)
      .maybeSingle()
    return data as Perfil | null
  }

  return {
    async sesion() {
      const { data } = await supabase.auth.getSession()
      return data.session ? perfilDe(data.session.user.id) : null
    },
    async entrar(correo, clave) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: correo, password: clave })
      if (error || !data.user) throw new ErrorApp('credenciales')
      const perfil = await perfilDe(data.user.id)
      if (!perfil) {
        await supabase.auth.signOut()
        throw new ErrorApp('sin_perfil')
      }
      return perfil
    },
    async salir() {
      await supabase.auth.signOut()
    },
    async cambiarClave(nueva) {
      const { error } = await supabase.auth.updateUser({ password: nueva })
      if (error) throw new ErrorApp('desconocido')
    },
    contactos: (f, pagina) => rpc('buscar_contactos', { ...parametros(f), pagina }),
    empresas: (f, pagina) => rpc('buscar_empresas', { ...parametros(f), pagina }),
    conteos: (f) => rpc('conteos', parametros(f)),
    detalle: (id) => rpc('detalle_empresa', { p_id: id }),
    usoHoy: () => rpc('uso_hoy'),
    demoEstado: () => rpc('demo_estado'),
    ajustarDemo: (limite, ocultar) => rpc('admin_demo', { p_limite: limite, p_ocultar: ocultar }),
    favoritos: () => rpc('mis_favoritos'),
    alternarFavorito: (id) => rpc('alternar_favorito', { p_empresa_id: id }),
    destacadas: () => rpc('empresas_destacadas'),
    clientes: () => rpc('admin_clientes'),
    analitica: (dias) => rpc('admin_analitica', { p_dias: dias }),
    adminEmpresas: (q, estado, giro, filtro, pagina) => rpc('admin_empresas', { q, p_estado: estado, p_giro: giro, p_filtro: filtro, pagina }),
    girosConsultados: (dias) => rpc('admin_giros_consultados', { p_dias: dias }),
    guardarEmpresa: (d) => rpc('admin_guardar_empresa', {
      p_id: d.id, p_nombre: d.nombre, p_web: d.web, p_estado: d.estado, p_giro: d.giro, p_ubicacion: d.ubicacion, p_telefono: d.telefono,
    }),
    borrarEmpresa: (id) => rpc('admin_borrar_empresa', { p_id: id }),
    guardarContacto: (d) => rpc('admin_guardar_contacto', {
      p_id: d.id, p_empresa_id: d.empresa_id, p_nombre: d.nombre, p_puesto: d.puesto, p_area: d.area, p_correo: d.correo, p_telefono: d.telefono,
    }),
    borrarContacto: (id) => rpc('admin_borrar_contacto', { p_id: id }),
    crearCliente: (datos) => admin({ accion: 'crear', ...datos }),
    nuevaClave: (id) => admin({ accion: 'nueva_clave', id }),
    actualizarCliente: async (id, cambios) => {
      await admin({ accion: 'actualizar', id, ...cambios })
    },
  }
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const modoDemo = import.meta.env.DEV && !(url && anon)

// La demostración solo existe en desarrollo: nunca entra al sitio publicado.
export const cargarApi = async (): Promise<Api> => {
  if (import.meta.env.DEV && !(url && anon)) return (await import('./demo')).apiDemo
  if (!url || !anon) throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  return crearApiSupabase(url, anon)
}
