import type { Cliente } from './types'

const numero = new Intl.NumberFormat('es-MX')
export const n = (valor: number) => numero.format(valor)

export const plural = (valor: number, uno: string, varios: string) => `${n(valor)} ${valor === 1 ? uno : varios}`

const fechaLarga = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
export const fecha = (iso: string) => fechaLarga.format(new Date(`${iso.slice(0, 10)}T12:00:00Z`))

const hoyIso = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())

export const sumarDias = (iso: string, dias: number) => {
  const base = new Date(`${iso}T12:00:00Z`)
  base.setUTCDate(base.getUTCDate() + dias)
  return base.toISOString().slice(0, 10)
}

export const hoy = hoyIso

export const diasHasta = (iso: string) =>
  Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${hoyIso()}T12:00:00Z`)) / 86400000)

export function haceCuanto(iso: string | null) {
  if (!iso) return null
  const minutos = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (minutos < 1) return 'Ahora'
  if (minutos < 60) return `Hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `Hace ${horas} h`
  const dias = Math.round(horas / 24)
  if (dias === 1) return 'Ayer'
  return `Hace ${dias} días`
}

export type EstadoCliente = 'activo' | 'por_vencer' | 'vencido' | 'suspendido'

export const DIAS_AVISO = 15

export function estadoCliente(cliente: Cliente): EstadoCliente {
  if (!cliente.activo) return 'suspendido'
  if (!cliente.vence_el) return 'activo'
  const dias = diasHasta(cliente.vence_el)
  if (dias < 0) return 'vencido'
  return dias <= DIAS_AVISO ? 'por_vencer' : 'activo'
}

export function textoVencimiento(iso: string | null) {
  if (!iso) return 'Sin vencimiento'
  const dias = diasHasta(iso)
  if (dias < -1) return `Venció hace ${-dias} días`
  if (dias === -1) return 'Venció ayer'
  if (dias === 0) return 'Vence hoy'
  if (dias === 1) return 'Vence mañana'
  return `En ${dias} días`
}

export const hostDe = (web: string) => web.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')

export const urlDe = (web: string) => (/^https?:\/\//.test(web) ? web : `https://${web}`)
