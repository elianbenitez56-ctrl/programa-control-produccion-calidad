# SIGPC — Modelo del Dominio

**Versión:** 1.0 · **Estado:** Borrador para aprobación · **Autor:** Business Analyst / Solution Architect MES

> Modelo conceptual de dominio del Sistema Integral de Gestión de Producción y Calidad. Define las **entidades del negocio**, sus **relaciones**, **estados** y las **reglas (RN)** que las gobiernan. Es la base para el diseño de base de datos y API.
>
> **Sin código, sin tablas, sin APIs.**

---

## 0. Contextos del dominio (bounded contexts)

El dominio se divide en contextos cohesivos para que cada uno evolucione de forma independiente:

| Contexto | Entidades que contiene | Responsabilidad |
|---|---|---|
| **Identidad y Acceso** | Usuario, Rol, Permiso, SesiónOperario, Kiosco/Dispositivo | Quién es cada persona, con qué credenciales y en qué máquina. |
| **Configuración (Planta)** | Planta, Área, Máquina, Turno, CausaParada, Producto, Cliente, PlanInspección, Parámetros | La fotografía de cada planta cliente: catálogos y reglas configurables. |
| **Planificación** | OrdenProducción | Qué producir, cuánto, para quién, en qué máquina/turno. |
| **Ejecución** | Producción (runtime), EventoProducción, LecturaContador, Parada, Defecto | Qué ocurrió en el piso, en orden cronológico e inmutable. |
| **Calidad** | Inspección, NoConformidad, Scrap | Aseguramiento de la calidad y sus hallazgos. |
| **Mantenimiento** | Mantenimiento | Solicitudes e intervenciones técnicas. |
| **Observabilidad** | Alarma, Notificación, Auditoría, Indicador, Dashboard | Vigilancia en tiempo real, históricos y trazabilidad. |
| **Seguridad** | Permiso, Rol (conjunto compartido) | Matriz de autorización aplicada en todo el sistema. |

> La **invariante central** del dominio: *"La máquina es un recurso único: en un instante dado tiene un único estado, y dentro de ese estado un único runtime y como máximo una parada activa."* (RN-RES-004, RN-RES-005)

---

## 1. Entidades y su definición

### 1.1. Usuario

| Campo | Contenido |
|---|---|
| **Definición** | Persona física que opera el sistema, con identidad única y credenciales. Es la **base** de perfiles específicos. |
| **Atributos clave** | Identificador, nombre, apellidos, estado (activo/inactivo), credenciales (PIN cifrado, QR, RFID), rol(s), planta(es), vigencia, última sesión. |
| **Relaciones** | Tiene 1..n **Rol**. Ejecuta **SesiónOperario**, registra **EventoProducción**, **Parada**, **Defecto**, **Inspección**, **Mantenimiento**. |
| **Estados** | `Activo` / `Inactivo` / `Suspendido` |
| **Reglas** | RN-GEN-003, RN-PRM-007, RN-PRM-008, RN-VAL-001, RN-VAL-013 |
| **Decisión de modelado** | **Operario y Supervisor no son entidades nuevas**: son **roles** que configuran el comportamiento del Usuario. Se modelan como perfiles derivados del rol (ver §1.2), no como tablas separadas. |

### 1.2. Operario y Supervisor (perfiles por rol)

| Campo | Contenido |
|---|---|
| **Definición** | Perfiles del Usuario según su **Rol** en la matriz de permisos. El modelo no duplica datos: el rol define *qué puede hacer* y el contexto (máquina/área) define *sobre qué*. |
| **Atributos clave** | Hereda de Usuario. Adicionales: área/máquinas asignables (alcance), turnos preferidos. |
| **Relaciones** | Un Operario opera **Máquina(s)** vía **SesiónOperario**; un Supervisor gobierna **Área(s)** y **Máquina(s)**. |
| **Estados** | Los del Usuario (activo/inactivo). |
| **Reglas** | RN-PRM-001 (Operario), RN-PRM-003 (Supervisor), RN-OPE-002, RN-SUP-001 |
| **Decisión de modelado** | Modelar como **rol + alcance**, no como jerarquía de tablas: permite que una persona sea operario y supervisor en turnos distintos sin duplicar identidad. |

