import { Star } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorBloque } from '../components/Comunes'
import { FichaEmpresa, RejillaCarga, TarjetaEmpresa } from '../components/Empresa'
import { useFavoritos } from '../lib/favoritos'
import { plural } from '../lib/formato'
import { useSesion } from '../lib/sesion'
import type { EmpresaFila } from '../lib/types'

export function Favoritos() {
  const { api } = useSesion()
  const { version } = useFavoritos()
  const [filas, setFilas] = useState<EmpresaFila[] | null>(null)
  const [error, setError] = useState('')
  const [abierta, setAbierta] = useState<number | null>(null)

  const cargar = useCallback(() => {
    setError('')
    api.favoritos().then(setFilas).catch((e: Error) => setError(e.message))
  }, [api])

  useEffect(cargar, [cargar, version])

  return (
    <div className="px-4 pt-1 pb-8 md:px-6 md:pt-5">
      <div className="mb-4">
        <h1 className="text-[22px] leading-7 font-semibold">Favoritos</h1>
        <p className="mt-0.5 min-h-5 text-gris">
          {filas && `${plural(filas.length, 'empresa guardada', 'empresas guardadas')} de 200`}
        </p>
      </div>

      {error && <ErrorBloque mensaje={error} alReintentar={cargar} />}

      {filas?.length === 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-control px-4 py-3">
          <Star size={18} className="flex-none text-cempasuchil" aria-hidden />
          <p>
            Aún no guardas empresas. En el <Link to="/directorio" className="font-medium text-jade-500 underline">directorio</Link>,
            toca la estrella de las que quieras seguir.
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {!filas && !error && <RejillaCarga cuantas={6} />}
        {filas?.map((e) => <TarjetaEmpresa key={e.id} empresa={e} alAbrir={setAbierta} />)}
      </div>

      {abierta !== null && <FichaEmpresa id={abierta} alCerrar={() => setAbierta(null)} />}
    </div>
  )
}
