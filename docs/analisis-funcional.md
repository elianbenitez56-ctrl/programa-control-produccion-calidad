# SIGPC — Análisis Funcional

**Versión:** 1.0 · **Estado:** Borrador para aprobación · **Autor:** Arquitectura de Software

> Sistema Integral de Gestión de Producción y Calidad — MES para plantas de producción continua (papel, film, impresión y similares).
>
> Documento de negocio previo a la implementación. **No contiene código, diseño de base de datos ni APIs.** Define la lógica de negocio, los procesos, los módulos y la experiencia de usuario de un producto comercial multi-planta.

---

## 0. Alcance, visión y principios rectores

### 0.1. Visión del producto

SIGPC es una plataforma comercial tipo MES que reemplaza por completo los formatos físicos de una planta industrial, digitalizando la ejecución de producción, la calidad en línea y la supervisión. Está pensada para:

- Ser **vendible a múltiples plantas** (multi-tenant: cada cliente = una planta o un grupo de plantas con su propia configuración, usuarios y datos).
- Configurarse **sin tocar código** (turnos, máquinas, causas de parada, tipos de defecto, planes de calidad, unidades, perfiles de máquinas).
- Operar 24/7 en interior de planta (kioscos, tables/, tabletas Android), con red local y tolerancia a cortes de red.
- Ser una **plataforma**, no un formulario: estados de máquina, runtime en tiempo real, indicadores automáticos (OEE, MTBF, MTTR) y trazabilidad total.

### 0.2. Glosario del dominio

| Término | Definición |
|---|---|
| **OP / Orden de Producción** | Instrucción para producir una cantidad de un producto/obra, con especificación y meta. |
| **Kiosco** | PC/tablet en el piso de producción en modo pantalla completa, sin teclado ni ratón, para la interacción del operario. |
| **Turno** | Bloque horario de trabajo (ej. 06-14, 14-22, 22-06). El sistema deduce el turno vigente por la hora local y el calendario configurado. |
| **Runtime / Ejecución** | Ciclo de producción de una OP sobre una máquina (se abre al INICIAR, se cierra al terminar). |
| **Contador** | Lectura que refleja metros (o unidades) producidas por la máquina. Fuente: automática (PLC/OPC-UA) o manual. |
| **Parada** | Intervalo de tiempo donde la máquina no produce. Con causa y clasificación (planeada / no planeada; cuenta na disponibilidad, MTTR, etc.). |
| **Disponibilidad** | Tiempo nominal menos pérdidas por detenciones / tiempo operativo programado. |
| **Rendimiento** | Producción real vs. producción teórica (cantidad máxima a velocidad objetivo en el tiempo efectivo). |
| **Calidad** | Piezas conforme / total producido. |
| **OEE** | OEE = Disponibilidad × Rendimiento × Calidad. |
| **MTBF** | Tiempo medio entre fallas = tiempo de funcionamiento / número de fallas. |
| **MTTR** | Tiempo medio de reparación = tiempo total de parada por falla / número de fallas. |
| **NC / No Conformidad** | Producto o proceso fuera de especificación detectado por Calidad (defecto, rechazo, queja). |
| **Inspección de autocontrol** | Control que Calidad realiza durante el turno según un plan de frecuencia (por tiempo o por volumen). |
| **Kiosco de turno del operario** | Tiempo del operario tocando la aplicación; objetivo < 2 minutos por hora de turno. |

### 0.3. Principios rectores (reglas de diseño)

1. **Cero escritura en planta**: el operario nunca digita más que (como máximo) un valor de contador o una nota opcional. Todo lo demás es automático.
2. **Menos clics, más valor**: cada interacción resuelve una emisión única (iniciar, parar justificado, registrar defecto). Toda operación autorizada se hace sola.
3. **La máquina es la entidad central**: el sistema conoce en todo momento el estado de cada máquina y quién la opera. Toda pantalla de planta se orienta a esa máquina.
4. **El tiempo lo marca el sistema**: fechas/horas las genera el servidor. El operario nunca escribe la hora.
5. **Informativo no invasivo**: el operario no se molesta con ventanas de calidad; solo se le muestran avisos pasivos (toast/indicador luminoso) cuando no bloquean su trabajo.
6. **Configurable antes que programado**: turnos, pérdidas y nombres de causas se configuran por planta; no se "hardcodea".
7. **Todo queda registrado**: cada acción y evento es trazable y auditable, sin excepción.
8. **Un mismo diseño modular multi-planta** (mismo producto, configurado por cliente).

---

## 1. Mapa completo de procesos de la planta

### 1.1. Diagrama de nivel (flujo macro)

```
            (ENTRADA EXTERNA)
  Pedido / Plan de ventas / ERP ──┐
                                 ▼
   [P1] EMISIÓN DE OP ──► [P2] PROGRAMACIÓN Y ASIGNACIÓN ──► [P3] PREPARACIÓN (SETUP)
                                                                    │
   ┌────────────────────────────────────────────────────────────────┘
   ▼
   [P4] EJECUCIÓN (Bucle en vivo) ──► (¿Contador avanzado?) ─► (¿Parada?) = [P5] GESTIÓN DE PARADAS
        │                                    │                              │ fin ──┐
        │                                    └─► [P6] CALIDAD EN LINEA (auto-control)   │
        │                                          │                                  │
        │                                          ├── defecto? ──► [P7] DEFECTOS / NC  │
        │                                          │                                  │
   ◄────┴──────────────────────────────────────────────────────────────────────────────┘
   ▼
   [P8] CIERRE DE LA OP ──► (¿cumple calidad final?) ──sí──► [P9] LIBERACIÓN DE LOTE/SKID
        │                       │ no                        │
        │                       └──► [P7] NC / retrabajo    ▼
   ----Fin de la OP---- prepare indicadores ─────► Juicio de cierre para reportes
                                                        │
   [P10] ANÁLISIS Y MEJORA CONTINUA ◄────────────────────┘ (OEE, Pareto, tendencias)
```

### 1.2. Desglose paso a paso

Cada paso precisa: entradas, procesos, decisiones, responsables, salidas e indicadores.