### 1.3. Área

| Campo | Contenido |
|---|---|
| **Definición** | Agrupación física o funcional de máquinas dentro de la planta (ej. "Línea de impresión", "Corte"). Nivel de supervisión. |
| **Atributos clave** | Código, nombre, descripción, responsables. |
| **Relaciones** | Contiene 1..n **Máquina**. Es alcance de **Supervisor**. |
| **Reglas** | RN-GEN-009, RN-PRM-001 (alcance), RN-SUP-001 |

### 1.4. Máquina

| Campo | Contenido |
|---|---|
| **Definición** | Recurso productivo central del sistema. Todo lo que ocurre en planta se ancla a ella. |
| **Atributos clave** | Código, nombre, área, capacidad nominal (velocidad máx.), unidad de contador (m/kg/unid.), ¿contador automático? (OPC) o manual, umbrales de alerta, perfil de paradas. |
| **Relaciones** | Pertenece a **Área**. Asignada a **Turno(s)** y **OrdenProducción(es)**. Tiene **Kiosco/Dispositivo**. Genera **Producción**, **Parada**, **Defecto**, **Inspección**, **Mantenimiento**, **Alarma**. |
| **Estados** | `SIN_ORDEN`, `LISTA`, `PREPARACION`, `PRODUCIENDO`, `PARADA`, `MANTENIMIENTO`, `OFFLINE` (diagrama §15.2 reglas) |
| **Reglas** | RN-GEN-005, RN-GEN-006, RN-PRD-001, RN-PAR-003, RN-RES-004/005/012 |

### 1.5. Turno

| Campo | Contenido |
|---|---|
| **Definición** | Bloque horario productivo configurado por la planta. El sistema deduce el turno vigente por reloj del servidor. |
| **Atributos clave** | Nombre, hora inicio/fin, días de la semana, plantilla (turno A/B/C), excepciones (festivos, plan de pausa). |
| **Relaciones** | Se asocia a **Máquina** y **OrdenProducción** (asignación). Genera **Indicador** (cierre de turno). |
| **Reglas** | RN-TUR-001 a 006, RN-GEN-001, RN-VAL-007 |

### 1.6. OrdenProducción (OP)

| Campo | Contenido |
|---|---|
| **Definición** | Instrucción de producir una cantidad de un producto para un cliente, con especificación congelada (snapshot) y meta. Raíz del contexto de planificación. |
| **Atributos clave** | Número OP, **Cliente**, **Producto**, cantidad meta, unidad, snapshot de especificación (gramaje, ancho, largo, velocidad objetivo), fecha compromiso, prioridad, máquina y turno asignados, estado. |
| **Relaciones** | 1 **Producto**, 1 **Cliente**, 0..n **Máquina** (asignación), 0..n **Turno**. Genera 0..1 **Producción** (runtime) y sus **EventoProducción**, **Parada**, **Defecto**, **Inspección**, **NoConformidad**, **Scrap**. |
| **Estados** | `BORRADOR` → `PLANIFICADA` → `ASIGNADA` → `LIBERADA` → `EN_EJECUCIÓN` → `TERMINADA` (+ `SUSPENDIDA`, `CANCELADA`) |
| **Reglas** | RN-ORD-001 a 007, RN-PRD-001/007/008/009, RN-VAL-008 |

### 1.7. Producto

| Campo | Contenido |
|---|---|
| **Definición** | Artículo fabricable con su especificación estándar (ficha técnica). Catálogo de la planta. |
| **Atributos clave** | Código/referencia, nombre, cliente principal, unidad, especificación: gramaje, ancho, largo, velocidad objetivo, límites de tolerancia, plan de inspección asociado. |
| **Relaciones** | 0..n **OrdenProducción**, 0..n **PlanInspección**, 0..n **Cliente**. |
| **Reglas** | RN-ORD-002 (snapshot), RN-ORD-007, RN-CAL-008 (plan), RN-VAL-009 |

