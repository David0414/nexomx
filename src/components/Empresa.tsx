import { Factory, Globe, Lock, Mail, MapPin, Phone, Star } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { modoDemo } from '../lib/api'
import { useFavoritos } from '../lib/favoritos'
import { hostDe, plural, urlDe } from '../lib/formato'
import { SIN_ESTADO } from '../lib/mexico'
import { usePerfil, useSesion } from '../lib/sesion'
import { nombreArea, nombreGiro } from '../lib/types'
import type { DetalleEmpresa, EmpresaResumen, EstadoDemo } from '../lib/types'
import { Copiar, ErrorBloque, Ventana } from './Comunes'

const COLORES = ['#0a6b58', '#1f4e8c', '#8a5a00', '#9c2f45', '#2f5d3a', '#3d4f5c']
const VACIAS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'sa', 's.a.', 's.', 'cv', 'c.v.'])

const huella = (texto: string) => [...texto].reduce((suma, letra) => (suma * 31 + letra.charCodeAt(0)) >>> 0, 7)

function iniciales(nombre: string) {
  const palabras = nombre.replace(/[^\p{L}\p{N}\s.]/gu, ' ').split(/\s+/).filter((p) => p && !VACIAS.has(p.toLowerCase()))
  return (palabras.length > 1 ? palabras[0][0] + palabras[1][0] : (palabras[0] ?? nombre).slice(0, 2)).toUpperCase()
}