| # | Proceso | Entradas | Proceso | Decisión | Responsable | Salida | Indicador |
|---|---|---|---|---|---|---|---|
| **P1** | **Emisión de la OP** | Pedido del cliente / plan maestro / necesidades de stock | Se convierten en la OP: cliente, producto, referencia, gramaje, f5 (ancho/largo/target), cantidad, vencimiento, espejo de especificación | ¿Existe producto maestro ativo? ¿cantidad válida? | Planificación / Ventas / Admin | OP emitida con estado `Programada` | Nº OPs emitidas / turno; tiempo de emisión |
| **P2** | **Programación y asignación** | OP emitida, capacidad y disponibilidad de máquinas, turnos | Asignar OP → máquina + turno, prioridad, hora prevista | ¿Qué máquina puede producirla? ¿existe conflicto con otra OP? ¿hay turno? | Supervisor | OP `Asignada` a máquina(s) y turno(s); sugerencia de carga | Carga de máquinas (%); avance plan vs. real |
| **P3** | **Preparación / Setup** | OP asignada, materiales, especificaciones | Operación de cambio de referencia: montaje, ajustes, ensayos | ¿Terminó la OT anterior? ¿calibrado/ajuste OK? | Operario (+Supervisor) | Tiempo de setup registrado, máquina en estado `Preparación` | Tempo muerto de preparación por cambio de referencia |
| **P4** | **Ejecución y control en línea** | OP, contador, velocidad real, lecturas | El operario abre el runtime (INICIAR), sistema captura contadores, supervisa velocidad y produce | ¿Se inicio correctamente? ¿contador coherente? ¿velocidad dentro de tolerancia? | Operario (con el sistema activo) | Órdenes en runtime, contador en línea, % de avance en vivo | Producción (m por hora), rendimiento, avance de meta |
| **P5** | **Incidencia / parada** | Evento en planta (rotura de papel, daño, espera, cambio) | El operador registra la parada (causa); al reanudar se cierra y se computa el tiempo perdido | ¿Reanudación, cambio de referencia, o pase a mantenimiento? | Operario (causa) / Supervisor (autorizaciones) | Parada con causalizado, tiempos disponibles de pérdida, máquina `Detenida` / `Preparación` | Disponibilidad, tiempo perdido, MTTR si es falla, % de bloqueos por causa |
| **P6** | **Calidad en línea (autocontrol)** | Plan de inspección de la OP, especificaciones | El sistema dispara recordatorio de inspección al Calidad (no al operador). El inspector ejecuta y registra | ¿Cumple tolerancia? ¿se permite seguir? | Inspector de Calidad | Inspecciones registradas; resultado conforme / no conforme; notificación de correr si aplica | % de inspecciones a tiempo; tasa de conformidad |
| **P7** | **Defectos y NC** | Detección de defecto (operario o inspector), especificación, fotografías | Registro con un clic del tipo de defecto + foto opcional; se acumulan cantidades asociadas al runtime | ¿Es rechazo total o parcial? ¿Para y corrige (setup) o continúa (paraume de producción)? | Operario / Calidad / Supervisor | Defecto registrado con foto, hora, operario, máquina y orden; NC cuando quality lo clasifique | Scrap / defecto rate (%), cantidad YY por tipo (Pareto) |
| **P8** | **Cierre de la orden** | Lectura final del contador, paradas, defectos, TP | El sistema calcula contador final, tiempos, metacomplimiento, KPIs (OEE/Dispon/Rend/Calidad/Scrap) y guarda la orden como `Terminada` | ¿Cantidad producida ﬁna OK? ¿Hay demasiado NC/no conformidad? | Sistema (automático) con validación del Supervisor | Orden cerrada con KPIs y cierres; trabajo Tiempo de cierre < 1 min | Puntualidad de cierre; % de OPs con KPI completo |
| **P9** | **Liberación / alimbra** | Orden cerrada, resultado de calidad final | Liberación del lote/skid para salida/inventario | ¿Es conforme a la calidad final? ¿Requiere bloqueo NC/retrabajo? | Calidad / Supervisor | Lote liberado a stock o transferencia; documento (si aplica) | OTs liberadas a tiempo; Qty bloqueada |
| **P10** | **Análisis y mejora continua** | Todos los KPI históricos, MC/defectos, paradas | Gerencia y mejora con antioxidantes: tendencias, Pareto, comparativos (máquina/turno/planta) | ¿Dónde se pierde OEE? ¿Quién lidera la acción? | Gerencia / Calidad / Mantenimiento | Reportes ejecutivos, planes de acción | OEE de fondo, Scrap%, MTTR/MTBF en tendencia |

### 1.3. Consideraciones transversales de los procesos

- **El sistema dispara P6 y P7 por reglas, sin intervención del operador** (ver §1.5 y §1.6).
- **P4 no puede existir sin contador válido.** El servidor valida monotonicidad; si no hay lectura inicial el runtime no abre en modo producción con calidad de cálculo.
- **Las decisiones de P5 ("¿reanudar o mantenimiento?")** quedan en el estado de máquina: `Detenida` (no planeada) vs `Mantenimiento` (planeada).
- Todo paso deja un **evento inmutable** para la trazabilidad y para la auditoría: quién, qué, cuándo (timestamps del servidor), máquina, OP.

---

## 2. Levantamiento de requerimientos

### 2.1. Requerimientos funcionales

| ID | Requerimiento | Prioridad |
|---|---|---|
| **RF1** | Login por Código QR, Tarjeta RFID o PIN, sin dígitos — el operario "se toca y entra". | Alta |
| **RF2** | Registro automático de sesión: usuario, hora/fecha, máquina, turno (deducido por el sistema). | Alta |
| **RF3** | El operario solo ve las OPs asignadas a su máquina (según plan); no crea, edita ni borra OPs. | Alta |
| **RF4** | Al seleccionar una OP se muestrea automáticamente: cliente, producto, referencia, gramaje, ancho, largo, cantidad, velocidad meta, especificaciones, supervisor. | Alta |
| **RF5** | Botón **INICIAR PRODUCCIÓN**: arranca el runtime, setTimeout en marcha, máquina pasa a `Produciendo`, comienza cálculo de indicadores. | Alta |
| **RF6** | Captura automática de producción: lector contador (OPC-UA) si existe; si no, solicitud de **un solo valor** (numérico, sin tabla). | Alta |
| **RF7** | Registro de **paradas con un clic**: muestra causa (botón grande): Cambio de referencia, Daño mecánico, Daño eléctrico, Espera de papel, Falta de operador, Limpieza, Ajuste, Otro. | Alta |
| **RF8** | Al registrar parada: grabado automático de hora + operador + máquina + OP. Al reanudar: se calcula tiempo perdido, productivo, disponibilidad. | Alta |
| **RF9** | Calidad por invitación: cada cierto tiempo el sistema notifica al **inspector** (no al operador); el inspector hace el registro; el operador no se frena. | Alta |
| **RF10** | Registro de **defectos**: seleccionar tipo + (opcional) foto + guardar. Nada más. | Alta |
| **RF11** | **Cierre automático de la OP** con cálculos: producción, scrap, disponibilidad, rendimiento, calidad, OEE, tiempo prod/impro, cumplimiento de meta. | Alta |
| **RF12** | **Dashboard supervisor en tiempo real**: estado máquinas (Produciendo / Detenida / Preparación / Mantenimiento) codificado por color. | Alta |
| **RF13** | Dashboard supervisor con: producción del turno, meta, avance, operario, OP, tiempo detenido, última parada, OEE, Calidad, Scrap. | Alta |
| **RF14** | **Dashboard gerencial** con históricos y comparativos: OEE, Disponibilidad, Calidad, Scrap, MTBF, MTTR, producción diaria/semanal/mensual, Pareto, gráficos. | Alta |
| **RF15** | Administración de usuarios y roles con permisos granulares por módulo. | Alta |
| **RF16** | Configuración de turnos, máquinas, áreas, productos, causas, defectos, parámetros por planta. | Alta |
| **RF17** | Mantenimiento: solicitudes desde paradas de máquina, registro de intervenciones, cálculo MTTR/MTBF, historial. | Media |
| **RF18** | Gestión de NC (no conformidades): clasificación, estado, seguimiento de roles y tratamiento, 8D básico. | Media |
| **RF19** | Notificaciones (inspector, supervisor, mantenimiento, gerencia) y gestor audit. | Alta |
| **RF20** | Reportes exportables (PDF/Excel) y programables (automáticos). | Media |
| **RF21** | Auditoría completa de acciones (quién, qué, cuando, anterior/anterior). | Alta |

### 2.2. Requerimientos no funcionales