### 1.8. Cliente

| Campo | Contenido |
|---|---|
| **Definición** | Entidad (empresa) que solicita los productos. Dato de contexto de la OP y de los reportes. |
| **Atributos clave** | Código, razón social, contacto, datos de facturación/entrega. |
| **Relaciones** | 0..n **OrdenProducción**, 0..n **Producto**. |
| **Reglas** | RN-ORD-001, reportes gerenciales |

### 1.9. Producción (runtime / ejecución)

| Campo | Contenido |
|---|---|
| **Definición** | Ciclo de ejecución de una OP sobre una máquina: desde INICIAR hasta FINALIZAR. Es el **agregado raíz del contexto de ejecución**. |
| **Atributos clave** | Máquina, OP, sesión del operador, hora inicio (servidor), hora fin, lectura inicial, lectura final, cantidad producida, tiempo productivo/improductivo, indicadores calculados (snapshot del cierre). |
| **Relaciones** | 1 **Máquina**, 1 **OrdenProducción**, 1..n **EventoProducción**, 0..n **Parada**, 0..n **Defecto**, 0..n **Inspección**, 0..n **Scrap**. |
| **Estados** | `ABIERTA` (en curso) / `CERRADA` (terminada, con KPIs) |
| **Reglas** | RN-PRD-001 a 010, RN-GEN-006, RN-RES-004, RN-VAL-004 |

### 1.10. EventoProducción

| Campo | Contenido |
|---|---|
| **Definición** | Registro **inmutable** de cada hecho ocurrido en la planta (inicio, fin, parada, defecto, lectura, inspección...). Es la fuente de verdad histórica y de auditoría. |
| **Atributos clave** | Tipo de evento, hora (servidor), actor, máquina, OP, payload (contexto), clave de idempotencia, estado anterior/nuevo cuando aplica. |
| **Relaciones** | Pertenece a **Producción**, **Máquina**, **OrdenProducción**, **Usuario**. |
| **Reglas** | RN-GEN-002, RN-AUD-001, RN-RES-001, RN-VAL-015 (idempotencia) |

### 1.11. Parada

| Campo | Contenido |
|---|---|
| **Definición** | Intervalo de tiempo en que la máquina no produce, con causa y clasificación. |
| **Atributos clave** | Máquina, OP (si aplica), **CausaParada**, hora inicio/fin (servidor), duración, operario, clasificación de impacto (disponibilidad / MTTR/MTBF / setup), observación. |
| **Relaciones** | 1 **Máquina**, 0..1 **OrdenProducción**, 1 **CausaParada**, 0..1 **Producción**, 0..1 **Mantenimiento** (si deriva en solicitud). |
| **Estados** | `ABIERTA` / `CERRADA` (normal, por fin de OT, por corrección) / `ANULADA` |
| **Reglas** | RN-PAR-001 a 008, RN-RES-005, RN-VAL-005/010/011 |

### 1.12. CausaParada

| Campo | Contenido |
|---|---|
| **Definición** | Catálogo configurable de motivos de parada con su **clasificación de impacto** (pierde disponibilidad; falla → MTTR/MTBF; planeada/setup). |
| **Atributos clave** | Código, nombre, clasificación (SETUP / FALLA / PLANEADA / ESPERA), ¿requiere mantenimiento?, orden de visualización (botones grandes), activa. |
| **Relaciones** | 0..n **Parada**. |
| **Reglas** | RN-PAR-001, RN-PAR-004, RN-PAR-006/007, RN-VAL-010 |

### 1.13. Defecto

