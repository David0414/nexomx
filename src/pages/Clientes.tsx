import { MoreHorizontal, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Copiar, ErrorBloque, Pestanas, Ventana } from '../components/Comunes'
import {
  estadoCliente, fecha, haceCuanto, hoy, n, plural, sumarDias, textoVencimiento, type EstadoCliente,
} from '../lib/formato'
import { useSesion } from '../lib/sesion'
import type { Cliente, Credencial } from '../lib/types'

type Tab = 'todos' | 'demos' | EstadoCliente

const PASTILLA: Partial<Record<EstadoCliente, [string, string]>> = {
  por_vencer: ['bg-aviso-bg text-aviso-tinta', 'Por vencer'],
  vencido: ['bg-alerta-bg text-alerta-tinta', 'Vencido'],
  suspendido: ['bg-cantera text-gris', 'Suspendido'],
}

function VentanaCredencial({ credencial, titulo, alCerrar }: {
  credencial: Credencial
  titulo: string
  alCerrar: () => void
}) {
  const mensaje = `Tu acceso a NexoMx\nEntra en: ${window.location.origin}\nCorreo: ${credencial.correo}\nContraseña: ${credencial.clave}`
  return (
    <Ventana titulo={titulo} alCerrar={alCerrar}>
      <p className="text-gris">Guárdala ahora: esta contraseña no se vuelve a mostrar.</p>
      <div className="mt-4 rounded-lg bg-tenue p-4">
        <p className="text-xs text-gris-2">Correo</p>
        <p className="truncate">{credencial.correo}</p>
        <p className="mt-3 text-xs text-gris-2">Contraseña</p>
        <div className="flex items-center gap-1">
          <code className="font-mono text-base font-medium">{credencial.clave}</code>
          <Copiar texto={credencial.clave} etiqueta="contraseña" />
        </div>
      </div>
      <button
        type="button"
        className="boton boton-primario mt-4 w-full"
        onClick={() => navigator.clipboard.writeText(mensaje)}
      >
        Copiar mensaje para enviar
      </button>
    </Ventana>
  )
}

function VentanaNuevo({ alCrear, alCerrar }: {
  alCrear: (credencial: Credencial) => void
  alCerrar: () => void
}) {
  const { api } = useSesion()
  const [nombre, setNombre] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [correo, setCorreo] = useState('')
  const [dias, setDias] = useState('30')
  const [limite, setLimite] = useState('1000')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setError('')
    try {
      alCrear(await api.crearCliente({
        nombre: nombre.trim(), empresa: empresa.trim(), correo: correo.trim().toLowerCase(),
        vence_el: dias === 'sin' ? null : sumarDias(hoy(), Number(dias)),
        limite_diario: Number(limite),
      }))
    } catch (fallo) {
      setError((fallo as Error).message)
      setEnviando(false)
    }
  }

  return (
    <Ventana titulo="Nuevo cliente" alCerrar={alCerrar}>
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <div>
          <label className="etiqueta" htmlFor="n-nombre">Nombre</label>
          <input id="n-nombre" required className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="n-empresa">Empresa</label>
          <input id="n-empresa" className="campo" value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="n-correo">Correo</label>
          <input id="n-correo" type="email" required className="campo" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="etiqueta" htmlFor="n-dias">Acceso</label>
            <select id="n-dias" className="campo" value={dias} onChange={(e) => setDias(e.target.value)}>
              <option value="30">30 días</option>
              <option value="90">90 días</option>
              <option value="180">6 meses</option>
              <option value="365">1 año</option>
              <option value="sin">Sin vencimiento</option>
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="n-limite">Resultados al día</label>
            <input id="n-limite" type="number" min={0} step={100} required className="campo num" value={limite} onChange={(e) => setLimite(e.target.value)} />
          </div>
        </div>
        {error && <p role="alert" className="rounded-md bg-alerta-bg px-3 py-2 text-alerta-tinta">{error}</p>}
        <button type="submit" disabled={enviando} className="boton boton-primario">
          {enviando ? 'Creando…' : 'Crear cuenta y generar contraseña'}
        </button>
      </form>
    </Ventana>
  )
}

