import { Factory, Globe, MapPin, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { hostDe, plural, urlDe } from '../lib/formato'
import { ESTADOS, SIN_ESTADO } from '../lib/mexico'
import { useSesion } from '../lib/sesion'
import { AREAS, GIROS, nombreArea, nombreGiro } from '../lib/types'
import type { Area, ContactoEditable, DetalleEmpresa, EmpresaEditable, Giro } from '../lib/types'
import { ErrorBloque, Ventana } from './Comunes'

function Campo({ id, etiqueta, valor, alCambiar, tipo = 'text', requerido, ayuda }: {
  id: string
  etiqueta: string
  valor: string
  alCambiar: (valor: string) => void
  tipo?: string
  requerido?: boolean
  ayuda?: string
}) {
  return (
    <div>
      <label className="etiqueta" htmlFor={id}>{etiqueta}</label>
      <input
        id={id} type={tipo} required={requerido} className="campo" value={valor}
        aria-describedby={ayuda ? `${id}-ayuda` : undefined}
        onChange={(e) => alCambiar(e.target.value)}
      />
      {ayuda && <p id={`${id}-ayuda`} className="mt-1.5 text-xs text-gris">{ayuda}</p>}
    </div>
  )
}

function useEnvio(alGuardar: () => Promise<void>) {
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await alGuardar()
    } catch (fallo) {
      setError((fallo as Error).message)
      setEnviando(false)
    }
  }
  return { error, enviando, enviar }
}

