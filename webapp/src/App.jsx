import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Agentes from './pages/Agentes'
import Conexion from './pages/Conexion'
import Monitor from './pages/Monitor'
import Configuraciones from './pages/Configuraciones'
import BlockedNumbers from './pages/BlockedNumbers'
import Citas from './pages/Citas'
import Pagos from './pages/Pagos'

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="agentes" element={<Agentes />} />
                    <Route path="conexion" element={<Conexion />} />
                    <Route path="monitor" element={<Monitor />} />
                    <Route path="configuraciones" element={<Configuraciones />} />
                    <Route path="numeros-bloqueados" element={<BlockedNumbers />} />
                    <Route path="citas" element={<Citas />} />
                    <Route path="pagos" element={<Pagos />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    )
}
