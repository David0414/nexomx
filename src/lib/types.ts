export type Area =
  | 'compras' | 'ventas' | 'ingenieria' | 'rh' | 'logistica'
  | 'direccion' | 'calidad' | 'finanzas' | 'otro'

export const AREAS: { id: Area; nombre: string }[] = [
  { id: 'compras', nombre: 'Compras' },
  { id: 'direccion', nombre: 'Dirección y planta' },
  { id: 'ingenieria', nombre: 'Ingeniería y producción' },
  { id: 'calidad', nombre: 'Calidad' },
  { id: 'logistica', nombre: 'Logística' },
  { id: 'ventas', nombre: 'Ventas' },
  { id: 'rh', nombre: 'Recursos humanos' },
  { id: 'finanzas', nombre: 'Finanzas' },
  { id: 'otro', nombre: 'Otras áreas' },
]

export const nombreArea = (id: Area) => AREAS.find((a) => a.id === id)?.nombre ?? id

export type Giro =
  | 'armadoras' | 'autopartes' | 'plasticos' | 'metalmecanica' | 'electrica' | 'automatizacion' | 'quimicos'
  | 'empaque' | 'logistica' | 'construccion' | 'servicios_industriales' | 'servicios_profesionales'
  | 'comercializadoras' | 'manufactura' | 'sin_clasificar'

export const GIROS: { id: Giro; nombre: string }[] = [
  { id: 'armadoras', nombre: 'Armadoras de vehículos' },
  { id: 'autopartes', nombre: 'Autopartes y sistemas' },
  { id: 'plasticos', nombre: 'Plásticos y hule' },
  { id: 'metalmecanica', nombre: 'Metalmecánica y herramentales' },
  { id: 'electrica', nombre: 'Eléctrica y electrónica' },
  { id: 'automatizacion', nombre: 'Automatización y maquinaria' },
  { id: 'quimicos', nombre: 'Químicos y recubrimientos' },
  { id: 'empaque', nombre: 'Empaque y embalaje' },
  { id: 'logistica', nombre: 'Logística y transporte' },
  { id: 'construccion', nombre: 'Construcción e instalaciones' },
  { id: 'servicios_industriales', nombre: 'Servicios a la industria' },
  { id: 'servicios_profesionales', nombre: 'Consultoría y profesionales' },
  { id: 'comercializadoras', nombre: 'Comercializadoras' },
  { id: 'manufactura', nombre: 'Manufactura en general' },
  { id: 'sin_clasificar', nombre: 'Sin clasificar' },
]

export const nombreGiro = (id: Giro) => GIROS.find((g) => g.id === id)?.nombre ?? id

export interface Perfil {
  id: string
  nombre: string
  empresa: string | null
  correo: string
  rol: 'admin' | 'cliente'
  activo: boolean
  vence_el: string | null
  limite_diario: number
  demo: boolean
  ocultar_contacto: boolean
  limite_consultas: number
}

export interface Filtros {
  q: string
  estado: string | null
  area: Area | null
  giro: Giro | null
  conCorreo: boolean
  conTelefono: boolean
}

export interface ContactoFila {
  id: number
  empresa_id: number
  empresa: string
  estado: string
  giro: Giro
  nombre: string | null
  puesto: string | null
  area: Area
  correo: string | null
  telefono: string | null
  telefono_directo: boolean
  web: string | null
}

export interface EmpresaFila {
  id: number
  nombre: string
  estado: string
  giro: Giro
  ubicacion: string | null
  telefono: string | null
  web: string | null
  num_contactos: number
}

export interface EmpresaResumen {
  id: number
  nombre: string
  estado: string
  giro: Giro
  web: string | null
  num_contactos: number
  telefono?: string | null
}

export interface Pagina<T> {
  total: number
  filas: T[]
}

export interface Conteos {
  personas: number
  empresas: number
  estados_personas: Record<string, number>
  estados_empresas: Record<string, number>
  areas: Partial<Record<Area, number>>
  giros: Partial<Record<Giro, number>>
}

export interface DetalleEmpresa {
  empresa: Omit<EmpresaFila, 'num_contactos'>
  contactos: {
    id: number
    nombre: string | null
    puesto: string | null
    area: Area
    correo: string | null
    telefono_directo: string | null
  }[]
}

