import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { RouteProtegida } from "@/components/auth/RouteProtegida"
import { MesLayout } from "@/components/mes/MesLayout"
import { AppLayout } from "@/components/layout/AppLayout"
import { AuthProvider } from "@/contexts/AuthContext"
import { MesProvider } from "@/contexts/MesContext"
import { areaAsignada, esAccesoGlobal } from "@/config/usuarios"
import { AccesoDenegadoPage } from "@/pages/AccesoDenegadoPage"
import { CapturaProduccionPage } from "@/pages/CapturaProduccionPage"
import { CierreTurnoPage } from "@/pages/CierreTurnoPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { LoginPage } from "@/pages/LoginPage"
import { ConfiguracionPage } from "@/pages/ConfiguracionPage"
import { MantenimientoPage } from "@/pages/mes/MantenimientoPage"
import { MesDashboardPage } from "@/pages/mes/MesDashboardPage"
import { ParadasPage } from "@/pages/mes/ParadasPage"
import { InicioPage } from "@/pages/plantas/InicioPage"
import { MaquinasPage } from "@/pages/plantas/MaquinasPage"
import { SeccionesPage } from "@/pages/plantas/SeccionesPage"
import { RegistroDiarioPage } from "@/pages/mes/RegistroDiarioPage"
import { RegistrosAreaPage } from "@/pages/RegistrosAreaPage"
import { AuditoriaPage } from "@/pages/modules/AuditoriaPage"
import { CalidadPage } from "@/pages/modules/CalidadPage"
import { IndicadoresPage } from "@/pages/modules/IndicadoresPage"
import { InventarioPage } from "@/pages/modules/InventarioPage"
import { ProduccionPage } from "@/pages/modules/ProduccionPage"
import { ReportesPage } from "@/pages/modules/ReportesPage"
import { TrazabilidadPage } from "@/pages/modules/TrazabilidadPage"
import { UsuariosPage } from "@/pages/modules/UsuariosPage"

/** Roles que pueden consultar los módulos corporativos (admin + supervisión). */
const ROLES_MODULOS_CORPORATIVOS = ["admin", "supervisor", "gerencia", "auditoria"]
/** Roles que pueden gestionar el sistema (administración). */
const ROLES_ADMINISTRACION = ["admin"]

export default function App() {
  const soloArea = (user: Parameters<typeof areaAsignada>[0], params: Record<string, string | undefined>) => {
    if (esAccesoGlobal(user)) return true
    const area = areaAsignada(user)
    if (!area) return false
    if (params.plantaId && area.plantaId !== params.plantaId) return false
    if (params.seccionId && area.seccionId !== params.seccionId) return false
    if (params.maquinaId && area.maquinaId !== params.maquinaId) return false
    return true
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <MesProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/acceso-denegado" element={<AccesoDenegadoPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                {/* Navegación corporativa MES: Inicio → Planta → Sección → Máquina */}
                <Route path="/" element={<Navigate to="/inicio" replace />} />
                <Route path="/inicio" element={<InicioPage />} />
                <Route path="/registros" element={<RegistrosAreaPage />} />

                {/* El operario solo puede entrar a la navegación de su área asignada */}
                <Route element={<RouteProtegida validar={soloArea} />}>
                  <Route path="/planta/:plantaId" element={<SeccionesPage />} />
                  <Route
                    path="/planta/:plantaId/seccion/:seccionId"
                    element={<MaquinasPage />}
                  />

                  {/* Sistema MES por máquina (contexto Planta · Sección · Máquina) */}
                  <Route
                    path="/mes/:plantaId/:seccionId/:maquinaId"
                    element={<MesLayout />}
                  >
                    <Route index element={<MesDashboardPage />} />
                    <Route path="ordenes" element={<ProduccionPage />} />
                    <Route path="produccion" element={<CapturaProduccionPage />} />
                    <Route path="produccion/cierre" element={<CierreTurnoPage />} />
                    <Route path="calidad" element={<CalidadPage />} />
                    <Route path="paradas" element={<ParadasPage />} />
                    <Route path="mantenimiento" element={<MantenimientoPage />} />
                    <Route path="registro-diario" element={<RegistroDiarioPage />} />
                    <Route path="reportes" element={<ReportesPage />} />
                    <Route path="indicadores" element={<IndicadoresPage />} />
                  </Route>
                </Route>

                {/* Rutas existentes (se conservan intactas) */}
                <Route path="/dashboard" element={<DashboardPage />} />

                {/* Módulos corporativos: solo supervisión (el operario ve su área) */}
                <Route element={<RouteProtegida roles={ROLES_MODULOS_CORPORATIVOS} />}>
                  <Route path="/produccion" element={<ProduccionPage />} />
                  <Route path="/produccion/captura" element={<CapturaProduccionPage />} />
                  <Route path="/cierre-turno" element={<CierreTurnoPage />} />
                  <Route path="/calidad" element={<CalidadPage />} />
                  <Route path="/trazabilidad" element={<TrazabilidadPage />} />
                  <Route path="/inventario" element={<InventarioPage />} />
                  <Route path="/reportes" element={<ReportesPage />} />
                  <Route path="/indicadores" element={<IndicadoresPage />} />
                </Route>

                {/* Administración del sistema: solo admin */}
                <Route element={<RouteProtegida roles={ROLES_ADMINISTRACION} />}>
                  <Route path="/usuarios" element={<UsuariosPage />} />
                  <Route path="/configuracion" element={<ConfiguracionPage />} />
                  <Route path="/auditoria" element={<AuditoriaPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/inicio" replace />} />
          </Routes>
        </MesProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}