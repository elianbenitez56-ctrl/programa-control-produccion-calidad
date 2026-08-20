# SIGPC — Reglas de Negocio

**Versión:** 1.0 · **Estado:** Borrador para aprobación · **Autor:** Business Analyst / Solution Architect MES

> Documento de **dominio** del Sistema Integral de Gestión de Producción y Calidad. Define *qué* debe hacer el sistema en el negocio, sin entrar en código, tablas o APIs.
>
> Cada regla incluye: **Identificador · Descripción · Justificación · Impacto · Prioridad**. Estado probable de los estados y diagramas al final del flujo.
>
> **Convención de prioridad:** `CRITICA` (bloquea, seguridad/integridad), `ALTA` (central al negocio), `MEDIA` (calidad de operación), `BAJA` (conveniencia).

---

## Índice

1. [Reglas generales del sistema](#1-reglas-generales-del-sistema)
2. [Reglas de Producción](#2-reglas-de-producción)
3. [Reglas de Calidad](#3-reglas-de-calidad)
4. [Reglas de Operarios](#4-reglas-de-operarios)
5. [Reglas de Supervisores](#5-reglas-de-supervisores)
6. [Reglas de Gerencia](#6-reglas-de-gerencia)
7. [Reglas de Auditoría](#7-reglas-de-auditoría)
8. [Reglas para Paradas](#8-reglas-para-paradas)
9. [Reglas para Scrap](#9-reglas-para-scrap)
10. [Reglas para OEE](#10-reglas-para-oee)
11. [Reglas para Cambios de Turno](#11-reglas-para-cambios-de-turno)
12. [Reglas para Órdenes de Producción](#12-reglas-para-órdenes-de-producción)
13. [Reglas de permisos por rol](#13-reglas-de-permisos-por-rol)
14. [Estados posibles de cada proceso](#14-estados-posibles-de-cada-proceso)
15. [Diagramas de estados](#15-diagramas-de-estados)
16. [Casos excepcionales](#16-casos-excepcionales-y-respuesta-del-sistema)
17. [Restricciones que nunca deben romperse](#17-restricciones-que-nunca-deben-romperse)
18. [Matriz completa de permisos por rol](#18-matriz-completa-de-permisos-por-rol)
19. [Eventos automáticos del sistema](#19-eventos-automáticos-del-sistema)
20. [Validaciones obligatorias](#20-validaciones-obligatorias)

---

## 1. Reglas generales del sistema

Reglas transversales que aplican a todo el sistema.

| ID | Descripción | Justificación | Impacto | Prioridad |
|---|---|---|---|---|
| **RN-GEN-001** | La **hora y la fecha son definidas por el servidor**. Ningún dispositivo cliente puede indicar la hora, turno o día; todo evento se timbres con el reloj del servidor. | Un operador o una falla del kiosco pueden manipular la hora de la PC; la coherencia del turno y de la productividad depende de una única fuente de tiempo. | Integridad de turnos, OEE, auditoría. | CRÍTICA |
| **RN-GEN-002** | Todo evento de planta se **registra de forma inmutable** (append-only) con actor, recurso, momento y estado antes/después. Lo que ya se registró no se sobrescribe. | Requisito de trazabilidad total y auditoría; histórico fiel y recalculable. | Confianza en los indicadores y cumplimiento normativo. | CRÍTICA |
| **RN-GEN-003** | Una operación de la planta solo se ejecute si el **actor tiene permiso** (`recurso:acción`) y su **alias de sesión es válida**. La validación se hace en el servidor, nunca solo en la interfaz. | Un rol no debe poder ejecutar acciones ajenas; la interfaz es fácil de manipular. | Seguridad y atribución. | CRÍTICA |
| **RN-GEN-004** | Las operaciones de la planta usan **claves de idempotencia**: una misma orden/evento repetida por la pantalla (retoque, doble clic, reenvío) se ignora; nunca se produce un duplicado. | Doble clic, reintentos o red reman desde offline duplicaban casos, paradas o lecturas y falsean los números. | Calidad de los datos | ALTA |
| **RN-GEN-005** | El **estado actual de cada máquina es un valor calculado por el sistema** (derivado de eventos), no un dato escrito por el usuario. | Evita que una persona "pinte" de verde una máquina que está realmente parada. | Integridad del dashboard de patio. | CRÍTICA |
| **RN-GEN-006** | Una máquina solo puede tener **una ejecución (runtime) activa a la vez**. Dos runtimes de la misma máquina no pueden solaparse en el tiempo. | La producción es línea continua por recurso; duplicar runtimes sin inválidos. | Consistencia del cálculo de producción. | CRÍTICA |
| **RN-GEN-007** | El sistema debe operar **sin conexión parcial**: los kioscos guardan eventos locales y los envían al servidor con reconciliación. Un mínimo de capacidad no bloquea al operador. | En planta real hay inestabilidad de red; la captura no se debe detener. | Disponibilidad y resiliencia. | ALTA |
| **RN-GEN-008** | Todo reto de interfaz (botón, ingreso) que falle se **notifica en pantalla** y se ofrece re-emendar sin datos perdidos; el sistema no "sabe" discretamente que falló. | El operador pierde confianza y tiempo si el sistema falla en silencio. | UX y confianza del usuario. | ALTA |
| **RN-GEN-009** | Todo período del sistema es **configurable por planta** (turnos, causas, defectos, planes, tolerancias, metas), sin modificar el producto. | El producto se vende a múltiples plantas; la configuración debe ser parte del negocio. | Comercialización y mantenimiento. | ALTA |
| **RN-GEN-010** | El **idioma Y unidades** se definen por planta (configuración), pudiendo usar múltiples dentro del sistema. | Plantas multi regiones y equipos. | — | MEDIA |
| **RN-GEN-011** | La **notificación a destinos** (inspector, supervisor, gerencia) se genera por eventos del sistema, según configuración; no hay notificaciones ilegales del flujo. | La proactividad del sistema (invitar inspector) es una de las claves del dominio. | Usabilidad y cumplimiento de calidad. | ALTA |

---

## 2. Reglas de Producción

| ID | Descripción | Justificación | Impacto | Prioridad |
|---|---|---|---|---|
| **RN-PRD-001** | Sólo se puede **INICIAR** una OP cuando: (a) hay sesión de operario válida en la máquina, (b) la OP está asignada a esa máquina y en estado `Liberada`, (c) la máquina no tiene runtime activo ni parada abierta, (d) el contador tiene lectura inicial válida. | El arranque precede una cadena de cálculos (contador, tiempos, OEE); arrancar mal invalida el histórico. | Cálculo correcto de indicadores. | CRÍTICA |
| **RN-PRD-002** | Al **INICIAR**, el sistema registra automáticamente: hora de inicio (servidor), operario, máquina, turno, OP y lectura inicial del contador. | El operador no debe escribir nada (eje `<2 min>`); el inicio es un clic. | Satisfacción del requisito "cero digitación". | ALTA |
| **RN-PRD-003** | La **producción del por contador = diferencia entre lectura final e inicial** dentro del runtime, salvo lecturas del lector (OPC/UA) continuas. | Forma de medir de forma automática y no basada en tablas. | e correcto del rendimiento. | CRÍTICO |
| **RN-PRD-004** | La **lectura de contador debe ser posible en (y)**: el contador nunca vuelve hacia atrás en el tiempo (monotonicidad) y los saltos entre lecturas consecutivas están dentro de un límite máximo verificable (riesgo por velocidad). | Detecta lecturas falsas o @; un salto fuera de límite es señal de anomalía. | Confiabilidad de horas. | CRÍTICA |
| **RN-PRD-005** | Si la máquina posee contador automático (OPC), la captura es transparente; si se usará manual, el sistema solo pide **un valor** en momento puntual (cd none inicial, al cerrar cierre o cuando la pantalla detecte que una cantidad). Nunca se pide tablas. | Meno clics; el valor único es suficiente para calcular lo necesario. | Carga del operario. | ALTA |
| **RN-PRD-006** | **RENDIMIENTO: si la velocidad actual cae por debajo del margen permitido en la meta**, el sistema lo registra oportunamente como pérdida de rendimiento (sistema activo) y sugiere/registra el aviso. | La velocidad variable, y el OEE sin esa pérdidaenciera estaría hinchado. | OEE honesto. | ALTA |
| **RN-PRD-007** | **FINALIZAR una OP** sólo cuando: el runtime de esa OP no tiene parada abierta; se **define** (si no, auto-cierra el modo supervisor); la lectura final es válida y no antes que la inicial. | Finalizar con paradas abiertas rompe el balance del cierre (hora final ≠). | Consistencia de KPIs. | ALTA |
| **RN-PRD-008** | Al **FINALIZAR** se limpia automáticamente collection: producción, tiempo productivo/importio de tareas, disponibilidad, rendimiento, calidad, scrap, OEE, cumplimiento de meta; la orden pasa a estado `Terminada`. | Es el hito de cierre que el operador no debe llenar a mano, cumple el requisito "todo automático al fin". | Reportes y toma de decisiones. | CRÍTICO |
| **RN-PRD-009** | **PRODUCTION Y ALMACÉN CONTINUAR en la misma OP**: si la OP fue terminada pero el contador sigue avanzando (pendiente de OK por causa mayor y no), no se "reabre". Se induce OT adicional con cambio de, o un nuevo runtime controlado por el supervisor. | Evita "cerrar" y seguencirca misma orden con tail de tiempo. | Pureza de datos de productividad (real→objetivo). | ALTA |
| **RN-PRD-010** | La **meta de la OT es: objetivo de producción a velocidad típica** según su especificación; la meta de turno se calcula por la ventana del turno (ver Turnos). | Cada nivel (OT vs turno) tiene su propósito; no se mezclass en la compara. | Semántica del cumplimiento. | MEDIA |

---

## 3. Reglas de Calidad

| ID | Descripción | Justificación | Impacto | Prioridad |
|---|---|---|---|---|
| **RN-CAL-001** | El operario **no ejecuta controles de calidad**. Cada X tiempo (plan de inspección: por min o volumen) el sistema genera una **inspección programada** y notifica al **Inspector/Calidad** asignado al plan de la máquina. | Evitar que el operador llene formularios; separar roles de forma limpia. | Modernidad del flujo, requisito clave. | CRÍTICA |
| **RN-CAL-002** | Una inspección de calidad se eneja **en el momento vigente del plan** (intervalo desde la última inspección del turno) y puede ser por tiempo o por volumen producido (configurable por producto/máquina). | Control por tiempo o por volumen según el proceso real. | Cobertura adecuada del auto-control. | ALTA |
| **RN-CAL-003** | La inspección se precargue con el **checklist / especificaciones de la OT** (parámetros: gramaje, ancho, largo, límites) y los datos de la máquina/OP. El inspector solo completa el resultado y el dato de campo si es imposible. | el inspector gana tiempo; el checklist correcta por OT es reproducido desde el sistema. | Velocidad de Calidad. | ALTA |
| **RN-CAL-004** | Al **ejecutar la inspección**, si el resultado es **NO CONFORME** el sistema: (a) registra la inspección, (b) dispara un cabezal de **no conformidad (NC)**, (c) notifica a Calidad/Supervisor, (d) detiene (según el tipo de desviación) la liberación de la OT. | El bloqueo y el aviso han de ser automáticos e-sensores. | Control de calidad preventivo. | CRÍTICA |
| **RN-CAL-005** | las inspecciones que **no se ejecutan** a su hora quedan como `VENCIDA` para Calidad/Supervisor y se ponen **en la cola del supervisor** con advertencia de riesgo. No se "olvida" una inspección. | Ninguna vigilancia se pierde por holgura; la trazabilidad exige visibilidad de veces en que no hubo el control. | Exigencia de la aseguramiento de calidad. | ALTA |
| **RN-CAL-006** | Solo el rol **Calidad** puede registrar o modificar resultados de inspección (el operario ve el aviso, no puede completarla). | El auto-control lo ejecuta el Inspector; la separación funcional es central en el dominio. | Cumplimiento de roles. | ALTA |
| **RN-CAL-007** | si la OT registra **too un defecto no clasificado** y no hay NC, la cantidad estén y la **liberación** no se quita, pero la NP la Quintana clasifica en una ventana definida (ej. fin de turno) | No detenemos la operación mientras no haya riesgo legal; pero nada queda "olvidado". | Fluidez + control. | MEDIA |
| **RN-CAL-008** | El **plan de autoc (autocontrol) es/son losfreces que se detectan**: cada plan se define por producto+carrera de inspección, se programa por plan de turno y no puede operar sin plan activo. | Auto control sin plan = inspecciones arbitrarias; el plan se hereda del producto con la OT. | Consistencia | ALTA |
| **RN-CAL-009** | los resultados quedan ser trazables a la **instancia de OT y al runtime** a la que corresponden (con su contador asociado). | OEC/Calidad se calculan sobre la OT; no pueden desincronizarse los controles del periodo. | Integridad de esta misma. como calculo de | ALTA |

---

## 4. Reglas de Operarios

| ID | Descripción | Justificación | Impacto | Prioridad |
|---|---|---|---|---|
| **RN-OPE-001** | El operario inicia sesión por **QR / RFID / PIN**. El sistema registra automáticamente **usuario, hora/fecha, máquina y turno** (deducida por el sistema). No digita nada. | Cumplir el requisito de los `<2 min` por hora y de captura automática. | Visitación noche. | CRÍTICA |
| **RN-OPE-002** | Un operario puede tener **una única sesión activa** en la fábrica a la vez. Si abre en otra máquina, la anterior cierra la ventana y se ficha. | evita operadores dobles/rotaciones no rendidas, base de winner de alta. | Atribución del tiempo. | ALTA |
| **RN-OPE-003** | El operario **solo ve y opera las OPs asignadas a su máquina** (del turno). No puede crear, editar, crear, borrar ni liberar OPs. | el operario no toma decisiones de planificación. | Respece del plano. | CRÍTICA |
| **RN-OPE-004** | El sistema **precarga automáticamente todos los datos de la OT** al seleccionarla: cliente, producto, referencia, ficha (gramaje, ancho, largo), velocidad objetivo, cant, especificación, supervisor. | Cero digitación en la selección; visualización única y en alto contraste. | Usabilidad.. | ALTA |
| **RN-OPE-005** | Las acciones del operador se **limitan a** * iniciar producir, registrar parada, registrar defecto, registrar contador (solo si manual), reanudar, finalizar *; nunca modifica datos maestros de ningún tipo. | el dominio del operador es ejecución pura | Control y seguridad. | ALTA |
| **RN-OPE-006** | Los paradas se capturan **con causa (clic (botón grande**)); final del parpadeo **CONTINUAR** cierra la parada y vuelve a producción; si la parada es de cambio y además debe ir a *PREPARACIÓN*, el sistema lo setea. | mitiga errores (1 a 2 clics) y respeta el requisito con causad. | Flujo diferencial de UX. | ALTA |
| **RN-OPE-007** | Si el operario de **define**, la parada no se borra; se metac con `SIN_CAMIO` (ver cambios de turno) y el supervisor la asigna al siguiente o la cierra. | la realidad del cambio de turno dura, quizás; la trazabilidad NO debe perder. | Duality de parada. | ALTA |
| **RN-OPE-008** | El sistema toma la **silla del control del estado** cuando el operario se **desconecta/bloquea**: cierre la sesión actual (sin log-out) tras timeout configurable; si había parada abierta se queda en la cola del supervisor y las alerta. | Nadie puede vendertime sobre sí mismo ni "man detener" el sistema de forma invisible. | control y confianza del operador. | ALTA |
| **RN-OPE-009** | El operador **no registra inspecciones** ni edites resultados de Calidad, ni expedeciona pieza para 3Group normas, NO se exige su típico a excepción de casos de excepción por puede emitir solicitud de trabajo a Mantenimiento al abrir a parada. | tiene fija y delimita a su rol. | Respeto de los límites. | MEDIA |

---

## 5. Reglas de supervisores

| ID | Descripción | Justificación | Impacto | Prioridad |
|---|---|---|---|---|
| **RN-SUP-001** | El supervisor ve la **planta completa en tiempo real** y puede consultar el detalle de cualquier máquina/OT del área y del turno. | supervisión global, iter al fato se informa por el sistema. | supervisión de. | CRÍTICA |
| **RN-SUP-002** | El supervisor puede **crear**, **liberar y asignar OTs** a máquinas/turnos; y modificar órdenes **solo en estado planificado/liberada** (no en ejecución salvo autorización explícita). | La programación se vigila; la OT en ejecución quedó congelada salvo supervisión. | Control de plan. | ALTA |
| **RN-SUP-003** | El supervisor **aprueba el cierre final** de una OT (si hay incidencias), incluye cuando se terminó sin seguimiento o cuando la paradas/defectos pendieron; en cierre estándar no se requieren validaciones (se dará auto por la METDM). | un jue y partes cargadas: cierre normal automático, cierre con riesgo, requiere aprobación. | velocidad y control. | MEDIA |
| **RN-SUP-004** | El supervisor puede **reclasificar** causas de parada y **reabrir/corregir** una parada errónea (con registro de auditoría de la corrección). Puede anular una parada, con clasó visible. | Evita la “frusi de oro” de losOEE (es correct el ingreso de). | calibra los indicadores con honestidad. | ALTA |
| **RN-SUP-005** | Es responsable de **resolver inspecciones VENCIDAS** y de validar la clasificación de defectos pendientes; un monto deo permitido en el **turno**. | Nadie más se la hace; si no resuelve, el indicador lo comunque en visible. | el sulfragio de Calidad. | ALTA |
| **RN-SUP-006** | Las alarmas (parada > umbral, OT sin causa, sin operador) **no se apaga ero**: el supervisor confirma/alarma==→ queda histórico resuelto, o se recibe bandera si expira. | "Avisar y confirmar" da histórico de atención real. | Súper decision. | ALTA |
| **RN-SUP-007** | El supervisor **puede liberar la máquina** en caso de conflicto (sesión doble no autorizada, OT a máquina emplear) y la corrección la deja sin datos. | El piso no puede bloquearse; la decisión es supervisada y auditable. | Continuity | ALTA |

---

## 6. Reglas de Gerencia

| ID | Descripción | Justificación | Impacto | Prioridad |
|---|---|---|---|---|
| **RN-GER-001** | Gerencia **consulta de datos consolidados** (OEE, disponibilidad, rendimiento, calidad, scrap, MTBF/MTTR, producción por periodo) en el dashboard de datos (de forma lectura). | Es su propósito: indicadores; no ejecución de planta. | ALTA |
| **RN-GER-002** | la gerencia puede **exportar reportes** (PDF/Excel) y guardar vistas/filtros para comparar periodos, máquinas y turnos. | análisis y sostenimiento de decisiones. | MEDIA |
| **RN-GER-003** | No ejecuta operación de la planta: no crea OTs, no produce, no cierra. Solo lectura, análisis y exportación. | Separación de responsabilidades; evita errores ricasos. | ALTA |
| **RN-GER-004** | El sistema **no está diseñado para ser verificado si el datos puede ser "ajustado"**: los reportes siempre son el dato tal cual (histórico fiel); gerencia los contrasta con alertas de anomalías (rollout). | el dato fiel es la base para planes acción. | CONFIANZA en decision. | ALTA |

---

## 7. Reglas de Auditoría

| ID | Descripción | Justificación | Impacto | Prioridad |
|---|---|---|---|---|
| **RN-AUD-001** | **Todo cambio de estado, evento de planta, corrección o modificación de datos** deja un registro de auditoría (actor, momento, recurso, antes/después, dispositivo/IP). Una mierda de los accesos. | Base de trazabilidad total y herr año. | CRÍTICA | 
| **RN-AUD-002** | El registro es **inmutable** y de solo agregado; no se puede editar, borrar ni limpiar por ningún móvil; una política de **retención** define fechas de vida configurable. | si no, compro la trazabilidad. | CRÍTICA |
| **RN-AUD-003** | El rol **Auditoría** tiene **lectura completa de todos los datos** (producción, calidad, config, auditoría de sesiones y de cambios), sin capacidad de crear, editar ni operar. | El auditor es espectador imparcial. | CRÍTICA |
| **RN-AUD-004** | Se **logan las excepciones**: intentos de acceso no autorizado, intentos de insertar contadores inversos, ediciones de causas, modificación de usuarios/roles, paradas corregidas, sesiones fuera atribuidas. | El "cuando las cosas se intentan" es tan valioso como lo normal. | ALTA |
| **RN-AUD-005** | todo campo de config (turnos, máquinas, planes, límites) que cambie de dor para 4 efectivo, muestre creador y fecha/fecha de vigencia y a quien se notificar. | los cambios de dé ech; para no estar caja en el histórico OEE. No se hicieron "retro-date" silenciosos. | SALTOHU SETTLE | ALTA |

---

## 8. Reglas para las Paradas

| ID | Descripción | Justificación | Impacto | Prioridad |
|---|---|---|---|---|
| **RN-PAR-001** | toda parada tienen una **causa** codificada de configuración (loading: cambio re-referencia, daño mecánico, daño eléctrico, espera de papel, falta de operador, limpieza, ajuste, otro etc.) y una **clasificación** que da sus efectos (ver RN-PAR-004). | sin clasificación no hay OEE/MTBF correctos; la causa se manda desde ya con el evento. | CRÍTICA |
| **RN-PAR-002** | registro inicio es **automático** al pulsar PARADA (hora de servidor; el usuario, la máq, OP y contador actual), cerrar fin se configura con **CONTINUAR** (hora+ calcular duración) o con **FINALIZAR OT** (fin OP) de la OT — ambos. | el clic de inicio es y la duración la calcula el servidor. | ALTA |
| **RN-PAR-003** | **una sola parada activa por máquina** en el mismo intervalo; no pueden superposicionar (se ignoran o se resuelve siendo). | dos paradas simultáneas eran no medible | AGLOMER perceptual de tiempo. | ALTA |
| **RN-PAR-004** | la **clasificación de la principal** impacta en disponibilidad y MTTR/MTBF de forma deliber: **PIERED CAUSAL** (como cambio de referencia) solo cuenta en la **disponibilidad**; **UNPLANNED / cause flaws** (daño mecánico, eléctrico, falta de oper, espera de papel) cuenta en disponibilidad **Y MTTR/MTBF**; **PLAN/bloqueadas/desc.####) se descuentan del tiempo a for-él usado. | alineated OEE "tipo industria" + diferenciando de los MTTR/MTBF. El usuario lo puede ver/editar en (configuración). | CRÍTICA |
| **RN-PAR-005** | no se finaliza una OT con una parada **abierta**: el sistema, al intentario (si) la cierra auto generando evento extra (`CERRADA_AUTOMATICA_POR_FIN`) ? lo indica al operador para que confirme. | El dominio no puede dejar "tiempo muerto" sin cierre. Manager(es máx.). | alta |
| **RN-PAR-006** | si una parada dura > umbral configurable, el sistema la **marca en alerta** al supervisor (tiempo muerto) y si tiene las causas de falla sámbolas, crea/scala solicitud de mantenimiento. | la vigilancia proactive del supervisor disminuye su tiempo de pérdida. | ALTA |
| **RN-PAR-007** | las paradas **sin causa finalmente al momento de superar turno/timbre** se quedan `abierta` pero llegan la shell del supervisor como "causafalta" para completar la causa. No se inventa sola de forma automática la causa. | el dato de tiempo es duro; la causa es contexto (no se inventa silenciosamente). | con ITS | MEDIA |
| **RN-PAR-008** | una parada **excepcional de tiempo > umbral** (configurada) se marca como CC/INCI y puede abrir MTTR para falla (o no) según causa. | Décide la gravedad propuesta también en el convero. | recto |

---

## 9. Reglas para Scrap

| ID | Descripción | Justificación | Impacto | Prioridad |
|---|---|---|---|---|
| **RN-SCR-001** | El Scrap = **cantidad (unidad de cuentro) que NO cumple la calidad** y se registra en la OT por defecto o estadística de rechazo, no se puede "eliminar" de la suma total de producción. Producción total = cantidad conforme + scrap. | Si se lo restas no sabemos la calidad real (O/E Quality=true). | dato correcto de scrap y. rendimiento. | CRÍTICA |
| **RN-SCR-002** | El defecto produce una **estimación de scrap** derivada delos contador entre el evento del defecto y la corrección (venta de batazo), de lo contrario un **scrap = 0**, X y | Debe registrarse el scrap sin exigir tablas ni conteo, el sistema lo estima/registra con un clic + (opcional). Llegada de los control de meta. | Eliminación de la jornada a mano. | ALTA |
| **RN-SCR-003** | El scrap SIEMPRE queda **asociado a la OT del runtime** en la que se produjo (con máquina/turno), y su cierre de OT suma el akount de scrap de esa OT. | no puedes como de la OT y el KP de rendimiento... | 
| **RN-SCR-004** | Un scrap **estimado automáticamente** se considerar **PENDIENTE de confirmación** por Calidad/Hay antes del cierre, si el valor estimado > vicitado umbral. | evita engañar el promedio al cerrar sin validar el big bug. | ALTA |
| **RN-SCR-005** | El usuario no puede **borrar/ajustar** scrapes con libertaja?: toda edición de la estimación (se sube M1) por SCVóa requiere permiso (Calidad o Sup.) y queda auditorínumber | las números manos transparentes, no editing louth. | ALTA |

---

## 10. Reglas para OEE (y sus componentes)

| ID | Descripción | Justificación | Impacto | Prioridad |
|---|---|---|---|---|
| **RN-OEE-001** | **Definición estándar**: Disponibilidad × Rendimiento × Calidad, en el mismo período (runtime/OT o turno). | Industria ISO; todos los reportes comparan como tal. | Estándar. | CRÍTICA |
| **RN-OEE-002** | **Disponibilidad = (Tiempo operativo − Tiempo de parada) / tiempo operativo**. El tiempo operativo = el turno programado (plan de turno − descansos programados) **sin** mantenimiento planificado (se excluyen del denominador). | mayor mida la disponibilidad real sobre lo "planeable". No se castigan los paros plan = daño. | Lo coherente del ratio. | ALTA |
| **RN-OEE-003** | **Rendimiento = producción real / (tiempo corrió × velocidad meta de la OT)**; puede ser **> 100%** si se produce por encima de la velocidad meta (no se clamped de forma artificial, es una información de "iota" real). | el rendimiento es información de ajuste, no un techo matemático artificial. | Heral de comunicaciones. | ALTA |
| **RN-OEE-004** | **Calidad = cantidad conforme / (conforme + scrap)** del período (por contador). | ratio verdadero de causa-efecto. | — | ALTA |
| **RN-OEE-005** | **OEE mostrado en dashboard público = mínimo(OEE, 100%)** (visual), pero el valor estricto se conserva y exporta. | para no sobrecargar, el 100% es techo visual y A×R×Q no se resta (no puede pasar de 100%: el mínimo lo queda). | comunicación | MEDIA |
| **RN-OEE-006** | de **Meta** para el cumplimiento: la producción del turno vs la meta de turno realizable; el % no puede superar 100 en el avance, tiene la sombra de fuera con exceso quedar **sobre la meta** (positivo en verde). | mostrar "cuánto % al día" honesto y no granatelar el desborde. | — | ALTA |
| **RN-OEE-007** | **Recomputemento automático**: cada evento que altera tiempo, contador o calidad **recalcular los rollups** del período afectado (turno/día/OT) en cascada con idempotencia, sin re-hub `. Las vistas gerenciales ya no se "manualizan". | que el lastN alguieno informen deews. a | productivos. | ALTA |
| **RN-OEE-008** | MTBF = **[tiempo de funcionamiento / número de fallas]**; MTTR = **[tiempo de parada por falla / número de fallas]**. Solo se consideran fallas (paradas no planificadas con causa de daño) para estos enfoque.) | MTBF/MTTR no se llenan con todos los corresponde. – fallas de re princ. | — | ALTA |
| **RN-OEE-009** | para periodos en los que no hubo mov/turno (holiday) **no se calculate OEE** (o se muestra `—`, no 0% implícito), para no distorsionar el promedio. | dominicales no castigan.. | pomo up | MEDIA |

---

## 11. Reglas para cambios de turno

| ID | Descripción | Justificación | Impacto | Prioridad |
|---|---|---|---|---|
| **RN-TUR-001** | El **corte de turno lo define el sistema** por el cuadro (turnos configurados) contra el reloj del servidor, no por el ingreso de personas. | по coherencia de la fuente temporal; el mismo. | ALTA |
| **RN-TUR-002** | El runtime **continúa sin interrumpirse** a través del cambio de turno; el contador y el OEE se calcularán por **corte en la OT** según la ventana del turno (fracción del periodo asignado en el turno anterior al siguiente), no se para la producción. | La producción no esperar; las OTs con lápida, evitar tener el OEE "olvidado" en la frontera. | ALTA |
| **RN-TUR-003** | Al fin de turno se genera un **resumen de cierre de turno automático** (producción, meta, OEE, tiempo perdido, pendientes) que queda para revisión del supervisor; no requiere intervención manual para re-hub. | el turno deja "evidencia" del periodo, para el following supervisor. | ALTA |
| **RN-TUR-004** | la parada que **truca el cambio de turno** se queda en la máquina; la causa la puede cerrar el que llega o el supervisor. Su duración se **particiona** entre los dos turnos según la hora del corte. | nota de continuidad; no [contador] doble. | ALTA |
| **RN-TUR-005** | El **handover**: el acabado turnador hace login (o el siguiente ya). El conductor que faltó su la deja para inmediato; el que llega puede "retomar" (asume la sesión) de forma directa, since | la transferencia de la máquina se hace sin duplicar información. | MEDIA |
| **RN-TUR-006** | Al final de cada **turno (y de día)** el sistema envía un **reporte conciso de indicadores** (a menos que se desactive) a supervisor y gerencia. | Un período cerrado, información lista | e chain.

---

## 12. Reglas para Órdenes de Producción (OP)

| ID | Descripción | Sin | Justificación | Impacto | Prioridad |
|---|---|---|---|---|---|
| **RN-ORD-001** | La OP se crea **solo por rol autorizado** (Supervisor/Plan+config) y pasa por los estados (programada → asignada → liberada). Nunca la crea un operario. | La OP es la programación del plan; valida el Slab. | CRÍTICA |
| **RN-ORD-002** | Cada OP **revisa el snapshot de especificación al liberarla** (producto y params). Si se modifica un producto DESPUÉS de la emisión, **no** afecta a las OTs ya emitidas (histórico estable) . Peb/Te: solo una OP por estado en ejecución por producto/máquina. | El sistema representa la "especificación que valió al emitarla", no cambiar cada día. | ALTA |
| **RN-ORD-003** | no se puede **asignar dos OPs a la misma máquina con el mismo turno**. Aviso; se reordena por secuencia planificada (prioridad, equipos de la máquina). | sin doble ejecución simultánea posible | ALTA |
| **RN-ORD-004** | Una **OP en ejecución** no se puede **editar/enar la cantidad** (fix) salvo con autorización supervisor y justif., quedando marcada la modificación. La variación se permite (no limitación) solo en pequeñas cantidades con el objeto del funcionario. | no decision - leftoare.
| **RN-ORD-005** | Las **OP canceladas/terminadas** no se eliminan: status en histórico; si hay lectura/escritura de ella, la ref. permanece. | informe por "producto" con historial completo. | ALTA |
| **RN-ORD-006** | La **prioridad de ejecución** la forma el supervisor (la secuencia), el sistema estáPT's internas (asignación secuencias) e **informa al kiosco cuando se puede avanzar**. | la tabla de turno (o mañana) no la dejael. | MEDIA |
| **RN-ORD-007** | Al crear OP se valida que **el producto/ref exista y esté activo** y que cantidad > 0; las especificaciones se varin (stock) en snapshot decir apenas to the reality. |evita "OP fantasmas" | ALTA |

---

## 13. Reglas de los permisos por rol

> Resumen narrativo; la matriz completa está en el punto 18. Los permites se aplican **servidor** siempre.

| ID | Descripción |
|---|---|
| **RN-PRM-001** | **Operador**: todo su alcance es sobre la máquina asignada (o las OTs de su área): leer sus OTs, ejecutar inicio/producción, paradas, defectos, contador. No puede ver ni la configuración ni la de máquinas de otros (full a su área), ni usuarios. |
| **RN-PRM-002** | **Calidad**: sobre el plan de calidad, inspecciones, NC, defectos y scrap de su área; puede ver producción de la máquina en contexto, pero no operar la máquina ni configurar. |
| **RN-PRM-003** | **Supervisor**: ver/consumir toda la planta **en el turno** (área), programar y asignar OTs, aprobar causa de parada reforzado, ver KPIs completos y utilizar reportes de turno. |
| **RN-PRM-004** | **Gerencia**: solo lectura de agregados + exportación de mejores reportes; NO **puede** ejecutar operación de planta ni modificar maestro. |
| **RN-PRM-005** | **Auditoría**: leer **todo** (incl. auditoría y config actual) de forma solo lectura; sin operar, sin exportar y ser administradores. |
| **RN-PRM-006** | **Admin**: gestión completa de maestro, usuarios y config (con límite de las operación de planta no) — para ciertos recursos se perm. (helessingle "duda"]: Por seguridad, puede permisible otorgar (delegar) una operación (por ejemplo "cerrar un runtime") solo a operadores de motor, no delegouter la autorización de permisos. |
| **RN-PRM-007** | Ningún usuario puede **modify su propio rol/permisos** o asignarse a sí mismo un permiso de elevado. Cambios de roles REQUIEREN login y se logn en auditoría. |
| **RN-PRM-008** | Los permisos se **evalúan siempre server-side del al contra seed-list** (no se pueden bloquear por ocultar un botón en el client; se prpuena también para UX). |

---

## 14. Estados posibles de cada proceso

### 14.1. Orden de Producción
`BORRADOR` → `PLANIFICADA` → `ASIGNADA` → `LIBERADA` → `EN_EJECUCIÓN` → `TERMINADA`
Canciones o pausas: `CANCELADA`, `SUSPENDIDA` (pausada por el supervisor; vuelve a `LIBERADA`).
Terminales: `TERMINADA`, `CANCELADA`.

### 14.2. Máquina
`OFFLINE` (fuera de servicio/noOPERANDO), `SIN_ORDEN` (sin OP asignada, disponible), `LISTA` (con OP liberada y casa), `PREPARACION` (setup), `PRODUCIENDO`, `PARADA` (con causa), `MANTENIMIENTO` (planeado o por falla). Tras `PARADA`→ se reanuda `PRODUCIENDO`, o a `MANTENIMIENTO` si la causa lo decide, o a `SIN_ORDEN` al finalizar la OT.

### 14.3. Inspección de Calidad
`R_PROGRAMADA` (con hora prevista) → `PENDIENTE` (posada la hora, no ejecutada) → opciones: `EN_PROGRESO` (la toma el inspector) → `CONFORME` | `NO_CONFORME`; o se queda `VENCIDA` (override, espera de novedades). `ANULADA` (solo Supervisor/Calidad Admin conv sent enough).

### 14.4. Parada
`ABIERTA` → `CERRADA` (con `CERRADA_NORMAL`, `CERRADA_AUTOMATICA_POR_FIN`, `CERRADA_POR_CORRECCION`). `ANULADA` (solo Supervisor, se era con auditoría). Aparente 1 sola abierta por máq.

### 14.5. No Conformidad (NC)
`ABIERTA` → `ASIGNADA` → `EN_TRATAMIENTO` → `RESUELTA` → `CERRADA`. manual: `RECHAZADA` (conjustificación) en cualquiera de las abierta/trata; siempre auditado.

---

## 15. Diagramas de estados

### 15.1. Orden de Producción

```
                 +--------+
                 | BORRADOR|------------------+
                 +---+----+                  |
       crea/datos |    |                      |
  +--------------+    |                     |
  |              v    v                     |
  |        +---------+  +----------+        |
  |        |PLANIFICA|  |SUSPENDIDA|--------+-----+
  |        +---------+  +----------+  suspens │    |
  |         |                          (volver a liber)│
  |         v       │                    │    │
  |    +--ASIGNADA--+  <--- confirma      │    │
  |        | m·quina/turno                │    │
  |        v                              │    │
  |    +LIBERADA+                         │    │
  |      │  init                           │    │
  |      v                                │    │
  | +EN_EJECUCIÓN+  —— cierre plus ------→ v
  |       │                               │
  |       +── TERMINADA  ◄──senlace auto  │
  |                                        │
  +────────── CANCELADA   (autorizado) ────+── “Cancel” ✔
```

### 15.2. Máquina

```
                 estado actual
[  inicar]       [ params]
  SIN_ORDEN ── liberado ──> ENO ───────────►PREPARACION ── inizial ──► PRODUCIENDO
       ▲                  ▲                        ▲                     │
       │                  │                        │ fin de OT           │ PARADA apretada
       │                  │                        │ (sin runtime)      │ de una OT        dirigido
       │                  │                        │                     v
       │                  +────────────  OT terminada /          +---PARADA----+
       └──────── solicitud de la OT terminada ──                   │ (causa)
                                                                   v
                                            PRODUCIENDO <──CONTINUAM───┐
                                              │ falla                 │
                                              └──▶ MANTENIMIENTO ────termina mtto ─→ SIN_ORDEN/ENO
```

(equivalentemente: todo camino valido de estado)

### 15.3. Inspección de calidad

```
 PROGRAMADA ──(se veda tiempo ──> PENDIENTE
      │                            │
      │ abre inspector             │
      └──> EN_PROGRESO ── resultado ─┬──> CONFORME
                                     └──> NO_CONFORME ──dispara NC──> (bloqueo según RN-CAL-004)
 PENDIENTE ──supervisor/no ejecutado──> VENCIDA ────────────> (cola de supervisor)
 PROGRAMADA/PENDIENTE ── anula (superv) ──> ANULADA
```

### 15.4. Parada

```
      ABIERTA ──CONTINUAR──> CERRADA_NORMAL
        │  │ ──FIN/TZ--> CERRADA_AUTOMATICA_POR_FIN de la OT
        │  └─ (supervisor corrije/rea) -> CERRADA_POR_CORRECCION
        └── (superv) → ANULADA   [siempre auditado]
 (una parada activa por máquina: RN-PAR-003)
```

### 15.5. No Conformidad

```
 ABIERTA ── asigna responsable ──> ASIGNADA ── inicia tratamiento ──> EN_TRATAMIENTO ──> RESUELTA ──> CERRADA
   │          │                          │
   │          ├─┘ (solo supervisor/calidad con motivo) → RECHAZADA
   └─(motivo, con auditoría) → RECHAZADA
```

---

## 16. Casos excepcionales y cómo responder

| ID | Caso excepcional | Respuesta del sistema | Prioridad |
|---|---|---|---|
| **RN-EXC-001** | Doble sesión de un mismo operador (misma persona en dos máquinas) | Al abrir la segunda, la primera se cierra CIMIENTA un `SESION_REASIGNADA`, con alarma suave; si la segunda es no autorizada (segunda máquina en run), se bloquea y se notifica al supervisor | ALTA |
| **RN-EXC-002** | Lectura de contador no monotona (menor > la anterior) | Se rechaza la lectura y se alerta; se permite explicit go solo a supervisor/qué wind se registra como CONTRADICCION en auditoría | ALTA |
| **RN-EXC-003** | Lewis OPC/contado automático cae a la mit | El sistema usa la última lectura y computa el tiempo como RUN INTERRUPTED hasta reanudar; no genera horas falsas; al reparar, se recusa sumario de (retraso puntual) y cierre. Se alerta al supervisor | ALTA |
| **RN-EXC-004** | Parada abierta que se cruzó con el cambio de turno | La parada permanece ABIERTA, se **particiona** por el cambio según la carretera, y queda en la cola del turno que estará + aviso. | ALTA |
| **RN-EXC-005** | Operador sale del turno sin log-out y el runtime queda abierto | Timeout de sesión → la sesión se variácta (cierra), la OT sigue activa del lado de la máquina; el supervisor puede asociar la OT u asignar el siguiente turno | ALTA |
| **RN-EXC-006** | Se intenta ARRANCAR sin causa de parada siendo tipo de setup anterior | el sistema entonces crea automáticamente la parada `PREPARACION`/setup del periodo anterior entre el fin de OT y el nuevo inicio, y_terns/la*dentro del tiempo de setup: es una "transición limpia", ejemplo | MEDIA |
| **RN-EXC-007** | Piezas (metros) fuera del rango del lector serie OTOP? | Si el valor es **duvioso** el sistema marca `CON_VALIDAR` y lo deja en la cola de calidad, no para la OT | MEDIA |
| **RN-EXC-008** | NC generada cuando no hay responsable de calidad presente | La NC queda `ABIERTA` y el sistema la eleva al supervisor del área además de un persona; la OT no liberada se bloquea. Nadie necesita "descargar" en el MIT | ALTA |
| **RN-EXC-009** | La velocidad nominal «objetiva» </meta» supera enormemente | que el rendimiento >100% está permitido (RN-OEE); pero se registra velocidad real y est periodo punta para saber si la meta se debe recalibrar (no es un error) | MEDIA |
| **RN-EXC-010** | Una vez finalizada una OT y nota overshoot del contador automático > cambio de OT | ver RN-PRD-009: se crea una OT de "remantente" si la hay (supervisor) o se agrega producción algorítmica al siguiente OT con señal auditada (extend counter overflow) | ALTA |
| **RN-EXC-011** | Falla la red en el kiosco | Modo OFFLINE: operador guarda localmente (id, estado, contador); al volver, sincronización con idempotencia. Si hay conflicto de contador al regresar (los que el contador bloque de OPC.), lo resuelve el servidor con la última lectura válida y alerta 3columna al supervisor | ALTA |
| **RN-EXC-012** | Corrección del supervisor en una parada posterior al cierre de la OT | Se regenera en cascade KPI de la OT/día con versión y **marca de "dato corregido"** visible en reportes; nunca "elimina", solo re-corrección registrada | ALTA |
| **RN-EXC-013** | Un usuario borrado está la máquina que sigue variando (otra vuelta login) | la sesión "constano" del usuario en la máquina se le fuerza nueva sesión/verificación; se notifica a supervisor y auditoría | ALTA |
| **RN-EXC-014** | 2 OTs a la misma máquina en el mismo instante (force) | la asignación no es posible por RN-ORD-003; si el planificador fuerza "flex de overtide" no existe, el sistema lo bloquea y lnotifica; el supervisor podría pedirDisponibilidad de OT con bibliografía (auto) | NUESTRA |

---

## 17. Restricciones que nunca deben romperse

| ID | Restricción |
|---|---|
| **RN-RES-001** | **Nunca** se borran, editan o re-indexan eventos de producción, lecturas de contador o auditorías (immutable/append-only). |
| **RN-RES-002** | **Nunca** un operario crea/edita/libera OTs ni edita maestro o calidades. |
| **RN-RES-003** | **Nunca** un operario ejecuta acción sobre máquina/OT de aspecto que no le fue asignada. |
| **RN-RES-004** | **Nunca** dos runtime abiertos de la misma máquina simultáneamente. |
| **RN-RES-005** | **Nunca** dos paradas activas de la misma máquina en el mismo momento. |
| **RN-RES-006** | **Nunca** una OT se cierra (FINALIZAR) con parada activa — salvo cierre asistido/automático RN-PAR-005 con traza. |
| **RN-RES-007** | **Nunca** el contador vuelve atrás; una lectura decreciente es una marca de anomaly y requiere gestión excepcional (RN-PAR-004). |
| **RN-RES-008** | **Nunca** la hora/feja/turno provenga de un cliente; el servidor es mayoría de MEDIA. |
| **RN-RES-009** | **Nunca** un usuario cambia sus propios permisos o rol. |
| **RN-RES-010** | **Nunca** un evento de planta se salta la escritura de auditoría. |
| **RN-RES-011** | **Nunca** una parada/causa de falla se inventa o se reemplaza por otra sin traza (esp. en causas del.MI). |
| **RN-RES-012** | **Nunca** el estado visual de una máquina puede ser desmentido por el estado calculado (el UI refleja el estado del sistema, no del protocolo de usuario). |

---

## 18. Matriz completa de permisos por rol

**Rol (columna)** en lo lector: **Componente**:
`-` sin acceso · `R` leer · `C` crear · `E` editar · `X` ejecutar (operar) · `A` aprobar · `G` configurar (config/administ).  
Roles: **Operador ⦁ Calidad ⦁ Supervisor ⦁ Gerencia ⦁ Auditoria ⦁**

| Módulo (recurso:acción) | Operador | Calidad | Supervisor | Gerencia | Auditar | Admin |
|---|---|---|---|---|---|---|
| Órdenes: ver (propias/asignadas) | R (solo su máq.) | R | R | R | R | R |
| Órdenes: crear/editar | — | — | C/E | — | — | C/E |
| Órdenes: asignar/liberar turno/máquina | — | — | A | — | — | A |
| Órdenes: ver todas (planta) | — | R | R | R | R | R |
| Iniciar/reanudar producción | X | — | A | — | — | — |
| Finalizar OT / cierre (normal) | X | — | A (validación con umbre) | — | — | — |
| Paradas: registrar | X | — | X | — | — | — |
| Paradas: cerrar/corregir/reclasificar causa | — | R | X (sup.) | — | — | X (con alegríca) |
| Contador: leer (ingresar manual) | X | — | X | — | — | X |
| Defectos: registrar | X | X | A | — | — | — |
| Defectos: clasificar/conexión (ND) | — | A | A | — | — | — |
| Inspector: ver cola / estados | R (aviso) | R | R | — | R | R |
| Inspecciones: crear plan | — | G | —* | — | — | G |
| Inspecciones: ejecutar/completar | — | X | — | — | — | — |
| Inspecciones: ver resultados OT | R | R | R | R (agre) | R | R |
| NC: crear (desde inspección/def) | — | X | — | — | — | — |
| NC: tratamiento/estado | — | X/A | A | — | — | — |
| NC: cerrar | — | X | A (sup) | — | — | X |
| Mant.: solicitar (desde parada) | R (la parada) | — | X | — | — | — |
| Mant.: gestionar / programar | — | — | X/A | — | — | G |
| Máquinas/áreas: config | bajo config según | G (para su ) | — | — | — | G |
| Turnos/calendario: config | — | — | — | — | — | G |
| Productos/clientes: maestros | — | R | R | R | R | G |
| Usuarios: ver | — | — | R | — | R | R |
| Usuarios: crear/editar / roles | — | — | — | — | — | G |
| Dashboard tiempo real (superv.) | R (de su máq.) | R | X | R | R | R |
| Dashboard gerencial / reportes | — | R | R | X | R | R |
| Reprobación/Exportación | — | R | X | X | R | X |
| Reportes programados | — | — | X | X | R | X |
| Auditoría: consultar | — | — | — | — | X | X |
| Config. OEE / pérdidas / plans | R (su) | R | R | — | R | G |
| Cambiar su propio rol/permisos | — | — | — | — | — | — (nunca) |
| Config. notificaciones globales | — | — | R | R | — | G |

\* nota: en la matriz, los permisos de Inspección tienen "R" para ver y los planes los administra Calidad con G (adicional). En la primera versión y por seguridad, `Supervisor` puede ver planes pero la escritura queda en `Calidad` y `Admin`.

---

## 19. Eventos automáticos del sistema

> Acciones disparadas por el sistema **sin intervención del usuario** (modelo de negocio "proactivo").

| ID | Trigger | Acción automática |
|---|---|---|
| **RN-EVT-001** | Login validado (kiosk) | Registra sesión con usuario/hora/máquina/turno ; prellenar OT a su estado y muestra solo ops válidas de la máquina |
| **RN-EVT-002** | INICIAR producción | Abre runtime (cronómetro), crea `contador_inicial`, espera la lectura inicial, cambia máq→`PRODUCIENDO`, captura y cálculo en cola |
| **RN-EVT-003** | continuación de OPC | sistema lee el contador automáti si OPC; en manual pide un valor singular entre t |
| **RN-EVT-004** | Contenido de la lectura en el intervalo | actualiza contador/producción en el kiosco y en el tablero del supervisor; detecta inconsistencia (RN-PRD) |
| **RN-EVT-005** | parada registrada (PAó) | registra inicio (servidor), marca máquina `PARADA`, avalo al supervisor si la duración excede el umbral, y si causa=falla generasolic de manten (Mant) |
| **RN-EVT-006** | fin de parada (CONTINUAR) | cierra parada, calcula duración, vuelve máq PRODUCIENDO, recalc de los tiempos | 
| **RN-EVT-007** | FINALIZAR la OT | capacidad de final de contador, cierre prep, calcula producción/OEE/KPIs, OT→TERMINADA, notifica(external), resumen del turno si es fin |
| **RN-EVT-008** | reloj llega a un insdustrial en el plan de inspección | crea **inspección** y notifica al inspector (y/o a Calidad) para el orden de turno; el operador (solo aviso no bloqueante) |
| **RN-EVT-009** | inspección destiempo (VENCIDA) | la cumple la cola de supervisor y se marca; para el sistema no se desenvuelva silenciosamente |
| **RN-EVT-010** | resultado NO_CONFORME de la inspección | (a) crear NC (b) bloqueo de liberación de la OT (si impacta) (c) notificado |
| **RN-EVT-011** | registro de defecto | llenava datos contexto (máq., OT), estimpla scrap (via contador), aviso a Calidad para clasificar |
| **RN-EVT-012** | cambio de turno (cálculo) | hilo por turnos: cierre de turno con resumen automático; runtime seccionada; notifica Resumen/Report |
| **RN-EVT-013** | reconexión offline kiosco | sincroniza la cola local con idempotencia; si conflicto de dif => cola de conflicts del supervisor |
| **RN-EVT-014** | parada exterior (speed bajo el límite) | marca pérdida de rendimiento y la cuenta (no bloquea) + aviso supervisor |
| **RN-EVT-015** | no hay lector de contador inicio | pide primer (única) lectura en el momento más adecuado; avisa fallas consecutivas |
| **RN-EVT-016** | cálculo de MTTR/MTBF (fin de turno/día) | overnight computic de hosts y para el día; cuando una falla quedó abierta, se muestra NO-DISP |
| **RN-EVT-017** | rollup (OEE/Disp/RT/Q) disparado | recalcula rollups del período (turno/día/OT) a cascada siempre que hayan nuevos eventos con un sistema idempotente |
| **RN-EVT-018** | alerta sospecha (excepción dentro de la red) | genera warning (toast/al sur); queda alerta activa hasta que el supervisor la "confirma/descarta" con trazo. |

---

## 20. Validaciones obligatorias

| # | Validación | Cuándo se aplica | Prioridad |
|---|---|---|---|
| **RN-VAL-001** | El usuario está activo, con rol y con sesión válida | En **toda** llamatoria/operación | CRÍTICA |
| **RN-VAL-002** | Los parámetros de búsqueda de ejecución (p)e ; e: "acciónVibigatoria es que la OT pasante..." | check `RN-PRD-001` | CRÍTICA |
| **RN-VAL-003** | La máquina existe, está activa y (si la OP) asignada a ella | antes de start | CRÍTICA |
| **RN-VAL-004** | No existe runtime activo de esa máquina | antes de start | CRÍTICA |
| **RN-VAL-005** | No existe parada activa de esa máquina | antes de `START` y de `FINISH` | CRÍTICA |
| **RN-VAL-006** | Contar: lectura > última y con delta limite | cada contador (auto/manual) | CRÍTICA |
| **RN-VAL-007** | La longitud/configuración del plan de turno está vigente | para calcular turno/meta | ALTA |
| **RN-VAL-008** | la OT (para operar) pertenece a la máquina del usuario | operacion de kiosco | CRÍTICA |
| **RN-VAL-009** | El plan de inspección vigente para esta OT | generación de inspección | ALTA |
| **RN-VAL-010** | causa de parada existe y clasificación `PIERDA/UNPLANNED` es válida | al registrar/cerrar | ALTA |
| **RN-VAL-011** | NO EXISTE parada activa con la causa de fin (ya hay una a) | del registro de parada | CRÍTICA |
| **RN-VAL-012** | cuando se permitirá una inquietud u OT abstracta sea válida (no edición de cantidad) | edición de OTS | ALTA |
| **RN-VAL-013** | usuario del turno (¿pertenece al rol esperado?) y no otra sesión donde | runtime login | ALTA |
| **RN-VAL-014** | La inspección no está guardada con datos de OT que difiere | completa de inspección | ALTA |
| **RN-VAL-015** | Cada evento (ya enviados) pasa idempotencia (sin duplicar) | todos los eventos de plantilla | ALTA |
| **RN-VAL-016** | No se puede crear una segunda NC para el mismismo caso en una misma OT se integra (acumular) | NC (vive) | MEDIA |
| **RN-VAL-017** | El estado del pedido no se cambia por una acción no permitida de rota | firma (transiciones) | CRÍTICA |
| **RN-VAL-018** | Antes de cerrar el día/turno: no hay runtimes abiertos con más de X (rollover candidato) — se marca en la cola | al cierre de turno | ALTA |

---

*Fin del documento Reglas de Negocio v1.0.*

> Sobre las transición de los estados (ID 15) validad: los cambios que se pueden hacer paso a paso están, y respeta los punto (P) de validación de la matriz de RN-VAL. Cualquier regla con `(P)` en prioridad da guard del objeto en el modelo dominio.