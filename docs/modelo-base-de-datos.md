# SIGPC — Modelo de Base de Datos Empresarial

**Versión:** 1.0 · **Estado:** Borrador para aprobación · **Autor:** Data Architect Senior MES/ERP

> Diseño conceptual-físico del sistema SIGPC: 50+ tablas organizadas en 8 módulos, normalizado (3FN), multi-tenant, preparado para millones de registros y para integración PLC/ERP/Industria 4.0.
>
> **Este documento NO contiene SQL.** Define tablas, atributos, tipos, claves, restricciones, índices y estrategias. El SQL, el ORM (SQLAlchemy) y las APIs se generarán una vez aprobado.

---

## 0. Principios y decisiones de diseño

| # | Decisión | Justificación |
|---|---|---|
| **DB-01** | **PostgreSQL 16+ como motor único**, con extensión **TimescaleDB** para tablas de eventos/series temporales | Robustez transaccional + hipertablas para miles de millones de lecturas de contador sin degradar. |
| **DB-02** | **PK con `UUID` (`gen_random_uuid()`)** en tablas maestras y de negocio; `BIGINT identity` en tablas de alto volumen (eventos, lecturas, bitácora) | UUID evita colisiones en integraciones multi-sistema y futura consolidación multi-planta; BIGINT en tablas append-only ahorra 16 bytes por fila × miles de millones de filas. |
| **DB-03** | **Multi-tenant por columna `planta_id`** (esquema único compartido) + **Row Level Security (RLS)** habilitable | Costo bajo por planta nueva, consultas simples, RLS garantiza aislamiento lógico incluso ante errores de aplicación. Se documenta el camino a esquema-por-tenant si un cliente exige separación física. |
| **DB-04** | **Particionado por rango de tiempo** (mensual) en: `eventos_produccion`, `lecturas_contador`, `bitacora`, `eventos_sistema`, `snapshots_indicadores` | Los históricos crecen para siempre; el particionado permite purge/detach de particiones viejas sin `DELETE` masivo y consultas por rango en particiones únicas. |
| **DB-05** | **Nada quemado en código: catálogos parametrizables** con FK reales (estados, causas, defectos, scrap, alarmas, prioridades, unidades, colores, turnos, productos) | Los estados de vida de cada entidad viven en `estados` (catálogo por proceso), cumpliendo el requisito de configuración total. |
| **DB-06** | **JSONB solo para datos flexibles/opcionales** (especificaciones, payloads de eventos, checklist, fotos, repuestos, configs) | Nunca en datos consultados por filtro; los campos críticos de negocio son columnas tipadas con índices. |
| **DB-07** | **Todos los timestamps en `TIMESTAMPTZ` (UTC)** + zona horaria de la planta en `plantas` | El servidor es la autoridad de tiempo (RN-GEN-001); reportes por turno convierten por planta. |
| **DB-08** | **Números con `NUMERIC(p,s)`** (nunca `FLOAT` para cantidades/monedas) | Exactitud decimal en contadores, scrap y costos. |
| **DB-09** | **Integridad referencial total con `ON DELETE RESTRICT`** (nunca CASCADE en datos de negocio) + columnas de baja lógica (`activo`) en maestros | Un evento nunca desaparece; se desactiva el maestro. |
| **DB-10** | **Invariantes de negocio materializadas con índices parciales únicos** (un runtime activo por máquina, una parada abierta por máquina, una sesión activa por operario) | La integridad se garantiza a nivel base de datos, no solo por aplicación (RN-RES-004/005). |
| **DB-11** | **Idempotencia en eventos** con `idempotencia_key UUID UNIQUE` | Doble envío por offline/reintentos nunca duplica (RN-GEN-004). |
| **DB-12** | **Auditoría inmutable por separado** (`bitacora`, `eventos_sistema`, `cambios`) sin FKs destructivas y con retención configurable | Trazabilidad total (RN-AUD-001/002). |

---

## 1. Convenciones de nombres

| Elemento | Convención | Ejemplo |
|---|---|---|
| Tablas | `snake_case`, **plural** | `ordenes_produccion`, `lecturas_contador` |
| Columnas | `snake_case`, singular | `hora_inicio`, `cantidad_meta` |
| PK | `id` | `id` |
| FK | `<tabla_referenciada>_id` | `maquina_id`, `usuario_id` |
| Índices | `ix_<tabla>_<columna(s)>` | `ix_paradas_maquina_hora` |
| Unique | `uq_<tabla>_<columna(s)>` | `uq_ordenes_planta_numero` |
| Check | `ck_<tabla>_<columna>` | `ck_paradas_hora_fin_gt_inicio` |
| PK explícita | `pk_<tabla>` | `pk_produccion` |
| Booleanos | `activo`, `es_*`, `tiene_*` | `activo`, `es_sistema` |
| Fechas/horas | prefijo `fecha_` (DATE) / `hora_` (TIMESTAMPTZ) | `fecha_compromiso`, `hora_inicio` |
| Catálogos | nombre semántico claro (`causas_parada`, `tipos_scrap`...) | — |
| Triggers | `trg_<tabla>_<evento>` | `trg_produccion_before_insert` |

**Tipos de dato estándar:** UUID, BIGINT, TIMESTAMPTZ, DATE, TIME, VARCHAR(n) (textos cortos), TEXT (libres), NUMERIC(p,s), SMALLINT (enums numerados), BOOLEAN, JSONB.

---

## 2. MÓDULO IDENTIDAD

### 2.1. `usuarios`

- **Objetivo:** Identidad única de toda persona que usa el sistema.
- **Responsabilidad:** Datos personales, credenciales (PIN/RFID/QR) y estado de vigencia.
- **Relaciones:** 1:n `usuarios_roles`, `sesiones_autenticacion`, `sesiones_operario`; n:1 `creado_por` (self-FK).

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| usuario | VARCHAR(60) | NO | UQ global, min 4 car |
| email | VARCHAR(150) | SÍ | UQ global |
| nombre | VARCHAR(80) | NO | |
| apellidos | VARCHAR(120) | NO | |
| pin_hash | VARCHAR(255) | SÍ | hash Argon2; NULL si no usa PIN |
| rfid_tag | VARCHAR(64) | SÍ | UQ; NULL si no usa RFID |
| qr_secret | UUID | SÍ | UQ; token QR rotativo |
| estado | VARCHAR(20) | NO | CK IN ('activo','inactivo','suspendido') DEFAULT 'activo' |
| idioma | VARCHAR(8) | SÍ | DEFAULT 'es' |
| ultima_conexion | TIMESTAMPTZ | SÍ | |
| creado_por | UUID | SÍ | FK self, NULL para el primer admin |
| created_at / updated_at | TIMESTAMPTZ | NO | DEFAULT now() |

**Índices:** `uq_usuarios_usuario`, `uq_usuarios_email`, `uq_usuarios_rfid_tag`, `uq_usuarios_qr_secret`, `ix_usuarios_estado`.
**Restricciones:** CK sobre estado; al menos una credencial (PIN/RFID/QR) requerida — CK: `pin_hash IS NOT NULL OR rfid_tag IS NOT NULL OR qr_secret IS NOT NULL`.

### 2.2. `roles`

- **Objetivo:** Agrupación de permisos (Operario, Calidad, Supervisor, Gerencia, Auditoría, Administrador).
- **Responsabilidad:** Definición de roles estándar editables, marcados como `es_sistema` los no eliminables.
- **Relaciones:** n:m `permisos` vía `rol_permisos`; 1:n `usuarios_roles`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| codigo | VARCHAR(30) | NO | UQ |
| nombre | VARCHAR(60) | NO | |
| descripcion | VARCHAR(255) | SÍ | |
| es_sistema | BOOLEAN | NO | DEFAULT false; no borrable ni desactivable |
| created_at / updated_at | TIMESTAMPTZ | NO | |

### 2.3. `permisos`

- **Objetivo:** Catálogo granular `recurso:acción` (matriz RN §18).
- **Responsabilidad:** Codificar cada capacidad del sistema de forma inmutable (se agregan, no se editan).
- **Relaciones:** n:m `roles`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| codigo | VARCHAR(80) | NO | UQ, formato `recurso:accion` |
| modulo | VARCHAR(40) | NO | |
| recurso | VARCHAR(40) | NO | |
| accion | VARCHAR(40) | NO | |
| descripcion | VARCHAR(255) | SÍ | |

### 2.4. `rol_permisos`

- **Objetivo:** Matriz rol→permiso.
- **Relaciones:** n:1 `roles`, n:1 `permisos`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| rol_id | UUID | NO | FK roles ON DELETE CASCADE |
| permiso_id | UUID | NO | FK permisos ON DELETE CASCADE |
| created_at | TIMESTAMPTZ | NO | |

**Índices/Restricciones:** `uq_rol_permisos_rol_permiso (rol_id, permiso_id)`.

### 2.5. `usuarios_roles`

- **Objetivo:** Asignación usuario × planta × rol con vigencia (un usuario puede tener roles distintos por planta).
- **Responsabilidad:** Materializa "un usuario, un rol activo por planta a la vez".
- **Relaciones:** n:1 `usuarios`, n:1 `plantas`, n:1 `roles`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| usuario_id | UUID | NO | FK usuarios |
| planta_id | UUID | NO | FK plantas |
| rol_id | UUID | NO | FK roles |
| vigencia_inicio | DATE | NO | |
| vigencia_fin | DATE | SÍ | NULL = indefinido; CK fin >= inicio |
| activo | BOOLEAN | NO | DEFAULT true |