| Campo | Contenido |
|---|---|
| **Definición** | Evento de calidad detectado (por operario o inspector) durante la ejecución: tipo de defecto + contexto + (opcional) foto. |
| **Atributos clave** | Tipo, máquina, OP, runtime, hora (servidor), operario/inspector que registra, foto (opcional), cantidad estimada afectada, estado de revisión. |
| **Relaciones** | 1 **Producción**, 1 **OrdenProducción**, 1 **Máquina**, 0..1 **Scrap** (estimación), 0..1 **NoConformidad** (si eleva). |
| **Estados** | `REGISTRADO` / `EN_REVISION` / `CLASIFICADO` / `ELEVADO_A_NC` |
| **Reglas** | RN-SCR-002/003/004, RN-CAL-007, RN-EVT-011 |

### 1.14. Inspección

| Campo | Contenido |
|---|---|
| **Definición** | Control de calidad programado por el **PlanInspección** de la OT, que el sistema dispara y el rol Calidad ejecuta. |
| **Atributos clave** | Plan, máquina, OP, runtime, hora programada (servidor), hora de ejecución, checklist pre-cargado (especificación), resultado, fotos, inspector. |
| **Relaciones** | 1 **PlanInspección**, 1 **Máquina**, 1 **OrdenProducción**, 1 **Producción**, 0..1 **NoConformidad** (si NO_CONFORME). |
| **Estados** | `PROGRAMADA` → `PENDIENTE` → `EN_PROGRESO` → `CONFORME` / `NO_CONFORME`; o `VENCIDA`; o `ANULADA` |
| **Reglas** | RN-CAL-001 a 009, RN-EVT-008/009/010, RN-VAL-009/014 |

### 1.15. NoConformidad (NC)

| Campo | Contenido |
|---|---|
| **Definición** | Hallazgo de calidad que requiere tratamiento formal (producto o proceso fuera de especificación). |
| **Atributos clave** | Origen (inspección/defecto/revisión), descripción, severidad, estado, responsable asignado, acciones, bloqueo de liberación de la OT. |
| **Relaciones** | 0..1 **Inspección**, 0..1 **Defecto**, 1 **OrdenProducción**, 1 **Máquina**, 0..n acciones de **Mantenimiento**. |
| **Estados** | `ABIERTA` → `ASIGNADA` → `EN_TRATAMIENTO` → `RESUELTA` → `CERRADA`; o `RECHAZADA` |
| **Reglas** | RN-CAL-004, RN-CAL-005, RN-EXC-008, RN-VAL-016, RN-EVT-010 |

### 1.16. Scrap

| Campo | Contenido |
|---|---|
| **Definición** | Cantidad (unidad de contador) no conforme asociada a la OT. Nace de defectos o revisiones; se estima automáticamente y se confirma. |
| **Atributos clave** | Cantidad, estimado vs confirmado, origen (defecto/revisión), OT/máquina/turno, estado de validación. |
| **Relaciones** | 1 **OrdenProducción**, 1 **Máquina**, 0..1 **Defecto**, 0..1 **NoConformidad**. |
| **Estados** | `ESTIMADO` / `CONFIRMADO` / `EN_VALIDACION` |
| **Reglas** | RN-SCR-001 a 005, RN-OEE-004, RN-CAL-007 |

### 1.17. Mantenimiento

| Campo | Contenido |
|---|---|
| **Definición** | Solicitud e intervención técnica sobre una máquina (desde parada con causa de falla, o planificada). |
| **Atributos clave** | Máquina, tipo (correctivo/preventivo), origen (parada/plan), técnico, inicio/fin de intervención, causa técnica, repuestos, estado, tickets derivados de MTTR/MTBF. |
| **Relaciones** | 1 **Máquina**, 0..1 **Parada** (origen), 0..n **Alarma**, 0..1 **Usuario** (técnico). |
| **Estados** | `SOLICITADA` → `ASIGNADA` → `EN_INTERVENCION` → `COMPLETADA` / `CANCELADA` |
| **Reglas** | RN-PAR-006, RN-EVT-005, RN-OEE-008 (MTBF/MTTR) |

### 1.18. Alarma