| ID | Requerimiento | Meta |
|---|---|---|
| **RNF-1** | Rendimiento: captura de eventos < 200 ms (P95) | Alta |
| **RNF-2** | Dashboard tiempo real propaga nuevos eventos a pantallas < 300 ms | Alta |
| **RNF-3** | Latencia de lectura de KPI bajo demanda < 1 s para rangos hasta 1 año | Media |
| **RNF-4** | Usabilidad de piso de producción: interacción con el sistema del operario < 2 min por hora (ver Sección 7) | Alta |
| **RNF-5** | Escalabilidad vertical/horizontal: 3-4 operadores por máquina, 20-200 máquinas/planta; 10–50 plantas (multi-tenant) | Media |
| **RNF-6** | Multi-idioma (ES / EN �teen) desde el inicio | Media |
| **RNF-7** | Mantenibilidad: Clean Architecture, módulos débilmente acoplados, configuración en datos | Alta |
| **RNF-8** | Compatibilidad de usuarios (convención A la Posta, kiosk, touch) | Media |

### 2.3. Requerimientos operacionales

| ID | Requerimiento |
|---|---|
| **RO-1** | Operar 24×7 (turnos continuos) con puesta/mantenimiento sin la detención del sistema. |
| **RO-2** | Modo **offline-first**: los kioscos funcionan en cortes de red, guardan local y sincronizan al reconectar. |
| **RO-3** | Pantalla touch-friendly: botones ≥ 80 px, objetivos táctiles mínimos 64 px, tipografía de lectura a distancia. |
| **RO-4** | El reloj del kiosco no debe ser de fiar (el servidor es la fuente de la hora). |
| **RO-5** | Sesión/página: pantalla completa, bloqueo del sistema, auto-lock tras inactividad (no obligatorio). |
| **RO-6** | Soporte para identidades físicas: QR impreso en carné y tarjetas RFID (o PIN numérico). |
| **RO-7** | El turno debe poder cerrarse (final de turno) con resumen de la sesión del operador. |
| **RO-8** | Los parametros de pérdida y las causas son configurables; no se requieren devs | Alta |
| **RO-9** | Preservar integridad: un operador no puede "terminar" un runtime con paradas abiertas; el sistema lo resuelve/avisa. |

### 2.4. Requerimientos de seguridad