**Índices/Restricciones:** `uq_usuarios_roles (usuario_id, planta_id, rol_id)`; CK `vigencia_fin >= vigencia_inicio`.

### 2.6. `sesiones_autenticacion`

- **Objetivo:** Sesión de autenticación (JWT/refresh) — separada de la sesión operativa (decisión D-7).
- **Responsabilidad:** Control de tokens activos, rotación y revocación.
- **Relaciones:** n:1 `usuarios`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| usuario_id | UUID | NO | FK usuarios |
| token_hash | VARCHAR(255) | NO | UQ (solo hash, nunca el token) |
| refresh_hash | VARCHAR(255) | NO | UQ |
| expira | TIMESTAMPTZ | NO | |
| revocada | BOOLEAN | NO | DEFAULT false |
| ip | VARCHAR(45) | SÍ | IPv4/IPv6 |
| dispositivo | VARCHAR(255) | SÍ | user-agent/kiosko |
| created_at | TIMESTAMPTZ | NO | |

**Índices:** `uq_sesiones_autenticacion_token_hash`, `ix_sesiones_autenticacion_usuario_activa (usuario_id) WHERE NOT revocada`.

### 2.7. `sesiones_operario`

- **Objetivo:** Sesión operativa de planta: quién opera qué máquina en qué turno (login QR/RFID/PIN).
- **Responsabilidad:** Registrar automáticamente usuario/hora/máquina/turno (RN-OPE-001) y garantizar una sesión activa por operario y por máquina.
- **Relaciones:** n:1 `usuarios`, `maquinas`, `turnos`, `kioskos`, `plantas`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| usuario_id | UUID | NO | FK usuarios |
| maquina_id | UUID | NO | FK maquinas |
| turno_id | UUID | NO | FK turnos (deducido por el sistema) |
| kiosko_id | UUID | NO | FK kioskos |
| metodo_acceso | VARCHAR(10) | NO | CK IN ('qr','rfid','pin') |
| hora_inicio | TIMESTAMPTZ | NO | reloj servidor |
| hora_fin | TIMESTAMPTZ | SÍ | NULL = activa |
| motivo_cierre | VARCHAR(20) | SÍ | CK IN ('logout','timeout','cambio_maquina','fin_turno','reemplazo') |
| estado | VARCHAR(20) | NO | FK `estados` (proceso sesion_operario: 'activa','cerrada'), DEFAULT 'activa' |

**Índices/Restricciones:** `uq_sesiones_operario_usuario_activa (usuario_id) WHERE estado = 'activa'` (1 sesión activa por operario); `uq_sesiones_operario_maquina_activa (maquina_id) WHERE estado = 'activa'` (1 operario activo por máquina); CK `hora_fin > hora_inicio`; índice `ix_sesiones_operario_turno (turno_id, hora_inicio)`.

---

## 3. MÓDULO CONFIGURACIÓN

### 3.1. `plantas`

- **Objetivo:** Cada cliente/planta del producto multi-tenant.
- **Responsabilidad:** Identidad del tenant, zona horaria, idioma y estado de licencia.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| codigo | VARCHAR(20) | NO | UQ |
| nombre | VARCHAR(120) | NO | |
| pais | VARCHAR(60) | SÍ | |
| zona_horaria | VARCHAR(50) | NO | IANA (ej. 'America/Mexico_City') |
| idioma | VARCHAR(8) | NO | DEFAULT 'es' |
| unidad_sistema_id | UUID | SÍ | FK unidades (unidad base de reportes) |
| licencia | JSONB | SÍ | vigencia, módulos habilitados, límite máquinas |
| activo | BOOLEAN | NO | DEFAULT true |
| created_at / updated_at | TIMESTAMPTZ | NO | |

### 3.2. `areas`

- **Objetivo:** Agrupación física/funcional de máquinas.
- **Relaciones:** n:1 `plantas`; 1:n `maquinas`; n:1 `responsable_id` (usuarios, opcional).

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| codigo | VARCHAR(20) | NO | |
| nombre | VARCHAR(80) | NO | |
| responsable_id | UUID | SÍ | FK usuarios |
| activo | BOOLEAN | NO | DEFAULT true |

**Índices/Restricciones:** `uq_areas_planta_codigo (planta_id, codigo)`.

### 3.3. `maquinas`

- **Objetivo:** Recurso productivo central del sistema.
- **Responsabilidad:** Perfil de máquina: contador (OPC/manual), unidades, velocidad máxima, parámetros y umbrales; guarda el **estado actual**.
- **Relaciones:** n:1 `plantas`, n:1 `areas`, n:1 `unidades` (contador y velocidad); 1:n `produccion`, `paradas`, `lecturas_contador`, `kioskos`, `sesiones_operario`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| area_id | UUID | NO | FK areas |
| codigo | VARCHAR(30) | NO | |
| nombre | VARCHAR(80) | NO | |
| tiene_contador | BOOLEAN | NO | DEFAULT false |
| tipo_contador | VARCHAR(10) | NO | CK IN ('opc','manual','ninguno') DEFAULT 'ninguno' |
| unidad_contador_id | UUID | SÍ | FK unidades (m, kg, unid) |
| velocidad_maxima | NUMERIC(12,4) | SÍ | |
| unidad_velocidad_id | UUID | SÍ | FK unidades |
| config_contador | JSONB | SÍ | endpoint OPC-UA, tag, dirección Modbus |
| parametros | JSONB | SÍ | umbrales de parada, delta máx. contador, tiempo de alerta |
| estado_actual_id | UUID | NO | FK `estados` (proceso maquina), no editable por UI — derivado de eventos |
| activo | BOOLEAN | NO | DEFAULT true |
| created_at / updated_at | TIMESTAMPTZ | NO | |

**Índices/Restricciones:** `uq_maquinas_planta_codigo (planta_id, codigo)`; CK `(tiene_contador = false AND tipo_contador = 'ninguno') OR (tiene_contador = true AND tipo_contador IN ('opc','manual'))`; CK `velocidad_maxima > 0`; índice `ix_maquinas_area (area_id, activo)`.

### 3.4. `turnos`

- **Objetivo:** Catálogo de turnos por planta (bloques horarios).
- **Responsabilidad:** Proveer horarios para deducir el turno vigente por reloj del servidor.
- **Relaciones:** n:1 `plantas`; 1:n `turnos_dias`; 1:n `sesiones_operario`; 1:n `ordenes_produccion` (asignación).

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| codigo | VARCHAR(20) | NO | |
| nombre | VARCHAR(60) | NO | |
| hora_inicio | TIME | NO | |
| hora_fin | TIME | NO | CK distinta de hora_inicio |
| activo | BOOLEAN | NO | DEFAULT true |

**Índices/Restricciones:** `uq_turnos_planta_codigo (planta_id, codigo)`.

### 3.5. `turnos_dias`

- **Objetivo:** Días de la semana que aplica cada turno.
- **Relaciones:** n:1 `turnos`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| turno_id | UUID | NO | FK turnos ON DELETE CASCADE |
| dia_semana | SMALLINT | NO | CK 1..7 (1=lunes, 7=domingo) |

**Índices/Restricciones:** `uq_turnos_dias (turno_id, dia_semana)`.

### 3.6. `calendario_excepciones`

- **Objetivo:** Festivos y días especiales por planta (anulan/ajustan turnos).
- **Relaciones:** n:1 `plantas`, n:1 `turnos` (opcional: turno alternativo).

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| fecha | DATE | NO | |
| tipo | VARCHAR(10) | NO | CK IN ('festivo','laboral','especial') |
| turno_id | UUID | SÍ | FK turnos |
| motivo | VARCHAR(255) | SÍ | |

**Índices/Restricciones:** `uq_calendario_excepciones (planta_id, fecha)`.

### 3.7. `kioskos`

- **Objetivo:** Dispositivos de planta (kiosco/pantalla) asociados a máquinas.
- **Responsabilidad:** Identificación del dispositivo en el login (de dónde entra el operario) y seguridad.
- **Relaciones:** n:1 `plantas`, n:1 `maquinas` (opcional: kiosco global/supervisor).

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| maquina_id | UUID | SÍ | FK maquinas |
| codigo | VARCHAR(30) | NO | |
| tipo_ingreso | VARCHAR(10) | NO | CK IN ('qr','rfid','pin','mixto') |
| token_dispositivo | VARCHAR(64) | NO | UQ — par rotativo del dispositivo |
| ubicacion | VARCHAR(120) | SÍ | |
| activo | BOOLEAN | NO | DEFAULT true |

**Índices:** `uq_kioskos_planta_codigo (planta_id, codigo)`, `uq_kioskos_token_dispositivo`.

### 3.8. `configuraciones_sistema`

- **Objetivo:** Parámetros clave→valor por planta (y globales).
- **Responsabilidad:** Todo lo parametrizable sin código (RN-GEN-009): umbrales globales, tiempos de timeout, retención, canales.
- **Relaciones:** n:1 `plantas` (nullable = global).

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | SÍ | FK plantas; NULL = global |
| clave | VARCHAR(80) | NO | |
| valor | JSONB | NO | |
| tipo_dato | VARCHAR(20) | NO | CK IN ('texto','numero','booleano','json','fecha','lista') |
| descripcion | VARCHAR(255) | SÍ | |
| vigente | BOOLEAN | NO | DEFAULT true |
| updated_by | UUID | SÍ | FK usuarios |
| updated_at | TIMESTAMPTZ | NO | |

