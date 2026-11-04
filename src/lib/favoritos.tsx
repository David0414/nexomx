import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useSesion } from './sesion'

interface Favoritos {
  ids: Set<number>
  version: number
  alternar(id: number): Promise<void>
}

const Contexto = createContext<Favoritos | null>(null)

export function ProveedorFavoritos({ children }: { children: ReactNode }) {
  const { api } = useSesion()
  const [ids, setIds] = useState<Set<number>>(new Set())
  const [version, setVersion] = useState(0)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    api.favoritos().then((filas) => setIds(new Set(filas.map((f) => f.id)))).catch(() => {})
  }, [api])

  const alternar = useCallback(async (id: number) => {
    try {
      const guardada = await api.alternarFavorito(id)
      setIds((actuales) => {
        const siguiente = new Set(actuales)
        if (guardada) siguiente.add(id)
        else siguiente.delete(id)
        return siguiente
      })
      setVersion((v) => v + 1)
    } catch (e) {
      setAviso((e as Error).message)
      setTimeout(() => setAviso(''), 4000)
    }
  }, [api])

  return (
    <Contexto.Provider value={{ ids, version, alternar }}>
      {children}
      {aviso && (
        <p role="alert" className="fixed right-4 bottom-4 z-30 max-w-sm rounded-lg bg-obsidiana px-4 py-3 text-white shadow-lg">
          {aviso}
        </p>
      )}
    </Contexto.Provider>
  )
}

export function useFavoritos() {
  const favoritos = useContext(Contexto)
  if (!favoritos) throw new Error('useFavoritos fuera de ProveedorFavoritos')
  return favoritos
}
