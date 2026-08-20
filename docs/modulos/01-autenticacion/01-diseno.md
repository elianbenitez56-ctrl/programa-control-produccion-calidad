# Módulo 1 — Autenticación · Diseño

**Estado:** Aprobado para desarrollo · **Rutas:** `docs/modulos/01-autenticacion/`

## 1. Objetivo

Permitir el acceso seguro al sistema con usuario/contraseña (usuarios de gestión) y con
credenciales de planta (PIN, QR, RFID) desde un kiosko, gestionando sesiones JWT, recuperación
de contraseña, sesiones activas, permisos por rol y auditoría completa. Es la base de todos los
módulos posteriores.

## 2. Permanencia sobre el modelo de datos congelado

Tablas usadas por este módulo (subconjunto de `docs/modelo-base-de-datos.md`):

- **IDENTIDAD**: `usuarios`, `roles`, `permisos`, `rol_permisos`, `usuarios_roles`, `sesiones_autenticacion`, `sesiones_operario`.
- **CONFIGURACIÓN (dependencias de FK)**: `plantas`, `areas`, `maquinas`, `turnos`, `turnos_dias`, `kioskos`, `colores`, `estados`, `configuraciones_sistema`.
- **AUDITORÍA**: `bitacora` (particionada por mes, inmutable).

Decisiones de diseño (sin alterar el modelo sin razón técnica crítica):

| Decisión | Detalle |
|---|---|
| **M1-D1** | Tokens de recuperación de contraseña = **JWT `typ=pwdreset`** de 15 min con `jti` registrado en `bitacora`; un solo uso por `jti`. No se agrega tabla (se preserva el modelo congelado). |
| **M1-D2** | Envío del enlace de recuperación vía **puerto `EmailSender`**; en desarrollo usa adaptador `LogEmailSender` (imprime el mecanismo en el log). El SMTP real llega en el módulo Notificaciones. |
| **M1-D3** | **Rate limit en memoria** (ventana deslizante por IP+recurso) en Módulo 1; la versión distribuida (Redis) llega con WebSockets/dashboards. Se implementa como middleware independiente, sin acoplar. |
| **M1-D4** | Deducción del **turno vigente** en el login de kiosko implementada como **servicio de dominio** (`TurnoService`) con lógica pura y testeada (RN-TUR-001). |
| **M1-D5** | Los refrescos rotan `jti`: el refresh anterior se revoca y se crea una nueva sesión. |
| **M1-D6** | `pin_hash`, `rfid_tag`, `qr_secret` en `usuarios` quedan como están en el modelo; la credencial kiosko se valida contra estos. |

## 3. Casos de uso (Módulo 1)

1. `LoginPassword` — usuario/contraseña (usuarios de gestión y admin).
2. `LoginKiosk` — credencial PIN/QR/RFID + `X-Kiosk-Id` → `sesiones_operario` (usuario + máquina + turno deducido).
3. `RefreshAccess` — rota refresh token.
4. `Logout` — revoca sesión (access y refresh) + cierre de sesión operaria si aplica.
5. `ChangePassword` — cambiar contraseña conocida, con política de complejidad.
6. `RequestPasswordReset` — genera token de recuperación (15 min) y envía correo.
7. `ResetPassword` — valida token, establece nueva contraseña, revoca sesiones activas.
8. `ListMySessions` / `RevokeSession` — gestión de sesiones activas del usuario.
9. `GetMe` — perfil y permisos del usuario autenticado.

## 4. Fases de la interfaz (endpoints)

| Método | Ruta | Autenticado | Descripción |
|---|---|---|---|
| POST | `/auth/login` | no | Login usuario/contraseña |
| POST | `/auth/login/kiosk` | no | Login de kiosko (PIN/QR/RFID) |
| POST | `/auth/refresh` | no (refresh) | Rotar refresh token |
| POST | `/auth/logout` | sí | Cerrar sesión |
| GET | `/auth/me` | sí | Perfil + permisos |
| POST | `/auth/password/change` | sí | Cambiar contraseña |
| POST | `/auth/password/forgot` | no | Solicitar recuperación |
| POST | `/auth/password/reset` | no | Establecer nueva contraseña |
| GET | `/auth/sessions` | sí | Listar sesiones activas |
| POST | `/auth/sessions/{id}/revoke` | sí | Revocar sesión |

Para asegurar el dominio:
- Requisitos RN: RN-OPE-01/02, RN-TUR-01, RN-PRM-007/008, RN-AUD-01/04, RN-GEN-003, RN-RES-009, RN-VAL-01/13.
- Rol `Operario` no puede operar por contraseña en pantalla (los operarios entran por kiosko); los perfiles de gestión por contraseña.

## 5. Auditoría (RN-AUD-01, RN-AUD-04)

Todo login, refresh, logout, cambio de clave, reset, revocación y lockout se registra en `bitacora`:
usuario, fecha/hora (servidor), IP, dispositivo, accion, modulo (`auth`), entidad, valor_anterior/nuevo (payload JSON) y `request_id`.

## 6. Reglas de negocio implementadas en este módulo

RN-GEN-001 (hora servidor) · RN-GEN-003 (permisos server-side) · RN-GEN-004 (idempotencia en eventos) ·
RN-OPE-001/002 (sesión operaria y única activa) · RN-PRM-001 a 008 (matriz de permisos) ·
RN-TUR-001 (turno deducido por servidor) · RN-AUD-001/004 (bitácora y excepciones) ·
RN-RES-009 (nadie cambia sus propios permisos) · RN-VAL-001/013 (usuario activo, rol, sesión).

## 7. Entregables del módulo (ámbito)

Backend completo (dominio → aplicación → infra → API) · Migraciones (esquema base + seed de roles/permisos/estados + admin por entorno) ·
Pruebas unitarias e integración · Frontend completo (login, kiosko, recuperación, cambio de clave, gestión de sesiones, guards, i18n, tema) ·
Documentación (README, diagrama, endpoints, modelo, reglas).