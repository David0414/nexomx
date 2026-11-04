import { Check, Copy, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export function Copiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [listo, setListo] = useState(false)
  return (
    <button
      type="button"
      aria-label={listo ? 'Copiado' : `Copiar ${etiqueta}`}
      title={listo ? 'Copiado' : `Copiar ${etiqueta}`}
      onClick={async (e) => {
        e.stopPropagation()
        await navigator.clipboard.writeText(texto)
        setListo(true)
        setTimeout(() => setListo(false), 1500)
      }}
      className="grid size-9 flex-none cursor-pointer place-items-center rounded text-gris hover:bg-cantera hover:text-obsidiana md:size-6"
    >
      {listo ? <Check size={13} className="text-jade-500" /> : <Copy size={13} />}
    </button>
  )
}

// Ventana nativa: el navegador se encarga del foco y de cerrar con Esc.
export function Ventana({ titulo, alCerrar, lateral, pie, children }: {
  titulo: string
  alCerrar: () => void
  lateral?: boolean
  pie?: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      onClose={alCerrar}
      onClick={(e) => e.target === ref.current && alCerrar()}
      aria-label={titulo}
      className={`hoja shadow-xl ${lateral ? 'hoja-alta' : ''}`}
    >
      <div className="flex h-full max-h-[inherit] flex-col">
        <span aria-hidden className="mx-auto mt-2 h-1 w-9 flex-none rounded-full bg-control sm:hidden" />
        <div className="flex flex-none items-start justify-between gap-4 px-5 pt-3 pb-3 sm:px-6 sm:pt-5 sm:pb-4">
          <h2 className="text-[17px] leading-6 font-semibold sm:text-base">{titulo}</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={alCerrar}
            className="-mt-2 -mr-2 grid size-11 flex-none cursor-pointer place-items-center rounded-md hover:bg-cantera sm:-mt-1 sm:size-8"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 sm:px-6">{children}</div>
        {pie && <div className="flex-none border-t border-linea p-4">{pie}</div>}
      </div>
    </dialog>
  )
}

export function ErrorBloque({ mensaje, alReintentar }: { mensaje: string; alReintentar?: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-control px-4 py-3">
      <p>{mensaje}</p>
      {alReintentar && (
        <button type="button" onClick={alReintentar} className="mt-1 cursor-pointer font-medium underline underline-offset-2">
          Reintentar
        </button>
      )}
    </div>
  )
}

export function Pestanas<T extends string>({ opciones, valor, alCambiar, etiqueta, repartir }: {
  opciones: { id: T; nombre: string; cuenta?: number | string }[]
  valor: T
  alCambiar: (id: T) => void
  etiqueta: string
  repartir?: boolean
}) {
  return (
    <div role="tablist" aria-label={etiqueta} className="sin-barra -mx-4 flex gap-5 overflow-x-auto border-b border-linea px-4 md:mx-0 md:gap-6 md:px-0">
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={valor === o.id}
          onClick={() => alCambiar(o.id)}
          className={`-mb-px flex h-11 cursor-pointer items-center gap-1.5 border-b-[3px] md:h-10 ${repartir ? 'flex-1 justify-center md:flex-none' : 'flex-none'} ${
            valor === o.id ? 'border-jade-500 font-semibold' : 'border-transparent text-gris hover:text-obsidiana'
          }`}
        >
          {o.nombre}
          {o.cuenta !== undefined && <span className="num font-normal">{o.cuenta}</span>}
        </button>
      ))}
    </div>
  )
}
