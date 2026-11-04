import { BarChart3, BookUser, Building2, House, LogOut, Menu, Search, Star, UserRound, Users, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { modoDemo } from '../lib/api'
import { ProveedorFavoritos } from '../lib/favoritos'
import { usePerfil, useSesion } from '../lib/sesion'

function Navegacion({ alElegir }: { alElegir?: () => void }) {
  const perfil = usePerfil()
  const { salir } = useSesion()

  const enlace = ({ isActive }: { isActive: boolean }) =>
    `flex h-9 items-center gap-2.5 rounded-md px-2.5 transition-colors ${
      isActive ? 'bg-jade-500 font-semibold text-white' : 'text-[#dde5e1] hover:bg-obsidiana-2 hover:text-white'
    }`

  return (
    <div className="flex h-full flex-col">
      <nav aria-label="Principal" className="flex flex-col gap-0.5">
        {perfil.rol === 'admin' ? (
          <>
            <p className="mb-2 px-2.5 text-xs text-[#b9c6c0]">Administración</p>
            <NavLink to="/" end className={enlace} onClick={alElegir}>
              <BarChart3 size={16} strokeWidth={1.75} /> Analíticas
            </NavLink>
            <NavLink to="/clientes" className={enlace} onClick={alElegir}>
              <Users size={16} strokeWidth={1.75} /> Clientes
            </NavLink>
            <NavLink to="/empresas" className={enlace} onClick={alElegir}>
              <Building2 size={16} strokeWidth={1.75} /> Empresas
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/" end className={enlace} onClick={alElegir}>
              <House size={16} strokeWidth={1.75} /> Inicio
            </NavLink>
            <NavLink to="/directorio" className={enlace} onClick={alElegir}>
              <BookUser size={16} strokeWidth={1.75} /> Directorio
            </NavLink>
            <NavLink to="/favoritos" className={enlace} onClick={alElegir}>
              <Star size={16} strokeWidth={1.75} /> Favoritos
            </NavLink>
          </>
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5">
        <NavLink to="/cuenta" className={enlace} onClick={alElegir}>
          <UserRound size={16} strokeWidth={1.75} /> Mi cuenta
        </NavLink>
        <button type="button" onClick={salir} className={`${enlace({ isActive: false })} w-full cursor-pointer`}>
          <LogOut size={16} strokeWidth={1.75} /> Salir
        </button>
        <div className="mt-3 px-2.5">
          <p className="truncate font-medium text-white">{perfil.nombre}</p>
          <p className="truncate text-xs text-[#b9c6c0]">{perfil.empresa ?? perfil.correo}</p>
        </div>
      </div>
    </div>
  )
}

function Buscador() {
  const perfil = usePerfil()
  const destino = perfil.rol === 'admin' ? '/empresas' : '/directorio'
  const [parametros] = useSearchParams()
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const campo = useRef<HTMLInputElement>(null)
  const actual = parametros.get('q') ?? ''
  // Estado propio: la URL se actualiza con retraso y perdería letras al teclear rápido.
  const [valor, setValor] = useState(actual)

  useEffect(() => {
    if (document.activeElement !== campo.current) setValor(actual)
  }, [actual])

  // La tecla / lleva al buscador desde cualquier lugar.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const destino = e.target as HTMLElement
      if (e.key === '/' && campo.current?.offsetParent && !/INPUT|TEXTAREA|SELECT/.test(destino.tagName)) {
        e.preventDefault()
        campo.current?.focus()
      }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [])

  const cambiar = (texto: string) => {
    setValor(texto)
    const enDestino = pathname === destino
    const siguiente = new URLSearchParams(enDestino ? parametros : undefined)
    if (texto) siguiente.set('q', texto)
    else siguiente.delete('q')
    navegar({ pathname: destino, search: siguiente.toString() }, { replace: enDestino })
  }

  return (
    <form role="search" className="relative w-full max-w-[548px]" onSubmit={(e: FormEvent) => e.preventDefault()}>
      <Search size={14} className="absolute top-[9px] left-3 text-gris-2" aria-hidden />
      <input
        ref={campo}
        type="search"
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
        placeholder={perfil.rol === 'admin' ? 'Buscar empresa o contacto para revisar' : 'Buscar empresa, persona, puesto o correo'}
        aria-label="Buscar"
        className="h-8 w-full rounded-md border border-control bg-papel pr-8 pl-8 placeholder:text-gris-2 [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd className="absolute top-[6px] right-2 hidden rounded border border-control px-1.5 font-sans text-xs text-gris lg:block">/</kbd>
    </form>
  )
}

export function Marco() {
  const [menu, setMenu] = useState(false)

  return (
    <div className="flex h-dvh flex-col bg-obsidiana lg:grid lg:grid-cols-[228px_minmax(0,1fr)] lg:grid-rows-[48px_minmax(0,1fr)]">
      <div className="flex h-12 items-center px-3 lg:px-4">
        <button
          type="button"
          aria-label="Abrir menú"
          className="mr-2 grid size-11 cursor-pointer place-items-center text-white lg:hidden"
          onClick={() => setMenu(true)}
        >
          <Menu size={20} />
        </button>
        <img src="/nexomx-logo-oscuro.svg" alt="NexoMx" className="h-6" />
      </div>

      <header className="hidden h-12 items-center justify-center gap-4 pr-4 lg:flex">
        <Buscador />
        {modoDemo && <span className="pastilla bg-aviso-bg text-aviso-tinta">Datos ficticios</span>}
      </header>

      <aside className="hidden min-h-0 px-2 pt-2 pb-4 lg:block">
        <Navegacion />
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto bg-papel lg:mr-2 lg:mb-2 lg:rounded-2xl">
        <div className="px-4 pt-3 pb-3 md:px-6 lg:hidden">
          <Buscador />
        </div>
        <ProveedorFavoritos>
          <Outlet />
        </ProveedorFavoritos>
      </main>

      {menu && (
        <div className="fixed inset-0 z-20 flex flex-col bg-obsidiana p-3 lg:hidden">
          <div className="mb-4 flex h-11 items-center justify-between">
            <img src="/nexomx-logo-oscuro.svg" alt="NexoMx" className="h-6" />
            <button
              type="button"
              aria-label="Cerrar menú"
              className="grid size-11 cursor-pointer place-items-center text-white"
              onClick={() => setMenu(false)}
            >
              <X size={20} />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <Navegacion alElegir={() => setMenu(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
