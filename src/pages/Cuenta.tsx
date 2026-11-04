import { LogOut } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { fecha, n, textoVencimiento } from '../lib/formato'
import { usePerfil, useSesion } from '../lib/sesion'

export function Cuenta() {
  const { api, salir } = useSesion()
  const perfil = usePerfil()
  const [uso, setUso] = useState<number | null>(null)
  const [prueba, setPrueba] = useState<{ usadas: number; limite: number } | null>(null)
  const [clave, setClave] = useState('')
  const [repetida, setRepetida] = useState('')
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)

  useEffect(() => {
    api.usoHoy().then(setUso).catch(() => setUso(null))
    if (perfil.demo) api.demoEstado().then(setPrueba).catch(() => setPrueba(null))
  }, [api, perfil.demo])

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (clave !== repetida) {
      setMensaje({ ok: false, texto: 'Las contraseñas no coinciden.' })
      return
    }
    try {
      await api.cambiarClave(clave)
      setClave('')
      setRepetida('')
      setMensaje({ ok: true, texto: 'Contraseña actualizada.' })
    } catch (fallo) {
      setMensaje({ ok: false, texto: (fallo as Error).message })
    }
  }

  const esCliente = perfil.rol === 'cliente'
  const razon = uso !== null && perfil.limite_diario ? Math.min(uso / perfil.limite_diario, 1) : 0

  return (
    <div className="px-4 pt-4 pb-8 md:px-6 md:pt-5">
      <h1 className="text-[22px] leading-7 font-semibold">Mi cuenta</h1>

      {perfil.demo && (
        <div className="mt-4 rounded-xl border border-linea p-4">
          <p className="text-gris">Consultas de prueba</p>
          <p className="num mt-1 text-[28px] leading-9">
            {prueba ? n(prueba.usadas) : '—'}
            <span className="text-sm text-gris-2"> /{n(perfil.limite_consultas)}</span>
          </p>
          <p className="mt-2">Para ver todos los resultados, correos y teléfonos completos, escríbele a tu asesor de NexoMx.</p>
        </div>
      )}

      {esCliente && !perfil.demo && (
        <div className="mt-4 grid rounded-lg border border-linea sm:grid-cols-2">
          <div className="p-4">
            <p className="text-gris">Resultados hoy</p>
            <p className="num mt-1 text-[28px] leading-9">
              {uso === null ? '—' : n(uso)}
              <span className="text-sm text-gris-2"> /{n(perfil.limite_diario)}</span>
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-cantera">
              <div className="h-full rounded-full bg-jade-500" style={{ width: `${razon * 100}%` }} />
            </div>
            <p className="mt-2 text-xs text-gris-2">Se renueva a medianoche, hora del centro de México</p>
          </div>
          <div className="border-t border-linea p-4 sm:border-t-0 sm:border-l">
            <p className="text-gris">Acceso hasta</p>
            <p className="num mt-1 text-[28px] leading-9">{perfil.vence_el ? fecha(perfil.vence_el) : 'Sin vencimiento'}</p>
            {perfil.vence_el && <p className="mt-2 text-xs text-gris-2">{textoVencimiento(perfil.vence_el)}</p>}
          </div>
        </div>
      )}

      {!perfil.demo && <section className="mt-8 grid gap-4 md:grid-cols-[320px_minmax(0,1fr)] md:gap-8">
        <div>
          <h2 className="text-base font-medium">Tus datos</h2>
          <p className="mt-1 text-gris">Para cambiarlos, escríbele a tu asesor.</p>
        </div>
        <dl className="rounded-lg bg-tenue p-4">
          <dt className="text-xs text-gris-2">Nombre</dt>
          <dd>{perfil.nombre}</dd>
          <dt className="mt-3 text-xs text-gris-2">Correo</dt>
          <dd className="break-all">{perfil.correo}</dd>
          {perfil.empresa && (
            <>
              <dt className="mt-3 text-xs text-gris-2">Empresa</dt>
              <dd>{perfil.empresa}</dd>
            </>
          )}
        </dl>
      </section>}

      {!perfil.demo && <section className="mt-8 grid gap-4 md:grid-cols-[320px_minmax(0,1fr)] md:gap-8">
        <div>
          <h2 className="text-base font-medium">Contraseña</h2>
          <p className="mt-1 text-gris">Cámbiala por una que solo tú conozcas.</p>
        </div>
        <form onSubmit={guardar} className="flex flex-col gap-4 rounded-lg bg-tenue p-4">
          <div>
            <label className="etiqueta" htmlFor="clave-nueva">Contraseña nueva</label>
            <input
              id="clave-nueva" type="password" required minLength={10} autoComplete="new-password"
              aria-describedby="regla-clave" className="campo"
              value={clave} onChange={(e) => setClave(e.target.value)}
            />
            <p id="regla-clave" className="mt-1.5 text-xs text-gris-2">Mínimo 10 caracteres.</p>
          </div>
          <div>
            <label className="etiqueta" htmlFor="clave-repetida">Repítela</label>
            <input
              id="clave-repetida" type="password" required autoComplete="new-password" className="campo"
              value={repetida} onChange={(e) => setRepetida(e.target.value)}
            />
          </div>
          {mensaje && (
            <p role="status" className={mensaje.ok ? 'text-jade-500' : 'text-alerta'}>{mensaje.texto}</p>
          )}
          <button type="submit" className="boton boton-primario self-end">Guardar contraseña</button>
        </form>
      </section>}

      <button type="button" onClick={salir} className="boton mt-8 w-full lg:hidden">
        <LogOut size={16} aria-hidden /> Salir
      </button>
    </div>
  )
}
