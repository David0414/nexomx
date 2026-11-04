// Datos ficticios para revisar la interfaz en desarrollo. Ninguna empresa ni persona
// aquí es real, y este archivo no entra al sitio publicado.
import { TAM_PAGINA, ErrorApp } from './api'
import { hoy, sumarDias } from './formato'
import { FORMA_ENTRADA, SIN_ESTADO } from './mexico'
import type {
  Actividad, AdminEmpresa, Analitica, Api, Area, Cliente, Conteos, ContactoFila, EmpresaFila, Filtros, Giro, Perfil,
} from './types'

function azar(semilla: number) {
  return () => {
    semilla = (semilla + 0x6d2b79f5) | 0
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const r = azar(2026)
const elegir = <T,>(lista: T[]) => lista[Math.floor(r() * lista.length)]

const TIPOS = ['Forjas', 'Troqueles', 'Moldes', 'Estampados', 'Arneses', 'Maquinados', 'Fundición', 'Plásticos', 'Recubrimientos', 'Inyectados', 'Autopartes', 'Tornillería', 'Herramentales', 'Empaques']
const LUGARES = ['del Bajío', 'Río Laja', 'San Roque', 'Tres Cruces', 'La Cañada', 'Los Pinos', 'Santa Rosa', 'El Marqués', 'Cerro Azul', 'Valle Alto', 'Las Huertas', 'Peñuelas', 'Sierra Gorda', 'Lomas del Sur']
const FORMAS = ['S.A. de C.V.', 'de México', 'Industrial', 'Automotriz', 'S. de R.L. de C.V.']
const NOMBRES = ['Ana Lucía', 'Carlos', 'Mariana', 'Jorge', 'Fernanda', 'Luis Ángel', 'Rocío', 'Héctor', 'Daniela', 'Óscar', 'Paola', 'Ricardo', 'Itzel', 'Tomás', 'Valeria', 'Emilio']
const APELLIDOS = ['Ramírez', 'Ortega', 'Villalobos', 'Cázares', 'Mendoza', 'Rangel', 'Zúñiga', 'Aguilar', 'Barajas', 'Treviño', 'Lozano', 'Sandoval', 'Galván', 'Arredondo']
const PUESTOS: [string, Area][] = [
  ['Comprador', 'compras'], ['Gerente de compras', 'compras'], ['Purchasing Manager', 'compras'], ['Buyer', 'compras'],
  ['Compras indirectas', 'compras'], ['Plant Manager', 'direccion'], ['Gerente general', 'direccion'],
  ['Gerente de calidad', 'calidad'], ['Quality Manager', 'calidad'], ['Gerente de mantenimiento', 'ingenieria'],
  ['Ingeniero de procesos', 'ingenieria'], ['Supply Chain Manager', 'logistica'], ['Comercio exterior', 'logistica'],
  ['Gerente de ventas', 'ventas'], ['Sales Manager', 'ventas'], ['Recursos humanos', 'rh'],
  ['Gerente de recursos humanos', 'rh'], ['Gerente de finanzas', 'finanzas'], ['Asistente de gerencia', 'otro'],
]

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const pesos = [...Object.entries(FORMA_ENTRADA), [SIN_ESTADO, 799] as [string, number]]
const sumaPesos = pesos.reduce((s, [, p]) => s + p, 0)
const estadoAlAzar = () => {
  let punto = r() * sumaPesos
  for (const [estado, peso] of pesos) {
    punto -= peso
    if (punto <= 0) return estado
  }
  return 'Guanajuato'
}

const empresas: (EmpresaFila & { busqueda: string })[] = []
const contactos: (ContactoFila & { busqueda: string })[] = []

for (let i = 1; i <= 900; i++) {
  const nombre = i === 7
    ? 'Recubrimientos y Tratamientos Térmicos de Alta Precisión para la Industria Automotriz del Bajío'
    : `${elegir(TIPOS)} ${elegir(LUGARES)} ${elegir(FORMAS)}`
  const slug = sinAcentos(nombre).replace(/[^a-z]+/g, '').slice(0, 14) + i
  const estado = estadoAlAzar()
  const giro = elegir<Giro>(['autopartes', 'autopartes', 'autopartes', 'metalmecanica', 'metalmecanica', 'plasticos', 'plasticos', 'electrica', 'logistica', 'empaque', 'quimicos', 'automatizacion', 'sin_clasificar', 'sin_clasificar', 'sin_clasificar'])
  const lada = 400 + Math.floor(r() * 80)
  const telefono = r() < 0.96 ? `+52 (${lada}) 555-${String(1000 + Math.floor(r() * 8999))}` : null
  const parque = elegir(['Parque Industrial Santa Fe', 'Parque Industrial Colinas', 'Zona Industrial Norte', 'Carretera Panamericana km 12'])
  const empresa: EmpresaFila = {
    id: i, nombre, estado, giro, telefono, web: `https://www.${slug}.example`, num_contactos: 0,
    ubicacion: estado === SIN_ESTADO ? parque : `${parque}, ${estado}`,
  }
  const cuantos = r() < 0.52 ? 0 : r() < 0.6 ? 1 : 1 + Math.ceil(r() * 3)
  for (let k = 0; k < cuantos; k++) {
    const pila = elegir(NOMBRES)
    const apellido = elegir(APELLIDOS)
    const [puesto, area] = elegir(PUESTOS)
    const correo = `${sinAcentos(pila).replace(/\s.*/, '')}.${sinAcentos(apellido)}@${slug}.example`
    const directo = r() < 0.1
    contactos.push({
      id: contactos.length + 1, empresa_id: i, empresa: nombre, estado, giro, web: empresa.web,
      nombre: `${pila} ${apellido}`, puesto, area, correo,
      telefono: directo ? `+52 (${lada}) 555-${String(1000 + Math.floor(r() * 8999))}` : telefono,
      telefono_directo: directo,
      busqueda: sinAcentos(`${pila} ${apellido} ${puesto} ${correo} ${nombre} ${empresa.ubicacion}`),
    })
    empresa.num_contactos++
  }
  empresas.push({ ...empresa, busqueda: sinAcentos(`${nombre} ${empresa.ubicacion}`) })
}

const orden = (a: string, b: string) => a.localeCompare(b, 'es')
contactos.sort((a, b) => orden(a.empresa, b.empresa))
empresas.sort((a, b) => orden(a.nombre, b.nombre))

const coincide = (texto: string, q: string) =>
  sinAcentos(q).split(/\s+/).filter(Boolean).every((t) => texto.includes(t))

const conEsteArea = (f: Filtros, id: number) =>
  contactos.some((c) => c.empresa_id === id && (!f.area || c.area === f.area))

const contactosBase = (f: Filtros) => contactos.filter((c) =>
  (!f.giro || c.giro === f.giro) && (!f.conCorreo || c.correo) && (!f.conTelefono || c.telefono) && coincide(c.busqueda, f.q))

const empresasBase = (f: Filtros) => empresas.filter((e) =>
  (!f.conTelefono || e.telefono) && (!f.conCorreo || e.num_contactos > 0) &&
  (!f.area || conEsteArea(f, e.id)) && coincide(e.busqueda, f.q))

const contar = <T,>(filas: T[], clave: (fila: T) => string) => {
  const salida: Record<string, number> = {}
  for (const fila of filas) salida[clave(fila)] = (salida[clave(fila)] ?? 0) + 1
  return salida
}

const hace = (minutos: number) => new Date(Date.now() - minutos * 60000).toISOString()

const clientes: Cliente[] = [
  { id: 'd1', nombre: 'Regina Quiroz', empresa: 'Lubricantes Cerro Azul', correo: 'regina@lubricantescerroazul.example', activo: true, vence_el: sumarDias(hoy(), 142), limite_diario: 1000, ultimo_acceso: hace(12), creado_el: hace(90000), uso_hoy: 860, demo: false, demo_minutos: 15, demo_empresas: 10, demo_inicio: null, demo_usadas: 0, demo_restante: null },
  { id: 'd2', nombre: 'Mauricio Elizondo', empresa: 'Rodamientos Norteños', correo: 'mauricio@rodamientosnortenos.example', activo: true, vence_el: sumarDias(hoy(), 6), limite_diario: 1000, ultimo_acceso: hace(190), creado_el: hace(80000), uso_hoy: 225, demo: false, demo_minutos: 15, demo_empresas: 10, demo_inicio: null, demo_usadas: 0, demo_restante: null },
  { id: 'd3', nombre: 'Sofía Bretón', empresa: 'Empaques Industriales del Centro', correo: 'sofia@empaquescentro.example', activo: true, vence_el: sumarDias(hoy(), 12), limite_diario: 500, ultimo_acceso: hace(2900), creado_el: hace(70000), uso_hoy: 0, demo: false, demo_minutos: 15, demo_empresas: 10, demo_inicio: null, demo_usadas: 0, demo_restante: null },
  { id: 'd4', nombre: 'Ernesto Palacios', empresa: 'Seguridad Industrial Palacios', correo: 'ernesto@segpalacios.example', activo: true, vence_el: sumarDias(hoy(), -3), limite_diario: 1000, ultimo_acceso: hace(7000), creado_el: hace(120000), uso_hoy: 0, demo: false, demo_minutos: 15, demo_empresas: 10, demo_inicio: null, demo_usadas: 0, demo_restante: null },
  { id: 'd5', nombre: 'Lorena Treviño', empresa: 'Consultoría LT', correo: 'lorena@consultorialt.example', activo: true, vence_el: sumarDias(hoy(), 58), limite_diario: 1000, ultimo_acceso: hace(45), creado_el: hace(30000), uso_hoy: 350, demo: false, demo_minutos: 15, demo_empresas: 10, demo_inicio: null, demo_usadas: 0, demo_restante: null },
  { id: 'd6', nombre: 'Andrés Beltrán', empresa: 'Beltrán Herramientas', correo: 'andres@beltranherramientas.example', activo: false, vence_el: sumarDias(hoy(), 40), limite_diario: 1000, ultimo_acceso: hace(30000), creado_el: hace(100000), uso_hoy: 0, demo: false, demo_minutos: 15, demo_empresas: 10, demo_inicio: null, demo_usadas: 0, demo_restante: null },
  { id: 'd7', nombre: 'Patricia Guerra', empresa: null, correo: 'patricia.guerra@correo.example', activo: true, vence_el: null, limite_diario: 2000, ultimo_acceso: null, creado_el: hace(600), uso_hoy: 0, demo: false, demo_minutos: 15, demo_empresas: 10, demo_inicio: null, demo_usadas: 0, demo_restante: null },
  { id: 'd8', nombre: 'Gabriela Montes', empresa: null, correo: 'gabriela@bandasnorte.example', activo: true, vence_el: null, limite_diario: 1000, ultimo_acceso: hace(3), creado_el: hace(900), uso_hoy: 0, demo: true, demo_minutos: 15, demo_empresas: 10, demo_inicio: hace(6), demo_usadas: 4, demo_restante: 540 },
  { id: 'd9', nombre: 'Rubén Ochoa', empresa: null, correo: 'ruben@ochoamaquinados.example', activo: true, vence_el: null, limite_diario: 1000, ultimo_acceso: null, creado_el: hace(120), uso_hoy: 0, demo: true, demo_minutos: 15, demo_empresas: 10, demo_inicio: null, demo_usadas: 0, demo_restante: null },
  { id: 'd10', nombre: 'Claudia Sáenz', empresa: null, correo: 'claudia@saenzempaques.example', activo: true, vence_el: null, limite_diario: 1000, ultimo_acceso: hace(4000), creado_el: hace(5000), uso_hoy: 0, demo: true, demo_minutos: 15, demo_empresas: 10, demo_inicio: hace(4000), demo_usadas: 10, demo_restante: 0 },
]

const actividad: Actividad[] = [
  ['d1', 'personas', { q: '', estado: 'Guanajuato', area: 'compras' }, 25, 12],
  ['d1', 'personas', { q: 'estampado', estado: 'Guanajuato', area: null }, 18, 16],
  ['d5', 'empresas', { q: '', estado: 'Querétaro', area: null }, 25, 45],
  ['d1', 'empresa', { empresa_id: 12 }, 3, 52],
  ['d5', 'personas', { q: 'calidad', estado: null, area: 'calidad' }, 25, 70],
  ['d2', 'personas', { q: '', estado: 'Nuevo León', area: 'direccion' }, 25, 190],
  ['d2', 'personas', { q: 'plant manager', estado: 'Coahuila', area: null }, 11, 205],
].map(([cliente, tipo, filtros, resultados, minutos], i) => {
  const c = clientes.find((x) => x.id === cliente)!
  return {
    id: i + 1, tipo, filtros, resultados, creado_el: hace(minutos as number), nombre: c.nombre, empresa: c.empresa,
  } as Actividad
})

let perfil: Perfil | null = null

const favoritos = new Set(empresas.filter((e) => e.num_contactos > 1).slice(3, 7).map((e) => e.id))

const claveDemo = () => 'k7Hn2vQpX4mRtz'

const desbloqueadas = new Set<number>()
const inicioDemo = Date.now()
const bloqueada = (id: number) => Boolean(perfil?.demo) && !desbloqueadas.has(id)

export const apiDemo: Api = {
  async sesion() {
    // ?demo=admin o ?demo=cliente entra directo, para revisar pantallas.
    const rol = new URLSearchParams(location.search).get('demo')
    if (rol && !perfil) await apiDemo.entrar(rol === 'admin' ? 'admin@nexomx.example' : rol === 'prueba' ? 'prueba' : 'regina@lubricantescerroazul.example', '')
    return perfil
  },
  async entrar(correo) {
    const base = { activo: true, demo: false, demo_minutos: 15, demo_empresas: 10, demo_inicio: null, demo_usadas: 0, demo_restante: null }
    perfil = correo.includes('admin')
      ? { ...base, id: 'adm', nombre: 'David Mendoza', empresa: 'NexoMx', correo, rol: 'admin', vence_el: null, limite_diario: 0 }
      : correo === 'prueba'
        ? { ...base, id: 'd8', nombre: 'Invitado', empresa: null, correo: 'demo@nexomx.mx', rol: 'cliente', vence_el: null, limite_diario: 1000, demo: true }
        : { ...base, id: 'd1', nombre: 'Regina Quiroz', empresa: 'Lubricantes Cerro Azul', correo, rol: 'cliente', vence_el: sumarDias(hoy(), 142), limite_diario: 1000 }
    return perfil
  },
  async salir() {
    perfil = null
  },
  async cambiarClave() {},
  async contactos(f, pagina) {
    const base = contactosBase(f).filter((c) => (!f.estado || c.estado === f.estado) && (!f.area || c.area === f.area))
    const filas = base.slice(pagina * TAM_PAGINA, (pagina + 1) * TAM_PAGINA)
    return {
      total: base.length,
      filas: filas.map((c) => (bloqueada(c.empresa_id)
        ? { ...c, bloqueada: true, nombre: 'Nombre del contacto', puesto: 'Puesto del contacto', correo: 'contacto@empresa.com', telefono: '+52 000 000 0000', telefono_directo: false }
        : c)),
    }
  },
  async empresas(f, pagina) {
    const base = empresasBase(f).filter((e) => (!f.estado || e.estado === f.estado) && (!f.giro || e.giro === f.giro))
    return {
      total: base.length,
      filas: base.slice(pagina * TAM_PAGINA, (pagina + 1) * TAM_PAGINA).map((e) => (bloqueada(e.id)
        ? { ...e, bloqueada: true, telefono: '+52 000 000 0000' }
        : e)),
    }
  },
  async conteos(f) {
    const c = contactosBase(f)
    const e = empresasBase({ ...f, giro: null })
    const eg = e.filter((x) => !f.giro || x.giro === f.giro)
    const porArea = c.filter((x) => !f.area || x.area === f.area)
    const porEstado = c.filter((x) => !f.estado || x.estado === f.estado)
    return {
      personas: porArea.filter((x) => !f.estado || x.estado === f.estado).length,
      empresas: eg.filter((x) => !f.estado || x.estado === f.estado).length,
      estados_personas: contar(porArea, (x) => x.estado),
      estados_empresas: contar(eg, (x) => x.estado),
      giros: contar(e.filter((x) => !f.estado || x.estado === f.estado), (x) => x.giro),
      areas: contar(porEstado, (x) => x.area),
    } as Conteos
  },
  async detalle(id) {
    const empresa = empresas.find((e) => e.id === id)
    if (!empresa) throw new ErrorApp('empresa_no_encontrada')
    const oculta = bloqueada(id)
    return {
      bloqueada: oculta,
      empresa: oculta ? { ...empresa, telefono: '+52 000 000 0000' } : empresa,
      contactos: contactos.filter((c) => c.empresa_id === id).map((c) => (oculta
        ? { id: c.id, nombre: 'Nombre del contacto', puesto: 'Puesto del contacto', area: c.area, correo: 'contacto@empresa.com', telefono_directo: null }
        : { id: c.id, nombre: c.nombre, puesto: c.puesto, area: c.area, correo: c.correo, telefono_directo: c.telefono_directo ? c.telefono : null })),
    }
  },
  async usoHoy() {
    return 860
  },
  async demoEstado() {
    return { restante: Math.max(900 - Math.round((Date.now() - inicioDemo) / 1000), 0), usadas: desbloqueadas.size, limite: 10 }
  },
  async demoDesbloquear(id) {
    if (desbloqueadas.size >= 10 && !desbloqueadas.has(id)) throw new ErrorApp('demo_sin_empresas')
    desbloqueadas.add(id)
  },
  async crearDemo(datos) {
    const id = `d${clientes.length + 1}`
    clientes.unshift({
      id, nombre: datos.nombre, empresa: null, correo: datos.correo, activo: true, vence_el: null, limite_diario: 1000,
      ultimo_acceso: null, creado_el: new Date().toISOString(), uso_hoy: 0, demo: true, demo_minutos: datos.minutos,
      demo_empresas: datos.empresas, demo_inicio: null, demo_usadas: 0, demo_restante: null,
    })
    return { id, correo: datos.correo, clave: claveDemo() }
  },
  async reiniciarDemo(id) {
    Object.assign(clientes.find((c) => c.id === id)!, { demo_inicio: null, demo_usadas: 0, demo_restante: null })
  },
  async favoritos() {
    return [...favoritos].flatMap((id) => empresas.filter((e) => e.id === id))
  },
  async alternarFavorito(id) {
    if (favoritos.delete(id)) return false
    if (favoritos.size >= 200) throw new ErrorApp('limite_favoritos')
    favoritos.add(id)
    return true
  },
  async destacadas() {
    return [...empresas].sort((a, b) => b.num_contactos - a.num_contactos).slice(0, 8)
  },
  async clientes() {
    return clientes.map((c) => ({ ...c }))
  },
  async guardarEmpresa(d) {
    if (!d.nombre.trim()) throw new ErrorApp('nombre_requerido')
    const datos = {
      nombre: d.nombre.trim(), web: d.web.trim() || null, estado: d.estado, giro: d.giro,
      ubicacion: d.ubicacion.trim() || null, telefono: d.telefono.trim() || null,
      busqueda: sinAcentos(`${d.nombre} ${d.ubicacion}`),
    }
    const existente = empresas.find((e) => e.id === d.id)
    if (existente) {
      Object.assign(existente, datos)
      return existente.id
    }
    const id = Math.max(...empresas.map((e) => e.id)) + 1
    empresas.unshift({ id, num_contactos: 0, ...datos })
    return id
  },
  async borrarEmpresa(id) {
    empresas.splice(empresas.findIndex((e) => e.id === id), 1)
    for (let i = contactos.length - 1; i >= 0; i--) if (contactos[i].empresa_id === id) contactos.splice(i, 1)
    favoritos.delete(id)
  },
  async guardarContacto(d) {
    if (!d.nombre.trim() && !d.correo.trim()) throw new ErrorApp('contacto_incompleto')
    const empresa = empresas.find((e) => e.id === d.empresa_id)!
    const datos = {
      nombre: d.nombre.trim() || null, puesto: d.puesto.trim() || null, area: d.area,
      correo: d.correo.trim().toLowerCase() || null, telefono: d.telefono.trim() || empresa.telefono,
      telefono_directo: Boolean(d.telefono.trim()), busqueda: sinAcentos(`${d.nombre} ${d.puesto} ${d.correo} ${empresa.busqueda}`),
    }
    const existente = contactos.find((c) => c.id === d.id)
    if (existente) {
      Object.assign(existente, datos)
      return existente.id
    }
    const id = Math.max(...contactos.map((c) => c.id)) + 1
    contactos.push({ id, empresa_id: empresa.id, empresa: empresa.nombre, estado: empresa.estado, giro: empresa.giro, web: empresa.web, ...datos })
    empresa.num_contactos++
    return id
  },
  async borrarContacto(id) {
    const i = contactos.findIndex((c) => c.id === id)
    empresas.find((e) => e.id === contactos[i].empresa_id)!.num_contactos--
    contactos.splice(i, 1)
  },
  async analitica(dias) {
    const hoyIso = hoy()
    const por_dia = Array.from({ length: dias }, (_, i) => ({
      dia: sumarDias(hoyIso, i - dias + 1),
      consultas: (i * 7 + 3) % 5 === 0 ? 2 : ((i * 11) % 9) + 4,
    }))
    const consultas = por_dia.reduce((s, d) => s + d.consultas, 0)
    const activos = clientes.filter((c) => c.activo && (!c.vence_el || c.vence_el >= hoyIso))
    return {
      clientes: {
        total: clientes.length,
        activos: activos.length,
        por_vencer: activos.filter((c) => c.vence_el && c.vence_el <= sumarDias(hoyIso, 15)).length,
        vencidos: clientes.filter((c) => c.activo && c.vence_el && c.vence_el < hoyIso).length,
        suspendidos: clientes.filter((c) => !c.activo).length,
      },
      usuarios_activos: 3,
      consultas,
      fichas: Math.round(consultas * 0.4),
      resultados: consultas * 18,
      por_dia,
      busquedas: [
        { q: 'estampado', veces: 18, usuarios: 3 }, { q: 'gerente de compras', veces: 14, usuarios: 2 },
        { q: 'plant manager', veces: 11, usuarios: 2 }, { q: 'inyección de plástico', veces: 9, usuarios: 2 },
        { q: 'lubricantes', veces: 6, usuarios: 1 },
      ],
      sin_resultados: [{ q: 'farmacéutica', veces: 4 }, { q: 'aeroespacial tijuana', veces: 2 }],
      estados: [
        { estado: 'Guanajuato', veces: 34 }, { estado: 'Querétaro', veces: 21 },
        { estado: 'Nuevo León', veces: 16 }, { estado: 'Coahuila', veces: 9 }, { estado: 'Jalisco', veces: 5 },
      ],
      areas: [
        { area: 'compras', veces: 41 }, { area: 'direccion', veces: 15 }, { area: 'calidad', veces: 12 },
        { area: 'logistica', veces: 7 }, { area: 'ingenieria', veces: 4 },
      ],
      empresas: empresas.filter((e) => e.num_contactos > 2).slice(0, 5).map((e, i) => ({ id: e.id, nombre: e.nombre, veces: 9 - i * 2 })),
      uso: clientes.filter((c) => c.ultimo_acceso).slice(0, 4).map((c, i) => ({
        id: c.id, nombre: c.nombre, empresa: c.empresa, consultas: 40 - i * 11, resultados: 860 - i * 240, ultima: c.ultimo_acceso,
      })),
      recientes: actividad,
    } as Analitica
  },
  async girosConsultados() {
    return [{ giro: 'autopartes' as Giro, veces: 38 }, { giro: 'plasticos' as Giro, veces: 19 }, { giro: 'metalmecanica' as Giro, veces: 12 }]
  },
  async adminEmpresas(q, estado, giro, filtro, pagina) {
    const base = empresas.filter((e) => (!estado || e.estado === estado) && (!giro || e.giro === giro) && coincide(e.busqueda, q))
    const prueba: Record<string, (e: EmpresaFila) => boolean> = {
      todas: () => true,
      con_personas: (e) => e.num_contactos > 0,
      sin_personas: (e) => e.num_contactos === 0,
      sin_telefono: (e) => !e.telefono,
      sin_web: (e) => !e.web,
      sin_estado: (e) => e.estado === SIN_ESTADO,
      sin_giro: (e) => e.giro === 'sin_clasificar',
    }
    const conteos = Object.fromEntries(Object.entries(prueba).map(([k, f]) => [k, base.filter(f).length])) as Record<keyof typeof prueba, number>
    const filas = base.filter(prueba[filtro])
    return {
      total: filas.length,
      conteos: conteos as never,
      filas: filas.slice(pagina * 50, (pagina + 1) * 50).map((e): AdminEmpresa => ({
        ...e, enlace_origen: 'https://origen.example/ficha', con_correo: e.num_contactos,
      })),
    }
  },
  async crearCliente(datos) {
    if (clientes.some((c) => c.correo === datos.correo)) throw new ErrorApp('correo_duplicado')
    const id = `d${clientes.length + 1}`
    clientes.unshift({ ...datos, id, empresa: datos.empresa || null, activo: true, ultimo_acceso: null, creado_el: new Date().toISOString(), uso_hoy: 0, demo: false, demo_minutos: 15, demo_empresas: 10, demo_inicio: null, demo_usadas: 0, demo_restante: null })
    return { id, correo: datos.correo, clave: claveDemo() }
  },
  async nuevaClave(id) {
    return { id, correo: clientes.find((c) => c.id === id)!.correo, clave: claveDemo() }
  },
  async actualizarCliente(id, cambios) {
    Object.assign(clientes.find((c) => c.id === id)!, cambios)
  },
}
