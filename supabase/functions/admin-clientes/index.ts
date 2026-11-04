// Acciones que requieren la clave de servicio: crear cuentas, generar contraseñas
// y suspender accesos. La clave vive solo aquí, nunca en el navegador.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ORIGEN_PERMITIDO') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Sin caracteres que se confundan al dictarlos o copiarlos: 0/O, 1/l/I.
const ALFABETO = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generarClave(largo = 14): string {
  const limite = 256 - (256 % ALFABETO.length)
  let clave = ''
  while (clave.length < largo) {
    for (const byte of crypto.getRandomValues(new Uint8Array(largo * 2))) {
      if (byte < limite && clave.length < largo) clave += ALFABETO[byte % ALFABETO.length]
    }
  }
  return clave
}

const fechaValida = (valor: unknown): valor is string | null =>
  valor === null || (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor))

const limiteValido = (valor: unknown): valor is number =>
  Number.isInteger(valor) && (valor as number) >= 0 && (valor as number) <= 100000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return responder({ error: 'metodo_no_permitido' }, 405)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return responder({ error: 'sin_sesion' }, 401)

  const { data: sesion, error: errorSesion } = await supabase.auth.getUser(token)
  if (errorSesion || !sesion.user) return responder({ error: 'sin_sesion' }, 401)

  const { data: solicitante } = await supabase
    .from('perfiles').select('rol, activo').eq('id', sesion.user.id).single()
  if (solicitante?.rol !== 'admin' || !solicitante.activo) return responder({ error: 'solo_admin' }, 403)

  let cuerpo: Record<string, unknown>
  try {
    cuerpo = await req.json()
  } catch {
    return responder({ error: 'solicitud_invalida' }, 400)
  }

  if (cuerpo.accion === 'crear') {
    const correo = String(cuerpo.correo ?? '').trim().toLowerCase()
    const nombre = String(cuerpo.nombre ?? '').trim()
    const empresa = String(cuerpo.empresa ?? '').trim() || null
    const venceEl = cuerpo.vence_el ?? null
    const limite = cuerpo.limite_diario ?? 1000

    if (!/^\S+@\S+\.\S+$/.test(correo) || !nombre || !fechaValida(venceEl) || !limiteValido(limite)) {
      return responder({ error: 'datos_invalidos' }, 400)
    }

    const clave = generarClave()
    const { data, error } = await supabase.auth.admin.createUser({ email: correo, password: clave, email_confirm: true })
    if (error || !data.user) {
      const duplicado = /already|registered/i.test(error?.message ?? '')
      return responder({ error: duplicado ? 'correo_duplicado' : 'no_se_pudo_crear' }, duplicado ? 409 : 500)
    }

    const { error: errorPerfil } = await supabase.from('perfiles').insert({
      id: data.user.id, correo, nombre, empresa, rol: 'cliente', vence_el: venceEl, limite_diario: limite,
    })
    if (errorPerfil) {
      await supabase.auth.admin.deleteUser(data.user.id)
      return responder({ error: 'no_se_pudo_crear' }, 500)
    }
    return responder({ id: data.user.id, correo, clave })
  }

  const id = String(cuerpo.id ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return responder({ error: 'datos_invalidos' }, 400)

  const { data: objetivo } = await supabase.from('perfiles').select('rol, correo').eq('id', id).single()
  if (!objetivo || objetivo.rol !== 'cliente') return responder({ error: 'cliente_no_encontrado' }, 404)

  if (cuerpo.accion === 'nueva_clave') {
    const clave = generarClave()
    const { error } = await supabase.auth.admin.updateUserById(id, { password: clave })
    if (error) return responder({ error: 'no_se_pudo_actualizar' }, 500)
    return responder({ id, correo: objetivo.correo, clave })
  }

  if (cuerpo.accion === 'actualizar') {
    const cambios: Record<string, unknown> = {}
    if ('activo' in cuerpo) {
      if (typeof cuerpo.activo !== 'boolean') return responder({ error: 'datos_invalidos' }, 400)
      cambios.activo = cuerpo.activo
    }
    if ('vence_el' in cuerpo) {
      if (!fechaValida(cuerpo.vence_el)) return responder({ error: 'datos_invalidos' }, 400)
      cambios.vence_el = cuerpo.vence_el
    }
    if ('limite_diario' in cuerpo) {
      if (!limiteValido(cuerpo.limite_diario)) return responder({ error: 'datos_invalidos' }, 400)
      cambios.limite_diario = cuerpo.limite_diario
    }

    const { error } = await supabase.from('perfiles').update(cambios).eq('id', id)
    if (error) return responder({ error: 'no_se_pudo_actualizar' }, 500)

    // Suspender también corta la renovación de la sesión abierta.
    if ('activo' in cambios) {
      await supabase.auth.admin.updateUserById(id, { ban_duration: cambios.activo ? 'none' : '876000h' })
    }
    return responder({ ok: true })
  }

  return responder({ error: 'accion_desconocida' }, 400)
})