**Índices/Restricciones:** `uq_config_global (clave) WHERE planta_id IS NULL`; `uq_config_planta (planta_id, clave) WHERE planta_id IS NOT NULL`.

### 3.9. `unidades` (Catálogo de Unidades)

- **Objetivo:** Catálogo de unidades de medida (m, kg, unid, m/min...).
- **Relaciones:** 1:n `productos`, `maquinas`, `ordenes_produccion`, `scrap`, `indicadores`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| codigo | VARCHAR(20) | NO | UQ (ej. 'm', 'kg', 'UN') |
| nombre | VARCHAR(60) | NO | |
| simbolo | VARCHAR(10) | NO | |
| tipo_medida | VARCHAR(20) | NO | CK IN ('longitud','peso','volumen','tiempo','velocidad','unidad','superficie','otro') |
| decimales | SMALLINT | NO | DEFAULT 2, CK 0..6 |
| activo | BOOLEAN | NO | DEFAULT true |

### 3.10. `colores` (Catálogo de Colores)

- **Objetivo:** Catálogo de colores (atributo de producto y de estados).
- **Relaciones:** 1:n `productos`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| codigo | VARCHAR(20) | NO | UQ |
| nombre | VARCHAR(60) | NO | |
| hex | VARCHAR(7) | NO | CK formato '#RRGGBB' |
| activo | BOOLEAN | NO | DEFAULT true |

### 3.11. `estados` (Catálogo de Estados)

- **Objetivo:** Catálogo único de estados de vida de **todos** los procesos (OP, máquina, producción, parada, inspección, NC, scrap, alarma, mantenimiento, defecto, alerta, sesión).
- **Responsabilidad:** Los flujos de estado viven en datos, no en código. Incluye los ciclos aprobados: Scrap (Estimado→Pendiente→Confirmado→Cerrado) y Alarma (Generada→Pendiente→Vista→Atendida→Cerrada).

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | SÍ | FK plantas; NULL = estándar de producto |
| proceso | VARCHAR(40) | NO | CK IN ('orden_produccion','maquina','produccion','parada','inspeccion','nc','scrap','alarma','alerta','mantenimiento','defecto','sesion_operario','accion_correctiva','notificacion') |
| codigo | VARCHAR(30) | NO | ej. 'EN_EJECUCION', 'CONFIRMADO' |
| nombre | VARCHAR(80) | NO | |
| color_id | UUID | SÍ | FK colores (semáforo UI) |
| descripcion | VARCHAR(255) | SÍ | |
| orden | SMALLINT | SÍ | para secuencias |
| activo | BOOLEAN | NO | DEFAULT true |

**Índices/Restricciones:** `uq_estados_proceso_codigo (proceso, codigo, planta_id)` — con regla de datos: por planta se heredan los globales y se agregan locales.

### 3.12. `causas_parada` (Catálogo de Paradas)

- **Objetivo:** Causas de parada (botones grandes del kiosco) con clasificación de impacto.
- **Relaciones:** 1:n `paradas`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| codigo | VARCHAR(30) | NO | |
| nombre | VARCHAR(80) | NO | |
| clasificacion | VARCHAR(20) | NO | CK IN ('setup','falla','planeada','espera','otra') |
| impacta_disponibilidad | BOOLEAN | NO | DEFAULT true |
| impacta_mttr_mtbf | BOOLEAN | NO | DEFAULT false (fallas) |
| genera_mantenimiento | BOOLEAN | NO | DEFAULT false |
| boton_grande | BOOLEAN | NO | DEFAULT true (kiosco) |
| orden | SMALLINT | SÍ | posición del botón |
| activo | BOOLEAN | NO | DEFAULT true |

**Índices/Restricciones:** `uq_causas_parada_planta_codigo (planta_id, codigo)`.

### 3.13. `defectos_catalogo` (Catálogo de Defectos)

- **Objetivo:** Tipos de defecto configurables con severidad e impacto.
- **Relaciones:** 1:n `defectos`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| codigo | VARCHAR(30) | NO | |
| nombre | VARCHAR(80) | NO | |
| severidad | VARCHAR(10) | NO | CK IN ('critico','mayor','menor') |
| tipo_impacto | VARCHAR(20) | NO | CK IN ('scrap','retrabajo','tolerable') |
| color_id | UUID | SÍ | FK colores |
| orden | SMALLINT | SÍ | |
| activo | BOOLEAN | NO | DEFAULT true |

**Índices/Restricciones:** `uq_defectos_catalogo_planta_codigo (planta_id, codigo)`.

### 3.14. `tipos_scrap` (Catálogo de Scrap)

- **Objetivo:** Categorías de scrap (defecto, arranque, cambio de referencia...).
- **Relaciones:** 1:n `scrap`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| codigo | VARCHAR(30) | NO | |
| nombre | VARCHAR(80) | NO | |
| categoria | VARCHAR(20) | NO | CK IN ('defecto','revision','arranque','cambio_referencia','otro') |
| confirmacion_automatica | BOOLEAN | NO | DEFAULT false |
| activo | BOOLEAN | NO | DEFAULT true |

**Índices/Restricciones:** `uq_tipos_scrap_planta_codigo (planta_id, codigo)`.

### 3.15. `tipos_alarma` (Catálogo de Alarmas)

- **Objetivo:** Tipos de alarma parametrizables con severidad y umbral.
- **Relaciones:** 1:n `alarmas`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| codigo | VARCHAR(30) | NO | |
| nombre | VARCHAR(80) | NO | |
| severidad | VARCHAR(10) | NO | CK IN ('critica','alta','media','baja') |
| umbral_segundos | INTEGER | SÍ | CK > 0 (si aplica) |
| requiere_confirmacion | BOOLEAN | NO | DEFAULT true |
| activo | BOOLEAN | NO | DEFAULT true |

**Índices/Restricciones:** `uq_tipos_alarma_planta_codigo (planta_id, codigo)`.

### 3.16. `prioridades` (Catálogo de Prioridades)

- **Objetivo:** Prioridades de OP/NC (baja, normal, alta, urgente).
- **Relaciones:** 1:n `ordenes_produccion`, 1:n `mantenimientos`, 1:n `no_conformidades`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| codigo | VARCHAR(20) | NO | |
| nombre | VARCHAR(60) | NO | |
| nivel | SMALLINT | NO | CK 1..10 (10 = máxima) |
| color_id | UUID | SÍ | FK colores |
| activo | BOOLEAN | NO | DEFAULT true |

**Índices/Restricciones:** `uq_prioridades_planta_codigo (planta_id, codigo)`, `uq_prioridades_planta_nivel (planta_id, nivel)`.

### 3.17. `clientes`

- **Objetivo:** Clientes de la planta.
- **Relaciones:** n:1 `plantas`; 1:n `productos`, `ordenes_produccion`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| codigo | VARCHAR(20) | NO | |
| nombre | VARCHAR(120) | NO | |
| contacto | JSONB | SÍ | teléfono, correo, dirección |
| activo | BOOLEAN | NO | DEFAULT true |

**Índices/Restricciones:** `uq_clientes_planta_codigo (planta_id, codigo)`.

### 3.18. `productos` (Catálogo de Productos)

- **Objetivo:** Productos fabricables con ficha técnica (gramaje, ancho, largo, velocidad objetivo).
- **Relaciones:** n:1 `plantas`, n:1 `clientes` (principal), n:1 `unidades`, n:1 `colores` (opcional); 1:n `ordenes_produccion`, `planes_inspeccion`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| cliente_id | UUID | SÍ | FK clientes |
| codigo | VARCHAR(30) | NO | referencia |
| nombre | VARCHAR(120) | NO | |
| descripcion | TEXT | SÍ | |
| unidad_id | UUID | NO | FK unidades |
| color_id | UUID | SÍ | FK colores |
| gramaje | NUMERIC(10,3) | SÍ | CK > 0 |
| ancho | NUMERIC(12,3) | SÍ | CK > 0 |
| largo | NUMERIC(12,3) | SÍ | CK > 0 |
| velocidad_objetivo | NUMERIC(12,4) | SÍ | CK > 0 |
| especificaciones | JSONB | SÍ | campos flexibles de la ficha |
| activo | BOOLEAN | NO | DEFAULT true |

**Índices/Restricciones:** `uq_productos_planta_codigo (planta_id, codigo)`, `ix_productos_cliente (cliente_id)`.

---

## 4. MÓDULO PRODUCCIÓN

### 4.1. `ordenes_produccion`