| Campo | Contenido |
|---|---|
| **Definición** | Señal automática generada por reglas del sistema (parada prolongada, lectura anómala, inspección vencida, sin operador...). Requiere confirmación con traza. |
| **Atributos clave** | Tipo, severidad, máquina/OP, hora de disparo, hora de confirmación, estado, responsable de confirmación. |
| **Relaciones** | 0..1 **Máquina**, 0..1 **Parada**, 0..1 **Inspección**, 0..n **Notificación** (derivadas). |
| **Estados** | `ACTIVA` → `CONFIRMADA` / `RESUELTA` / `DESCARTADA` |
| **Reglas** | RN-SUP-006, RN-EVT-018, RN-EXC-002/003/011 |

### 1.19. Notificación

| Campo | Contenido |
|---|---|
| **Definición** | Mensaje entregado a un usuario (inspector, supervisor, gerencia) originado por un evento o alarma. |
| **Atributos clave** | Destinatario, canal (in-app/push/email), asunto, contenido, evento origen, hora de envío, hora de lectura. |
| **Relaciones** | 0..1 **Usuario**, 0..1 **Alarma**, 0..1 **EventoProducción**, 0..1 **Inspección**. |
| **Reglas** | RN-GEN-011, RN-CAL-001, RN-EVT-008 |

### 1.20. Auditoría

| Campo | Contenido |
|---|---|
| **Definición** | Registro inmutable de toda acción y cambio (quién, qué, cuándo, antes/después, dispositivo). |
| **Atributos clave** | Actor, acción, recurso/entidad, id de objeto, valor anterior, valor nuevo, hora servidor, origen (IP/kiosco), tipo de evento. |
| **Relaciones** | Referencia a cualquier entidad; especializado en **EventoProducción** y **SesiónOperario**. |
| **Reglas** | RN-AUD-001 a 005, RN-GEN-002, RN-RES-001/010 |

### 1.21. Indicador

| Campo | Contenido |
|---|---|
| **Definición** | Definición de KPI (OEE, disponibilidad, rendimiento, calidad, scrap, MTBF, MTTR, cumplimiento) y su **valor calculado** por período (OT/turno/día/mes). |
| **Atributos clave** | Código, nombre, fórmula (definición), unidad, período, valor, meta, marca de recálculo. |
| **Relaciones** | 1..n **Dashboard**, 1 **OrdenProducción**/**Turno**/**Máquina** (por nivel). |
| **Reglas** | RN-OEE-001 a 009, RN-EVT-017 |

### 1.22. Dashboard

| Campo | Contenido |
|---|---|
| **Definición** | Vista configurable (supervisor / gerencia) compuesta de indicadores, por plantel, con filtros. |
| **Atributos clave** | Tipo (operador/supervisor/gerencia), configuración de widgets, filtros por área/máquina/turno/fecha, permisos. |
| **Relaciones** | 1..n **Indicador**, 1 **Planta**, 0..n **Usuario** (vistas guardadas). |
| **Reglas** | RN-SUP-001, RN-GER-001, matriz de permisos §18 |

### 1.23. Configuración

| Campo | Contenido |
|---|---|
| **Definición** | Parámetros por planta: turnos, causas, defectos, planes, límites, umbrales, unidades, idioma, pérdidas OEE. Configurable sin código. |
| **Atributos clave** | Parámetro, valor, vigencia, planta, cambiado por/por cuándo (auditoría). |
| **Relaciones** | 1 **Planta**, referenciada por catálogos y reglas. |
| **Reglas** | RN-GEN-009, RN-AUD-005, RN-VAL-007 |

### 1.24. Permiso

| Campo | Contenido |
|---|---|
| **Definición** | Capacidad granular `recurso:acción` (ej. `parada:registrar`, `op:crear`, `reportes:exportar`). |
| **Atributos clave** | Recurso, acción, descripción, módulo. |
| **Relaciones** | 0..n **Rol** (vía matriz), 0..n **Usuario** (sobreescrituras excepcionales). |
| **Reglas** | RN-PRM-007/008, RN-VAL-001, matriz §18 |