export interface Cliente {
  id: string
  nombre: string
  empresa: string | null
  correo: string
  activo: boolean
  vence_el: string | null
  limite_diario: number
  ultimo_acceso: string | null
  creado_el: string
  uso_hoy: number
  demo: boolean
  ocultar_contacto: boolean
  limite_consultas: number
}

export interface NuevoCliente {
  nombre: string
  empresa: string
  correo: string
  vence_el: string | null
  limite_diario: number
}

export interface CambiosCliente {
  activo?: boolean
  vence_el?: string | null
  limite_diario?: number
}

export interface Credencial {
  id: string
  correo: string
  clave: string
}

export interface Actividad {
  id: number
  tipo: 'personas' | 'empresas' | 'empresa'
  filtros: { q?: string; estado?: string | null; area?: Area | null; giro?: Giro | null; pagina?: number; empresa_id?: number }
  resultados: number
  creado_el: string
  nombre: string
  empresa: string | null
  empresa_vista?: string | null
}

export interface Analitica {
  clientes: { total: number; activos: number; por_vencer: number; vencidos: number; suspendidos: number }
  usuarios_activos: number
  consultas: number
  fichas: number
  resultados: number
  por_dia: { dia: string; consultas: number }[]
  busquedas: { q: string; veces: number; usuarios: number }[]
  sin_resultados: { q: string; veces: number }[]
  estados: { estado: string; veces: number }[]
  areas: { area: Area; veces: number }[]
  empresas: { id: number; nombre: string; veces: number }[]
  uso: { id: string; nombre: string; empresa: string | null; consultas: number; resultados: number; ultima: string | null }[]
  recientes: Actividad[]
}

export interface EmpresaEditable {
  id: number | null
  nombre: string
  web: string
  estado: string
  giro: Giro
  ubicacion: string
  telefono: string
}

export interface ContactoEditable {
  id: number | null
  empresa_id: number
  nombre: string
  puesto: string
  area: Area
  correo: string
  telefono: string
}

export type FiltroEmpresas = 'todas' | 'con_personas' | 'sin_personas' | 'sin_telefono' | 'sin_web' | 'sin_estado' | 'sin_giro'

export interface AdminEmpresa extends EmpresaFila {
  enlace_origen: string
  con_correo: number
}

export interface AdminEmpresas {
  total: number
  filas: AdminEmpresa[]
  conteos: Record<FiltroEmpresas, number>
}

export interface Api {
  sesion(): Promise<Perfil | null>
  entrar(correo: string, clave: string): Promise<Perfil>
  salir(): Promise<void>
  cambiarClave(nueva: string): Promise<void>
  contactos(filtros: Filtros, pagina: number): Promise<Pagina<ContactoFila>>
  empresas(filtros: Filtros, pagina: number): Promise<Pagina<EmpresaFila>>
  conteos(filtros: Filtros): Promise<Conteos>
  detalle(id: number): Promise<DetalleEmpresa>
  usoHoy(): Promise<number>
  demoEstado(): Promise<{ usadas: number; limite: number }>
  ajustarDemo(limite: number, ocultar: boolean): Promise<void>
  favoritos(): Promise<EmpresaFila[]>
  alternarFavorito(id: number): Promise<boolean>
  destacadas(): Promise<EmpresaResumen[]>
  clientes(): Promise<Cliente[]>
  analitica(dias: number): Promise<Analitica>
  adminEmpresas(q: string, estado: string | null, giro: Giro | null, filtro: FiltroEmpresas, pagina: number): Promise<AdminEmpresas>
  girosConsultados(dias: number): Promise<{ giro: Giro; veces: number }[]>
  guardarEmpresa(datos: EmpresaEditable): Promise<number>
  borrarEmpresa(id: number): Promise<void>
  guardarContacto(datos: ContactoEditable): Promise<number>
  borrarContacto(id: number): Promise<void>
  crearCliente(datos: NuevoCliente): Promise<Credencial>
  nuevaClave(id: string): Promise<Credencial>
  actualizarCliente(id: string, cambios: CambiosCliente): Promise<void>
}
