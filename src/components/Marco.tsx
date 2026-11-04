import { BarChart3, BookUser, Building2, House, LogOut, Search, Star, UserRound, Users, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { modoDemo } from '../lib/api'
import { ProveedorFavoritos } from '../lib/favoritos'
import { usePerfil, useSesion } from '../lib/sesion'

interface Destino {
  to: string
  nombre: string
  corto: string
  icono: LucideIcon
}

function useDestinos(): Destino[] {
  const perfil = usePerfil()
  if (perfil.rol === 'admin') {
    return [
      { to: '/', nombre: 'Analíticas', corto: 'Analíticas', icono: BarChart3 },
      { to: '/clientes', nombre: 'Clientes', corto: 'Clientes', icono: Users },
      { to: '/empresas', nombre: 'Empresas', corto: 'Empresas', icono: Building2 },
    ]
  }
  return [
    { to: '/', nombre: 'Inicio', corto: 'Inicio', icono: House },
    { to: '/directorio', nombre: 'Directorio', corto: 'Directorio', icono: BookUser },
    ...(perfil.demo ? [] : [{ to: '/favoritos', nombre: 'Favoritos', corto: 'Favoritos', icono: Star }]),
  ]
}

function Navegacion() {
  const perfil = usePerfil()
  const { salir } = useSesion()
  const destinos = useDestinos()

  const enlace = ({ isActive }: { isActive: boolean }) =>
    `flex h-9 items-center gap-2.5 rounded-md px-2.5 transition-colors ${
      isActive ? 'bg-jade-500 font-semibold text-white' : 'text-[#dde5e1] hover:bg-obsidiana-2 hover:text-white'
    }`

  return (
    <div className="flex h-full flex-col">
      <nav aria-label="Principal" className="flex flex-col gap-0.5">
        {perfil.rol === 'admin' && <p className="mb-2 px-2.5 text-xs text-[#b9c6c0]">Administración</p>}
        {destinos.map(({ to, nombre, icono: Icono }) => (
          <NavLink key={to} to={to} end={to === '/'} className={enlace}>
            <Icono size={16} strokeWidth={1.75} /> {nombre}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5">
        <NavLink to="/cuenta" className={enlace}>
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

function BarraInferior() {
  const destinos = useDestinos()
  const todos: Destino[] = [...destinos, { to: '/cuenta', nombre: 'Mi cuenta', corto: 'Cuenta', icono: UserRound }]

  return (
    <nav
      aria-label="Principal"
      className="grid flex-none border-t border-linea bg-papel pb-[env(safe-area-inset-bottom)] lg:hidden"
      style={{ gridTemplateColumns: `repeat(${todos.length}, minmax(0, 1fr))` }}
    >
      {todos.map(({ to, nombre, corto, icono: Icono }) => (
        <NavLink key={to} to={to} end={to === '/'} aria-label={nombre} className="group flex h-[60px] flex-col items-center justify-center gap-0.5">
          {({ isActive }) => (
            <>
              <span className={`grid h-7 w-14 place-items-center rounded-full transition-colors ${isActive ? 'bg-jade-500 text-white' : 'text-gris group-active:bg-cantera'}`}>
                <Icono size={20} strokeWidth={isActive ? 2.1 : 1.75} aria-hidden />
              </span>
              <span className={`text-[11px] leading-4 ${isActive ? 'font-semibold text-jade-700' : 'text-gris'}`}>{corto}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function Buscador({ grande }: { grande?: boolean }) {
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
      const elemento = e.target as HTMLElement
      if (e.key === '/' && campo.current?.offsetParent && !/INPUT|TEXTAREA|SELECT/.test(elemento.tagName)) {
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

  const texto = perfil.rol === 'admin' ? 'Buscar empresa o contacto para revisar' : 'Buscar empresa, persona, puesto o correo'

  return (
    <form role="search" className="relative w-full max-w-[548px]" onSubmit={(e: FormEvent) => e.preventDefault()}>
      <Search size={grande ? 18 : 14} className={`absolute text-gris ${grande ? 'top-[13px] left-3.5' : 'top-[9px] left-3'}`} aria-hidden />
      <input
        ref={campo}
        type="search"
        enterKeyHint="search"
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
        placeholder={grande && perfil.rol !== 'admin' ? 'Empresa, persona o puesto' : texto}
        aria-label="Buscar"
        className={`w-full border border-control bg-papel placeholder:text-gris-2 [&::-webkit-search-cancel-button]:hidden ${
          grande ? 'h-11 rounded-[10px] pr-3 pl-10 text-base' : 'h-8 rounded-md pr-8 pl-8'
        }`}
      />
      {!grande && <kbd className="absolute top-[6px] right-2 rounded border border-control px-1.5 font-sans text-xs text-gris">/</kbd>}
    </form>
  )
}

function AvisoPrueba() {
  const { api } = useSesion()
  const [estado, setEstado] = useState<{ usadas: number; limite: number } | null>(null)

  const refrescar = useCallback(() => {
    api.demoEstado().then(setEstado).catch(() => setEstado(null))
  }, [api])

  useEffect(() => {
    refrescar()
    window.addEventListener('nexo:consulta', refrescar)
    return () => window.removeEventListener('nexo:consulta', refrescar)
  }, [refrescar])

  if (!estado) return null
  const quedan = Math.max(estado.limite - estado.usadas, 0)

  return (
    <div role="status" className={`px-4 py-2 text-[13px] leading-5 font-medium md:px-6 ${quedan ? 'bg-jade-50 text-jade-700' : 'bg-aviso-bg text-aviso-tinta'}`}>
      {quedan
        ? <>Cuenta de prueba: te {quedan === 1 ? 'queda 1 consulta' : `quedan ${quedan} consultas`} de {estado.limite}.</>
        : 'Terminaste tus consultas de prueba. Escríbele a tu asesor de NexoMx para activar tu cuenta.'}
    </div>
  )
}

export function Marco() {
  const perfil = usePerfil()
  const { pathname } = useLocation()
  const principal = useRef<HTMLElement>(null)
  const inicial = perfil.nombre.trim()[0]?.toUpperCase()
  const conBusqueda = perfil.rol === 'admin' ? pathname === '/empresas' : pathname === '/' || pathname === '/directorio'

  useEffect(() => {
    principal.current?.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex h-dvh flex-col bg-obsidiana lg:grid lg:grid-cols-[228px_minmax(0,1fr)] lg:grid-rows-[48px_minmax(0,1fr)]">
      <div className="flex flex-none items-center justify-between px-4 pt-[env(safe-area-inset-top)] lg:h-12">
        <img src="/nexomx-logo-oscuro.svg" alt="NexoMx" className="h-6" />
        <Link to="/cuenta" aria-label="Mi cuenta" className="-mr-1 grid size-11 place-items-center lg:hidden">
          <span className="grid size-8 place-items-center rounded-full bg-jade-500 text-[13px] font-semibold text-white">{inicial}</span>
        </Link>
      </div>

      <header className="hidden h-12 items-center justify-center gap-4 pr-4 lg:flex">
        <Buscador />
        {modoDemo && <span className="pastilla bg-aviso-bg text-aviso-tinta">Datos ficticios</span>}
      </header>

      <aside className="hidden min-h-0 px-2 pt-2 pb-4 lg:block">
        <Navegacion />
      </aside>

      {conBusqueda && (
        <div className="flex-none px-4 pb-3 lg:hidden">
          <Buscador grande />
        </div>
      )}

      <main ref={principal} className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-t-[18px] bg-papel lg:mr-2 lg:mb-2 lg:rounded-2xl">
        {perfil.demo && <AvisoPrueba />}
        <ProveedorFavoritos>
          <Outlet />
        </ProveedorFavoritos>
      </main>

      <BarraInferior />
    </div>
  )
}