function VentanaDemo({ alCrear, alCerrar }: { alCrear: (credencial: Credencial) => void; alCerrar: () => void }) {
  const { api } = useSesion()
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [minutos, setMinutos] = useState('15')
  const [empresas, setEmpresas] = useState('10')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setError('')
    try {
      alCrear(await api.crearDemo({
        nombre: nombre.trim(), correo: correo.trim().toLowerCase(), minutos: Number(minutos), empresas: Number(empresas),
      }))
    } catch (fallo) {
      setError((fallo as Error).message)
      setEnviando(false)
    }
  }

  return (
    <Ventana titulo="Nueva demo" alCerrar={alCerrar}>
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <div>
          <label className="etiqueta" htmlFor="d-nombre">Nombre</label>
          <input id="d-nombre" required className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="d-correo">Correo</label>
          <input id="d-correo" type="email" required className="campo" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="etiqueta" htmlFor="d-minutos">Minutos</label>
            <input id="d-minutos" type="number" min={1} max={1440} required className="campo num" value={minutos} onChange={(e) => setMinutos(e.target.value)} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="d-empresas">Empresas</label>
            <input id="d-empresas" type="number" min={0} max={500} required className="campo num" value={empresas} onChange={(e) => setEmpresas(e.target.value)} />
          </div>
        </div>
        <p className="text-gris">El tiempo empieza cuando la persona entra por primera vez.</p>
        {error && <p role="alert" className="rounded-md bg-alerta-bg px-3 py-2 text-alerta-tinta">{error}</p>}
        <button type="submit" disabled={enviando} className="boton boton-primario">
          {enviando ? 'Creando…' : 'Crear demo y generar contraseña'}
        </button>
      </form>
    </Ventana>
  )
}

function FilaDemo({ demo, alReiniciar, alClave }: { demo: Cliente; alReiniciar: () => void; alClave: () => void }) {
  const terminada = demo.demo_restante === 0
  const [tono, texto] = demo.demo_inicio === null
    ? ['bg-cantera text-gris', 'Sin usar']
    : terminada
      ? ['bg-alerta-bg text-alerta-tinta', 'Terminada']
      : ['bg-jade-50 text-jade-700', `Quedan ${Math.ceil((demo.demo_restante ?? 0) / 60)} min`]

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-regla py-3">
      <div className="min-w-0 flex-1 basis-56">
        <p className="flex items-center gap-2">
          <span className="truncate font-medium">{demo.nombre}</span>
          <span className={`pastilla ${tono}`}>{texto}</span>
        </p>
        <p className="truncate text-xs text-gris">{demo.correo}</p>
      </div>
      <p className="num text-gris">{n(demo.demo_usadas)} /{n(demo.demo_empresas)} empresas · {n(demo.demo_minutos)} min</p>
      <div className="flex gap-2">
        <button type="button" className="boton h-9 px-3" onClick={alClave}>Nueva contraseña</button>
        <button type="button" className="boton h-9 px-3" onClick={alReiniciar}>Reiniciar</button>
      </div>
    </li>
  )
}

function MenuFila({ cliente, alRenovar, alClave, alSuspender }: {
  cliente: Cliente
  alRenovar: () => void
  alClave: () => void
  alSuspender: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto])

  const opcion = 'block w-full cursor-pointer rounded px-2.5 py-2.5 text-left hover:bg-cantera md:py-1.5'
  const elegir = (accion: () => void) => () => {
    setAbierto(false)
    accion()
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-label={`Acciones de ${cliente.nombre}`}
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
        className="grid size-11 cursor-pointer place-items-center rounded-md hover:bg-cantera md:size-8"
      >
        <MoreHorizontal size={18} />
      </button>
      {abierto && (
        <div className="absolute top-11 right-0 z-10 w-52 md:top-9 rounded-lg border border-linea bg-papel p-1 text-left shadow-lg">
          <button type="button" className={opcion} onClick={elegir(alRenovar)}>Renovar 30 días</button>
          <button type="button" className={opcion} onClick={elegir(alClave)}>Nueva contraseña</button>
          <button type="button" className={`${opcion} ${cliente.activo ? 'text-alerta' : ''}`} onClick={elegir(alSuspender)}>
            {cliente.activo ? 'Suspender acceso' : 'Reactivar acceso'}
          </button>
        </div>
      )}
    </div>
  )
}