### 1.25. Rol

| Campo | Contenido |
|---|---|
| **Definición** | Agrupación de permisos que define qué puede hacer un usuario. Roles estándar: Operario, Calidad, Supervisor, Gerencia, Auditoría, Administrador. |
| **Atributos clave** | Código, nombre, planta, lista de permisos, editable por Admin. |
| **Relaciones** | 0..n **Usuario**, 0..n **Permiso**. |
| **Reglas** | RN-PRM-001 a 008, RN-RES-009, matriz §18 |

---

## 2. Diagrama de relaciones (nivel conceptual)

```
                    ┌─────────────────── CONFIGURACIÓN (Planta) ───────────────────┐
                    │                                                              │
  CLIENTE ──< Producto ──< OrdenProducción ──> Turno ──> Área ──> Máquina ──> Kiosco/Dispositivo
                 │              │               │                      │
                 │              │               │                      ├─> SesiónOperario ──> Usuario ──> Rol ──> Permiso
                 │              │               │                      │
                 │              └──> Producción (runtime)              │
                 │                        │                             │
                 │                        ├─< EventoProducción           │
                 │                        ├─< Parada ──< CausaParada     │
                 │                        │     └──> Mantenimiento       │
                 │                        ├─< Defecto ──> Scrap          │
                 │                        ├─< Inspección ──< PlanInspección
                 │                        │        └──> NoConformidad
                 │                        │
                 │                        └─> Indicador (KPI por OT/turno/día)
                 │                                    │
                 │                                    └─> Dashboard ──> (Supervisor / Gerencia)
                 │
                 └──> Alarma ──> Notificación ──> Auditoría (transversal, inmutable)
```

**Leyenda:** `A ──< B` = B pertenece a A (B→A); `──>` relación.

---

## 3. Relaciones de cardinalidad clave

| Relación | Cardinalidad | Nota de dominio |
|---|---|---|
| Área → Máquina | 1 → 0..n | Una máquina pertenece a una única área. |
| Máquina → Producción | 1 → 0..n | Solo un runtime **activo** a la vez (invariante). |
| Máquina → Parada | 1 → 0..n | Máx. una parada **abierta** a la vez. |
| Máquina → SesiónOperario | 1 → 0..n | Máx. una sesión activa a la vez. |
| OrdenProducción → Producción | 1 → 0..n | Una OP puede tener varios runtimes a lo largo del tiempo (retomas), nunca simultáneos. |
| Producción → EventoProducción | 1 → 1..n | Todo lo que ocurre en un runtime es un evento. |
| Producción → Parada | 1 → 0..n | Las paradas de un runtime son su historial de pérdida. |
| OrdenProducción → Inspección | 1 → 0..n | Por plan, con frecuencia configurada. |
| Inspección → NoConformidad | 0..1 → 0..1 | Solo resultado NO_CONFORME genera NC. |
| Defecto → Scrap | 0..1 → 0..1 | El scrap estimado nace del defecto; también puede nacer de revisión. |
| Parada → Mantenimiento | 0..1 → 0..1 | Causas de falla derivan solicitud de mantenimiento. |
| Usuario → Rol | n → n | Un usuario puede tener varios roles (nunca operar a la vez con dos). |
| Planta → * | 1 → n | Toda entidad operativa pertenece a una planta (multi-tenant). |

---

## 4. Reglas de negocio por entidad (referencia cruzada)