function dominioDe(web: string) {
  try {
    return new URL(urlDe(web)).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// Las empresas ficticias no tienen sitio: en la demostración se dibuja un logo simple
// para unas 6 de cada 10, la misma proporción medida con empresas reales.
function logoDemo(dominio: string) {
  const h = huella(dominio)
  if (h % 10 > 5) return null
  const color = COLORES[h % COLORES.length]
  const figura = [
    `<circle cx="32" cy="32" r="24" fill="${color}"/><circle cx="32" cy="32" r="10" fill="#fff"/>`,
    `<path d="M8 54 32 10l24 44z" fill="${color}"/>`,
    `<rect x="10" y="10" width="20" height="44" fill="${color}"/><rect x="34" y="26" width="20" height="28" fill="${color}"/>`,
    `<path d="M32 6l26 26-26 26L6 32z" fill="${color}"/>`,
  ][h % 4]
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${figura}</svg>`)}`
}

function urlLogo(web: string) {
  const dominio = dominioDe(web)
  if (!dominio) return null
  if (modoDemo) return logoDemo(dominio)
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(dominio)}&sz=128`
}

export const telefonoParaLlamar = (telefono: string) => telefono.split(/[,;/]/)[0].replace(/[^\d+]/g, '')

export function LogoEmpresa({ nombre, web, tam = 40 }: { nombre: string; web: string | null; tam?: number }) {
  const src = web ? urlLogo(web) : null
  const [fallo, setFallo] = useState(false)
  useEffect(() => setFallo(false), [src])

  if (!src || fallo) {
    return (
      <span
        aria-hidden
        style={{ width: tam, height: tam, background: COLORES[huella(nombre) % COLORES.length], fontSize: tam * 0.38 }}
        className="grid flex-none place-items-center rounded-md font-semibold text-white"
      >
        {iniciales(nombre)}
      </span>
    )
  }

  return (
    <span style={{ width: tam, height: tam }} className="grid flex-none place-items-center rounded-md border border-linea bg-white">
      <img
        src={src}
        alt=""
        width={Math.round(tam * 0.7)}
        height={Math.round(tam * 0.7)}
        loading="lazy"
        referrerPolicy="no-referrer"
        // El servicio responde un globo de 16 px cuando no conoce el sitio.
        onLoad={(e) => e.currentTarget.naturalWidth < 32 && setFallo(true)}
        onError={() => setFallo(true)}
      />
    </span>
  )
}

export function BotonFavorito({ id, nombre, conTexto }: { id: number; nombre: string; conTexto?: boolean }) {
  const perfil = usePerfil()
  const { ids, alternar } = useFavoritos()
  if (perfil.demo) return null
  const activo = ids.has(id)
  const etiqueta = `${activo ? 'Quitar de' : 'Guardar en'} favoritos: ${nombre}`

  if (conTexto) {
    return (
      <button type="button" aria-pressed={activo} onClick={() => alternar(id)} className="boton h-9">
        <Star size={16} className={activo ? 'fill-cempasuchil text-cempasuchil' : ''} />
        {activo ? 'En favoritos' : 'Guardar en favoritos'}
      </button>
    )
  }

  return (
    <button
      type="button"
      aria-pressed={activo}
      aria-label={etiqueta}
      title={activo ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      onClick={(e) => {
        e.stopPropagation()
        alternar(id)
      }}
      className="grid size-11 flex-none cursor-pointer place-items-center rounded-md transition-transform hover:bg-cantera active:scale-90 md:size-8"
    >
      <Star size={17} className={activo ? 'fill-cempasuchil text-cempasuchil' : 'text-gris-2'} />
    </button>
  )
}

export function TarjetaEmpresa({ empresa, alAbrir }: { empresa: EmpresaResumen; alAbrir: (id: number) => void }) {
  return (
    <article className="relative flex min-w-0 gap-3 rounded-xl border border-linea bg-papel p-3.5 transition-colors hover:border-jade-500 active:bg-tenue">
      <LogoEmpresa nombre={empresa.nombre} web={empresa.web} tam={48} />
      <div className="min-w-0 flex-1 pr-7">
        <button
          type="button"
          title={empresa.nombre}
          onClick={() => alAbrir(empresa.id)}
          className="line-clamp-2 cursor-pointer text-left leading-5 font-semibold after:absolute after:inset-0 hover:text-jade-500"
        >
          {empresa.nombre}
        </button>
        <p className="mt-0.5 truncate text-[13px] text-gris">{empresa.estado}{empresa.giro !== 'sin_clasificar' && ` · ${nombreGiro(empresa.giro)}`}</p>
        <p className="num mt-1 text-[13px]">
          {plural(empresa.num_contactos, 'persona', 'personas')}
          {empresa.telefono && <span className="text-gris"> · <span aria-hidden={empresa.bloqueada} className={empresa.bloqueada ? 'borroso' : ''}>{empresa.telefono}</span></span>}
        </p>
      </div>
      <div className="absolute top-0.5 right-0.5 z-10 md:top-2 md:right-2">
        <BotonFavorito id={empresa.id} nombre={empresa.nombre} />
      </div>
    </article>
  )
}

function Desbloquear({ id, alListo }: { id: number; alListo: () => void }) {
  const { api } = useSesion()
  const [estado, setEstado] = useState<EstadoDemo | null>(null)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    api.demoEstado().then(setEstado).catch(() => {})
  }, [api])

  const quedan = estado ? Math.max(estado.limite - estado.usadas, 0) : null

  const abrir = async () => {
    setEnviando(true)
    setError('')
    try {
      await api.demoDesbloquear(id)
      alListo()
    } catch (e) {
      setError((e as Error).message)
      setEnviando(false)
    }
  }

  return (
    <div className="mb-5 rounded-xl bg-jade-50 p-3.5">
      <p className="flex items-center gap-2 font-semibold text-jade-700"><Lock size={15} aria-hidden /> Contactos ocultos</p>
      {quedan === 0
        ? <p className="mt-1 text-jade-700">Ya usaste todas las empresas de tu demo. Escríbele a tu asesor para activar tu cuenta.</p>
        : (
          <button type="button" disabled={enviando || quedan === null} onClick={abrir} className="boton boton-primario mt-2.5 h-11 w-full">
            {enviando ? 'Abriendo…' : `Ver esta empresa · ${quedan === 1 ? 'te queda 1' : `te quedan ${quedan ?? ''}`}`}
          </button>
        )}
      {error && <p role="alert" className="mt-2 text-alerta">{error}</p>}
    </div>
  )
}

export function FichaEmpresa({ id, alCerrar }: { id: number; alCerrar: () => void }) {
  const { api } = useSesion()
  const [detalle, setDetalle] = useState<DetalleEmpresa | null>(null)
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    api.detalle(id).then(setDetalle).catch((e: Error) => setError(e.message))
      .finally(() => window.dispatchEvent(new Event('nexo:consulta')))
  }, [api, id])

  useEffect(cargar, [cargar])

  const empresa = detalle?.empresa

  return (
    <Ventana titulo={empresa?.nombre ?? 'Empresa'} alCerrar={alCerrar} lateral>
      {error && <ErrorBloque mensaje={error} />}
      {!detalle && !error && (
        <div>
          <span className="hueso mb-3 size-16" />
          <span className="hueso mb-3 h-4 w-2/3" />
          <span className="hueso h-4 w-1/2" />
        </div>
      )}
      {detalle && empresa && (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <LogoEmpresa nombre={empresa.nombre} web={empresa.web} tam={64} />
            <BotonFavorito id={empresa.id} nombre={empresa.nombre} conTexto />
          </div>

          {detalle.bloqueada && <Desbloquear id={empresa.id} alListo={cargar} />}

          {!detalle.bloqueada && (empresa.telefono || empresa.web) ? (
            <div className="mb-5 flex gap-2 sm:hidden">
              {empresa.telefono && (
                <a href={`tel:${telefonoParaLlamar(empresa.telefono)}`} className="accion"><Phone size={16} aria-hidden /> Llamar</a>
              )}
              {empresa.web && (
                <a href={urlDe(empresa.web)} target="_blank" rel="noreferrer noopener" className="accion"><Globe size={16} aria-hidden /> Sitio web</a>
              )}
            </div>
          ) : null}

          <dl className="flex flex-col gap-2.5">
            {empresa.giro !== 'sin_clasificar' && (
              <div className="flex gap-2.5">
                <dt className="pt-[3px]"><Factory size={14} className="text-gris" aria-label="Giro" /></dt>
                <dd>{nombreGiro(empresa.giro)}</dd>
              </div>
            )}
            <div className="flex gap-2.5">
              <dt className="pt-[3px]"><MapPin size={14} className="text-gris" aria-label="Ubicación" /></dt>
              <dd>
                {empresa.ubicacion ?? '—'}
                {empresa.estado !== SIN_ESTADO && !empresa.ubicacion?.includes(empresa.estado) && `, ${empresa.estado}`}
              </dd>
            </div>
            {empresa.telefono && (
              <div className="flex items-center gap-2.5">
                <dt><Phone size={14} className="text-gris" aria-label="Teléfono" /></dt>
                <dd className="num flex items-center gap-0.5">
                  {detalle.bloqueada ? <span aria-hidden className="borroso">{empresa.telefono}</span> : (
                    <>
                      <a href={`tel:${telefonoParaLlamar(empresa.telefono)}`}>{empresa.telefono}</a>
                      <Copiar texto={empresa.telefono} etiqueta="teléfono" />
                    </>
                  )}
                </dd>
              </div>
            )}
            {empresa.web && (
              <div className="flex items-center gap-2.5">
                <dt><Globe size={14} className="text-gris" aria-label="Sitio web" /></dt>
                <dd className="min-w-0 truncate">
                  <a href={urlDe(empresa.web)} target="_blank" rel="noreferrer noopener" className="font-medium text-jade-500 hover:underline">
                    {hostDe(empresa.web)}
                  </a>
                </dd>
              </div>
            )}
          </dl>

          <h3 className="mt-6 mb-1 font-semibold">{plural(detalle.contactos.length, 'persona', 'personas')}</h3>
          {detalle.contactos.length === 0 && (
            <p className="rounded-lg border border-dashed border-control px-3 py-2.5">
              Esta empresa solo tiene datos generales. Usa el teléfono de arriba y pide el área que buscas.
            </p>
          )}
          <ul>
            {detalle.contactos.map((c) => (
              <li key={c.id} className="border-t border-regla py-3 first:border-t-0">
                <p className={`font-medium ${detalle.bloqueada ? 'borroso' : ''}`} aria-hidden={detalle.bloqueada}>{c.nombre ?? 'Sin nombre'}</p>
                <p className={`text-gris ${detalle.bloqueada ? 'borroso' : ''}`} aria-hidden={detalle.bloqueada}>{c.puesto ?? nombreArea(c.area)}</p>
                {detalle.bloqueada && <span className="sr-only">Contacto oculto</span>}
                {c.correo && (
                  <p className="mt-1 flex min-w-0 items-center gap-2">
                    <Mail size={14} className="flex-none text-gris" aria-hidden />
                    {detalle.bloqueada ? <span aria-hidden className="borroso truncate">{c.correo}</span> : (
                      <>
                        <a href={`mailto:${c.correo}`} className="truncate hover:text-jade-500">{c.correo}</a>
                        <Copiar texto={c.correo} etiqueta="correo" />
                      </>
                    )}
                  </p>
                )}
                {c.telefono_directo && (
                  <p className="num mt-1 flex items-center gap-2">
                    <Phone size={14} className="flex-none text-gris" aria-hidden />
                    {c.telefono_directo}
                    <Copiar texto={c.telefono_directo} etiqueta="teléfono" />
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Ventana>
  )
}

export function RejillaCarga({ cuantas }: { cuantas: number }) {
  return (
    <>
      {Array.from({ length: cuantas }, (_, i) => (
        <div key={i} className="flex gap-3 rounded-lg border border-linea p-3.5">
          <span className="hueso size-12 flex-none" />
          <div className="flex-1">
            <span className="hueso mb-2 h-4 w-4/5" />
            <span className="hueso h-3 w-1/2" />
          </div>
        </div>
      ))}
    </>
  )
}

