import { ChevronLeft, ChevronRight, ExternalLink, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FichaAdmin, FormEmpresa } from '../components/AdminEmpresa'
import { ErrorBloque, Pestanas } from '../components/Comunes'
import { LogoEmpresa } from '../components/Empresa'
import { hostDe, n, plural, urlDe } from '../lib/formato'
import { ESTADOS } from '../lib/mexico'
import { useSesion } from '../lib/sesion'
import { GIROS, nombreGiro } from '../lib/types'
import type { AdminEmpresas, FiltroEmpresas, Giro } from '../lib/types'

const TAM = 50

const FILTROS: { id: FiltroEmpresas; nombre: string }[] = [
  { id: 'todas', nombre: 'Todas' },
  { id: 'con_personas', nombre: 'Con personas' },
  { id: 'sin_personas', nombre: 'Sin personas' },
  { id: 'sin_telefono', nombre: 'Sin teléfono' },
  { id: 'sin_web', nombre: 'Sin sitio' },
  { id: 'sin_estado', nombre: 'Sin estado' },
  { id: 'sin_giro', nombre: 'Sin giro' },
]

const Vacio = () => <span className="text-gris-2">—</span>

export function Empresas() {
  const { api } = useSesion()
  const [parametros] = useSearchParams()
  const texto = parametros.get('q') ?? ''
  const [q, setQ] = useState(texto)
  const [filtro, setFiltro] = useState<FiltroEmpresas>('todas')
  const [estado, setEstado] = useState('')
  const [giro, setGiro] = useState('')
  const [pagina, setPagina] = useState(0)
  const [datos, setDatos] = useState<AdminEmpresas | null>(null)
  const [error, setError] = useState('')
  const [abierta, setAbierta] = useState<number | null>(null)
  const [nueva, setNueva] = useState(false)
  const [recarga, setRecarga] = useState(0)
  const turno = useRef(0)

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(texto)
      setPagina(0)
    }, 300)
    return () => clearTimeout(id)
  }, [texto])

  useEffect(() => {
    const mio = ++turno.current
    setError('')
    api.adminEmpresas(q, estado || null, (giro || null) as Giro | null, filtro, pagina)
      .then((d) => mio === turno.current && setDatos(d))
      .catch((e: Error) => mio === turno.current && setError(e.message))
  }, [api, q, estado, giro, filtro, pagina, recarga])

  const total = datos?.total ?? 0
  const desde = total ? pagina * TAM + 1 : 0
  const hasta = Math.min((pagina + 1) * TAM, total)

  return (
    <div className="px-4 pt-4 pb-8 md:px-6 md:pt-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] leading-7 font-semibold">Empresas</h1>
          <p className="mt-0.5 min-h-5 text-gris">
            {datos && `${n(datos.conteos.con_personas)} con personas de contacto y ${n(datos.conteos.sin_personas)} solo con datos generales`}
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:flex-wrap">
          <select
            aria-label="Filtrar por estado"
            className="campo min-w-0 md:h-9 md:w-auto md:min-w-48"
            value={estado}
            onChange={(e) => { setEstado(e.target.value); setPagina(0) }}
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <select
            aria-label="Filtrar por giro"
            className="campo min-w-0 md:h-9 md:w-auto md:min-w-48"
            value={giro}
            onChange={(e) => { setGiro(e.target.value); setPagina(0) }}
          >
            <option value="">Todos los giros</option>
            {GIROS.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
          <button type="button" className="boton boton-primario col-span-2" onClick={() => setNueva(true)}>
            <Plus size={16} /> Nueva empresa
          </button>
        </div>
      </div>

      <Pestanas
        etiqueta="Revisar empresas"
        valor={filtro}
        alCambiar={(f) => { setFiltro(f); setPagina(0) }}
        opciones={FILTROS.map((f) => ({ ...f, cuenta: datos ? n(datos.conteos[f.id]) : '' }))}
      />

      <div className="mt-3">
        {error && <ErrorBloque mensaje={error} alReintentar={() => setRecarga((r) => r + 1)} />}

        {datos && !error && total === 0 && (
          <p className="rounded-lg border border-dashed border-control px-4 py-3">Ninguna empresa coincide con esta revisión.</p>
        )}

        {datos && total > 0 && (
          <>
            <ul className="flex flex-col gap-2.5 md:hidden">
              {datos.filas.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => setAbierta(e.id)} className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-linea p-3 text-left active:bg-tenue">
                    <LogoEmpresa nombre={e.nombre} web={e.web} tam={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{e.nombre}</span>
                      <span className="block truncate text-[13px] leading-[18px] text-gris">{e.estado} · {nombreGiro(e.giro)}</span>
                      <span className="num block text-[13px] leading-[18px]">{plural(e.num_contactos, 'persona', 'personas')}{e.telefono ? '' : ' · sin teléfono'}</span>
                    </span>
                    <ChevronRight size={18} className="flex-none text-gris" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px]">
                <thead className="text-left text-xs text-gris">
                  <tr className="h-9">
                    <th scope="col" className="pr-4 font-medium">Empresa</th>
                    <th scope="col" className="pr-4 text-right font-medium">Personas</th>
                    <th scope="col" className="pr-4 text-right font-medium">Con correo</th>
                    <th scope="col" className="pr-4 font-medium">Teléfono</th>
                    <th scope="col" className="pr-4 font-medium">Sitio</th>
                    <th scope="col" className="text-right font-medium">Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.filas.map((e) => (
                    <tr key={e.id} className="h-[56px] border-t border-regla hover:bg-tenue">
                      <td className="max-w-[360px] pr-4">
                        <div className="flex items-center gap-2.5">
                          <LogoEmpresa nombre={e.nombre} web={e.web} tam={32} />
                          <div className="min-w-0">
                            <button type="button" title={e.nombre} onClick={() => setAbierta(e.id)} className="block max-w-full cursor-pointer truncate text-left font-semibold hover:text-jade-500">
                              {e.nombre}
                            </button>
                            <p className="truncate text-xs text-gris">{e.estado} · {nombreGiro(e.giro)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="num pr-4 text-right">{n(e.num_contactos)}</td>
                      <td className="num pr-4 text-right">{n(e.con_correo)}</td>
                      <td className="num max-w-[170px] truncate pr-4">{e.telefono ?? <Vacio />}</td>
                      <td className="max-w-[180px] truncate pr-4">
                        {e.web
                          ? <a href={urlDe(e.web)} target="_blank" rel="noreferrer noopener" className="text-jade-500 hover:underline">{hostDe(e.web)}</a>
                          : <Vacio />}
                      </td>
                      <td className="text-right">
                        {e.enlace_origen.startsWith('http') ? (
                          <a
                            href={e.enlace_origen}
                            target="_blank"
                            rel="noreferrer noopener"
                            aria-label={`Ver origen de ${e.nombre}`}
                            title="Ver ficha de origen"
                            className="inline-grid size-8 place-items-center rounded-md text-gris hover:bg-cantera hover:text-obsidiana"
                          >
                            <ExternalLink size={15} />
                          </a>
                        ) : <span className="text-xs text-gris">Manual</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-regla pt-3">
              <p className="num text-gris">{n(desde)}–{n(hasta)} de {n(total)}</p>
              <div className="flex gap-2">
                <button type="button" aria-label="Página anterior" className="boton w-11 px-0 md:w-9" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
                  <ChevronLeft size={16} />
                </button>
                <button type="button" aria-label="Página siguiente" className="boton w-11 px-0 md:w-9" disabled={hasta >= total} onClick={() => setPagina((p) => p + 1)}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {abierta !== null && (
        <FichaAdmin id={abierta} alCerrar={() => setAbierta(null)} alCambiar={() => setRecarga((r) => r + 1)} />
      )}

      {nueva && (
        <FormEmpresa
          inicial={null}
          alCerrar={() => setNueva(false)}
          alGuardar={(id) => {
            setNueva(false)
            setRecarga((r) => r + 1)
            setAbierta(id)
          }}
        />
      )}
    </div>
  )
}
