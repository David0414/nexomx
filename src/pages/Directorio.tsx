import { ChevronLeft, ChevronRight, Map as IconoMapa, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Copiar, ErrorBloque, Pestanas } from '../components/Comunes'
import { BotonFavorito, FichaEmpresa, LogoEmpresa, RejillaCarga, TarjetaEmpresa } from '../components/Empresa'
import { LeyendaMapa, MapaEstados } from '../components/MapaEstados'
import { ErrorApp, TAM_PAGINA } from '../lib/api'
import { n, plural } from '../lib/formato'
import { SIN_ESTADO } from '../lib/mexico'
import { useSesion } from '../lib/sesion'
import { AREAS, GIROS, nombreArea, nombreGiro } from '../lib/types'
import type { Area, ContactoFila, Conteos, EmpresaFila, Filtros, Giro } from '../lib/types'

type Vista = 'personas' | 'empresas'

function useDemorado<T>(valor: T, ms: number) {
  const [demorado, setDemorado] = useState(valor)
  useEffect(() => {
    const id = setTimeout(() => setDemorado(valor), ms)
    return () => clearTimeout(id)
  }, [valor, ms])
  return demorado
}

function Rieles({ conteos, vista, estado, area, giro, alEstado, alArea, alGiro }: {
  conteos: Conteos | null
  vista: Vista
  estado: string | null
  area: Area | null
  giro: Giro | null
  alEstado: (estado: string | null) => void
  alArea: (area: Area | null) => void
  alGiro: (giro: Giro | null) => void
}) {
  const porEstado = (vista === 'personas' ? conteos?.estados_personas : conteos?.estados_empresas) ?? {}
  const areas = AREAS
    .map((a) => ({ ...a, total: conteos?.areas[a.id] ?? 0 }))
    .sort((a, b) => (a.id === 'otro' ? 1 : b.id === 'otro' ? -1 : b.total - a.total))
  const mayor = Math.max(1, ...areas.map((a) => a.total))
  const giros = GIROS
    .map((g) => ({ ...g, total: conteos?.giros[g.id] ?? 0 }))
    .filter((g) => g.total > 0)
    .sort((a, b) => (a.id === 'sin_clasificar' ? 1 : b.id === 'sin_clasificar' ? -1 : b.total - a.total))
  const mayorGiro = Math.max(1, ...giros.filter((g) => g.id !== 'sin_clasificar').map((g) => g.total))

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="titulo-mapa" className="rounded-lg border border-linea p-4">
        <h2 id="titulo-mapa" className="mb-3 font-semibold">
          {vista === 'personas' ? 'Personas' : 'Empresas'} por estado
        </h2>
        <MapaEstados conteos={porEstado} seleccionado={estado} alElegir={alEstado} unidad={vista} />
        <LeyendaMapa sinEstado={porEstado[SIN_ESTADO] ?? 0} seleccionado={estado} alElegir={alEstado} />
      </section>

      <section aria-labelledby="titulo-giros" className="rounded-lg border border-linea p-4">
        <h2 id="titulo-giros" className="mb-2 font-semibold">Empresas por giro</h2>
        <ul className="flex flex-col gap-0.5">
          {giros.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                aria-pressed={giro === g.id}
                onClick={() => alGiro(giro === g.id ? null : g.id)}
                className={`relative flex h-8 w-full cursor-pointer items-center justify-between overflow-hidden rounded px-2 text-left ${
                  giro === g.id ? 'font-semibold outline-2 -outline-offset-2 outline-jade-500' : 'hover:bg-tenue'
                }`}
              >
                <span aria-hidden className="absolute inset-y-0 left-0 rounded bg-jade-50" style={{ width: `${Math.min(g.total / mayorGiro, 1) * 100}%` }} />
                <span className="relative">{g.nombre}</span>
                <span className="num relative">{n(g.total)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-areas" className="rounded-lg border border-linea p-4">
        <h2 id="titulo-areas" className="mb-2 font-semibold">Personas por área</h2>
        <ul className="flex flex-col gap-0.5">
          {areas.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                aria-pressed={area === a.id}
                onClick={() => alArea(area === a.id ? null : a.id)}
                className={`relative flex h-8 w-full cursor-pointer items-center justify-between overflow-hidden rounded px-2 text-left ${
                  area === a.id ? 'font-semibold outline-2 -outline-offset-2 outline-jade-500' : 'hover:bg-tenue'
                }`}
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded bg-jade-50"
                  style={{ width: `${(a.total / mayor) * 100}%` }}
                />
                <span className="relative">{a.nombre}</span>
                <span className="num relative">{n(a.total)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function CuerpoCarga() {
  return (
    <tbody>
      {Array.from({ length: 8 }, (_, i) => (
        <tr key={i} className="h-[64px] border-t border-regla">
          {[0, 1, 2].map((j) => (
            <td key={j} className="pr-4">
              <span className="hueso mb-2 h-3.5 w-3/4" />
              <span className="hueso h-3 w-1/2" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

function TablaPersonas({ filas, cargando, alAbrir }: {
  filas: ContactoFila[]
  cargando: boolean
  alAbrir: (id: number) => void
}) {
  return (
    <table className="w-full table-fixed">
      <thead className="hidden text-left text-xs text-gris md:table-header-group">
        <tr className="h-9">
          <th scope="col" className="w-[42%] pr-4 font-medium">Empresa</th>
          <th scope="col" className="w-[22%] pr-4 font-medium">Persona</th>
          <th scope="col" className="w-[36%] font-medium">Contacto</th>
        </tr>
      </thead>
      {cargando && !filas.length ? <CuerpoCarga /> : (
        <tbody>
          {filas.map((c) => (
            <tr key={c.id} className="block border-t border-regla py-2.5 hover:bg-tenue md:table-row md:h-[64px] md:py-0">
              <td className="block pr-3 md:table-cell">
                <div className="flex items-center gap-2.5">
                  <LogoEmpresa nombre={c.empresa} web={c.web} tam={36} />
                  <div className="min-w-0 flex-1">
                    <button type="button" title={c.empresa} onClick={() => alAbrir(c.empresa_id)} className="block max-w-full cursor-pointer truncate text-left font-semibold hover:text-jade-500">
                      {c.empresa}
                    </button>
                    <p className="truncate text-xs text-gris">{c.estado}{c.giro !== 'sin_clasificar' && ` · ${nombreGiro(c.giro)}`}</p>
                  </div>
                  <BotonFavorito id={c.empresa_id} nombre={c.empresa} />
                </div>
              </td>
              <td className="block pt-1.5 pr-4 md:table-cell md:pt-0">
                <p className="truncate font-medium">{c.nombre ?? <span className="text-gris-2">—</span>}</p>
                <p className="truncate text-xs text-gris">{c.puesto ?? nombreArea(c.area)}</p>
              </td>
              <td className="block pt-1 md:table-cell md:pt-0">
                {c.correo ? (
                  <div className="flex items-center gap-0.5">
                    <a href={`mailto:${c.correo}`} className="truncate hover:text-jade-500">{c.correo}</a>
                    <Copiar texto={c.correo} etiqueta="correo" />
                  </div>
                ) : <p className="text-gris-2">—</p>}
                <p className="num truncate text-xs text-gris">
                  {c.telefono ?? '—'}{c.telefono_directo ? ' · directo' : ''}
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      )}
    </table>
  )
}

function RejillaEmpresas({ filas, cargando, alAbrir }: {
  filas: EmpresaFila[]
  cargando: boolean
  alAbrir: (id: number) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {cargando && !filas.length
        ? <RejillaCarga cuantas={8} />
        : filas.map((e) => <TarjetaEmpresa key={e.id} empresa={e} alAbrir={alAbrir} />)}
    </div>
  )
}

export function Directorio() {
  const { api } = useSesion()
  const [parametros] = useSearchParams()
  const q = useDemorado(parametros.get('q') ?? '', 500)

  // Los accesos del inicio llegan con el filtro ya puesto en la dirección.
  const [vista, setVista] = useState<Vista>(parametros.get('vista') === 'empresas' ? 'empresas' : 'personas')
  const [estado, setEstado] = useState<string | null>(parametros.get('estado'))
  const [area, setArea] = useState<Area | null>(AREAS.find((a) => a.id === parametros.get('area'))?.id ?? null)
  const [giro, setGiro] = useState<Giro | null>(GIROS.find((g) => g.id === parametros.get('giro'))?.id ?? null)
  const [conCorreo, setConCorreo] = useState(false)
  const [conTelefono, setConTelefono] = useState(false)
  const [pagina, setPagina] = useState(0)

  const [conteos, setConteos] = useState<Conteos | null>(null)
  const [personas, setPersonas] = useState<ContactoFila[]>([])
  const [empresas, setEmpresas] = useState<EmpresaFila[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [abierta, setAbierta] = useState<number | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [mapaAbierto, setMapaAbierto] = useState(false)

  const filtros: Filtros = { q, estado, area, giro, conCorreo, conTelefono }
  const clave = JSON.stringify(filtros)
  const turno = useRef(0)

  const reiniciar = useCallback(<T,>(fijar: (valor: T) => void) => (valor: T) => {
    fijar(valor)
    setPagina(0)
  }, [])

  useEffect(() => setPagina(0), [q])

  useEffect(() => {
    const mio = ++turno.current
    setCargando(true)
    setError('')
    const consulta = vista === 'personas' ? api.contactos(filtros, pagina) : api.empresas(filtros, pagina)
    Promise.all([consulta, api.conteos(filtros)])
      .then(([resultado, nuevos]) => {
        if (mio !== turno.current) return
        if (vista === 'personas') setPersonas(resultado.filas as ContactoFila[])
        else setEmpresas(resultado.filas as EmpresaFila[])
        setTotal(resultado.total)
        setConteos(nuevos)
      })
      .catch((e: ErrorApp) => {
        if (mio === turno.current) setError(e.message)
      })
      .finally(() => {
        if (mio === turno.current) setCargando(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, clave, vista, pagina, recarga])

  const unidad = vista === 'personas' ? ['persona', 'personas'] : ['empresa', 'empresas']
  const lugar = estado && estado !== SIN_ESTADO ? ` en ${estado}` : estado ? ' sin estado registrado' : ' en todo México'
  const enArea = `${area ? ` de ${nombreArea(area).toLowerCase()}` : ''}${giro ? ` · ${nombreGiro(giro)}` : ''}`
  const hayFiltros = Boolean(estado || area || giro)
  const vacio = !cargando && !error && total === 0
  const desde = total ? pagina * TAM_PAGINA + 1 : 0
  const hasta = Math.min((pagina + 1) * TAM_PAGINA, total)

  const rieles = (
    <Rieles
      conteos={conteos} vista={vista} estado={estado} area={area} giro={giro}
      alEstado={reiniciar(setEstado)} alArea={reiniciar(setArea)} alGiro={reiniciar(setGiro)}
    />
  )

  return (
    <div className="px-4 pt-1 pb-8 md:px-6 md:pt-5">
      <div className="mb-3">
        <h1 className="text-[22px] leading-7 font-semibold">Directorio</h1>
        <p className="mt-0.5 min-h-5 text-gris">
          {conteos && `${plural(total, unidad[0], unidad[1])}${enArea}${lugar}`}
        </p>
      </div>

      <Pestanas
        etiqueta="Qué ver"
        valor={vista}
        alCambiar={reiniciar(setVista)}
        opciones={[
          { id: 'personas', nombre: 'Personas', cuenta: conteos ? n(conteos.personas) : '' },
          { id: 'empresas', nombre: 'Empresas', cuenta: conteos ? n(conteos.empresas) : '' },
        ]}
      />

      <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_384px]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-px">
            <button type="button" className="filtro xl:hidden" aria-pressed={mapaAbierto} aria-expanded={mapaAbierto} onClick={() => setMapaAbierto(!mapaAbierto)}>
              <IconoMapa size={14} /> Estado, giro y área
            </button>
            <button type="button" className="filtro" aria-pressed={conCorreo} onClick={() => reiniciar(setConCorreo)(!conCorreo)}>
              Con correo
            </button>
            <button type="button" className="filtro" aria-pressed={conTelefono} onClick={() => reiniciar(setConTelefono)(!conTelefono)}>
              Con teléfono
            </button>
            {estado && (
              <button type="button" className="filtro filtro-activo" aria-label={`Quitar filtro ${estado}`} onClick={() => reiniciar(setEstado)(null)}>
                {estado} <X size={13} />
              </button>
            )}
            {giro && (
              <button type="button" className="filtro filtro-activo" aria-label={`Quitar filtro ${nombreGiro(giro)}`} onClick={() => reiniciar(setGiro)(null)}>
                {nombreGiro(giro)} <X size={13} />
              </button>
            )}
            {area && (
              <button type="button" className="filtro filtro-activo" aria-label={`Quitar filtro ${nombreArea(area)}`} onClick={() => reiniciar(setArea)(null)}>
                {nombreArea(area)} <X size={13} />
              </button>
            )}
          </div>

          {mapaAbierto && <div className="mb-4 xl:hidden">{rieles}</div>}

          {error ? (
            <ErrorBloque mensaje={error} alReintentar={() => setRecarga((r) => r + 1)} />
          ) : vacio ? (
            <div className="rounded-lg border border-dashed border-control px-4 py-3">
              <p>Nada coincide con esta búsqueda{lugar}.</p>
              {hayFiltros && (
                <button
                  type="button"
                  className="mt-1 cursor-pointer font-medium underline underline-offset-2"
                  onClick={() => { setEstado(null); setArea(null); setGiro(null); setPagina(0) }}
                >
                  Quitar filtros
                </button>
              )}
            </div>
          ) : vista === 'personas' ? (
            <TablaPersonas filas={personas} cargando={cargando} alAbrir={setAbierta} />
          ) : (
            <RejillaEmpresas filas={empresas} cargando={cargando} alAbrir={setAbierta} />
          )}

          {total > 0 && !error && (
            <div className="mt-3 flex items-center justify-between border-t border-regla pt-3">
              <p className="num text-gris">{n(desde)}–{n(hasta)} de {n(total)}</p>
              <div className="flex gap-2">
                <button type="button" aria-label="Página anterior" className="boton w-9 px-0" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
                  <ChevronLeft size={16} />
                </button>
                <button type="button" aria-label="Página siguiente" className="boton w-9 px-0" disabled={hasta >= total} onClick={() => setPagina((p) => p + 1)}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="hidden xl:block">{rieles}</aside>
      </div>

      {abierta !== null && <FichaEmpresa id={abierta} alCerrar={() => setAbierta(null)} />}
    </div>
  )
}
