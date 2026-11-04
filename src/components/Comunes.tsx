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
      className="grid size-6 flex-none cursor-pointer place-items-center rounded text-gris-2 hover:bg-cantera hover:text-obsidiana"
    >
      {listo ? <Check size={13} className="text-jade-500" /> : <Copy size={13} />}
    </button>
  )
}

// Ventana nativa: el navegador se encarga del foco y de cerrar con Esc.
export function Ventana({ titulo, alCerrar, lateral, children }: {
  titulo: string
  alCerrar: () => void
  lateral?: boolean
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
      className={
        lateral
          ? 'ml-auto h-dvh max-h-dvh w-full max-w-[480px] bg-papel text-obsidiana'
          : 'm-auto w-[calc(100%-32px)] max-w-[480px] rounded-xl bg-papel text-obsidiana shadow-xl'
      }
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
          <h2 className="text-base leading-6 font-semibold">{titulo}</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={alCerrar}
            className="-mt-1 -mr-2 grid size-8 flex-none cursor-pointer place-items-center rounded-md hover:bg-cantera"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
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

export function Pestanas<T extends string>({ opciones, valor, alCambiar, etiqueta }: {
  opciones: { id: T; nombre: string; cuenta?: number | string }[]
  valor: T
  alCambiar: (id: T) => void
  etiqueta: string
}) {
  return (
    <div role="tablist" aria-label={etiqueta} className="flex gap-6 overflow-x-auto border-b border-linea">
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={valor === o.id}
          onClick={() => alCambiar(o.id)}
          className={`-mb-px flex h-10 flex-none cursor-pointer items-center gap-1.5 border-b-[3px] ${
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