- **Objetivo:** Instrucción de producción (OP) con especificación congelada (snapshot) y estado de vida.
- **Responsabilidad:** Núcleo de planificación: cantidad meta, asignación máquina/turno, prioridad, cierre.
- **Relaciones:** n:1 `plantas`, `productos`, `clientes`, `maquinas` (asignada), `turnos`, `prioridades`, `unidades`, `estados`; n:1 `usuarios` (creador); 1:n `produccion`, `paradas`, `defectos`, `inspecciones`, `no_conformidades`, `scrap`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| numero | VARCHAR(30) | NO | n° visible de OP |
| producto_id | UUID | NO | FK productos |
| cliente_id | UUID | SÍ | FK clientes |
| maquina_id | UUID | SÍ | FK maquinas (asignada) |
| turno_id | UUID | SÍ | FK turnos (asignado) |
| prioridad_id | UUID | SÍ | FK prioridades |
| estado_id | UUID | NO | FK `estados` (proceso orden_produccion) |
| cantidad_meta | NUMERIC(18,4) | NO | CK > 0 |
| cantidad_producida | NUMERIC(18,4) | NO | DEFAULT 0, CK >= 0 (mantenida por el sistema) |
| unidad_id | UUID | NO | FK unidades |
| especificacion_snapshot | JSONB | NO | gramaje, ancho, largo, velocidad objetivo... (RN-ORD-002) |
| velocidad_objetivo | NUMERIC(12,4) | SÍ | |
| fecha_compromiso | DATE | SÍ | |
| fecha_programada | TIMESTAMPTZ | SÍ | |
| motivo_cancelacion | VARCHAR(255) | SÍ | |
| creado_por | UUID | NO | FK usuarios |
| created_at / updated_at | TIMESTAMPTZ | NO | |

**Índices/Restricciones:** `uq_ordenes_produccion_planta_numero (planta_id, numero)`; `ix_ordenes_estado_maquina (estado_id, maquina_id)`; `ix_ordenes_producto (producto_id, fecha_compromiso)`; CK `cantidad_meta > 0`, `cantidad_producida >= 0`.

### 4.2. `produccion` (runtime / ejecución)

- **Objetivo:** Ciclo de ejecución de una OP en una máquina (INICIAR → FINALIZAR).
- **Responsabilidad:** Agregado raíz de la ejecución: contadores, tiempos, cierre con snapshot de indicadores.
- **Relaciones:** n:1 `ordenes_produccion`, `maquinas`, `turnos`, `sesiones_operario`, `usuarios` (operario); 1:n `eventos_produccion`, `lecturas_contador`, `paradas`, `defectos`, `inspecciones`, `scrap`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| orden_id | UUID | NO | FK ordenes_produccion |
| maquina_id | UUID | NO | FK maquinas |
| turno_id | UUID | NO | FK turnos (inicio) |
| sesion_operario_id | UUID | SÍ | FK sesiones_operario |
| operario_id | UUID | SÍ | FK usuarios (opcional si la sesión se cierra) |
| estado_id | UUID | NO | FK `estados` (proceso produccion: 'abierta','cerrada') |
| contador_inicial | NUMERIC(18,4) | SÍ | CK >= 0 |
| contador_final | NUMERIC(18,4) | SÍ | CK >= 0 |
| produccion_total | NUMERIC(18,4) | NO | DEFAULT 0 |
| produccion_conforme | NUMERIC(18,4) | NO | DEFAULT 0 |
| scrap_total | NUMERIC(18,4) | NO | DEFAULT 0 |
| hora_inicio | TIMESTAMPTZ | NO | |
| hora_fin | TIMESTAMPTZ | SÍ | NULL = abierta |
| tiempo_productivo_seg | INTEGER | NO | DEFAULT 0 |
| tiempo_improductivo_seg | INTEGER | NO | DEFAULT 0 |
| indicadores_cierre | JSONB | SÍ | snapshot OEE/A/R/Q al cerrar |
| cerrado_por | UUID | SÍ | FK usuarios |
| cerrado_en | TIMESTAMPTZ | SÍ | |
| created_at | TIMESTAMPTZ | NO | |

**Índices/Restricciones — invariantes críticas:**
- `uq_produccion_maquina_activa (maquina_id) WHERE estado_id = 'abierta'` — **una ejecución activa por máquina** (RN-RES-004).
- CK `contador_final >= contador_inicial` (cuando ambos existen) — RN-PRD-004.
- CK `hora_fin > hora_inicio`.
- `ix_produccion_orden (orden_id, hora_inicio)`, `ix_produccion_maquina_fecha (maquina_id, hora_inicio)`.

### 4.3. `eventos_produccion` (particionada)

- **Objetivo:** Bitácora inmutable de todo lo ocurrido en el piso (source of truth histórica).
- **Responsabilidad:** Alimentar auditoría, recalcular rollups y reconstruir estados. Append-only.
- **Relaciones:** n:1 `produccion`, `maquinas`, `ordenes_produccion` (nullable), `usuarios` (nullable); 1:n vía payload a otros registros.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | BIGINT | NO | PK compuesta (id, hora_evento) — identity por partición |
| planta_id | UUID | NO | FK plantas |
| produccion_id | UUID | SÍ | FK produccion |
| maquina_id | UUID | NO | FK maquinas |
| orden_id | UUID | SÍ | FK ordenes_produccion |
| usuario_id | UUID | SÍ | FK usuarios |
| tipo_evento | VARCHAR(40) | NO | CK IN ('inicio_runtime','fin_runtime','lectura_contador','inicio_parada','fin_parada','defecto','scrap_registrado','inspeccion_programada','inspeccion_resultado','nc_creada','cambio_estado','sesion_operario','sincronizacion_offline','correccion_supervisor','cierre_turno') |
| hora_evento | TIMESTAMPTZ | NO | reloj servidor — clave de partición |
| payload | JSONB | SÍ | datos flexibles del evento |
| idempotencia_key | UUID | NO | |
| estado_anterior | VARCHAR(30) | SÍ | |
| estado_nuevo | VARCHAR(30) | SÍ | |

**Particionado:** RANGE mensual por `hora_evento` (TimescaleDB hypertable o particiones declarativas).
**Índices/Restricciones:** `uq_eventos_produccion_idempotencia (idempotencia_key, hora_evento)`; `ix_eventos_produccion_maquina_fecha (maquina_id, hora_evento DESC)`; `ix_eventos_produccion_tipo (tipo_evento, hora_evento)`; BRIN en `hora_evento`.

### 4.4. `lecturas_contador` (particionada)

- **Objetivo:** Cada lectura del contador (OPC o manual) con su fuente y validación.
- **Responsabilidad:** Detección de anomalías (monotonicidad, delta) y cálculo de producción por intervalos.
- **Relaciones:** n:1 `produccion`, `maquinas`, `ordenes_produccion`, `usuarios` (si manual).

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | BIGINT | NO | PK (id, hora_lectura) |
| planta_id | UUID | NO | FK plantas |
| produccion_id | UUID | NO | FK produccion |
| maquina_id | UUID | NO | FK maquinas |
| orden_id | UUID | SÍ | FK ordenes_produccion |
| valor | NUMERIC(18,4) | NO | CK >= 0 |
| hora_lectura | TIMESTAMPTZ | NO | clave de partición |
| fuente | VARCHAR(10) | NO | CK IN ('opc','manual','import','historica') |
| usuario_id | UUID | SÍ | si fuente = manual |
| delta | NUMERIC(18,4) | SÍ | valor − lectura anterior |
| delta_esperado | NUMERIC(18,4) | SÍ | velocidad × Δt (validación) |
| velocidad_calculada | NUMERIC(12,4) | SÍ | |
| validada | BOOLEAN | NO | DEFAULT true |
| anomalia | BOOLEAN | NO | DEFAULT false |
| observacion | VARCHAR(255) | SÍ | |

**Particionado:** RANGE mensual.
**Índices/Restricciones:** `ix_lecturas_maquina_fecha (maquina_id, hora_lectura DESC)`; `ix_lecturas_produccion (produccion_id, hora_lectura)`; BRIN `hora_lectura`.

### 4.5. `paradas`

- **Objetivo:** Intervalos de no-producción con causa y clasificación de impacto.
- **Responsabilidad:** Cálculo de disponibilidad, MTTR/MTBF y alertas.
- **Relaciones:** n:1 `maquinas`, n:1 `produccion` (opcional), n:1 `ordenes_produccion` (opcional), n:1 `usuarios` (registro y cierre), n:1 `causas_parada`, n:1 `estados`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| produccion_id | UUID | SÍ | FK produccion |
| maquina_id | UUID | NO | FK maquinas |
| orden_id | UUID | SÍ | FK ordenes_produccion |
| usuario_id | UUID | NO | FK usuarios (quien registra) |
| causa_id | UUID | NO | FK causas_parada |
| hora_inicio | TIMESTAMPTZ | NO | |
| hora_fin | TIMESTAMPTZ | SÍ | NULL = abierta |
| duracion_seg | INTEGER | SÍ | calculada al cierre |
| estado_id | UUID | NO | FK `estados` (proceso parada: 'abierta','cerrada_normal','cerrada_fin_auto','cerrada_correccion','anulada') |
| cerrado_por | UUID | SÍ | FK usuarios |
| motivo_anulacion | VARCHAR(255) | SÍ | |
| cruza_turno | BOOLEAN | NO | DEFAULT false |
| particion_turnos | JSONB | SÍ | desglose duración por turno (RN-TUR-004) |
| observacion | VARCHAR(255) | SÍ | |
| created_at | TIMESTAMPTZ | NO | |