export function Clientes() {
  const { api } = useSesion()
  const [clientes, setClientes] = useState<Cliente[] | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('todos')
  const [nuevo, setNuevo] = useState(false)
  const [nuevaDemo, setNuevaDemo] = useState(false)
  const [credencial, setCredencial] = useState<{ dato: Credencial; titulo: string } | null>(null)
  const [aSuspender, setASuspender] = useState<Cliente | null>(null)

  const cargar = useCallback(() => {
    setError('')
    api.clientes().then(setClientes).catch((e: Error) => setError(e.message))
  }, [api])

  useEffect(cargar, [cargar])

  const cuentas = useMemo(() => {
    const salida: Record<EstadoCliente, number> = { activo: 0, por_vencer: 0, vencido: 0, suspendido: 0 }
    for (const c of clientes ?? []) if (!c.demo) salida[estadoCliente(c)]++
    return salida
  }, [clientes])

  const demos = clientes?.filter((c) => c.demo) ?? []
  const reales = clientes?.filter((c) => !c.demo)
  const visibles = (reales ?? []).filter((c) => tab === 'todos' || estadoCliente(c) === tab)

  const accion = async (tarea: () => Promise<void>) => {
    try {
      await tarea()
      cargar()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const renovar = (c: Cliente) => accion(async () => {
    const base = c.vence_el && c.vence_el > hoy() ? c.vence_el : hoy()
    await api.actualizarCliente(c.id, { vence_el: sumarDias(base, 30) })
  })

  const hallazgo = cuentas.por_vencer + cuentas.vencido > 0
    ? `${plural(cuentas.por_vencer, 'acceso vence', 'accesos vencen')} en 15 días o menos, ${plural(cuentas.vencido, 'vencido', 'vencidos')}`
    : `${plural(cuentas.activo, 'cliente activo', 'clientes activos')}`

  return (
    <div className="px-4 pt-4 pb-8 md:px-6 md:pt-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] leading-7 font-semibold">Clientes</h1>
          <p className="mt-0.5 min-h-5 text-gris">{clientes && hallazgo}</p>
        </div>
        {tab === 'demos' ? (
          <button type="button" className="boton boton-primario" onClick={() => setNuevaDemo(true)}>
            <Plus size={16} /> Nueva demo
          </button>
        ) : (
          <button type="button" className="boton boton-primario" onClick={() => setNuevo(true)}>
            <Plus size={16} /> Nuevo cliente
          </button>
        )}
      </div>

      <Pestanas
        etiqueta="Estado del acceso"
        valor={tab}
        alCambiar={setTab}
        opciones={[
          { id: 'todos', nombre: 'Todos', cuenta: reales?.length },
          { id: 'activo', nombre: 'Activos', cuenta: cuentas.activo },
          { id: 'por_vencer', nombre: 'Por vencer', cuenta: cuentas.por_vencer },
          { id: 'vencido', nombre: 'Vencidos', cuenta: cuentas.vencido },
          { id: 'suspendido', nombre: 'Suspendidos', cuenta: cuentas.suspendido },
          { id: 'demos', nombre: 'Demos', cuenta: demos.length },
        ]}
      />

      <div className="mt-3">
        {error && <div className="mb-3"><ErrorBloque mensaje={error} alReintentar={cargar} /></div>}

        {tab === 'demos' && (
          demos.length === 0
            ? <p className="rounded-lg border border-dashed border-control px-4 py-3">Aún no has creado demos.</p>
            : (
              <ul>
                {demos.map((d) => (
                  <FilaDemo
                    key={d.id}
                    demo={d}
                    alReiniciar={() => accion(() => api.reiniciarDemo(d.id))}
                    alClave={() => accion(async () => {
                      setCredencial({ dato: await api.nuevaClave(d.id), titulo: `Nueva contraseña de ${d.nombre}` })
                    })}
                  />
                ))}
              </ul>
            )
        )}

        {tab !== 'demos' && clientes && visibles.length === 0 && !error && (
          <div className="rounded-lg border border-dashed border-control px-4 py-3">
            {reales?.length === 0 ? (
              <>
                <p>Aún no tienes clientes.</p>
                <button type="button" className="mt-1 cursor-pointer font-medium underline underline-offset-2" onClick={() => setNuevo(true)}>
                  Crea la primera cuenta
                </button>
              </>
            ) : <p>Ningún cliente en este estado.</p>}
          </div>
        )}

        {tab !== 'demos' && visibles.length > 0 && (
          <table className="block w-full md:table">
            <thead className="hidden text-left text-xs text-gris-2 md:table-header-group">
              <tr className="h-9">
                <th scope="col" className="pr-4 font-normal">Cliente</th>
                <th scope="col" className="pr-4 font-normal">Acceso hasta</th>
                <th scope="col" className="pr-4 text-right font-normal">Resultados hoy</th>
                <th scope="col" className="pr-4 text-right font-normal">Última consulta</th>
                <th scope="col"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {visibles.map((c) => {
                const estado = estadoCliente(c)
                const pastilla = PASTILLA[estado]
                const uso = c.limite_diario ? c.uso_hoy / c.limite_diario : 0
                return (
                  <tr key={c.id} className="relative block border-t border-regla py-2.5 hover:bg-tenue md:table-row md:h-[60px] md:py-0">
                    <td className="block pr-28 md:table-cell md:pr-4">
                      <p className="flex items-center gap-2">
                        <span className="truncate font-medium">{c.nombre}</span>
                        {pastilla && <span className={`pastilla ${pastilla[0]}`}>{pastilla[1]}</span>}
                      </p>
                      <p className="truncate text-xs text-gris-2">{c.empresa ? `${c.empresa} · ` : ''}{c.correo}</p>
                    </td>
                    <td className="block pt-1 pr-4 md:table-cell md:pt-0">
                      <p className="num inline md:block">{c.vence_el ? fecha(c.vence_el) : 'Sin vencimiento'}</p>
                      {c.vence_el && (
                        <p className="inline text-xs text-gris-2 md:block">
                          <span className="md:hidden"> · </span>{textoVencimiento(c.vence_el)}
                        </p>
                      )}
                    </td>
                    <td className="num inline pt-1 pr-1 md:table-cell md:pt-0 md:pr-4 md:text-right">
                      <span className={uso >= 0.8 ? 'font-medium text-aviso-tinta' : ''}>{n(c.uso_hoy)}</span>
                      <span className="text-gris-2"> /{n(c.limite_diario)}</span>
                    </td>
                    <td className="inline pr-4 text-xs text-gris-2 md:table-cell md:text-right md:text-sm">
                      <span className="md:hidden">· </span>{haceCuanto(c.ultimo_acceso) ?? '—'}
                    </td>
                    <td className="absolute top-1 right-0 md:static md:w-[132px]">
                      <div className="flex items-center justify-end gap-1">
                      {c.activo && (estado === 'por_vencer' || estado === 'vencido') && (
                        <button type="button" className="boton h-8 px-2.5" onClick={() => renovar(c)}>Renovar</button>
                      )}
                      <MenuFila
                        cliente={c}
                        alRenovar={() => renovar(c)}
                        alClave={() => accion(async () => {
                          setCredencial({ dato: await api.nuevaClave(c.id), titulo: `Nueva contraseña de ${c.nombre}` })
                        })}
                        alSuspender={() => (c.activo ? setASuspender(c) : accion(() => api.actualizarCliente(c.id, { activo: true })))}
                      />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {nuevo && (
        <VentanaNuevo
          alCerrar={() => setNuevo(false)}
          alCrear={(dato) => {
            setNuevo(false)
            setCredencial({ dato, titulo: 'Cuenta creada' })
            cargar()
          }}
        />
      )}

      {nuevaDemo && (
        <VentanaDemo
          alCerrar={() => setNuevaDemo(false)}
          alCrear={(dato) => {
            setNuevaDemo(false)
            setCredencial({ dato, titulo: 'Demo creada' })
            cargar()
          }}
        />
      )}

      {credencial && (
        <VentanaCredencial credencial={credencial.dato} titulo={credencial.titulo} alCerrar={() => setCredencial(null)} />
      )}

      {aSuspender && (
        <Ventana titulo={`¿Suspender a ${aSuspender.nombre}?`} alCerrar={() => setASuspender(null)}>
          <p>Perderá el acceso de inmediato. Sus datos se conservan y puedes reactivarlo cuando quieras.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="boton" onClick={() => setASuspender(null)}>Cancelar</button>
            <button
              type="button"
              className="boton boton-peligro"
              onClick={() => {
                const c = aSuspender
                setASuspender(null)
                accion(() => api.actualizarCliente(c.id, { activo: false }))
              }}
            >
              Suspender acceso
            </button>
          </div>
        </Ventana>
      )}
    </div>
  )
}
