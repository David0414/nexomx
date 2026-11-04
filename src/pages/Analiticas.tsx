import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorBloque } from '../components/Comunes'
import { fecha, haceCuanto, n, plural } from '../lib/formato'
import { useSesion } from '../lib/sesion'
import { nombreArea, nombreGiro } from '../lib/types'
import type { Actividad, Analitica, Area, Giro } from '../lib/types'

const PERIODOS = [
  { dias: 7, nombre: '7 días' },
  { dias: 30, nombre: '30 días' },
  { dias: 90, nombre: '90 días' },
]

function Panel({ titulo, children, className = '' }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-lg border border-linea p-4 ${className}`}>
      <h2 className="mb-3 font-semibold">{titulo}</h2>
      {children}
    </section>
  )
}

function SinDatos({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md bg-tenue px-3 py-2.5 text-gris">{children}</p>
}

// Tope redondo por encima del máximo, para que las marcas del eje sean números limpios.
function topeRedondo(maximo: number) {
  if (maximo <= 4) return 4
  const magnitud = 10 ** Math.floor(Math.log10(maximo))
  const paso = [1, 2, 5, 10].map((m) => (m * magnitud) / 4).find((p) => p * 4 >= maximo && Number.isInteger(p))
  return (paso ?? magnitud) * 4
}

const diaCorto = (iso: string) => fecha(iso).replace(/ \d{4}$/, '')

function ColumnasPorDia({ dias }: { dias: Analitica['por_dia'] }) {
  const [activo, setActivo] = useState<number | null>(null)
  const tope = topeRedondo(Math.max(0, ...dias.map((d) => d.consultas)))
  const total = dias.reduce((suma, d) => suma + d.consultas, 0)
  const salto = Math.max(1, Math.ceil(dias.length / 6))
  const dato = activo === null ? null : dias[activo]

  return (
    <div>
      <p className="num mb-2 h-5 text-gris" aria-live="polite">
        {dato ? `${fecha(dato.dia)}: ${plural(dato.consultas, 'consulta', 'consultas')}` : plural(total, 'consulta en el periodo', 'consultas en el periodo')}
      </p>
      <div className="flex gap-2">
        <div className="num flex h-[160px] w-7 flex-none flex-col justify-between text-right text-xs text-gris" aria-hidden>
          {[tope, tope / 2, 0].map((marca) => <span key={marca} className="-my-1.5 leading-3">{n(marca)}</span>)}
        </div>
        <div className="min-w-0 flex-1">
          <div
            role="img"
            aria-label={`Consultas por día: ${n(total)} en ${n(dias.length)} días`}
            className="relative flex h-[160px] items-end gap-[2px] border-b-2 border-obsidiana"
            onMouseLeave={() => setActivo(null)}
          >
            <i aria-hidden className="absolute inset-x-0 top-0 border-t border-regla" />
            <i aria-hidden className="absolute inset-x-0 top-1/2 border-t border-regla" />
            {dias.map((d, i) => (
              <div key={d.dia} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setActivo(i)}>
                <div
                  className={`w-full rounded-t-[3px] ${activo === i ? 'bg-jade-700' : 'bg-jade-500'}`}
                  style={{ height: `${(d.consultas / tope) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="relative mt-1.5 h-4 text-xs text-gris" aria-hidden>
            {dias.map((d, i) => i % salto === 0 && (
              <span key={d.dia} className="absolute" style={{ left: `${(i / dias.length) * 100}%` }}>{diaCorto(d.dia)}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ListaBarras({ filas, vacio }: { filas: { id: string | number; texto: string; valor: number; nota?: string }[]; vacio: string }) {
  if (!filas.length) return <SinDatos>{vacio}</SinDatos>
  const mayor = Math.max(...filas.map((f) => f.valor))
  return (
    <ul className="flex flex-col gap-2.5">
      {filas.map((f) => (
        <li key={f.id} title={f.texto}>
          <div className="flex justify-between gap-3">
            <span className="truncate">{f.texto}</span>
            <span className="num flex-none font-medium">{n(f.valor)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-sm bg-cantera">
            <div className="h-full rounded-sm bg-jade-500" style={{ width: `${(f.valor / mayor) * 100}%` }} />
          </div>
          {f.nota && <p className="mt-0.5 text-xs text-gris">{f.nota}</p>}
        </li>
      ))}
    </ul>
  )
}

function queBusco(r: Actividad) {
  if (r.tipo === 'empresa') return `Abrió ${r.empresa_vista ?? 'una empresa'}`
  const partes = [r.tipo === 'personas' ? 'Personas' : 'Empresas']
  if (r.filtros.area) partes.push(`de ${nombreArea(r.filtros.area as Area).toLowerCase()}`)
  if (r.filtros.giro) partes.push(`del giro ${nombreGiro(r.filtros.giro).toLowerCase()}`)
  if (r.filtros.estado) partes.push(`en ${r.filtros.estado}`)
  if (r.filtros.q) partes.push(`con «${r.filtros.q}»`)
  return partes.join(' ')
}

export function Analiticas() {
  const { api } = useSesion()
  const [dias, setDias] = useState(30)
  const [datos, setDatos] = useState<Analitica | null>(null)
  const [giros, setGiros] = useState<{ giro: Giro; veces: number }[]>([])
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    setError('')
    api.analitica(dias).then(setDatos).catch((e: Error) => setError(e.message))
    api.girosConsultados(dias).then(setGiros).catch(() => setGiros([]))
  }, [api, dias])

  useEffect(cargar, [cargar])

  const c = datos?.clientes
  const hallazgo = !datos ? '' : datos.consultas === 0
    ? 'Aún no hay consultas de clientes en este periodo'
    : `${plural(datos.usuarios_activos, 'cliente usó', 'clientes usaron')} NexoMx y ${datos.usuarios_activos === 1 ? 'hizo' : 'hicieron'} ${plural(datos.consultas, 'consulta', 'consultas')}`

  const cifras = datos && c ? [
    { etiqueta: 'Clientes activos', valor: c.activos, nota: `de ${n(c.total)} en total` },
    { etiqueta: 'Usaron la plataforma', valor: datos.usuarios_activos, nota: 'clientes distintos' },
    { etiqueta: 'Consultas', valor: datos.consultas, nota: 'búsquedas hechas' },
    { etiqueta: 'Empresas abiertas', valor: datos.fichas, nota: 'fichas vistas' },
    { etiqueta: 'Resultados entregados', valor: datos.resultados, nota: 'filas consultadas' },
  ] : []

  return (
    <div className="px-4 pt-4 pb-8 md:px-6 md:pt-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] leading-7 font-semibold">Analíticas</h1>
          <p className="mt-0.5 min-h-5 text-gris">{hallazgo}</p>
        </div>
        <div role="group" aria-label="Periodo" className="flex gap-1 rounded-md bg-cantera p-1">
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              type="button"
              aria-pressed={dias === p.dias}
              onClick={() => setDias(p.dias)}
              className={`h-7 cursor-pointer rounded px-3 ${dias === p.dias ? 'bg-jade-500 font-semibold text-white' : 'hover:bg-cantera-2'}`}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4"><ErrorBloque mensaje={error} alReintentar={cargar} /></div>}

      {!datos && !error && <span className="hueso h-[92px] w-full" />}

      {datos && c && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 rounded-lg border border-linea md:grid-cols-5">
            {cifras.map((f, i) => (
              <div key={f.etiqueta} className={`p-4 ${i === 0 ? 'col-span-2 md:col-span-1' : ''} ${i > 0 ? 'border-t border-linea md:border-t-0 md:border-l' : ''}`}>
                <p className="text-gris">{f.etiqueta}</p>
                <p className="num mt-1 text-[28px] leading-9">{n(f.valor)}</p>
                <p className="text-xs text-gris">{f.nota}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel titulo="Consultas por día" className="xl:col-span-2">
              <ColumnasPorDia dias={datos.por_dia} />
            </Panel>
            <Panel titulo="Accesos de clientes">
              <dl className="flex flex-col">
                {[
                  { nombre: 'Activos', valor: c.activos },
                  { nombre: 'Vencen en 15 días o menos', valor: c.por_vencer },
                  { nombre: 'Vencidos', valor: c.vencidos },
                  { nombre: 'Suspendidos', valor: c.suspendidos },
                ].map((f) => (
                  <div key={f.nombre} className="flex h-9 items-center justify-between border-b border-regla last:border-0">
                    <dt>{f.nombre}</dt>
                    <dd className="num font-medium">{n(f.valor)}</dd>
                  </div>
                ))}
              </dl>
              <Link to="/clientes" className="mt-3 inline-block font-medium text-jade-500 hover:underline">Administrar clientes</Link>
            </Panel>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Panel titulo="Qué están buscando">
              <ListaBarras
                vacio="Aquí verás las palabras que más buscan."
                filas={datos.busquedas.map((b) => ({
                  id: b.q, texto: b.q, valor: b.veces, nota: plural(b.usuarios, 'cliente', 'clientes'),
                }))}
              />
            </Panel>
            <Panel titulo="Estados más consultados">
              <ListaBarras
                vacio="Aquí verás los estados que más filtran."
                filas={datos.estados.map((e) => ({ id: e.estado, texto: e.estado, valor: e.veces }))}
              />
            </Panel>
            <Panel titulo="Giros más consultados">
              <ListaBarras
                vacio="Aquí verás los giros que más filtran."
                filas={giros.map((g) => ({ id: g.giro, texto: nombreGiro(g.giro), valor: g.veces }))}
              />
            </Panel>
            <Panel titulo="Áreas más consultadas">
              <ListaBarras
                vacio="Aquí verás las áreas que más filtran."
                filas={datos.areas.map((a) => ({ id: a.area, texto: nombreArea(a.area), valor: a.veces }))}
              />
            </Panel>
            <Panel titulo="Empresas más abiertas">
              <ListaBarras
                vacio="Aquí verás las empresas que más revisan."
                filas={datos.empresas.map((e) => ({ id: e.id, texto: e.nombre, valor: e.veces }))}
              />
            </Panel>
          </div>

          <Panel titulo="Búsquedas sin resultados">
            {datos.sin_resultados.length === 0
              ? <SinDatos>Cuando busquen algo que no tienes, aparecerá aquí: te dirá qué datos conviene conseguir.</SinDatos>
              : (
                <ul className="flex flex-wrap gap-2">
                  {datos.sin_resultados.map((s) => (
                    <li key={s.q} className="pastilla bg-aviso-bg text-aviso-tinta">{s.q} · {n(s.veces)}</li>
                  ))}
                </ul>
              )}
          </Panel>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel titulo="Uso por cliente">
              {datos.uso.length === 0 ? <SinDatos>Aún no tienes clientes.</SinDatos> : (
                <table className="w-full">
                  <thead className="text-left text-xs text-gris">
                    <tr className="h-8">
                      <th scope="col" className="w-1/2 pr-3 font-medium">Cliente</th>
                      <th scope="col" className="pr-3 text-right font-medium">Consultas</th>
                      <th scope="col" className="pr-3 text-right font-medium">Resultados</th>
                      <th scope="col" className="hidden text-right font-medium sm:table-cell">Última</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.uso.map((u) => (
                      <tr key={u.id} className="h-12 border-t border-regla">
                        <td className="max-w-0 pr-3">
                          <p className="truncate font-medium">{u.nombre}</p>
                          {u.empresa && <p className="truncate text-xs text-gris">{u.empresa}</p>}
                        </td>
                        <td className="num pr-3 text-right">{n(u.consultas)}</td>
                        <td className="num pr-3 text-right">{n(u.resultados)}</td>
                        <td className="hidden text-right text-gris sm:table-cell">{haceCuanto(u.ultima) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel titulo="Últimas consultas">
              {datos.recientes.length === 0 ? <SinDatos>Aquí aparecerá lo que busquen tus clientes.</SinDatos> : (
                <ul>
                  {datos.recientes.slice(0, 10).map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 border-t border-regla py-2 first:border-t-0">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.nombre}</p>
                        <p className="truncate text-gris">{queBusco(r)}</p>
                      </div>
                      <span className="flex-none text-gris">{haceCuanto(r.creado_el)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  )
}