**Índices/Restricciones — invariantes:**
- `uq_paradas_maquina_abierta (maquina_id) WHERE estado_id = 'abierta'` — **máx. una parada abierta por máquina** (RN-RES-005).
- CK `hora_fin > hora_inicio`; CK `duracion_seg >= 0`.
- `ix_paradas_maquina_fecha (maquina_id, hora_inicio DESC)`; `ix_paradas_causa (causa_id, hora_inicio)`; `ix_paradas_produccion (produccion_id)`.

### 4.6. `scrap`

- **Objetivo:** Cantidad no conforme por OT con ciclo de vida aprobado: **Estimado → Pendiente → Confirmado → Cerrado**.
- **Relaciones:** n:1 `ordenes_produccion`, `produccion`, `maquinas`, `defectos` (origen), `tipos_scrap`, `unidades`, `usuarios` (registro y confirmación), `estados`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| orden_id | UUID | NO | FK ordenes_produccion |
| produccion_id | UUID | SÍ | FK produccion |
| maquina_id | UUID | NO | FK maquinas |
| defecto_id | UUID | SÍ | FK defectos |
| tipo_scrap_id | UUID | NO | FK tipos_scrap |
| cantidad | NUMERIC(18,4) | NO | CK > 0 |
| unidad_id | UUID | NO | FK unidades |
| origen | VARCHAR(15) | NO | CK IN ('defecto','revision','rechazo_final') |
| estado_id | UUID | NO | FK `estados` (proceso scrap: estimado/pendiente/confirmado/cerrado) |
| registrado_por | UUID | NO | FK usuarios |
| confirmado_por | UUID | SÍ | FK usuarios |
| fecha_estimacion | TIMESTAMPTZ | NO | |
| fecha_confirmacion | TIMESTAMPTZ | SÍ | |
| observacion | VARCHAR(255) | SÍ | |

**Índices/Restricciones:** `ix_scrap_orden (orden_id, estado_id)`; `ix_scrap_maquina_fecha (maquina_id, fecha_estimacion)`; CK `cantidad > 0`.

### 4.7. `defectos`

- **Objetivo:** Eventos de calidad detectados en ejecución (operario o inspector), con foto opcional.
- **Responsabilidad:** Origen del scrap estimado y de NC elevadas.
- **Relaciones:** n:1 `ordenes_produccion`, `produccion`, `maquinas`, `usuarios`, `defectos_catalogo`, `estados`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| orden_id | UUID | NO | FK ordenes_produccion |
| produccion_id | UUID | SÍ | FK produccion |
| maquina_id | UUID | NO | FK maquinas |
| usuario_id | UUID | NO | FK usuarios (quien lo registra) |
| defecto_tipo_id | UUID | NO | FK defectos_catalogo |
| cantidad_afectada | NUMERIC(18,4) | SÍ | estimada por contador |
| foto_urls | JSONB | SÍ | URLs del repo de fotos (privado) |
| observacion | VARCHAR(255) | SÍ | |
| estado_id | UUID | NO | FK `estados` (proceso defecto: registrado/en_revision/clasificado/elevado_nc) |
| revisado_por | UUID | SÍ | FK usuarios |
| created_at | TIMESTAMPTZ | NO | |

**Índices:** `ix_defectos_maquina_fecha (maquina_id, created_at DESC)`, `ix_defectos_estado (estado_id, created_at)`, `ix_defectos_orden (orden_id)`.

---

## 5. MÓDULO CALIDAD

### 5.1. `planes_inspeccion`

- **Objetivo:** Planes de autocontrol (frecuencia por tiempo o volumen) por producto y/o máquina.
- **Relaciones:** n:1 `plantas`, n:1 `productos` (opcional), n:1 `maquinas` (opcional); 1:n `inspecciones`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| producto_id | UUID | SÍ | FK productos |
| maquina_id | UUID | SÍ | FK maquinas |
| codigo | VARCHAR(30) | NO | |
| nombre | VARCHAR(80) | NO | |
| tipo_frecuencia | VARCHAR(10) | NO | CK IN ('tiempo','volumen') |
| frecuencia_valor | NUMERIC(12,4) | NO | CK > 0 (min o unidades) |
| tolerancia | JSONB | SÍ | límites de la especificación |
| activo | BOOLEAN | NO | DEFAULT true |

**Índices/Restricciones:** `uq_planes_inspeccion_planta_codigo (planta_id, codigo)`; CK `producto_id IS NOT NULL OR maquina_id IS NOT NULL`.

### 5.2. `inspecciones`

- **Objetivo:** Inspección programada automáticamente por el plan y ejecutada por Calidad.
- **Relaciones:** n:1 `planes_inspeccion`, `ordenes_produccion`, `produccion`, `maquinas`, `usuarios` (inspector), `estados`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| plan_id | UUID | NO | FK planes_inspeccion |
| orden_id | UUID | NO | FK ordenes_produccion |
| produccion_id | UUID | SÍ | FK produccion |
| maquina_id | UUID | NO | FK maquinas |
| programada_para | TIMESTAMPTZ | NO | generada por el sistema |
| ejecutada_en | TIMESTAMPTZ | SÍ | |
| inspector_id | UUID | SÍ | FK usuarios (rol Calidad) |
| checklist_resultado | JSONB | SÍ | ítems del plan + resultados |
| resultado_id | UUID | SÍ | FK `estados` (proceso inspeccion: conforme/no_conforme) |
| fotos | JSONB | SÍ | |
| observacion | VARCHAR(255) | SÍ | |
| estado_id | UUID | NO | FK `estados` (proceso inspeccion: programada/pendiente/en_progreso/vencida/anulada) |
| created_at | TIMESTAMPTZ | NO | |

**Índices/Restricciones:** `uq_inspecciones_produccion_fecha (produccion_id, programada_para)`; `ix_inspecciones_inspector_estado (inspector_id, estado_id)`; `ix_inspecciones_maquina_fecha (maquina_id, programada_para)`.

### 5.3. `no_conformidades`

- **Objetivo:** Hallazgos de calidad que requieren tratamiento formal.
- **Relaciones:** n:1 `plantas`, `ordenes_produccion`, `inspecciones` (origen), `defectos` (origen), `usuarios` (asignado/cierre), `prioridades`, `estados`; 1:n `acciones_correctivas`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| codigo | VARCHAR(30) | NO | número NC |
| orden_id | UUID | SÍ | FK ordenes_produccion |
| inspeccion_id | UUID | SÍ | FK inspecciones |
| defecto_id | UUID | SÍ | FK defectos |
| prioridad_id | UUID | SÍ | FK prioridades |
| titulo | VARCHAR(120) | NO | |
| descripcion | TEXT | SÍ | |
| severidad | VARCHAR(10) | NO | CK IN ('critico','mayor','menor') |
| estado_id | UUID | NO | FK `estados` (proceso nc: abierta/asignada/en_tratamiento/resuelta/cerrada/rechazada) |
| asignado_a | UUID | SÍ | FK usuarios |
| bloquea_liberacion | BOOLEAN | NO | DEFAULT false (RN-CAL-004) |
| detectada_en | TIMESTAMPTZ | NO | |
| resuelta_en | TIMESTAMPTZ | SÍ | |
| cierre_aprobado_por | UUID | SÍ | FK usuarios |
| created_at / updated_at | TIMESTAMPTZ | NO | |

**Índices/Restricciones:** `uq_no_conformidades_planta_codigo (planta_id, codigo)`; `ix_nc_estado (estado_id, detectada_en)`; `ix_nc_orden (orden_id)`.

### 5.4. `acciones_correctivas`

- **Objetivo:** Acciones correctivas/preventivas derivadas de NC.
- **Relaciones:** n:1 `no_conformidades`, `usuarios` (responsable y creador), `estados`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| nc_id | UUID | NO | FK no_conformidades |
| tipo | VARCHAR(10) | NO | CK IN ('correctiva','preventiva') |
| descripcion | TEXT | NO | |
| responsable_id | UUID | NO | FK usuarios |
| fecha_limite | DATE | NO | |
| estado_id | UUID | NO | FK `estados` (proceso accion_correctiva: pendiente/en_curso/completada/verificada) |
| evidencia | JSONB | SÍ | |
| creado_por | UUID | NO | FK usuarios |
| created_at / updated_at | TIMESTAMPTZ | NO | |

**Índices/Restricciones:** `ix_acciones_nc (nc_id, estado_id)`.

---

## 6. MÓDULO MANTENIMIENTO

### 6.1. `equipos`

- **Objetivo:** Equipos físicos (puede haber varios por máquina o independientes).
- **Relaciones:** n:1 `plantas`, n:1 `maquinas` (opcional); 1:n `mantenimientos`, `historial_mantenimiento`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| maquina_id | UUID | SÍ | FK maquinas |
| codigo | VARCHAR(30) | NO | |
| nombre | VARCHAR(80) | NO | |
| tipo_equipo | VARCHAR(40) | SÍ | |
| marca / modelo | VARCHAR(60) | SÍ | |
| serial | VARCHAR(60) | SÍ | |
| activo | BOOLEAN | NO | DEFAULT true |

**Índices/Restricciones:** `uq_equipos_planta_codigo (planta_id, codigo)`.

### 6.2. `mantenimientos`