export function FormEmpresa({ inicial, alCerrar, alGuardar }: {
  inicial: EmpresaEditable | null
  alCerrar: () => void
  alGuardar: (id: number) => void
}) {
  const { api } = useSesion()
  const [datos, setDatos] = useState<EmpresaEditable>(
    inicial ?? { id: null, nombre: '', web: '', estado: SIN_ESTADO, giro: 'sin_clasificar', ubicacion: '', telefono: '' },
  )
  const fijar = (campo: keyof EmpresaEditable) => (valor: string) => setDatos((d) => ({ ...d, [campo]: valor }))
  const { error, enviando, enviar } = useEnvio(async () => alGuardar(await api.guardarEmpresa(datos)))

  return (
    <Ventana titulo={inicial ? 'Editar empresa' : 'Nueva empresa'} alCerrar={alCerrar}>
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <Campo id="e-nombre" etiqueta="Nombre" valor={datos.nombre} alCambiar={fijar('nombre')} requerido />
        <div>
          <label className="etiqueta" htmlFor="e-estado">Estado</label>
          <select id="e-estado" className="campo" value={datos.estado} onChange={(e) => fijar('estado')(e.target.value)}>
            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="e-giro">Giro</label>
          <select id="e-giro" className="campo" value={datos.giro} onChange={(e) => fijar('giro')(e.target.value as Giro)}>
            {GIROS.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </div>
        <Campo id="e-ubicacion" etiqueta="Ubicación" valor={datos.ubicacion} alCambiar={fijar('ubicacion')} />
        <Campo id="e-telefono" etiqueta="Teléfono" valor={datos.telefono} alCambiar={fijar('telefono')} />
        <Campo id="e-web" etiqueta="Sitio web" valor={datos.web} alCambiar={fijar('web')} />
        {error && <p role="alert" className="rounded-md bg-alerta-bg px-3 py-2 text-alerta-tinta">{error}</p>}
        <button type="submit" disabled={enviando} className="boton boton-primario">
          {enviando ? 'Guardando…' : 'Guardar empresa'}
        </button>
      </form>
    </Ventana>
  )
}

function FormPersona({ inicial, alCerrar, alGuardar }: {
  inicial: ContactoEditable
  alCerrar: () => void
  alGuardar: () => void
}) {
  const { api } = useSesion()
  const [datos, setDatos] = useState(inicial)
  const fijar = (campo: keyof ContactoEditable) => (valor: string) => setDatos((d) => ({ ...d, [campo]: valor }))
  const { error, enviando, enviar } = useEnvio(async () => {
    await api.guardarContacto(datos)
    alGuardar()
  })

  return (
    <Ventana titulo={inicial.id ? 'Editar persona' : 'Nueva persona'} alCerrar={alCerrar}>
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <Campo id="p-nombre" etiqueta="Nombre" valor={datos.nombre} alCambiar={fijar('nombre')} />
        <Campo id="p-puesto" etiqueta="Puesto" valor={datos.puesto} alCambiar={fijar('puesto')} />
        <div>
          <label className="etiqueta" htmlFor="p-area">Área</label>
          <select id="p-area" className="campo" value={datos.area} onChange={(e) => fijar('area')(e.target.value as Area)}>
            {AREAS.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </div>
        <Campo id="p-correo" etiqueta="Correo" tipo="email" valor={datos.correo} alCambiar={fijar('correo')} ayuda="Escribe al menos el nombre o el correo." />
        <Campo id="p-telefono" etiqueta="Teléfono directo" valor={datos.telefono} alCambiar={fijar('telefono')} />
        {error && <p role="alert" className="rounded-md bg-alerta-bg px-3 py-2 text-alerta-tinta">{error}</p>}
        <button type="submit" disabled={enviando} className="boton boton-primario">
          {enviando ? 'Guardando…' : 'Guardar persona'}
        </button>
      </form>
    </Ventana>
  )
}

function Confirmar({ titulo, texto, accion, alCerrar, alConfirmar }: {
  titulo: string
  texto: string
  accion: string
  alCerrar: () => void
  alConfirmar: () => Promise<void>
}) {
  const [error, setError] = useState('')
  return (
    <Ventana titulo={titulo} alCerrar={alCerrar}>
      <p>{texto}</p>
      {error && <p role="alert" className="mt-3 rounded-md bg-alerta-bg px-3 py-2 text-alerta-tinta">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="boton" onClick={alCerrar}>Cancelar</button>
        <button
          type="button"
          className="boton boton-peligro"
          onClick={() => alConfirmar().catch((e: Error) => setError(e.message))}
        >
          {accion}
        </button>
      </div>
    </Ventana>
  )
}

type Persona = DetalleEmpresa['contactos'][number]

export function FichaAdmin({ id, alCerrar, alCambiar }: { id: number; alCerrar: () => void; alCambiar: () => void }) {
  const { api } = useSesion()
  const [detalle, setDetalle] = useState<DetalleEmpresa | null>(null)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState(false)
  const [persona, setPersona] = useState<ContactoEditable | null>(null)
  const [borrarPersona, setBorrarPersona] = useState<Persona | null>(null)
  const [borrarEmpresa, setBorrarEmpresa] = useState(false)

  const cargar = useCallback(() => {
    api.detalle(id).then(setDetalle).catch((e: Error) => setError(e.message))
  }, [api, id])

  useEffect(cargar, [cargar])

  const refrescar = () => {
    cargar()
    alCambiar()
  }

  const empresa = detalle?.empresa
  const nuevaPersona = (): ContactoEditable => ({ id: null, empresa_id: id, nombre: '', puesto: '', area: 'compras', correo: '', telefono: '' })
  const aEditable = (c: Persona): ContactoEditable => ({
    id: c.id, empresa_id: id, nombre: c.nombre ?? '', puesto: c.puesto ?? '', area: c.area, correo: c.correo ?? '', telefono: c.telefono_directo ?? '',
  })

  return (
    <Ventana titulo={empresa?.nombre ?? 'Empresa'} alCerrar={alCerrar} lateral>
      {error && <ErrorBloque mensaje={error} />}
      {!detalle && !error && <span className="hueso h-24 w-full" />}
      {detalle && empresa && (
        <>
          <dl className="flex flex-col gap-2.5">
            <div className="flex gap-2.5">
              <dt className="pt-[3px]"><Factory size={14} className="text-gris" aria-label="Giro" /></dt>
              <dd>{nombreGiro(empresa.giro)}</dd>
            </div>
            <div className="flex gap-2.5">
              <dt className="pt-[3px]"><MapPin size={14} className="text-gris" aria-label="Ubicación" /></dt>
              <dd>{empresa.ubicacion ?? 'Sin ubicación'}{empresa.ubicacion?.includes(empresa.estado) ? '' : ` · ${empresa.estado}`}</dd>
            </div>
            <div className="flex gap-2.5">
              <dt className="pt-[3px]"><Phone size={14} className="text-gris" aria-label="Teléfono" /></dt>
              <dd className="num">{empresa.telefono ?? 'Sin teléfono'}</dd>
            </div>
            <div className="flex gap-2.5">
              <dt className="pt-[3px]"><Globe size={14} className="text-gris" aria-label="Sitio web" /></dt>
              <dd className="min-w-0 truncate">
                {empresa.web
                  ? <a href={urlDe(empresa.web)} target="_blank" rel="noreferrer noopener" className="font-medium text-jade-500 hover:underline">{hostDe(empresa.web)}</a>
                  : 'Sin sitio'}
              </dd>
            </div>
          </dl>

          <button type="button" className="boton mt-4" onClick={() => setEditando(true)}>
            <Pencil size={14} /> Editar empresa
          </button>

          <div className="mt-6 mb-1 flex items-center justify-between gap-3">
            <h3 className="font-semibold">{plural(detalle.contactos.length, 'persona', 'personas')}</h3>
            <button type="button" className="boton h-8 px-2.5" onClick={() => setPersona(nuevaPersona())}>
              <Plus size={14} /> Agregar persona
            </button>
          </div>

          {detalle.contactos.length === 0 && (
            <p className="rounded-lg border border-dashed border-control px-3 py-2.5">Esta empresa aún no tiene personas.</p>
          )}

          <ul>
            {detalle.contactos.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 border-t border-regla py-3 first:border-t-0">
                <div className="min-w-0">
                  <p className="font-medium">{c.nombre ?? 'Sin nombre'}</p>
                  <p className="text-gris">{c.puesto ?? 'Sin puesto'} · {nombreArea(c.area)}</p>
                  {c.correo && <p className="truncate">{c.correo}</p>}
                  {c.telefono_directo && <p className="num">{c.telefono_directo}</p>}
                </div>
                <div className="flex flex-none">
                  <button
                    type="button" aria-label={`Editar a ${c.nombre ?? c.correo}`} title="Editar"
                    onClick={() => setPersona(aEditable(c))}
                    className="grid size-8 cursor-pointer place-items-center rounded-md hover:bg-cantera"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button" aria-label={`Borrar a ${c.nombre ?? c.correo}`} title="Borrar"
                    onClick={() => setBorrarPersona(c)}
                    className="grid size-8 cursor-pointer place-items-center rounded-md text-alerta hover:bg-alerta-bg"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 border-t border-linea pt-4">
            <button type="button" className="boton boton-peligro" onClick={() => setBorrarEmpresa(true)}>
              <Trash2 size={14} /> Borrar empresa
            </button>
          </div>

          {editando && (
            <FormEmpresa
              inicial={{
                id: empresa.id, nombre: empresa.nombre, web: empresa.web ?? '', estado: empresa.estado, giro: empresa.giro,
                ubicacion: empresa.ubicacion ?? '', telefono: empresa.telefono ?? '',
              }}
              alCerrar={() => setEditando(false)}
              alGuardar={() => { setEditando(false); refrescar() }}
            />
          )}

          {persona && (
            <FormPersona
              inicial={persona}
              alCerrar={() => setPersona(null)}
              alGuardar={() => { setPersona(null); refrescar() }}
            />
          )}

          {borrarPersona && (
            <Confirmar
              titulo={`¿Borrar a ${borrarPersona.nombre ?? borrarPersona.correo}?`}
              texto="Desaparecerá del directorio de tus clientes. Esto no se puede deshacer."
              accion="Borrar persona"
              alCerrar={() => setBorrarPersona(null)}
              alConfirmar={async () => {
                await api.borrarContacto(borrarPersona.id)
                setBorrarPersona(null)
                refrescar()
              }}
            />
          )}

          {borrarEmpresa && (
            <Confirmar
              titulo={`¿Borrar ${empresa.nombre}?`}
              texto={`${detalle.contactos.length ? `También se borrarán ${plural(detalle.contactos.length, 'persona', 'personas')}. ` : ''}Saldrá del directorio y de los favoritos de tus clientes. Esto no se puede deshacer.`}
              accion="Borrar empresa"
              alCerrar={() => setBorrarEmpresa(false)}
              alConfirmar={async () => {
                await api.borrarEmpresa(empresa.id)
                setBorrarEmpresa(false)
                alCerrar()
                alCambiar()
              }}
            />
          )}
        </>
      )}
    </Ventana>
  )
}
