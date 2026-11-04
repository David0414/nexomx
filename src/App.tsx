import { Navigate, Route, Routes } from 'react-router-dom'
import { Marco } from './components/Marco'
import { useSesion } from './lib/sesion'
import { Analiticas } from './pages/Analiticas'
import { Clientes } from './pages/Clientes'
import { Cuenta } from './pages/Cuenta'
import { Directorio } from './pages/Directorio'
import { Empresas } from './pages/Empresas'
import { Entrada } from './pages/Entrada'
import { Favoritos } from './pages/Favoritos'
import { Inicio } from './pages/Inicio'

export default function App() {
  const { perfil } = useSesion()

  if (!perfil) {
    return (
      <Routes>
        <Route path="/entrar" element={<Entrada />} />
        <Route path="*" element={<Navigate to="/entrar" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      {perfil.rol === 'admin' ? (
        <Route element={<Marco />}>
          <Route index element={<Analiticas />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="empresas" element={<Empresas />} />
          <Route path="cuenta" element={<Cuenta />} />
        </Route>
      ) : (
        <Route element={<Marco />}>
          <Route index element={<Inicio />} />
          <Route path="directorio" element={<Directorio />} />
          <Route path="favoritos" element={<Favoritos />} />
          <Route path="cuenta" element={<Cuenta />} />
        </Route>
      )}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