- **Objetivo:** Solicitudes e intervenciones técnicas (correctivo/preventivo/predictivo).
- **Relaciones:** n:1 `maquinas`, `equipos`, `plantas`, `prioridades`, `paradas` (origen), `alarmas` (origen), `usuarios` (solicitante/técnico), `estados`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| maquina_id | UUID | SÍ | FK maquinas |
| equipo_id | UUID | SÍ | FK equipos |
| tipo | VARCHAR(15) | NO | CK IN ('correctivo','preventivo','predictivo') |
| origen | VARCHAR(15) | NO | CK IN ('parada','alarma','planificado','nc') |
| parada_id | UUID | SÍ | FK paradas |
| alarma_id | UUID | SÍ | FK alarmas |
| prioridad_id | UUID | SÍ | FK prioridades |
| solicitado_por | UUID | NO | FK usuarios |
| tecnico_id | UUID | SÍ | FK usuarios |
| hora_inicio / hora_fin | TIMESTAMPTZ | SÍ | |
| descripcion | TEXT | SÍ | |
| repuestos | JSONB | SÍ | |
| resultado | VARCHAR(15) | SÍ | CK IN ('completado','incompleto','cancelado') |
| estado_id | UUID | NO | FK `estados` (proceso mantenimiento: solicitada/asignada/en_intervencion/completada/cancelada) |
| created_at / updated_at | TIMESTAMPTZ | NO | |

**Índices/Restricciones:** `ix_mantenimientos_maquina (maquina_id, estado_id)`; `ix_mantenimientos_estado_fecha (estado_id, created_at)`; CK `hora_fin > hora_inicio`.

### 6.3. `historial_mantenimiento`

- **Objetivo:** Historial acumulado por máquina/equipo (para MTTR/MTBF y análisis).
- **Relaciones:** n:1 `mantenimientos` (opcional), `maquinas`, `equipos`, `plantas`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| mantenimiento_id | UUID | SÍ | FK mantenimientos |
| maquina_id | UUID | SÍ | FK maquinas |
| equipo_id | UUID | SÍ | FK equipos |
| fecha | TIMESTAMPTZ | NO | |
| tipo | VARCHAR(15) | NO | CK IN ('correctivo','preventivo','predictivo') |
| tecnico | VARCHAR(120) | SÍ | |
| horas_hombre | NUMERIC(8,2) | SÍ | CK >= 0 |
| repuestos | JSONB | SÍ | |
| descripcion | TEXT | SÍ | |
| costo | NUMERIC(14,2) | SÍ | CK >= 0 |
| created_at | TIMESTAMPTZ | NO | |

**Índices:** `ix_historial_maquina_fecha (maquina_id, fecha DESC)`, `ix_historial_equipo (equipo_id, fecha)`.

---

## 7. MÓDULO NOTIFICACIONES

### 7.1. `alarmas`

- **Objetivo:** Alarmas de sistema con ciclo de vida aprobado: **Generada → Pendiente → Vista → Atendida → Cerrada**.
- **Responsabilidad:** Detección automática de condiciones anómalas y confirmación con traza.
- **Relaciones:** n:1 `tipos_alarma`, `maquinas`, `produccion`, `paradas`, `inspecciones`, `estados`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| tipo_alarma_id | UUID | NO | FK tipos_alarma |
| maquina_id | UUID | SÍ | FK maquinas |
| produccion_id | UUID | SÍ | FK produccion |
| parada_id | UUID | SÍ | FK paradas |
| inspeccion_id | UUID | SÍ | FK inspecciones |
| descripcion | VARCHAR(255) | NO | |
| severidad | VARCHAR(10) | NO | CK IN ('critica','alta','media','baja') |
| disparada_en | TIMESTAMPTZ | NO | |
| vista_en | TIMESTAMPTZ | SÍ | |
| atendida_en | TIMESTAMPTZ | SÍ | |
| cerrada_en | TIMESTAMPTZ | SÍ | |
| atendida_por | UUID | SÍ | FK usuarios |
| estado_id | UUID | NO | FK `estados` (proceso alarma: generada/pendiente/vista/atendida/cerrada) |
| origen | VARCHAR(15) | NO | CK IN ('sistema','parada','lectura','inspeccion','mantenimiento','config') |

**Índices:** `ix_alarmas_estado_fecha (estado_id, disparada_en DESC)`, `ix_alarmas_maquina (maquina_id, disparada_en DESC)`.

### 7.2. `alertas`

- **Objetivo:** Avisos visuales de planta (toasts/paneles) para operarios y supervisores.
- **Relaciones:** n:1 `alarmas` (opcional), `paradas`, `ordenes_produccion`, `estados`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| alarma_id | UUID | SÍ | FK alarmas |
| parada_id | UUID | SÍ | FK paradas |
| orden_id | UUID | SÍ | FK ordenes_produccion |
| tipo_alerta | VARCHAR(30) | NO | |
| titulo / mensaje | VARCHAR(120) / TEXT | NO | |
| severidad | VARCHAR(10) | NO | CK IN ('critica','alta','media','baja') |
| estado_id | UUID | NO | FK `estados` (proceso alerta: activa/confirmada/descartada) |
| creada_en | TIMESTAMPTZ | NO | |

**Índices:** `ix_alertas_estado_fecha (estado_id, creada_en)`.

### 7.3. `notificaciones`

- **Objetivo:** Mensajes a destinatarios (inspector, supervisor, gerencia) con canal.
- **Relaciones:** n:1 `usuarios` (destino directo, opcional), `alarmas`, `inspecciones`, `ordenes_produccion`; 1:n `notificaciones_destinatarios`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| usuario_id | UUID | SÍ | FK usuarios (destino directo) |
| canal | VARCHAR(15) | NO | CK IN ('inapp','email','push','telegram','whatsapp') |
| asunto | VARCHAR(120) | NO | |
| cuerpo | TEXT | NO | |
| alarma_id | UUID | SÍ | FK alarmas |
| inspeccion_id | UUID | SÍ | FK inspecciones |
| orden_id | UUID | SÍ | FK ordenes_produccion |
| evento_origen | VARCHAR(40) | SÍ | |
| enviada_en | TIMESTAMPTZ | NO | |
| entregada | BOOLEAN | NO | DEFAULT false |
| error_detalle | VARCHAR(255) | SÍ | |
| created_at | TIMESTAMPTZ | NO | |

**Índices:** `ix_notificaciones_usuario_fecha (usuario_id, enviada_en DESC)`, `ix_notificaciones_no_entregadas (entregada, created_at)`.

### 7.4. `notificaciones_destinatarios`

- **Objetivo:** Desglose por destinatario (un usuario o un rol) y estado de entrega por canal.
- **Relaciones:** n:1 `notificaciones`, n:1 `usuarios` (opcional), n:1 `roles` (opcional).

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| notificacion_id | UUID | NO | FK notificaciones ON DELETE CASCADE |
| usuario_id | UUID | SÍ | FK usuarios |
| rol_id | UUID | SÍ | FK roles |
| canal | VARCHAR(15) | NO | CK IN ('inapp','email','push','telegram','whatsapp') |
| estado | VARCHAR(15) | NO | CK IN ('pendiente','entregada','leida','fallida') |
| enviada_en / leida_en | TIMESTAMPTZ | SÍ | |
| falla_detalle | VARCHAR(255) | SÍ | |

**Índices/Restricciones:** CK `usuario_id IS NOT NULL OR rol_id IS NOT NULL`; `ix_ndestinatarios_notificacion (notificacion_id)`.

---

## 8. MÓDULO ANALÍTICA

### 8.1. `indicadores`

- **Objetivo:** Definiciones de KPI (OEE, A, R, Q, scrap, MTBF, MTTR, producción, cumplimiento).
- **Relaciones:** n:1 `plantas` (opcional: global), n:1 `unidades`; 1:n `snapshots_indicadores`, `historico_indicadores`, `dashboard_indicadores`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | SÍ | FK plantas; NULL = global |
| codigo | VARCHAR(30) | NO | UQ |
| nombre | VARCHAR(80) | NO | |
| tipo | VARCHAR(20) | NO | CK IN ('oee','disponibilidad','rendimiento','calidad','scrap','mtbf','mttr','produccion','cumplimiento','personalizado') |
| formula | VARCHAR(255) | SÍ | expresión descriptiva |
| unidad_id | UUID | SÍ | FK unidades |
| nivel | VARCHAR(15) | NO | CK IN ('orden','turno','dia','semana','mes','maquina','area','planta') |
| activo | BOOLEAN | NO | DEFAULT true |

### 8.2. `snapshots_indicadores` (particionada)

- **Objetivo:** Valores calculados por período y dimensión (persistidos para dashboards rápidos — decisión D-5).
- **Responsabilidad:** Cálculo por rollup en cascada con versionado de recálculo.
- **Relaciones:** n:1 `indicadores`, `maquinas`, `areas`, `ordenes_produccion`, `turnos`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | BIGINT | NO | PK (id, periodo_inicio) |
| planta_id | UUID | NO | FK plantas |
| indicador_id | UUID | NO | FK indicadores |
| maquina_id | UUID | SÍ | FK maquinas |
| area_id | UUID | SÍ | FK areas |
| orden_id | UUID | SÍ | FK ordenes_produccion |
| turno_id | UUID | SÍ | FK turnos |
| periodo_inicio | TIMESTAMPTZ | NO | clave de partición |
| periodo_fin | TIMESTAMPTZ | NO | CK fin > inicio |
| valor | NUMERIC(18,4) | NO | |
| meta | NUMERIC(18,4) | SÍ | |
| componentes | JSONB | SÍ | A×R×Q desglosado, tiempos, etc. |
| version | SMALLINT | NO | DEFAULT 1 (recálculos incrementan) |
| calculado_en | TIMESTAMPTZ | NO | |
| calculado_por | VARCHAR(20) | NO | CK IN ('sistema','recalculo','usuario') |

