// Mosaico de México: cada estado es una tecla en una rejilla de 10 × 6.
// Conserva la posición relativa del noroeste al sureste sin depender de un mapa.
export interface Mosaico {
  nombre: string
  clave: string
  col: number
  fila: number
}

export const COLUMNAS = 10
export const FILAS = 6

export const MOSAICOS: Mosaico[] = [
  { nombre: 'Baja California', clave: 'BC', col: 0, fila: 0 },
  { nombre: 'Sonora', clave: 'SON', col: 1, fila: 0 },
  { nombre: 'Chihuahua', clave: 'CHH', col: 2, fila: 0 },
  { nombre: 'Coahuila', clave: 'COA', col: 3, fila: 0 },
  { nombre: 'Nuevo León', clave: 'NL', col: 4, fila: 0 },

  { nombre: 'Baja California Sur', clave: 'BCS', col: 0, fila: 1 },
  { nombre: 'Sinaloa', clave: 'SIN', col: 1, fila: 1 },
  { nombre: 'Durango', clave: 'DGO', col: 2, fila: 1 },
  { nombre: 'Zacatecas', clave: 'ZAC', col: 3, fila: 1 },
  { nombre: 'Tamaulipas', clave: 'TAM', col: 4, fila: 1 },

  { nombre: 'Nayarit', clave: 'NAY', col: 2, fila: 2 },
  { nombre: 'Aguascalientes', clave: 'AGS', col: 3, fila: 2 },
  { nombre: 'San Luis Potosí', clave: 'SLP', col: 4, fila: 2 },

  { nombre: 'Jalisco', clave: 'JAL', col: 2, fila: 3 },
  { nombre: 'Guanajuato', clave: 'GTO', col: 3, fila: 3 },
  { nombre: 'Querétaro', clave: 'QRO', col: 4, fila: 3 },
  { nombre: 'Hidalgo', clave: 'HGO', col: 5, fila: 3 },
  { nombre: 'Veracruz', clave: 'VER', col: 6, fila: 3 },
  { nombre: 'Yucatán', clave: 'YUC', col: 9, fila: 3 },

  { nombre: 'Colima', clave: 'COL', col: 2, fila: 4 },
  { nombre: 'Michoacán', clave: 'MIC', col: 3, fila: 4 },
  { nombre: 'Estado de México', clave: 'MEX', col: 4, fila: 4 },
  { nombre: 'Ciudad de México', clave: 'CDMX', col: 5, fila: 4 },
  { nombre: 'Tlaxcala', clave: 'TLX', col: 6, fila: 4 },
  { nombre: 'Tabasco', clave: 'TAB', col: 7, fila: 4 },
  { nombre: 'Campeche', clave: 'CAM', col: 8, fila: 4 },
  { nombre: 'Quintana Roo', clave: 'QR', col: 9, fila: 4 },

  { nombre: 'Guerrero', clave: 'GRO', col: 3, fila: 5 },
  { nombre: 'Morelos', clave: 'MOR', col: 4, fila: 5 },
  { nombre: 'Puebla', clave: 'PUE', col: 5, fila: 5 },
  { nombre: 'Oaxaca', clave: 'OAX', col: 6, fila: 5 },
  { nombre: 'Chiapas', clave: 'CHS', col: 7, fila: 5 },
]

export const SIN_ESTADO = 'Sin estado'

export const ESTADOS = [...MOSAICOS.map((m) => m.nombre).sort((a, b) => a.localeCompare(b, 'es')), SIN_ESTADO]

// Filas del Excel por estado en la carga de octubre de 2026. Solo da forma al mapa de la
// pantalla de entrada, que es pública; en el directorio los conteos vienen de la base.
export const FORMA_ENTRADA: Record<string, number> = {
  Guanajuato: 4295, 'Querétaro': 1656, 'Nuevo León': 1389, 'San Luis Potosí': 829, Coahuila: 821,
  'Ciudad de México': 681, 'Estado de México': 632, Jalisco: 558, Puebla: 553, Aguascalientes: 501,
  Chihuahua: 405, Tamaulipas: 208, 'Baja California': 188, Tlaxcala: 143, Sonora: 125, Morelos: 85,
  Durango: 66, Zacatecas: 62, Hidalgo: 46, Veracruz: 35, 'Michoacán': 17, Sinaloa: 13, Colima: 12,
  Guerrero: 12, 'Yucatán': 12, Chiapas: 8, Nayarit: 6, 'Quintana Roo': 5, Campeche: 2, Oaxaca: 2, Tabasco: 1,
}

// Escala logarítmica de cinco pasos: Guanajuato tiene miles y Tabasco uno.
export function paso(valor: number, maximo: number): number {
  if (valor <= 0 || maximo <= 0) return 0
  return Math.max(1, Math.ceil((Math.log(valor + 1) / Math.log(maximo + 1)) * 5))
}
