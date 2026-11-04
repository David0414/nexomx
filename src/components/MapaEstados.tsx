import { COLUMNAS, FILAS, MOSAICOS, SIN_ESTADO, paso } from '../lib/mexico'
import { n } from '../lib/formato'

const RAMPA_CLARA = [
  'bg-cantera text-gris',
  'bg-jade-50 text-obsidiana',
  'bg-jade-100 text-obsidiana',
  'bg-jade-200 text-obsidiana',
  'bg-jade-300 text-white',
  'bg-jade-700 text-white',
]

const RAMPA_OSCURA = [
  'bg-obsidiana-2 text-gris-2',
  'bg-[#17332c] text-jade-200',
  'bg-[#1d4a3f] text-jade-100',
  'bg-[#20705f] text-white',
  'bg-[#3a9a85] text-obsidiana',
  'bg-jade-claro text-obsidiana',
]

interface Propiedades {
  conteos: Record<string, number>
  seleccionado?: string | null
  alElegir?: (estado: string | null) => void
  unidad?: string
  oscuro?: boolean
}

export function MapaEstados({ conteos, seleccionado, alElegir, unidad = '', oscuro }: Propiedades) {
  const maximo = Math.max(0, ...MOSAICOS.map((m) => conteos[m.nombre] ?? 0))
  const rampa = oscuro ? RAMPA_OSCURA : RAMPA_CLARA

  return (
    <div
      role={alElegir ? 'group' : 'img'}
      aria-label="Mapa de México por estado"
      className="grid gap-[3px]"
      style={{
        gridTemplateColumns: `repeat(${COLUMNAS}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${FILAS}, auto)`,
      }}
    >
      {MOSAICOS.map((m) => {
        const valor = conteos[m.nombre] ?? 0
        const activo = seleccionado === m.nombre
        const tono = activo ? 'bg-obsidiana text-white' : rampa[paso(valor, maximo)]
        const posicion = { gridColumn: m.col + 1, gridRow: m.fila + 1 }
        const clase = `grid aspect-square place-items-center rounded-[3px] leading-none font-medium ${m.clave.length > 3 ? 'text-[9.5px] md:text-[10px]' : 'text-[11px]'} ${tono}`

        if (!alElegir) {
          return <span key={m.clave} style={posicion} className={clase}>{m.clave}</span>
        }
        return (
          <button
            key={m.clave}
            type="button"
            style={posicion}
            aria-pressed={activo}
            aria-label={`${m.nombre}: ${n(valor)} ${unidad}`}
            title={`${m.nombre}: ${n(valor)} ${unidad}`}
            onClick={() => alElegir(activo ? null : m.nombre)}
            className={`${clase} cursor-pointer transition-transform hover:scale-110 hover:z-10 ${activo ? 'outline-2 outline-offset-1 outline-cempasuchil' : ''}`}
          >
            {m.clave}
          </button>
        )
      })}
    </div>
  )
}

export function LeyendaMapa({ sinEstado, seleccionado, alElegir }: {
  sinEstado: number
  seleccionado: string | null
  alElegir: (estado: string | null) => void
}) {
  const activo = seleccionado === SIN_ESTADO
  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gris-2">
      <span className="flex items-center gap-1.5">
        Menos
        <span className="flex gap-0.5" aria-hidden>
          {RAMPA_CLARA.slice(1).map((clase) => <i key={clase} className={`size-2.5 rounded-[2px] ${clase}`} />)}
        </span>
        Más
      </span>
      {sinEstado > 0 && (
        <button
          type="button"
          aria-pressed={activo}
          onClick={() => alElegir(activo ? null : SIN_ESTADO)}
          className={`num cursor-pointer rounded px-1 underline-offset-2 hover:underline ${activo ? 'bg-obsidiana text-white' : ''}`}
        >
          Sin estado {n(sinEstado)}
        </button>
      )}
    </div>
  )
}