| Entidad | Reglas dominantes |
|---|---|
| Usuario / Sesión | RN-OPE-001/002, RN-PRM-007, RN-VAL-001/013 |
| Máquina | RN-GEN-005/006, RN-PRD-001, RN-PAR-003, RN-RES-004/005/012 |
| Turno | RN-TUR-001 a 006, RN-VAL-007 |
| OrdenProducción | RN-ORD-001 a 007, RN-PRD-001/007/008/009, RN-VAL-008 |
| Producción (runtime) | RN-PRD-001 a 010, RN-GEN-006, RN-VAL-002 a 005 |
| EventoProducción | RN-GEN-002, RN-AUD-001, RN-VAL-015 |
| Parada / CausaParada | RN-PAR-001 a 008, RN-VAL-005/010/011 |
| Defecto / Scrap | RN-SCR-001 a 005, RN-CAL-007, RN-OEE-004 |
| Inspección | RN-CAL-001 a 009, RN-EVT-008/009/010, RN-VAL-009/014 |
| NoConformidad | RN-CAL-004/005, RN-EXC-008, RN-VAL-016 |
| Mantenimiento | RN-PAR-006, RN-OEE-008 |
| Alarma / Notificación | RN-SUP-006, RN-GEN-011, RN-EVT-018 |
| Auditoría | RN-AUD-001 a 005, RN-RES-001/010 |
| Indicador / Dashboard | RN-OEE-001 a 009, RN-EVT-017 |
| Rol / Permiso | RN-PRM-001 a 008, RN-RES-009 |

---

## 5. Entidades propuestas adicionales (no estaban en tu lista)

Para completar el dominio hacen falta — propuestas para tu validación:

| Entidad propuesta | Por qué es necesaria |
|---|---|
| **Planta** | Multi-tenant: todo pertenece a una planta (comercialización a varias plantas). |
| **SesiónOperario** | El requisito "login QR/RFID/PIN registra usuario-hora-máquina-turno" es una entidad, no un simple evento: tiene inicio, fin y conflicto. |
| **Kiosco/Dispositivo** | La máquina se identifica por su kiosco (dispositivo) en el login; permite seguridad y auditoría de ubicación. |
| **PlanInspección** | La frecuencia de autocontrol (tiempo/volumen) es configuración por producto/máquina: sin plan no hay inspección (RN-CAL-008). |
| **LecturaContador** | Cada lectura (auto OPC o manual) es un hecho con fuente, valor y validación (monotonicidad); no puede ser solo un atributo de Producción. |
| **ProductoEspecificación (snapshot)** | La especificación se congela al liberar la OP (RN-ORD-002): el snapshot es parte de la OP. |

---

## 6. Decisiones de modelado a confirmar

| # | Decisión | Opción recomendada |
|---|---|---|
| D-1 | Operario/Supervisor: ¿entidades propias o perfiles del Usuario? | **Perfiles (rol + alcance)** — evita duplicación y permite multirol. |
| D-2 | Producción vs EventoProducción: ¿dos conceptos? | **Sí**: Producción es el agregado (estado), EventoProducción es el hecho inmutable (historial). |
| D-3 | Scrap: ¿entidad o valor derivado del Defecto? | **Entidad con estados** (ESTIMADO→CONFIRMADO): necesita validación de calidad. |
| D-4 | ¿Alarma como entidad independiente o derivada? | **Entidad con ciclo de confirmación** (RN-SUP-006). |
| D-5 | Indicador: ¿solo definición o también valor persistido por período? | **Ambos**: la definición configura el dashboard; el valor (rollup) da histórico rápido y auditable. |
| D-6 | ¿Turno como entidad persistida o derivada del reloj? | **Entidad configurable** (horarios) que el sistema consulta para deducir el turno vigente. |
| D-7 | SesiónOperario vs SesiónUsuario (auth): ¿una sola? | **Dos capas**: la sesión de autenticación (token) y la sesión operativa de planta (máquina/turno) se separan; la de planta es la que registra indicadores. |

---

## 7. Próximo paso

Con este modelo de dominio aprobado, el siguiente entregable será el **diseño de la base de datos** (entidades → tablas, relaciones, restricciones de integridad que materializan las invariantes RN-RES-004/005, monotonía de contador, etc.) y luego las **API** (contratos que exponen los casos de uso).

*Fin del documento Modelo del Dominio v1.0.*