**Particionado:** RANGE mensual.
**Índices/Restricciones:** `uq_snapshots_dimension_periodo (indicador_id, maquina_id, area_id, orden_id, turno_id, periodo_inicio)` (upsert del último version); `ix_snapshots_maquina (maquina_id, periodo_inicio DESC)`; BRIN `periodo_inicio`.

### 8.3. `historico_indicadores`

- **Objetivo:** Rollup mensual (y anual) para consultas gerenciales de larga duración.
- **Relaciones:** n:1 `indicadores`, `maquinas`, `areas`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| indicador_id | UUID | NO | FK indicadores |
| maquina_id | UUID | SÍ | FK maquinas |
| area_id | UUID | SÍ | FK areas |
| periodo_inicio | DATE | NO | primer día del mes |
| periodo_fin | DATE | NO | |
| valor | NUMERIC(18,4) | NO | |
| n_puntos | INTEGER | NO | DEFAULT 0 |
| componentes | JSONB | SÍ | |
| calculado_en | TIMESTAMPTZ | NO | |

**Índices/Restricciones:** `uq_historico_dimension_periodo (indicador_id, maquina_id, area_id, periodo_inicio)`; `ix_historico_maquina (maquina_id, periodo_inicio)`.

### 8.4. `dashboards`

- **Objetivo:** Vistas configurables (supervisor/gerencia/calidad) por planta.
- **Relaciones:** n:1 `plantas`, n:1 `usuarios` (creador); 1:n `dashboard_indicadores`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | NO | FK plantas |
| codigo | VARCHAR(30) | NO | |
| nombre | VARCHAR(80) | NO | |
| tipo | VARCHAR(15) | NO | CK IN ('supervisor','gerencia','operario','calidad') |
| config | JSONB | NO | widgets, filtros, layout |
| creado_por | UUID | NO | FK usuarios |
| activo | BOOLEAN | NO | DEFAULT true |

**Índices/Restricciones:** `uq_dashboards_planta_codigo (planta_id, codigo)`.

### 8.5. `dashboard_indicadores`

- **Objetivo:** Relación dashboard ↔ indicador con configuración del widget.
- **Relaciones:** n:1 `dashboards`, n:1 `indicadores`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| dashboard_id | UUID | NO | FK dashboards ON DELETE CASCADE |
| indicador_id | UUID | NO | FK indicadores |
| config_widget | JSONB | SÍ | tipo gráfico, colores, eje |
| orden | SMALLINT | NO | |

**Índices/Restricciones:** `uq_dashboard_indicadores (dashboard_id, indicador_id, orden)`.

---

## 9. MÓDULO AUDITORÍA

### 9.1. `bitacora` (particionada, inmutable)

- **Objetivo:** Registro inmutable de toda acción sobre el sistema (RN-AUD-001).
- **Responsabilidad:** Trazabilidad total: quién, qué, cuándo, antes/después, desde dónde.
- **Relaciones:** Referencial a cualquier entidad (sin FK por inmutabilidad), n:1 `usuarios`.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | BIGINT | NO | PK (id, fecha) |
| planta_id | UUID | SÍ | FK plantas (nullable: acciones globales) |
| usuario_id | UUID | SÍ | FK usuarios (NULL: sistema) |
| accion | VARCHAR(60) | NO | |
| modulo | VARCHAR(40) | NO | |
| entidad | VARCHAR(60) | NO | nombre de la entidad |
| entidad_id | VARCHAR(64) | SÍ | id (UUID o BIGINT) como texto |
| valor_anterior | JSONB | SÍ | |
| valor_nuevo | JSONB | SÍ | |
| ip | VARCHAR(45) | SÍ | |
| dispositivo | VARCHAR(255) | SÍ | |
| kiosko_id | UUID | SÍ | FK kioskos |
| fecha | TIMESTAMPTZ | NO | clave de partición |

**Particionado:** RANGE mensual.
**Índices:** `ix_bitacora_entidad (entidad, entidad_id)`; `ix_bitacora_usuario (usuario_id, fecha DESC)`; `ix_bitacora_accion (accion, fecha)`; BRIN `fecha`.

### 9.2. `eventos_sistema` (particionada)

- **Objetivo:** Logs técnicos del sistema (servicios, integraciones, schedulers).
- **Responsabilidad:** Salud del sistema y diagnóstico (no es auditoría de negocio).

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | BIGINT | NO | PK (id, fecha) |
| planta_id | UUID | SÍ | FK plantas |
| tipo | VARCHAR(30) | NO | |
| origen | VARCHAR(20) | NO | CK IN ('api','servicio','scheduler','integrador','ui') |
| nivel | VARCHAR(10) | NO | CK IN ('info','warning','error','critical') |
| mensaje | TEXT | NO | |
| payload | JSONB | SÍ | |
| fecha | TIMESTAMPTZ | NO | |

**Particionado:** RANGE mensual. **Índices:** `ix_eventos_sistema_nivel_fecha (nivel, fecha)`, BRIN `fecha`.

### 9.3. `cambios`

- **Objetivo:** Detalle de cambios (campo a campo) con flujo de aprobación para configuraciones sensibles.
- **Relaciones:** n:1 `usuarios` (autor y aprobador), referencia a entidades.

| Campo | Tipo | Nul | Restricción / Nota |
|---|---|---|---|
| id | UUID | NO | PK |
| planta_id | UUID | SÍ | FK plantas |
| bitacora_id | BIGINT | SÍ | referencia a bitacora |
| entidad | VARCHAR(60) | NO | |
| registro_id | VARCHAR(64) | NO | |
| campo | VARCHAR(60) | NO | |
| valor_anterior | JSONB | SÍ | |
| valor_nuevo | JSONB | SÍ | |
| usuario_id | UUID | NO | FK usuarios |
| aprobado_por | UUID | SÍ | FK usuarios |
| estado | VARCHAR(15) | NO | CK IN ('pendiente','aprobado','rechazado') |
| fecha | TIMESTAMPTZ | NO | |

**Índices:** `ix_cambios_entidad_registro (entidad, registro_id)`, `ix_cambios_estado (estado, fecha)`.

---

## 10. Resumen de invariantes de negocio materializadas en la BD

| Invariante | Mecanismo | Regla RN |
|---|---|---|
| Una ejecución activa por máquina | `uq_produccion_maquina_activa` (partial unique) | RN-RES-004 |
| Una parada abierta por máquina | `uq_paradas_maquina_abierta` (partial unique) | RN-RES-005 |
| Una sesión operario activa por usuario | `uq_sesiones_operario_usuario_activa` | RN-OPE-002 |
| Una sesión operario activa por máquina | `uq_sesiones_operario_maquina_activa` | RN-OPE-002 |
| Contador monotónico (no retroceso) | CHECK `contador_final >= contador_inicial` + validación por app sobre lecturas | RN-PRD-004 |
| Eventos sin duplicados | `uq_eventos_produccion_idempotencia` | RN-GEN-004 |
| Tiempos coherentes | CHECK `hora_fin > hora_inicio` en paradas/produccion/sesiones | RN-TUR-001 |
| Cantidades no negativas | CHECK `cantidad > 0`, `>= 0` en producciones y scrap | — |
| Datos inmutables | Sin UPDATE/DELETE en eventos (política + RLS/triggers de bloqueo) | RN-RES-001 |
| Baja lógica, nunca física | `activo` en todos los maestros; `ON DELETE RESTRICT` | RN-GEN-002 |

---

## 11. Diagrama Entidad-Relación (por módulo)

```
════════ IDENTIDAD ════════
  usuarios ──1:n── usuarios_roles ──n:1── plantas
      │                       └─n:1── roles ──n:m── permisos (rol_permisos)
      ├─1:n── sesiones_autenticacion
      └─1:n── sesiones_operario ──n:1── maquinas / turnos / kioskos

════════ CONFIGURACIÓN ════════
  plantas ──1:n── areas ──1:n── maquinas
      │              └──1:n── (maquinas)
      ├─1:n── turnos ──1:n── turnos_dias
      ├─1:n── calendario_excepciones
      ├─1:n── kioskos ──n:1── maquinas
      ├─1:n── configuraciones_sistema
      ├─1:n── causas_parada / defectos_catalogo / tipos_scrap / tipos_alarma / prioridades
      ├─1:n── clientes ──1:n── productos ──n:1── unidades / colores
      └─1:n── estados (proceso, código) — catálogo transversal

════════ PRODUCCIÓN ════════
  clientes ──< productos ──< ordenes_produccion ──> maquina/turno/prioridad
      │                          │ 1:n produccion (runtime) ──1:n── eventos_produccion
      │                          │       │                      (particionada)
      │                          │       ├─1:n── lecturas_contador (particionada)
      │                          │       ├─1:n── paradas ──n:1── causas_parada
      │                          │       └─1:n── defectos / inspecciones / scrap
      │                          └─1:n── scrap ──n:1── tipos_scrap / defectos

════════ CALIDAD ════════
  productos/maquinas ──< planes_inspeccion ──1:n── inspecciones
      │                                           └─0..1─ n:1 ─ no_conformidades
  defectos ──0..1── no_conformidades ──1:n── acciones_correctivas
      └─0..1── scrap

════════ MANTENIMIENTO ════════
  maquinas ──1:n── equipos
      └─1:n── mantenimientos ──n:1── paradas (origen) / alarmas (origen)
                └─1:n── historial_mantenimiento

════════ NOTIFICACIONES ════════
  tipos_alarma ──1:n── alarmas ──1:n── alertas
      │                    └─1:n── notificaciones ──1:n── notificaciones_destinatarios

════════ ANALÍTICA ════════
  indicadores ──1:n── snapshots_indicadores (particionada, por período/dimensión)
      │            └─1:n── historico_indicadores (mensual)
  dashboards ──1:n── dashboard_indicadores ──n:1── indicadores

════════ AUDITORÍA ════════
  (transversal, sin FKs de negocio)
  usuarios ──1:n── bitacora (particionada, inmutable)
  bitacora ──0..1── cambios
  (servicios) ──1:n── eventos_sistema (particionada)
```

