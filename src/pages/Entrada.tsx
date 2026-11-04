import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapaEstados } from '../components/MapaEstados'
import { modoDemo } from '../lib/api'
import { FORMA_ENTRADA } from '../lib/mexico'
import { useSesion } from '../lib/sesion'

export function Entrada() {
  const { entrar } = useSesion()
  const navegar = useNavigate()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await entrar(correo.trim(), clave)
      navegar('/', { replace: true })
    } catch (fallo) {
      setError((fallo as Error).message)
      setEnviando(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.15fr)_minmax(420px,1fr)]">
      <section className="flex flex-col bg-obsidiana px-6 py-6 text-white sm:px-10 sm:py-8 lg:px-14 lg:py-10">
        <img src="/nexomx-logo-oscuro.svg" alt="NexoMx" className="h-8 self-start" />
        <div className="flex flex-1 flex-col justify-center py-8 lg:py-10">
          <h1 className="max-w-[560px] text-[28px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[40px]">
            La industria de México, con nombre y teléfono.
          </h1>
          <p className="mt-4 max-w-[480px] text-base leading-6 text-jade-100">
            8,645 empresas y 7,308 contactos en 31 estados, de compras a dirección de planta.
          </p>
          <div className="mt-8 hidden w-full max-w-[560px] sm:block lg:mt-10">
            <MapaEstados conteos={FORMA_ENTRADA} oscuro />
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center bg-papel px-6 py-10">
        <form onSubmit={enviar} className="w-full max-w-[360px]">
          <h2 className="text-[22px] leading-7 font-semibold">Entra a tu cuenta</h2>
          <p className="mt-1 text-gris">Usa el correo y la contraseña que te entregó tu asesor.</p>

          <div className="mt-6">
            <label className="etiqueta" htmlFor="correo">Correo</label>
            <input
              id="correo" type="email" required autoComplete="username" className="campo"
              value={correo} onChange={(e) => setCorreo(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <label className="etiqueta" htmlFor="clave">Contraseña</label>
            <input
              id="clave" type="password" required autoComplete="current-password" className="campo"
              value={clave} onChange={(e) => setClave(e.target.value)}
            />
          </div>

          {error && <p role="alert" className="mt-4 rounded-md bg-alerta-bg px-3 py-2 text-alerta-tinta">{error}</p>}

          <button type="submit" disabled={enviando} className="boton boton-primario mt-5 h-10 w-full">
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>

          <p className="mt-6 text-gris">
            ¿Aún no tienes acceso o perdiste tu contraseña? Tu asesor de NexoMx te ayuda.
          </p>

          {modoDemo && (
            <p className="mt-6 rounded-md bg-aviso-bg px-3 py-2 text-xs text-aviso-tinta">
              Demostración: cualquier contraseña funciona. Un correo con «admin» abre el panel de administrador.
            </p>
          )}
        </form>
      </section>
    </div>
  )
}
