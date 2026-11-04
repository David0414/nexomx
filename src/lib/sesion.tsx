import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { cargarApi } from './api'
import type { Api, Perfil } from './types'

interface Sesion {
  api: Api
  perfil: Perfil | null
  entrar(correo: string, clave: string): Promise<void>
  salir(): Promise<void>
}

const Contexto = createContext<Sesion | null>(null)

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<Api | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarApi()
      .then(async (cargada) => {
        setPerfil(await cargada.sesion())
        setApi(cargada)
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <p className="p-6">{error}</p>
  if (!api) return null

  return (
    <Contexto.Provider
      value={{
        api,
        perfil,
        entrar: async (correo, clave) => setPerfil(await api.entrar(correo, clave)),
        salir: async () => {
          await api.salir()
          setPerfil(null)
        },
      }}
    >
      {children}
    </Contexto.Provider>
  )
}

export function useSesion() {
  const sesion = useContext(Contexto)
  if (!sesion) throw new Error('useSesion fuera de ProveedorSesion')
  return sesion
}

// El perfil solo se usa dentro de rutas protegidas, donde ya existe.
export function usePerfil() {
  const { perfil } = useSesion()
  return perfil as Perfil
}