---

## 12. Diagrama de dependencias (para creación)

```
NIVEL 1 (sin dependencias)          NIVEL 2                    NIVEL 3
unidades ────────────┐
colores ─────────────┤
estados ─────────────┼────▶ plantas ──▶ areas ──▶ maquinas
roles                │       │            └──────────────▶ kioskos
permisos             │       ├─▶ turnos ─▶ turnos_dias
(permisos→roles:     │       ├─▶ calendario_excepciones
 rol_permisos)       │       ├─▶ configuraciones_sistema
usuarios (self-FK)   │       ├─▶ clientes ─▶ productos
                     │       ├─▶ causas_parada / defectos_catalogo /
                     │       │    tipos_scrap / tipos_alarma / prioridades
                     └───────┴─▶ usuarios_roles (usuarios+plantas+roles)

NIVEL 4 (negocio)                  NIVEL 5 (eventos)         NIVEL 6 (análisis)
ordenes_produccion ──▶ produccion ──▶ eventos_produccion      indicadores
sesiones_operario ──▶ paradas        lecturas_contador        snapshots_indicadores
planes_inspeccion ──▶ inspecciones   (particionadas)          historico_indicadores
defectos ──▶ scrap                                         dashboards
no_conformidades ──▶ acciones_correctivas                  dashboard_indicadores
equipos ──▶ mantenimientos ──▶ historial_mantenimiento
alarmas ──▶ alertas / notificaciones / notificaciones_destinatarios
bitacora / eventos_sistema / cambios (auditoría, últimas)
```

---

## 13. Orden recomendado para crear las tablas

1. **Catálogos base:** `unidades`, `colores`, `estados`, `roles`, `permisos`, `rol_permisos`
2. **Planta e identidad:** `plantas`, `usuarios`, `usuarios_roles`
3. **Estructura física:** `areas`, `turnos`, `turnos_dias`, `calendario_excepciones`
4. **Catálogos de operación:** `causas_parada`, `defectos_catalogo`, `tipos_scrap`, `tipos_alarma`, `prioridades`, `clientes`, `productos`
5. **Recursos:** `maquinas`, `kioskos`, `configuraciones_sistema`
6. **Planificación y sesión:** `ordenes_produccion`, `sesiones_autenticacion`, `sesiones_operario`
7. **Ejecución:** `produccion`, `paradas`, `defectos`, `scrap`
8. **Calidad:** `planes_inspeccion`, `inspecciones`, `no_conformidades`, `acciones_correctivas`
9. **Alta frecuencia (particionadas):** `eventos_produccion`, `lecturas_contador` (crear particiones iniciales + política)
10. **Mantenimiento:** `equipos`, `mantenimientos`, `historial_mantenimiento`
11. **Notificaciones:** `alarmas`, `alertas`, `notificaciones`, `notificaciones_destinatarios`
12. **Analítica:** `indicadores`, `snapshots_indicadores`, `historico_indicadores`, `dashboards`, `dashboard_indicadores`
13. **Auditoría:** `bitacora`, `eventos_sistema`, `cambios`

## 14. Orden recomendado para poblar catálogos (seed)

1. `unidades` (SI + m, kg, unid, m/min...) → 2. `colores` (semáforos) → 3. `estados` (ciclos completos: OP, máquina, producción, parada, inspección, NC, **scrap Estimado/Pendiente/Confirmado/Cerrado**, **alarma Generada/Pendiente/Vista/Atendida/Cerrada**, mantenimiento, defecto, sesión, alerta) → 4. `roles` + `permisos` + `rol_permisos` (matriz §18 RN) → 5. `prioridades` (baja/normal/alta/urgente) → 6. `causas_parada` (las 8 del kiosco + clasificación) → 7. `defectos_catalogo` → 8. `tipos_scrap` → 9. `tipos_alarma` → 10. `configuraciones_sistema` (globales: timeout de sesión, umbrales, retención) → 11. `indicadores` (OEE/A/R/Q/scrap/MTBF/MTTR/producción/cumplimiento) → 12. Planta demo + admin → 13. `turnos` (A/B/C por cliente) → 14. catálogos de cliente (`clientes`, `productos`, `maquinas`, `areas`, `kioskos`, `planes_inspeccion`).

> El seed de `estados` es **el más crítico**: define los flujos completos que el código y la UI consumirán. Se versiona junto a la migración.

---

## 15. Estrategia de migraciones

- **Herramienta:** Alembic (SQLAlchemy), directorio `backend/migrations` con un **único head** por rama.
- **Convención:** una migración = un cambio atómico revisable en code review; nombres con prefijo `vXX_` descriptivo.
- **Política de producción (forward-only):** nunca se edita una migración ya aplicada; los cambios se corrigen con migraciones nuevas. Los rollbacks se permiten en dev/staging pero no en producción (se usa contra-migración).
- **Datos y esquema separados:** migraciones de esquema vs migraciones de datos (seed/backfill) en carpetas distintas para poder ejecutarlas con permisos distintos.
- **Tablas grandes (particionadas):** patrón *expand/contract* — añadir columna nullable + backfill por lotes + índice/con comprobación, sin bloqueo prolongado; creación de particiones futuras por job.
- **Zero-downtime:** los cambios destructivos nunca se ejecutan en el mismo deploy que los libera; se sigue: agregar (compatible) → duplicar/backfill → conmutar → eliminar (en versión posterior).
- **Entornos:** dev → staging (con datos de cliente anonimizados) → producción, con pruebas de migración en staging contra una copia real.

## 16. Estrategia de versionado de base de datos

- **Versión semántica de esquema desacoplada de la app:** `esquema v1.x.y` — el backend declara `SCHEMA_VERSION_MIN` y `SCHEMA_VERSION_MAX` soportadas; el API valida al arrancar (defensa ante deploys desalineados).
- **Archivo de control:** tabla `schema_version` (id, version, aplicada_en, descripcion, hash) alimentada por Alembic.
- **Compatibilidad hacia atrás:** una versión del backend funciona con el esquema de la versión anterior (la app nueva es tolerante); los desplegues se ordenan *backend primero, API después* o *API primero, backend después* según el cambio (documentado por migración).
- **Squash anual:** al estabilizar la V1, se comprime el historial de migraciones en un `baseline_v1.sql` y se re-emite desde ahí (solo afecta instalaciones nuevas).
- **Multi-planta/multi-tenant:** el esquema es único por base de datos; una instalación nueva aplica el baseline + migraciones pendientes. La política `planta_id + RLS` evita migraciones por cliente.

---

## 17. Métricas objetivo (para validar el diseño)

| Métrica | Objetivo |
|---|---|
| Lecturas de contador | > 100 M de filas/año (particionadas, ok) |
| Eventos de producción | > 20 M de filas/año |
| Snapshots de indicadores | ~2–4 M de filas/año |
| Bitácora | > 5 M de filas/año, retención configurable |
| Consulta dashboard gerencial (1 año) | < 2 s (P95) vía snapshots + históricos |
| Inserción de evento (P95) | < 50 ms |
| Latencia propagación dashboard | < 300 ms |

---

## 18. Preguntas abiertas para tu revisión

1. **PK UUID vs BIGINT en tablas maestras** — el diseño usa UUID en maestras y BIGINT en series. ¿Confirmas?
2. **`estados` como catálogo global + local por planta** — ¿ok que cada planta pueda agregar estados propios por proceso?
3. **RLS (Row Level Security)** para multi-tenant: ¿la habilitamos desde V1 o solo a nivel de aplicación?
4. **Retención de datos**: ¿política por defecto de 5 años para eventos/lecturas y 10 para auditoría (configurable)?
5. **`notificaciones` con FKs a `alarmas`/`inspecciones`**: ¿ok mantener FKs (con RESTRICT) o referencia débil?
6. **Horario de turnos con `TIME` + `turnos_dias`**: ¿soportas turnos que cruzan la medianoche (ej. 22:00–06:00) correctamente? (el diseño sí lo permite con `turnos_dias`).

---

*Fin del Modelo de Base de Datos v1.0. Aprobado este documento, se generará: 1) SQL (DDL con particiones e índices), 2) Modelos SQLAlchemy, 3) FastAPI, 4) Frontend React.*
