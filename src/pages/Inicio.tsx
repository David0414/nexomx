import {
  ArrowRight, BadgeCheck, Building2, Handshake, Search, ShoppingCart, Star, Truck, Users, Wallet, Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorBloque } from '../components/Comunes'
import { FichaEmpresa, RejillaCarga, TarjetaEmpresa } from '../components/Empresa'
import { LeyendaMapa, MapaEstados } from '../components/MapaEstados'
import { useFavoritos } from '../lib/favoritos'
import { n } from '../lib/formato'
import { useSesion, usePerfil } from '../lib/sesion'
import { GIROS } from '../lib/types'
import type { Area, Conteos, EmpresaFila, EmpresaResumen, Filtros } from '../lib/types'

const SIN_FILTROS: Filtros = { q: '', estado: null, area: null, giro: null, conCorreo: false, conTelefono: false }

const ACCESOS: { id: Area; nombre: string; icono: LucideIcon }[] = [
  { id: 'compras', nombre: 'Compras', icono: ShoppingCart },
  { id: 'direccion', nombre: 'Dirección y planta', icono: Building2 },
  { id: 'ingenieria', nombre: 'Ingeniería', icono: Wrench },
  { id: 'calidad', nombre: 'Calidad', icono: BadgeCheck },
  { id: 'logistica', nombre: 'Logística', icono: Truck },
  { id: 'ventas', nombre: 'Ventas', icono: Handshake },
  { id: 'rh', nombre: 'Recursos humanos', icono: Users },
  { id: 'finanzas', nombre: 'Finanzas', icono: Wallet },
]

function Encabezado({ titulo, enlace, texto }: { titulo: string; enlace?: string; texto?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-base font-semibold">{titulo}</h2>
      {enlace && (
        <Link to={enlace} className="inline-flex flex-none items-center gap-1 font-medium text-jade-500 hover:underline">
          {texto} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  )
}

export function Inicio() {
  const { api } = useSesion()
  const perfil = usePerfil()
  const { version } = useFavoritos()
  const navegar = useNavigate()
  const [conteos, setConteos] = useState<Conteos | null>(null)
  const [destacadas, setDestacadas] = useState<EmpresaResumen[] | null>(null)
  const [favoritas, setFavoritas] = useState<EmpresaFila[] | null>(null)
  const [error, setError] = useState('')
  const [abierta, setAbierta] = useState<number | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    setError('')
    Promise.all([api.conteos(SIN_FILTROS), api.destacadas()])
      .then(([nuevos, empresas]) => {
        setConteos(nuevos)
        setDestacadas(empresas)
      })
      .catch((e: Error) => setError(e.message))
  }, [api, recarga])

  useEffect(() => {
    api.favoritos().then(setFavoritas).catch(() => setFavoritas([]))
  }, [api, version])

  const irEstado = (estado: string | null) => {
    if (estado) navegar(`/directorio?estado=${encodeURIComponent(estado)}`)
  }

  const primerNombre = perfil.nombre.split(' ')[0]

  return (
    <div className="px-4 pt-1 pb-8 md:px-6 md:pt-5">
      <div className="mb-5">
        <h1 className="text-[22px] leading-7 font-semibold">Hola, {primerNombre}</h1>
        <p className="mt-0.5 min-h-5 text-gris">
          {conteos && `${n(conteos.empresas)} empresas y ${n(conteos.personas)} personas para contactar`}
        </p>
      </div>

      {error && <div className="mb-4"><ErrorBloque mensaje={error} alReintentar={() => setRecarga((r) => r + 1)} /></div>}

      <div className="flex flex-col gap-7 xl:grid xl:grid-cols-[minmax(0,1fr)_384px] xl:gap-6">
        <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-7">
          <section className="order-1 xl:order-none">
            <Encabezado titulo="¿A quién quieres contactar?" enlace="/directorio" texto="Ver todos" />
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {ACCESOS.map(({ id, nombre, icono: Icono }) => (
                <li key={id}>
                  <Link
                    to={`/directorio?area=${id}`}
                    className="flex h-full flex-col gap-2 rounded-lg border border-linea p-3.5 transition-colors hover:border-jade-500 hover:bg-jade-50"
                  >
                    <Icono size={22} strokeWidth={1.75} className="text-jade-500" aria-hidden />
                    <span className="font-semibold">{nombre}</span>
                    <span className="num text-[13px] text-gris">
                      {conteos ? `${n(conteos.areas[id] ?? 0)} personas` : ' '}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="order-3 xl:order-none">
            <Encabezado titulo="¿De qué giro?" />
            <ul className="flex flex-wrap gap-2">
              {GIROS.filter((g) => g.id !== 'sin_clasificar' && (conteos?.giros[g.id] ?? 0) > 0)
                .sort((a, b) => (conteos?.giros[b.id] ?? 0) - (conteos?.giros[a.id] ?? 0))
                .map((g) => (
                  <li key={g.id}>
                    <Link to={`/directorio?vista=empresas&giro=${g.id}`} className="filtro hover:border-jade-500">
                      {g.nombre} <span className="num text-gris">{n(conteos?.giros[g.id] ?? 0)}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>

          <section className="order-3 xl:order-none">
            <Encabezado titulo="Tus favoritos" enlace={favoritas?.length ? '/favoritos' : undefined} texto="Ver todos" />
            {favoritas?.length === 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-control px-4 py-3">
                <Star size={18} className="flex-none text-cempasuchil" aria-hidden />
                <p>Toca la estrella de cualquier empresa para tenerla siempre a la mano.</p>
              </div>
            )}
            {!!favoritas?.length && (
              <div className="grid gap-3 md:grid-cols-2">
                {favoritas.slice(0, 4).map((e) => <TarjetaEmpresa key={e.id} empresa={e} alAbrir={setAbierta} />)}
              </div>
            )}
          </section>

          <section className="order-4 xl:order-none">
            <Encabezado titulo="Empresas con más contactos" enlace="/directorio?vista=empresas" texto="Ver empresas" />
            <div className="grid gap-3 md:grid-cols-2">
              {destacadas
                ? destacadas.slice(0, 6).map((e) => <TarjetaEmpresa key={e.id} empresa={e} alAbrir={setAbierta} />)
                : <RejillaCarga cuantas={6} />}
            </div>
          </section>
        </div>

        <aside className="order-2 xl:sticky xl:top-5 xl:order-none xl:self-start">
          <section className="rounded-lg border border-linea p-4">
            <h2 className="mb-1 text-base font-semibold">¿En qué estado?</h2>
            <p className="mb-3 text-gris">Toca un estado para ver sus empresas.</p>
            <MapaEstados conteos={conteos?.estados_empresas ?? {}} alElegir={irEstado} unidad="empresas" />
            <LeyendaMapa sinEstado={conteos?.estados_empresas['Sin estado'] ?? 0} seleccionado={null} alElegir={irEstado} />
          </section>
          <Link to="/directorio" className="boton boton-primario mt-4 h-10 w-full">
            <Search size={16} /> Buscar en todo el directorio
          </Link>
        </aside>
      </div>

      {abierta !== null && <FichaEmpresa id={abierta} alCerrar={() => setAbierta(null)} />}
    </div>
  )
}