| ID | Requerimiento |
|---|---|
| **RS-1** | Autenticación con credenciales en ningún caso: PIN con hash seguro, QR con token rotativo/prestando, RFID con asociación de evento. |
| **RS-2** | Autorización RBAC estricta por `recurso:acción`. Cualquier verificador en el backend (no [en el cliente). |
| **RS-3** | JWT con expiración corta (access) y refresh rotatorio revocable por rol/planta. |
| **RS-4** | Registro de sesión por duración y dispositivo (kiosco), policy de conflictos (2 operadores en la misma máquina). |
| **RS-5** | Seguridad en API: rate-limit, CORS restringido, headers HSTS, validación estricta Pydantic. |
| **RS-6** | Fotografías de defecto/NC solo accesibles con autorización; almacenaje cifrado (local S3 privado). |
| **RS-7** | Los usuarios de rol `Auditoría`, `Gerencia` son de solo lectura garantizado. |
| **RS-8** | Trazabilidad antialicción: los eventos y los audit logs no pueden borrarse ni modificarse (política de retención). |

### 2.5. Requerimientos de infraestructura

| ID | Requerimiento |
|---|---|
| **RIN-1** | Contenedores (Docker) + orquestación opcional (Docker Compose → Swarm/K8s) sin hardcoded hosts. |
| **RIN-2** | Bases: PostgreSQL (transcaccional/datos) + Redis (pub/sub y caché) — ver el plan de arquitectura previo. |
| **RIN-3** | Almacenamiento de remoto fotos en volumen privado compatible S3 (local o nube). |
| **RIN-4** | Backups automatizados con estrategia y test de restauración. |
| **RIN-5** | Despliegue "de fábrica": instalable on-premises en LAN de planta (firewall, vlan) sin forzar nube. |
| **RIN-6** | Los kioscos son capas (vid), no requieren instalación local salvo el navegador/PWA. |
| **RIN-7** | NTP/sync de reloj configurable (para las integraciones externas, aunque no como autoridad de marca). |
| **RIN-8** | Alertas de estado del soporte (redis, disco, backups, colas pendientes de sync) para el OPS. |

### 2.6. Requerimientos de escalabilidad

| ID | Requerimiento |
|---|---|
| **ES-1** | Multi-tenant: aislamiento lógico por planta (tenant_id) con posibilidad de separación física futura. |
| **ES-2** | Escala horizontal del backend (subir replicas) con Redis pub/sub y cola para kpis. |
| **ES-3** | Series temporales particionadas (Timescale) para los datos de contadores y KPI. |
| **ES-4** | El modelo agregado (rollups) por turno/día libra de cálculos oneroos a la consulta gerencial. |
| **ES-5** | Design de API versionable `/v1` y contratos con DTO independientes del dominio. |
| **ES-6** | Los cambios de estructura vía migraciones automatizadas (si plan explícito multi-tenant). |

### 2.7. Requerimientos de disponibilidad

| ID | Requerimiento |
|---|---|
| **DI-1** | Disponibilidad objetivo ≥ 99,5 % en horario productivo. |
| **DI-2** | El fallo de un kiosco no afecta producción; otro kiosco/segunda puedo tomar la sesión. |
| **DI-3** | Modo degradado: sin BBDD/Redis se mantiene última pantalla y cola local (no se pierde lectura). |
| **DI-4** | Mantenimiento planificado (migraciones) en ventana sin turno o con riesgo de cola. |
| **DI-5** | Reconexión transparente: retry con idempotencia (el backend rechaza duplicados). |

### 2.8. Requerimientos de auditoría

| ID | Requerimiento |
|---|---|
| **AU-1** | Registro de todo evento: inicio de sesión, cambio de estado, runtime, paradas, contadores, inspecciones, defectos, cierres, config. |
| **AU-2** | `audit_log` con actor, acción, recurso, objeto, valor anterior/nuevo, fecha-hora servidor, IP/dispositivo. |
| **AU-3** | Registro de `drift`: lectores que intentan modificar, ediciones de config por Admin, sesiones raras. |
| **AU-4** | Consulta de auditoría por fecha, máquina, usuario, tipo; exportación. |
| **AU-5** | Rotación y retención configurable (mínimos legales) sin modificación. |
| **AU-6** | Roles de solo-lectura y de "auditor" no ejecutan operaciones de planta. |

---

## 3. Diseño de módulos

Relación de módulos del sistema (producto comercial multi-planta). Todos son configurables y con dependencias internas claras.

| Módulo | Descripción | Depende de |
|---|---|---|
| **M01 – Usuarios y Roles** | Gestión de usuarios, roles y permisos (RBAC por plant). Base para IAAF. | M18 (Multitenant) |
| **M02 – Autenticación y Sesiones** | Login PIN / QR / RFID, JWT, sesión de operador (inicio/fin), confrontaciones, kiosco. | M01, M15 |
| **M03 – Catálogos y Maestros** | Cliente, producto/referencia y especificaciones (gramaje, ancho, largo, velocidad, UDE). | M01 |
| **M04 – Estructura Física** | Áreas, líneas, máquinas, periféricos (kioscos, lectores), perfiles de máquina. | M03 |
| **M05 – Turnos y Calendario** | Turnos (horarios), semanas/calendario, excepciones (festivos), detección del turno actual. | M04 |
| **M06 – Planificación / OP** | OP: emisión, programación/asignación a máquina-turno, prioridad, estado, cambios. | M03, M04, M05 |
| **M07 – Ejecución (Kiosco/IPC)** | Runtime de la OP en la máquina, estado de máquina, contador (auto/manual), inicio/fin. | M02, M04, M06 |
| **M08 – Paradas** | Causas, registro inicio/fin, tiempos, clasificación (pierdas/planeadas, MTTR), historial. | M07 |
| **M09 – Calidad en Línea** | Planes de autocontrol por producto/máquina (frecuencia por tiempo o unidades), recordatorios, inspecciones. | M03, M04, M06 |
| **M10 – Defectos y NC** | Tipos de defecto, fotos, cantidades scrap, no conformidades, tratamiento/seguimiento (8D lite). | M09, M07 |
| **M11 – Mantenimiento** | Solicitudes (desde parada o manual), intervenciones, técnicos, historial, MTTR/MTBF, checklist. | M08, M01 |
| **M12 – Motriz/KPI** | Cálculo de OEE, MTBF, MTTR, rendimiento, disponibilidad, calidad, scrap, metas, rollups. | M07, M08, M09 |
| **M13 – Reportes y Exportaciones** | Reportes (por máquina/turno/OP/lote), exportación PDF/Excel, programación de reportes. | M12 |
| **M14 – Dashboard Supervisor** | Control room en tiempo real (estado, meta, paradas, último evento) | M12, M04, M06 |
| **M15 – Dashboard Gerencial** | KPIs ejecutivos, contraste, tendencias, Pareto | M12 |
| **M16 – Notificaciones y Alertas** | Motores: a inspector (calidad a tiempo), supervisor (paradas, feed, incidencias), gerencia (hits), alarmas de estado. | multi |
| **M17 – Auditoría** | registro inmutable de eventos, log tail, alertas de anomalías. | multi |
| **M18 – Configuración / Parámetros** | Parámetros de planta: pérdidas, clasificación OEE, plantillas de pérdidas, idioma, horario, sema. | M01 |
| **M19 – Integraciones** | OPIs de salida (ERP, SCADA, PLC), OPC-UA/RFID/contadores, import/export. | multi |
| **M20 – Administración de la(s) planta(s)** | multi-tenant: tenant, config de la planta, backup/restore, licencia, monitoreo del infra. | M18 |

---

## 4. Diseño del flujo de cada módulo

> Formato de cada módulo: **Objetivo · Usuarios · Entradas · Proceso · Salidas · Automatizaciones · Reglas de negocio**.

### 4.1. M03 – Usuarios y Roles

- **Objetivo:** gestión segura de personas/roles con permisos granulariales por rol y por planta.
- **Usuarios:** Administrador de la planta (y/o integración con IAM externa).
- **Entradas:** datos de persona, rol, método-marca (PIN/QR/RFID), vigencia, área/máquinas de libre asignación.
- **Proceso:** alta/baja/modificación, reset de PIN, activación de credenciales, asociar role y características; el sistema invita al kiosco.
- **Salidas:** usuarios activos, matriz de permisos por rol, credenciales emitidas.
- **Automatizaciones:** stamp de creador/fecha; deactivación programada de BN/paternidad; plantillas de permisos por tipo de operario.
- **Reglas:** un rol no puede modificar sus propios permisos; los usuarios `Auditoría`/`Gerencia` son solo lectura; cada cambio se audita.

### 4.2. M02 – Autenticación y Sesiones

- **Objetivo:** entrar a la máquina en 1 gesto sin digitar; controlar la sesión "quién y en qué máquina".
- **Usuarios:** Operario, Calidad, Supervisor, etc.
- **Entradas:** QR / PIN / RFID del kiosco de la máquina; o credencial tradicional (escritorio para roles no operativos).
- **Proceso:** detección de credencial → identificación de la máquina (kiosco) → apertura de sesión (login) → (al terminar) close/autolock.
- **Salidas:** token JWT, `sesión de turno` con usuario/máquina/hora/turno, log de evento.
- **Automatizaciones:** el turno se deduce por calendario; la hora se toma del servidor; la máquina está definida por el kiosco (no la escribe el operador); el token se renueva solo.
- **Reglas:** un operador no puede abrir una sesión en dos máquinas simultáneamente (salvo rol/viabilidad); la sesión cambia al cambiar de máquina; el sistema notifica al supervisor sobre intentos conflictivos.

### 4.3. M04 – Estructura física (Áreas y Máquinas)

- **Objetivo:** representar la planta tal como es: áreas → líneas → máquinas con su perfil.
- **Usuarios:** Admin / Configuración.
- **Entradas:** nombres, códigos, tipos de máquina, si tiene contador (auto/manual), velocidad max nominal, unidad (m/u).
- **Proceso:** CRUD + asignación de kiosco asociado y tipo de lector (O PC, manual, RFIDInterface).
- **Salidas:** catálogo de máquinas del plantel; máquinas invitadas a los dashboards.
- **Automatizaciones:** el estado actual de cada máquina (IDLE / preparación / produciendo / parada / mantenimiento) es un valor del sistema, no escribido por nadie.
- **Reglas:** una máquina solo puede tener una ejecución (runtime) abierta; cambios de perfil se logean en auditoría.

### 4.4. M05 – Turnos y Calendario

- **Objetivo:** definir la jornada productiva y el horario de trabajo; soportar cambios de turno y festivos.
- **Usuarios:** Administración / Planificación.
- **Entradas:** nombre de turno, hora inicio/fin, día de la semana, plantilla (lunes, etc.), excepciones.
- **Proceso:** configuración de calendario base + reglas de excepción del sistema, detección del turno actual por hora servidor.
- **Salidas:** turno vigente para cada evento, límites de meta de turno.
- **Automatizaciones:** el turno se auto-identifica en el login y en cada evento; cierre de turno sugiere a supervisor para revisión.
- **Reglas:** un evento de vivienda no puede pertenecer a dos turnos; el corte de turno usa hora viral (granil fijo), no la hora del operador.

### 4.5. M06 – Ordenes de Producción / Planificación

- **Objetivo:** recibir la demanda, emitir OP y programarla en la máquina/turno correcto.
- **Usuarios:** Planificador, Supervisor (asignación fina), Admin (maestro).
- **Entradas:** pedido o demanda interna, producto/referencia, cantidad, fecha, especificación (snapshot); en ausencia maestra.
- **Proceso:** emisión → crítica (capacidad) → asignación a máquina/turno → liberación → vista en kiosco.
- **Salidas:** OP con estado (`Programado` → `Asignada` → `Liberada` → `En ejecución` → `Terminada` → `Cancelada`/`En pausa`), avance.
- **Automatizaciones:** sugerencia de máquina y turno (capasidad actual), sugerencia de orden de arranque por prioridad; el kiosco solo invita una asignación; el cambio de estado dispara notificaciones.
- **Reglas:** no se puede asignar dos OPs a la misma máquina en el mismo turno sin conflicto (se permite, aviso); editar OP de una máquina en marcha exige supervisor; el Límite de meta a doble es producto×turno.

### 4.6. M07 – Ejecución (Kiosco)

- **Objetivo:** que el operador dirija la OT con el mímin de interacción.
- **Usuarios:** Operador (kiosco de la máquina), Supervisor (valores de seguimiento).
- **Entradas:** Origen (login), OP seleccionada, botón INICIAR; contador (automático OPC o manual).
- **Proceso (cadena de la plantilla):**
  1. Operario elige su máquina (automático por kiosco) y se loguea (QR/PIN/RFID).
  2. Se muestran las OPs liberadas de esa máquina.
  3. Al seleccionar: **INICIAR** abre runtime (cronómetro, máquina `Produciendo`).
  4. El sistema captura el contador de forma continua (automático) o pide un valor puntual mínimo.
  5. Opciones en vivo: `Parada`, `Defecto`, `Contador`, `Finalizar` (solo Supervisor confirmado).
  6. Al finalizar: sistema cierra, graba lecturas, calcula y limpia KPIs.

- **Salidas:** runtime activo, histórico de contadores, eventos de la OT, cambios de estado.
- **Automatizaciones:** arranque de contador; detector de turno; auto-comdificación de parada abierta al INICIAR; sugerencia de causa "última"; carga automática del contenidos segunda vez; fin de count final al cerrar; music/Alarmas de guardado.
- **Reglas:** no se inicia una OT si la máquina ya está en Produciendo/Parada/Mantenimiento sin terminar la anterior; no se permite guardar un contador menor al último; no se pasa a FIN sin cerrar paradas abiertas (el sistema ofrece cerrarlas automáticamente).

### 4.7. M08 – Paradas (Downtime)

- **Objetivo:** capturar cada parada con causa y calcular el impacto real en el tiempo.
- **Usuarios:** Operador (registro), Supervisor (cierre, gestion).
- **Entradas:** causa (botón grande); tipo de parada (planeada o no), hora automática.
- **Proceso:** parada → el sistema abre (inicio, usuario, máquina, OP); al reanudar (botón CONTINUAR) se cierra y calcula duración; según causa se clasifica (pierde dispon, MTTR, etc.).
- **Salidas:** evento parada con inicio/fin/nor, tiempo perdido, posible solicitud de mantenimiento.
- **Automatizaciones:** hora de inicio/fin automática; Cálculo de duración automático; si la parada termina de la OT, sugiere `CONTINUAR` versus `FINALIZAR` según cantidad restante; agrupa paradas consecutivas de igual causa en "una parada doble".
- **Reglas:** no puede haber dos paradas abiertas; no se cierra una OT con parada abierta (debe resolverse); causas con `require_corrective_action` → generan tarea de M11.

### 4.8. M09 – Calidad en la Línea

- **Objetivo:** garantizar los controles según planes, **sin** interrumpir al operador.
- **Usuarios:** Calidad/Inspector (según turno), Supervisor (via).
- **Entradas:** plan de autocontrol por máquina/producto (intervalo en tiempo o en unidades), programa del turno.
- **Proceso:** el sistema programa próximas inspecciones durante el runtime; notifica al inspector; el inspector abre la ficha pre-cargada y completa; resultado (conforme/no conforme) con OK/foto.
- **Salidas:** inspección registrada, alerta al supervisor en caso NC, /etapa result.
- **Automatizaciones:** cálculo de la hora/volumen de la próxima inspección (según plan); recordatorio al inspector; **prefill** de la ficha desde la especificación de la OT; cierre automático de la inspección si no se completó (se marca como "vencida") — con nueva tarea de supervisor.
- **Reglas:** nadie más que el rol Calidad ejecuta inspecciones; un inspector no puede inspeccionar bajo su propia supervisión (conflict management); una NC de calidad bloquea la liberación de la OT hasta resolución.

### 4.9. M10 – Defectos y NC

- **Objetivo:** registrar defectos / no conformes con mínima carga, y dar seguimiento.
- **Usuarios:** Operador de planta (defecto simple), Calidad (registro/complejo + NC), Supervisor (clasificación/asignación).
- **Entradas:** tipo de defecto, opcional foto, máquina/qué automático.
- **Proceso:** el operador selecciona el defecto (y foto si quiere) → se calcula cantidad Yajada según contador del tramo (o se toman cuenta) → QA la revisa y clasifica (scrap / retrabajo / tolerable) → NC de alto impacto abre la ruta de tratamiento.
- **Salidas:** defecto con cantidad estimada, registro fotográfico, NC con estado.
- **Automatizaciones:** el tipo de sugiere (primeras causas recientes); el volumen se soretiende del contador si el defecto ocurre durante runtime; la etiqueta de "NC a asignar" se crea automáticamente si impacto > umbral; fotos guardadas en repo central privado.
- **Reglas:** un defecto no genera borrado de producción; la cantidad de scrap NO se resta de lo producido (se analiza por calidad/scrap); tipos NC marcados como "crítico" requieren acción supervisor/pausa.

### 4.10. M11 – Mantenimiento

- **Objetivo:** convertir pérdidas en historial técnico; priorizar y dar MTTR/MTBF honestos.
- **Usuarios:** Supervisor (solicitud), Técnico de mantenimiento, Admin (banco), Gerencia (return).
- **Entradas:** solicitudes desde paradas (daño mecánico/eléctrico), agenda planeada (sin fecha), intervenciones.
- **Proceso:** solicitud → asignación → intervención (inicio/fin, tipo de falla, repuestos, comentario) → cierre.
- **Salidas:** histórico técnico por máquina, indicadores MTTR/MTBF/frecuencia por falla, conforme del equipo.
- **Automatizaciones:** las paradas con causa de mantenimiento generan la solicitud directa; el MTTR se calcula del par; el sistema emite alertas de frecuencia anormal (por causa-máquina) desde la historia; interviniendo plazo de falta de partes.
- **Reglas:** los tiempos de mantenimiento no se cuentan como pérdida de plan para OEE (son tiempos satelitales), pero habla el MTBF/MTTR; una OT en mantenimiento no puede arrancar producción.

### 4.9. M12 – Indicadores / M12 · Não direções

Indicadores consistentes (repositorio de fórmulas del dominio):

- **Disponibilidad** = (Tiempo operativo programa – Tiempo de pérdida) / Tiempo operativo programa. El "tiempo de programación" se deriva del turno con paradas programadas (mantenimiento planificado, descanso) excluidas.
- **Rendimiento** = Producción real / (Tiempo operativo × Velocidad meta).
- **Calidad** = Cantidad conforme / Cantidad total.
- **OEE** = Disponibilidad × Rendimiento × Calidad.
- **MTBF** = horas de funcionamiento / cantidad de fallas (paradas no planeadas con causa mecánica/eléctrica).
- **MTTR** = horas de parada por falla / cantidad de fallas.
- **Scrap %** = Cantidad no conforme / Producción total.

---

## 5. Automatización máxima

### 5.1. Matriz "qué se autocompleta" (fuente automática)

| Campo | Fuente automática (Siempre si no se puede) |
|---|---|
| Usuario actual | Sesión abierta (QR/PIN/RFID) — nunca se escribe |
| Fecha y hora | Servidor — nunca se escribe |
| Máquina | Kick/badge del dispositivo (en login kiosk) — nunca se escribe |
| Área / línea | Herencia de la máquina |
| Turno | Calendario config por hora servidor |
| Orden de la jornada | OP asignada (selección, no digitación) |
| Cliente, producto, gramaje, ancho, largo, velocidad, especificaciones | Maestro de OP/producto al elegir la OP |
| Velocidad meta del turno | Especificación de la OP |
| Contador N°1 | Lectura al INICIAR (a UTI/OPC o 1ª manual) |
| Contador N°2.. | Automático (OPC), si no = 1 dato numérico (solo si cambia mucho) |
| Contador final | Al FINALIZAR: automático o manual ÚNICO valor |
| Hora inicio parada / ínicio | Servidor en el clic del botón |
| Duración parada | Cálculo (inicio–fin) automático |
| Clasificación de la parada | Por causa elegida (botón grande) |
| Tiempo perdido / productivo | Cálculo automático en cada inicio/fin |
| Próxima inspección | Cálculo del plan (tiempo o unidad) automático |
| Checklist de inspección | Desde especificación de la OP (componentes automáticos) |
| Tipo de defecto | Selección, y se sugiere el más reciente de esa máquina para el mismo tipo |
| Volumen de defecto | Estimación del contador automáticamente puede quezda |
| Trabajo de KPI/OEE de la OT | Cálculo automático al cierre |
| Yield/Rollo de MLT/MTTR | Calculado automáticamente del histórico |
| Cumplimiento de meta del turno | Lineal de contador vs meta del turno |
| Notificación de turno | Programado en calendario conocer límites |

### 5.2. Automatizaciones de proceso (acciones que el sistema ejecuta solo)

1. Al iniciar sesión (Login): registra sesión físic y abre el home del operario con sus OPs.
2. Al INICIAR producción: cierra la parada previa "Preparación", si es pertinente; abre runtime; registra inicio; el cambio de estado de la máquina; los bogados de paros; arranca cronómetro; calcula disponibilidad base.
3. Aceptar de la producción: el sistema avisa al Inspector si corresponde hora de inspección; no interrumpe al operador.
4. Con un clic de CONTINUAR tras una parada: cierra, computa duración, devuelve el estado a Produciendo y el cronómetro OEE continúa.
5. Registro de defecto: llena OP, máquina, operador, hora y **cantidad por contador**; solo se necesitan clic de imagen (opcional).
6. Al FINALIZAR: cierre automático del runtime, paradas pendientes (solicitada supervisión), análisis de KPIs, aviso al supervisor y a calidad final.
7. Al entrar/cerrar el turno: calcula el cierre de turno (producción, meta, OEE) y lo guarda para la revisión.
8. Si el kiosco pierde red: cola local automática con envío en reconexión con idempotencia (no se pasa lecturas dos veces).
9. Alarmas automáticas: parada > X min sin reanudar → notificación; MTTR alto por falla→Supervisor; OT sin leer contador por X → sug.

### 5.3. "Carga predictiva / only-intelligent"

- **Sugerencia de causa al solicitar** Parada: la última causa usada en esa OT (ahorra el clic). 
- **Sugerencia de valor de contador por defecto**: el sistema ofrece el "esperado" (última lectura + velocidad×Δt) y el operador solo confirma/corrige.
- **Sugerencia para la próxima OP**: al terminar, el kiosco sugiere la siguiente OP de la secuencia (con las materias Oackage) → un solo clic.
- **Botón "Repetir la última acción"** para casos de homología (el operador repite la acción anterior sin abrir menú).

**Resultado esperado de carga el kiosco: mínimo posible** (ver §7 para el presupuesto de tiempo con objetivos concretos).

---

## 6. Diseño de pantallas

> Sin código: se describe la experiencia, distribución, jerarquía visual y comportamiento. Base de diseño: estética industrial premium (inspirada en Ignition SCADA / OpCenter), colores fuertes solo para estados, alta legibilidad de distancia, patrones de kiosco táctil.

### 6.1. Pantalla principal (Kiosco de la máquina) — el núcleo

- **Distribución:**
  - Franja superior (~80 px): izda. máquina + área + turno + fecha/hora (grande); centro: estado de la máquina en badge de color; dcha.: usuario logueado + botón "Salir".
  - Cuerpo central: **tarjeta de la OT activa o "Seleccionar OP"** (grande, con toda la info precargada, en vez de sin margen).
  - Franja de acción inferior: **botones grandes** (no menos de 120 px de alto): INICIAR/CONTINUAR (verde), PARADA (rojo), DEFECTO (naranja), CONTADOR (gris), FINALIZAR (azul).
  - Esquina inferior izq.: mini-gráfico circular u horizontal de avance de la meta de la OT/turno.
  - Esquina inferior dcha.: reloj + cronómetro activo.
- **Colores (semáforo en badge):** Verde = Produciendo · Amarillo = Preparación/Setup · Rojo = Parada no planeada · Azul = Mantenimiento · Gris = Sin OT / Offline.
- **Alertas:** avisos toast no bloqueantes (abajo-dcha) para inspección, orden nueva, alarma de datos. Alertas críticas (si la parada > umbral) se muestran más prominentes desde el kiosk sin llegar a molestar el trabajo.
- **Acciones prioritarias (visibilidad):** INICIAR → mayor, PARADA también, DEFECTO visible siempre, CONTADOR solo si hay máquina sin OPC.
- **Comportamientos:** pocos estados completos (sin scroll); todo touch; la pantalla se actualiza sola vía WS cuando el estado de la OT/contador cambia; si no hay OT asignada, botón "Llamar supervisor" discreto cortaba.

### 6.2. Pantalla de Login (kiosco)

- **Distribución:** todo el centro: gran recuadro con QR/PIN/RF (tab switcher por método); teclado numérico grande (si PIN); nombre de la máquina como título; "¿Busca tu tarjeta?" no; al leer un insignia, aleación.
- **Alertas:** intento fallido = amarillo, aviso de "solo operario de esta máquina" si corresponde; timeout envía al estado inicial.
- **Prioridades:** el acceso con muestra del método disponible en la fúrbrica por OP; y el destino tras login siempre la home del operador.

### 6.3. Pantalla Pops: **Selección de OP**

- **Distribución:** lista de OP asignadas a la máquina del turno (tarjetas), ordenadas por prioridad/fecha; cada tarjeta: código de OP, producto, cliente, cantidad pre-cargada, color de estado (preparada, sincronizada, parada).
- **Acciones:** tocar → abrir detalle (TODA la info precargada) → botón **INICIAR**.
- **Regla visual:** máquina debe estar `Asignada`; no se crean OP aquí.

### 6.4. Pops: **Registrar parada**

- **Distribución:** cuadro modal a pantalla completa, red; lista de causas con botones long (grid 2×4): Cambio de referencia, Daño mecánico, Daño eléctrico, Espera de papel, Falta de operador, Limpieza, Ajuste, Otro (→ teclado alfa si "otro" + nota).
- **Campaña automática:** al tocar → si "Daño mecánico/eléctrico", el sistema sugiere crear un ticket de M11 (checkbox precargado); luego la causa "última vez" aparece el primer botón sugerido.
- **Acción "CONTINUAR"** al final del modal → cierra y calcula.

### 6.5. Pops: **Registrar defecto**

- **ones:** Modal con lista de tipos de defectos de la planta (grid); en la esquina nueva: cámara para foto opcional (debajo, opcional); campo "cantidad" implícito (auto del contador).
- **Flujo:** toca nombre → (opcional) foto → guarda. — El inspector luego la revisa.

### 6.6. Pops: **contador manual**

- **Tipo:** solo se avisa si la máquina no tiene contador automático.
- **UI:** número grande + teclado numérico; se muestra el valor esperado (última + estimación) como línea de guía deshabilitada.

### 6.7. Pantalla **Calidad (Panel del Inspector)**

- **Distribución:** lista de inspecciones pendientes/vencum (header con contador de pendientes y la alerta de hora), cada una con máquina, OT, hora y plano/plan; al elegir → ficha precargada con todos los items del plan (regla: bob).
- **Acciones:** pasar ✓ por ítem (toque), foto adjunta, observar brevemente, resultado global (CONFORME / NO CONFORME) → Guardar. NC dispara aviso.
- **alertas:** pendiente > 5 min → avisor rojo al supervisor.

### 6.8. Pantalla de calidad de Calidad: **Revisión de defectos (QA)**
…continúa en 6.9

### 6.9. Pantallas de Configuración (Admin/Config)

- **Distribución** por secciones tipo tablas: Usuarios (grid+botones), Roles/perfiles, Máquinas, Turnos, Áreas, Tipos de defecto, Causas de parada, Plans de inspección, Params OEE, Plantas.
- **Foco:** crear bajo "configuración", no código; in muero de vista previa de turnos y de test OEE (simulador con datos de entrada y resultados en vivo).

### 6.10. Pantallas de Supervisor (ver detalle en §8)

---

## 7. Diseño del flujo del operario (< 2 min por hora)

### 7.1. Objetivo de interacción

En las horas de producción el operador debe interactuar **menos de 2 min/hora totales** con la app, incluyendo 1-3 paradas, contador puntual (si es manual) y ocasional defecto/inspección; el resto, la app monitorea sola.

### 7.2. Presupuesto de tiempo (análisis peor caso)

| Actividad | Frecuencia (turno 8h) | Duración media | Subtotal (turno) |
|---|---|---|---|
| Login (scan QR/PIN) | 1 | 15 s | 0:15 |
| Seleccionar OP + INICIAR | 1-2 | 20 s | 0:40 |
| Parada + causa + CONTINUAR | 2-4 | 20 s | 1:20 |
| Defecto (tipo + foto?) | 0-1 | 25 s | 0:25 |
| Contador manual (si sin OPC) | 1-2 | 12 s | 0:24 |
| FINALIZAR una OT / siguiente OP | 1-2 | 20 s | 0:40 |
| Total estimado (peor) | | | **≈ 5:xx?** |

> Objetivo bueno: **menos de 2 min/hora** se alcanza cuando la mayoría de los turnos son ≤ 6 h de viaje (2-3 paradas reales, sin contador manual, con login una vez). Fórmula: ~30–60 s por incidente, nunca >1 min cuando el flujo es normal.

### 7.3. Diseño de la experiencia de turno

1. **Reingreso (una vez)**: scan / tecleo de PIN. Cero escritura adicional (no escribe hora ni máquina).
2. **Vista inicial**: arranca con la OT asignada lista y el botón INICIAR encendido. La pantalla NO pide confirmación de WI.
3. **Duriera**: holding automático. Solo aparece:
   - Cambio de OT (asignaron antes por turno) → 1 clic.
   - FINALIZAR/INICIAR OT → 1 clic.
   - PARADA → 1 clic + causa (1 para volver).
   - Sugerencia de causa y de defecto (1 clic + regresar).
4. **Inspección de calidad**: el aviso es un mic-button no bloqueante; el operador sigue su turno; sucede en paralelo (toda la supervisión la hace Inspector que está conectado).
5. **Uso de intenciones**: si el operario finaliza turn air the system sugiere el siguiente OT del programa para el operador del cheque si la producción continúa → 1 clic.
6. **Fin de turno**: la pantalla pasa a "resumen de mi cuenta" (producción, calidad de turno) sin que el operador haga nada; a la hora de la siguiente presencia se hará contacto con el operator asignado.

### 7.4. Principios de la capa de interacción

- **Un solo clic por la acción principal.** Ya en "Otro" se surgira confirmación/nota única.
- **No se cierra nunca un modal de confirmación para "está seguro?" si la acción es no destructiva**; solo se confirman fin de OT o cambio de operador (esas si).
- **Toque y error**: si el toque es recibido, el UI riposta visible instantáneamente (efecto).
- **Modo "trabajo continuo"**: en runtime con OPC, el kiosk pasa a "display-only" (modo monitor), sin botones grandes disturb por el universo, pero la PARADA siempre accesible en el pulgar y no dolorosa.
- **Id = tarde**: el sistema no espera por el operador; los datos de la máquina fluyen; si el operador no pone parada, el contador no avanza y el sistema marca "sin actividad", alertando al supervisor, no juz hizo culpa al operador con trabajo extra.

---

## 8. Dashboard del Supervisor — Centro de control

### 8.1. Propósito

Una sola pantalla con visibilidad total de la planta para tomar decisiones en el piso: "¿dónde estamos perdiendo minutos y cuánto para la meta?".

### 8.2. Layout (una sola vista, modo Control Room)

```
┌──────────────────────────────────────────────────────────────────────┐
│ NAV: LOGO · Estados crit. (Alarmas) · Reloj/Turno/Turno · Usuario        │
├────────────────────────────── PLANT· MÁQUINAS ──────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│  │ MÁQ 1 (verde)│ │ MÁQ 2 (rojo) │ │ MÁQ 3 (amar)│ │ MÁQ 4 (azul)│ →  .→
│  │ OP · Meta · │ │ OP · Meta ·   │ │ OP · Meta   │ │ MT/OP       │    │
│  │ avance% OEE │ │ avance ·OEE   │ │ parada causa│ │  dsh        │    │
│  │ última par.  │ │ último par. │ │ t-12m        │ │  (t-14m)    │    │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │
│  ─────────────── bottom bar del superintendent ───────────────      │
│  OEE Global │ Disp │ Rend │ Calidad │ Scrap | Tiempo parada total    │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.3. Tarjeta de máquina (bloque en vivo)

- **Color de fondo del bloque**: según estado (verde / rojo / amarillo / azul / gris) — también un borde parpadeo lento en casos de alarma (parada>umbral, sin operador, PH).
- **Contenido (en columna visual jerárquica):**
  1. Nombre + estado + OT actual.
  2. Operario logueado (avatar/foto) + turno.
  3. Avance de la OT: barra de metro vs. marco, "Δ a la meta del turno" (±m), en Azul por debajo (siempre).
  4. Contador actual + velocidad actual (principalmente si OPC).
  5. OEE en vivo con desglose A×R×Q (mini 3 cosas).
  6. Estado de calidad: próxima inspección (hora), contador de pendiente; si NC activa → icono.
  7. **Última parada**: causa + duración + hace cuánto.
- **Interacción:** tocar un bloque → panel lateral de detalle del máq. con:
  - Cronología (timeline) del turno: barras verde (producción) / rojas (paradas) / azul (mantenimiento / setup).
  - Eventos recientes (últimos 10) con filtro.
  - Botones: `FINALIZAR OT` (aprobación supervisor), `Pedir causa`, `Chamador de manten`, `Asignar OT` para esa máquina.

### 8.4. Banda inferior (KPIs de turno/corr de la planta)

- OEE global del turno (con A/R/Q), meta vs. real del turno (m/h), paradas activas (nº máquinas en rojo), lista de "alertas activas".

### 8.5. Alertas y semáforos

- **Nivel crítico (parada activa > 5 min sin causa)** → parpadeo de rojo en el bloque.
- **Nivel atención (parada > 5 min con causa o cambio de turno sin login)** → amarillo destello.
- **Límite de calidad**: NC pendiente > X min → azul info + icono a QA.
- Cada alerta llegue además a `Notificaciones` (ver M16).

### 8.6. Modo vista "de ejecutivos"

- Rendering de series: Disponibilidad/Performance en el tiempo (minutos/hora) de cada máquina, para revisar "micro-patrones" con desplazamientos de retardo.

---

## 9. Dashboard gerencial

### 9.1. Propósito

Planta/EJECUTIVO: ver el estado de la operación en agregados diarios/semana/ mes y evolución histórica, para comparar, tomar atribución de actividades y negociar.

### 9.2. Layout y contenido

**A) Cabecera de filtros:** rango de fechas (hoje, 7d, 30d, mes, año, personalizado), planta/área, selección de máquinas, turno, tipo de OT/producto. Estos filtros reconfiguran todo el dashboard sin cambio de página.

**B) Filas de KPIs (azul), con sparkline por período:**

| KPI | Defin / detalle |
|---|---|
| OEE | % con triángulo de evolución vs. período anterior |
| Disponibilidad | % con tendencia |
| Rendimiento | % |
| Calidad | % (producir bueno) |
| Scrap | % (o ancho perdido) |
| MTTR / MTBF | horas por falla / horas de de entre fallas |
| Produción total | m o unidades |
| Meta vs real | % cumplimiento por día |
| Paradas | horas totales en perdido + % por causa (dds) |

**C) Gráficos (títulos + series):**
1. **Tendencia OEE y componentes** — línea/ `area` por día (filtable por máquina).
2. **Producción por día** (semana/mes) con meta programada trazada (brecha).
3. **Pareto de paradas** (por causa) y **pareto de defectos** (por tipo) — con % documentado acumulado.
4. **Perdidas**: "dónde se pierde el OEE" (pérdidas de disponibilidad vs rendimiento vs calidad) en un gráfico de barras apilado.
5. **Comparativo entre máquinas/turnos** — (mini bar) «turno mejor/peor».
6. **Mapa de calor de OEE por máquina×día** (semana) — rojizo->azulada.

**C) Tablas de drill-down:** click en Pareto → detalle por OT → evento de parada original. Exportación PDF/Excel (reporte de la tabla).

**D) Notas para acción:** el sistema sugiere los 3 mayores desafíos (p. ej. "Máquina 3: 34 % de OEE perdido por Daño eléctrico — MTTR creciente") derivados de los datos.

### 9.3. Nivel de resumen

- **Multi-área / multi-máquina**.
- **Estado** comparando turnos A/B/C consistentes.
- **Tendido** por plantilla de fecha (lunes a domingo correcto en fabricante de papel).

---

## 10. Roadmap por versiones (producto comercial)

> Fases con **objetivo, funcionalidades y criterio de salida**.

### **Versión 1 — Núcleo operacional (planta piloto)**
*Entradas: pipeline operacional, kiosco funcional, auditoría, configuración.*
- Módulos: M01, M02, M03 (básico), M04, M05, M06, M07, M08 (básico), M12 (OEE por cierre), M14, M17.
- Funcionalidades: Login QR/PIN/RFID, sesión+turno automático, ver OP asignada, INICIAR/FINISH, contador OPC manúal, paradas con causa + clasificación, cierre de OT con OEE, dashboard supervisor en vivo (estado, meta, paradas), auditoría de eventos, usuarios/roles/permisos, configuración de turnos y máquinas, reporte de OT exportable.
- **Criterio de salida:** una máquina real (kiosk) completa en producción con los 8 flujos clave; OEE reconciliado (cálculo verificado vs Excel).
- **Fuera:** calidad online (llega V2), gerencia analítica completa.

### **V2 — Calidad Integral**
- **Funcionalidades de agente:** M09, M10 – inspecciones programadas por plan (intervalo tiempo/volumen), cola del inspector, checklist precargado, defectos con foto, NC con tratamiento 8D uni, bloqueo de liberación.
- **Añade:**
 - Calidad dashboard de QA (pendientes, NC).
 - Métricas de scrap / tasa de no conforme por OT.
 - Mantenimiento (M11): tickets desde paradas mecánico/eléctrico, histórico por máquina.
 - Notificaciones (Web/Push email) para inspector/supervisor.
- **Criterio de salida:** circuito calidad cerrado sin formularios (todo auto-ai, fotos) con un volumen objetivo (p.ej. planta libera). requisito de los informes.

### **V3 — Analytics y Equipos**
- **Extensión:** Dashboard gerencial completo (M15), reportes programados/export (M13), Paretos, comparativos, tendencias, rollout AG for histórica.
- **añade:** Dashboard supervisor mejorado (timeline por máquina, al defender/redeem directa), módulo de configuração de plans (planes de inspección por grupo, NP, plantas), API REST para extracción (integración sin línea a ERP).
- **Criterio:** decisión gerencial basada en reportes del producto (sin hojas de papel). Primer export.

### **V4 — Multiplante> y layout integración**
- **Funcionalidades:** M20 multi-tenant completo (licencias de zona, tenant, aislamiento, facturación config), integraciones de E/S principales: ERP (SAP/a cualquier, transferidor de OTs y resultado), OPC-UA + historizador completo de series, lector RFID industrial y Tables/wire.
- **Añade:** Scheduler de turnos, diferente por planta; reporte por tenant; módulo de exportación de KPIs propio.
- **Criterio:** instalación en 2+ plantas con datos completamente separados; OPC OOT(BA) de una segunda planta piloto.

### **V5 — Inteligencia y mejora continua (elasto ...)**
- **Funcionalidades:** 
  - Anomalías del contador/velociE crítico (ML de regres y).
  - Mantenimiento predictivo temprano (featurización de màquinas para predecir fallas por patrones de funcionamiento y paradas); análisis de causa raíz asistido (correlación defecto-causa).
  - Rally videos / visión (opcional) para calidad automática (demo en fase de pilot).
  - Aplicación móvil ligera (supervisor/gerencia + kiosk PWA).
  - IA para llenado de datos faltantes (imputación de inspecciones perdidas con alerta de riesgo).
- **Criterio:** recomendaciones predicco validadas en datos reales; plataforma entregada como producto multi-planta completo.

---

## Anexo: Decisiones y preguntas abiertas (para confirmar antes de programar)

| # | Pregunta / decisión de negocio | Opciones (recomendada) |
|---|---|---|
| 1 | Unidad del contador de producción | metros kg / unidades (recomendada: según máquina; puede verse por máquina) |
| 2 | Horario de turnos de la planta | ej. 06-14/14-22/22-06; definir plantilla |
| 3 | Frecuencia de inspección automática | por tiempo (min) y/o por volumen (m) — configurable al plan |
| 4 | Velocidades objetivo | fija por producto o editable por OP (recom.do: por OP con fuelc de producto) |
| 5 | ¿Integraciones OPC-UA en V1? | primereso sin OPC (contador manual) y OPC en V1 si hay PLC disponible |
| 6 | ¿Qué sistema/ERP existente conectable? | nombres/API actuales — para diseño de la capa de integración |
| 7 | ¿Fotografías almacenadas local o nube? presente infra | Recomendado: storage privado (on-promise/S3) |
| 8 | Idiomas de las pantallas | ES / EN (config por planta) |
| 9 | ¿Modo offline total en algun.setUch no red? | Recomendado: soporte parcial en V2, total en V4 |
| 10 | ¿Qué "meta" se usa para cumplimiento? | cantidad de la OT o meta de turno por máquina — para definir el 100% del juego para los avances |
| 11 | ¿Escal 10 plantas? | multi-tenant en V4; arquitectura ya preparada desde V1 |

---
*Fin del análisis funcional v1.0. Documento de referencia para aprobar y luego detallar el diseño técnico (base de datos y API).*