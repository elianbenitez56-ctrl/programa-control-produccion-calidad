# SIGPC — Arquitectura de Software del Proyecto (Fase 1)

**Versión:** 1.0 · **Estado:** Para aprobación · **Autor:** Tech Lead Senior

> Estructura base del monorepo: backend (FastAPI + Clean Architecture), frontend (React/TS), infraestructura (Docker), calidad (tests, CI/CD).
>
> **No contiene módulos funcionales.** Define convenciones, dependencias, configuración, seguridad, errores, autenticación, permisos, i18n, temas y estrategia de pruebas. Los módulos se desarrollarán en el orden aprobado (1 Autenticación → 13 Integraciones), cada uno completo, probado y documentado antes de avanzar.
>
> **Referencias:** reglas de negocio → `docs/reglas-de-negocio.md` · modelo de datos → `docs/modelo-base-de-datos.md` (congelados).

---

## 0. Principios de implementación

1. **Clean Architecture estricta**: `interfaces → application → domain`; el dominio no importa FastAPI, SQLAlchemy ni Pydantic. Dependencias siempre hacia adentro.
2. **Código completo, nunca esqueletos**: cada módulo se entrega funcional, con tests, migración (si toca esquema) y documentación. Sin datos ficticios (los seeds solo cargan catálogos reales definidos en el análisis).
3. **Convenciones verificadas por máquina**: ruff + mypy (backend), ESLint + tsc (frontend) en CI; sin excepciones silenciosas.
4. **El modelo de datos es la autoridad**: cualquier cambio de esquema pasa por migración Alembic y se refleja en `docs/modelo-base-de-datos.md`.
5. **Multi-tenant desde el inicio**: `planta_id` en todas las capas (decisión DB-02); RLS se habilitará en versión futura.
6. **Errores con código y sin detalles internos**: el cliente recibe `{code, message, details, request_id}` internacionalizable.
7. **Todo se audita**: cada caso de uso que muta estado escribe en `bitacora` (RN-AUD-001).

---

## 1. Árbol de carpetas

```
sigpc/
├── README.md
├── docker-compose.yml              # infra local: db, redis, api, frontend
├── .env.example                    # variables raíz (compose)
├── Makefile                        # atajos: make dev, test, lint, migrate
├── .github/
│   └── workflows/
│       ├── ci-backend.yml
│       ├── ci-frontend.yml
│       └── cd-deploy.yml
├── docs/                           # documentación del proyecto
│
├── backend/
│   ├── pyproject.toml              # dependencias, ruff, mypy, pytest config
│   ├── alembic.ini
│   ├── Dockerfile
│   ├── .env.example
│   ├── app/
│   │   ├── main.py                 # factory de la app (crear_app)
│   │   ├── core/                   # ── CAPA INFRA/FRAMEWORK (sin lógica de negocio)
│   │   │   ├── config.py           # pydantic-settings por ambiente
│   │   │   ├── database.py         # engine asíncrono, sesión, RLS hooks
│   │   │   ├── redis.py            # cliente redis + pub/sub
│   │   │   ├── logging.py          # structlog configurado
│   │   │   ├── security.py         # JWT, argon2, firmas
│   │   │   ├── exceptions.py       # jerarquía de errores de dominio/api
│   │   │   ├── i18n.py             # catálogo de mensajes por código (es/en)
│   │   │   └── deps.py             # dependencias: DB, auth, permisos, request-id
│   │   ├── domain/                 # ── DOMINIO PURO (sin import de infra)
│   │   │   ├── entities/           # entidades por módulo (op, runtime, parada...)
│   │   │   ├── value_objects/      # contador, turno, especificacion, etc.
│   │   │   ├── services/           # motor OEE, cálculo de tiempos, MTBF/MTTR
│   │   │   └── rules/              # validación de reglas RN (puras)
│   │   ├── application/            # ── CASOS DE USO + PUERTOS
│   │   │   ├── ports/              # interfaces: repos, idempotencia, notificaciones
│   │   │   ├── use_cases/          # un caso de uso por operación del dominio
│   │   │   ├── dtos/               # contratos de entrada/salida de casos de uso
│   │   │   └── events/             # event bus en memoria (base para integraciones)
│   │   ├── infrastructure/         # ── ADAPTADORES
│   │   │   ├── orm/                # modelos SQLAlchemy (espejo fiel del ER congelado)
│   │   │   │   ├── identidad/ configuracion/ produccion/ calidad/ mantenimiento/
│   │   │   │   ├── notificaciones/ analitica/ auditoria/
│   │   │   ├── repositories/       # implementaciones de puertos
│   │   │   ├── idempotency/        # guard de idempotencia (RN-GEN-004)
│   │   │   └── adapters/           # opc_ua.py, rfid.py, storage_fotos.py, smtp.py
│   │   └── interfaces/             # ── API (transporte)
│   │       ├── api/
│   │       │   ├── v1/
│   │       │   │   ├── routers/    # un router por módulo (auth, usuarios, maquinas...)
│   │       │   │   ├── schemas/    # Pydantic de entrada/salida
│   │       │   │   └── deps.py     # permisos por ruta
│   │       │   └── errors.py       # handlers de excepción → respuestas estándar
│   │       └── websockets/         # ws_machines.py, ws_notifications.py
│   ├── migrations/                 # Alembic: versions/ (esquema), data/ (seed)
│   └── tests/
│       ├── unit/                   # dominio puro (OEE, reglas) — sin IO
│       ├── integration/            # repos + casos de uso contra PostgreSQL real
│       ├── api/                    # contratos HTTP completos
│       ├── factories.py            # builders de entidades para tests
│       └── conftest.py             # app de test, DB aislada, auth de test
│
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    ├── .env.example
    ├── Dockerfile
    ├── components.json              # config shadcn/ui
    ├── src/
    │   ├── main.tsx
    │   ├── app/                     # bootstrap: providers, router, layout shell
    │   │   ├── router.tsx           # rutas + guards por rol
    │   │   ├── providers.tsx        # Query, Auth, Theme, I18n, Toaster
    │   │   └── layouts/             # kiosk.layout, app.layout, admin.layout
    │   ├── components/
    │   │   ├── ui/                  # shadcn/ui generados (button, dialog, ...)
    │   │   └── common/              # page-header, status-badge, empty-state...
    │   ├── features/                # UN DIRECTORIO POR MÓDULO (1:1 con el orden de desarrollo)
    │   │   ├── auth/                # api.ts, hooks.ts, store.ts, schemas.ts, pages/, components/
    │   │   ├── usuarios/  roles/  catalogos/  plantas/  maquinas/  turnos/
    │   │   ├── ordenes/  produccion/  paradas/  calidad/
    │   │   ├── dashboards/  reportes/  integraciones/
    │   │   └── common/              # kiosk ui compartido
    │   ├── lib/                     # http.ts (axios+JWT+refresh), error-mapper.ts,
    │   │   │                        # query-client.ts, formatters.ts, ws.ts
    │   ├── stores/                  # zustand: auth.store, theme.store, locale.store, kiosk.store
    │   ├── hooks/                   # useDebounce, useMachineState, useCountdown...
    │   ├── locales/                 # es/ en/ (i18next resources)
    │   ├── styles/                  # tailwind.css, tokens
    │   ├── types/                   # DTO globales
    │   └── test/                    # vitest setup + helpers
```

**Regla de estructura:** el frontend y el backend usan el **mismo orden de módulos** (features 1:1), y cada feature backend = `domain + use_case + port + repository + router`. Un módulo nuevo no requiere tocar código de otros.

---

## 2. Convenciones

| Tema | Convención |
|---|---|
| **Ramas** | `main` (producción) · `develop` (integración) · `feature/<modulo>-<tema>` · hotfix de `main`. PR obligatorio con CI verde. |
| **Commits** | Conventional Commits: `feat(autenticacion): login por RFID`, `fix(paradas): ...`, `test(...)`, `docs(...)`, `chore(...)` |
| **Backend** | Python 3.12 · `snake_case` · type hints en todo el código público · docstrings solo donde aportan; los nombres de tablas/columnas siguen `docs/modelo-base-de-datos.md` §1. |
| **Frontend** | TypeScript estricto · `camelCase` variables, `PascalCase` componentes · imports con alias `@/` · sin `any` (salvo contrato externo documentado) · componentes de feature nombrados `<Modulo><Vista><Elemento>` |
| **Versiones** | Backend `0.x.y` hasta V1; esquema de BD versionado aparte (v1.x, congelado) |
| **Errores** | Siempre vía jerarquía central de excepciones; prohibido `print`, `assert` en producción, `except: pass` |
| **Secrets** | Jamás en código: solo variables de entorno; `.env*` en `.gitignore`; secrets de staging/prod en el secreto store del CI |
| **Documentación** | Cada módulo entrega su sección en `docs/modulos/<modulo>.md` (qué hace, reglas RN que implementa, endpoints, decisiones) |

---

## 3. Dependencias

### 3.1. Backend (pyproject.toml)

| Paquete | Versión | Rol |
|---|---|---|
| fastapi | 0.115.x | Framework HTTP |
| uvicorn[standard] | 0.30.x | Servidor ASGI |
| pydantic / pydantic-settings | 2.x | Validación + configuración por ambiente |
| sqlalchemy[asyncio] | 2.0.x | ORM async (modelos espejo del ER congelado) |
| asyncpg | 0.29.x | Driver PostgreSQL async |
| alembic | 1.13.x | Migraciones (única fuente del esquema) |
| pyjwt | 2.9.x | JWT access/refresh |
| argon2-cffi | 23.x | Hash de PIN y contraseñas (Argon2id) |
| structlog | 24.x | Logging estructurado (JSON) |
| redis | 5.x | Pub/sub para WebSockets y caché |
| websockets | 12.x | Cliente WS del servidor |
| httpx | 0.27.x | Cliente HTTP (integraciones, tests) |
| python-multipart | 0.0.9+ | Formularios (fotos) |

**Dev:** `pytest`, `pytest-asyncio`, `pytest-cov`, `respx`, `factory-boy`, `ruff`, `mypy`, `testcontainers[postgres]` (o perfil compose de tests).

### 3.2. Frontend (package.json)

| Paquete | Versión | Rol |
|---|---|---|
| react / react-dom | 18.3.x | UI |
| typescript | 5.5.x | Tipado |
| vite + @vitejs/plugin-react | 5.x / 4.x | Build |
| tailwindcss | 3.4.x | CSS (con tokens shadcn) |
| class-variance-authority / clsx / tailwind-merge | — | Variantes shadcn |
| shadcn/ui (componentes) | — | Biblioteca de componentes base |
| lucide-react | — | Iconos |
| react-router-dom | 6.26.x | Routing con guards por rol |
| @tanstack/react-query | 5.x | Server state (caché/refetch/realtime) |
| zustand | 5.x | Client state (auth, theme, locale, kiosk) |
| react-hook-form + @hookform/resolvers | 7.x | Formularios |
| zod | 3.23.x | Schemas (1:1 con Pydantic) |
| i18next + react-i18next | 23.x / 14.x | Internacionalización |
| axios | 1.7.x | Cliente HTTP con interceptores |
| sonner | — | Toasts |
| recharts | 2.12.x | Gráficos (dashboards) |

**Dev:** `vitest`, `@testing-library/react`, `jsdom`, `eslint` (typescript-eslint), `prettier`, `playwright` (E2E, fase dashboard).

---

## 4. Configuración por ambientes

### 4.1. Modelo

- `pydantic-settings` con clases: `AppSettings`, `DatabaseSettings`, `RedisSettings`, `SecuritySettings`, `CorsSettings`, `LoggingSettings`, `StorageSettings`.
- Variables cargadas de `.env` (dev) o del entorno (staging/prod). Se valida al arrancar: falla rápida si falta `JWT_SECRET`, `DATABASE_URL` o si `ENVIRONMENT=prod` y `DEBUG=true`.
- **Ambientes:** `dev` (auto-reload, SQL echo, CORS local) · `staging` (réplica de prod, datos de catálogo) · `prod` (sin debug, headers de seguridad estrictos).

### 4.2. Variables de entorno backend (`.env.example`)

```
ENVIRONMENT=dev                 # dev | staging | prod
DEBUG=false
API_V1_PREFIX=/api/v1
DATABASE_URL=postgresql+asyncpg://sigpc:sigpc@db:5432/sigpc
REDIS_URL=redis://redis:6379/0
JWT_SECRET=CHANGE_ME
JWT_ALGORITHM=HS256
JWT_ACCESS_EXPIRE_MINUTES=15
JWT_REFRESH_EXPIRE_DAYS=7
CORS_ORIGINS=http://localhost:5173
LOG_LEVEL=INFO
LOG_FORMAT=json               # json | console
STORAGE_FOTOS_URL=s3://fotos-local/bucket
SMTP_URL=  # para notificaciones (futuro módulo)
KIOSK_HEADER=X-Kiosk-Id
```

### 4.3. Variables frontend (`.env.example`)

```
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000
VITE_DEFAULT_LOCALE=es
VITE_DEFAULT_THEME=dark-industrial
```

### 4.4. Inyección de dependencias

`core/deps.py` expone: `get_db` (sesión por request), `get_current_user` (JWT → usuario), `require_permission(recurso:accion)`, `get_request_id`, `get_kiosk` (header de kiosko). Los casos de uso reciben **puertos** (interfaces), nunca sesiones de ORM directamente.

---

## 5. Docker y Docker Compose

### 5.1. Dockerfile backend

- **Multi-stage:** `python:3.12-slim` → build (instala deps, corre ruff/mypy/pytest como gate opcional) → runtime con usuario no-root, `--prestart.sh` que ejecuta `alembic upgrade head` y arranca uvicorn.

### 5.2. Dockerfile frontend

- **Multi-stage:** node:20-alpine build → `nginx:alpine` sirviendo `dist/` con SPA fallback y headers de seguridad.

### 5.3. docker-compose.yml (dev)

```yaml
services:
  db:        # postgres:16-alpine, healthcheck pg_isready, volumen pgdata, init script de particiones
  redis:     # redis:7-alpine
  api:       # backend, ports 8000, depends_on healthy(db, redis), env_file .env
  frontend:  # vite dev server (ports 5173) o nginx (prod)
  test-db:   # postgres:16 dedicado a pytest (ci)
```

- `make dev` levanta todo; `make test` corre tests contra `test-db`; `make migrate` aplica migraciones.
- **Producción:** mismo compose con perfiles `prod` (nginx + red interna, sin puertos expuestos al host salvo 80/443), backups del volumen y rotación de logs vía driver.

---

## 6. Logging

- **structlog** con procesadores: timestamp UTC ISO, nivel, servicio (`sigpc-api`), `request_id` (middleware), `user_id`, `planta_id`, `module`.
- **Formato:** `json` en prod/staging (parsable por Loki/ELK), `console` color en dev.
- **Niveles:** `INFO` por defecto; `DEBUG` solo dev; `WARNING/ERROR` con stack en eventos_sistema (nunca en respuesta HTTP).
- **Reglas:** los errores controlados se logean a `INFO` (son esperados); los no controlados a `ERROR` con `request_id`; prohibido loguear PINs, tokens ni datos personales.
- Los eventos de negocio **no** van al log: van a `bitacora`/`eventos_produccion` (RN-AUD-001).

---

## 7. Seguridad

| Área | Estrategia |
|---|---|
| **Contraseñas/PIN** | Argon2id (nunca reversibles); PIN solo 4–6 dígitos pero con Argon2 + costo alto + rate-limit de intentos por usuario/máquina. |
| **JWT** | Access 15 min (claims: `sub`, `planta_id`, `permisos`, `exp`, `iat`, `jti`) + Refresh rotativo de 7 días, guardado **hasheado** en `sesiones_autenticacion`; revocación por `jti`. |
| **RFID/QR** | El tag/QR identifica al usuario (no autentica por sí solo): tras el scan se abre sesión con método registrado; `kiosko token` en header identifica la máquina; intentos fallidos → lockout temporal + bitácora. |
| **RBAC** | Permisos de `rol_permisos` cargados en el claim; `require_permission` valida **en el servidor** por ruta (RN-PRM-008). |
| **Rate limiting** | Middleware: límites por IP/endpoint (login más estricto: 5/min). |
| **Headers** | CORS con `CORS_ORIGINS`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options: DENY`, CSP en el nginx del frontend. |
| **Input** | Pydantic estricto (`extra=forbid` en schemas de entrada), límites de tamaño en uploads (fotos ≤ 5 MB, formatos fijos). |
| **Auditoría** | Toda mutación escribe `bitacora`; eventos de planta en `eventos_produccion` (inmutables). |
| **Operación** | Corre como usuario no-root; secretos solo por entorno; migraciones con usuario con menos privilegios en prod. |

---

## 8. Manejo de errores

### 8.1. Jerarquía

- `DomainError` (base, con `code`) → `BusinessRuleError` (violación RN, HTTP 422/409), `EntityNotFoundError` (404), `StateTransitionError` (409), `PermissionDeniedError` (403), `AuthenticationError` (401), `ConflictError` (409), `IdempotencyError` (409/208).
- `ApiError` para transporte (400 validación de contrato, 404 ruta).

### 8.2. Respuesta estándar

```json
{ "error": { "code": "PARADA_ABIERTA", "message": "Existe una parada activa en la máquina", "details": {}, "request_id": "..." } }
```

- `code` es la clave i18n (el cliente traduce; el backend devuelve el mensaje en el idioma del `Accept-Language` para depuración).
- Los 500 nunca revelan stack ni internals; se logean con `request_id`.
- Handlers registrados en `app` para `DomainError`, `RequestValidationError` (Pydantic → code `VALIDACION`), `HTTPException` y `Exception`.

---

## 9. Autenticación (diseño del módulo base)

- **Endpoints:** `POST /auth/login` (métodos `password | pin | qr | rfid` + `kiosko_id` opcional), `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`.
- **Flujo kiosko:** el kiosko envía `X-Kiosk-Id` → el servidor identifica máquina/turno → valida credencial → crea `sesiones_autenticacion` + **`sesiones_operario`** (usuario, hora, máquina, turno deducido — RN-OPE-001) → responde token + contexto de máquina.
- **Reglas aplicadas:** 1 sesión operativa activa por usuario y por máquina (índices parciales únicos del modelo); conflicto → se reasigna con bitácora (RN-EXC-001); cierre por `logout|timeout|cambio_maquina|fin_turno|reemplazo`.
- **WebSockets:** autenticación por token en el primer frame; suscripción limitada por rol.

## 10. Permisos

- Seed del módulo: roles estándar + permisos según **matriz RN §18** (se carga en migración de datos, `migrations/data/`).
- Helper `require_permission("maquinas:ver")` como dependencia de FastAPI; el claim de permisos se revalida contra BD en mutaciones críticas (evita revocación diferida).
- UI: hook `usePermission()` solo para ocultar; **nunca** como control de seguridad.

---

## 11. Internacionalización

- **Backend:** mensajes por `code` en `core/i18n.py` (es/en); selección por `Accept-Language`, default de la planta.
- **Frontend:** i18next + react-i18next; namespaces por feature (`auth`, `paradas`, `comun`); locale persistido en `locale.store` (default: config de la planta).
- **Convención:** todo texto visible es una clave i18n; fechas/números con `Intl` según locale; los `code` de error del backend se traducen con namespace `errores`.

## 12. Sistema de temas

- Tokens **CSS variables** shadcn (background, foreground, primary, accent...) con dos temas: `dark-industrial` (default, estética MES: grises oscuros + acento cian/verde) y `light`.
- `theme.store` (zustand) persistido; el color de acento por planta puede sobreescribir los tokens (`planta.accent`) vía configuración.
- Los estados de máquina usan colores del catálogo `colores` referenciado por `estados` (nunca hardcodeados en la UI).

---

## 13. Estrategia de pruebas

| Nivel | Herramienta | Qué cubre | Gate CI |
|---|---|---|---|
| **Unit (dominio)** | pytest | Reglas RN puras: OEE (RN-OEE-001..009), máquina (transiciones), tiempos de parada/turno, validaciones de contador, cálculo MTBF/MTTR | sí |
| **Integration (repos+UC)** | pytest-asyncio + PostgreSQL real (compose `test-db` o testcontainers) | Persistencia fiel al ER, idempotencia, invariantes (1 runtime/1 parada/1 sesión), rollups | sí |
| **API** | httpx ASGITransport + DB aislada por test | Contratos HTTP, códigos de error estándar, RBAC por endpoint, i18n | sí |
| **E2E frontend** | Vitest + Testing Library (componentes/hooks) | Features críticas del kiosko y guards de rutas | sí |
| **E2E completo** | Playwright (fase dashboards) | Flujos operario/supervisor completos | staging |

- **Fixtures:** `tests/factories.py` (factory-boy) construye entidades válidas; **sin datos ficticios en código de producción**.
- **Cobertura:** objetivo ≥ 80 % en dominio/application; 100 % en reglas críticas (OEE, transiciones).
- **Aislamiento:** cada test corre sobre schema limpio (truncate por fixture); transacciones por test.

## 14. CI/CD recomendado

### CI (GitHub Actions, en cada PR)
1. **ci-backend:** ruff check + ruff format --check + mypy → pytest (con servicio postgres del runner) → build imagen Docker.
2. **ci-frontend:** eslint + tsc --noEmit → vitest → vite build.
3. **Reglas:** PR no mergea sin CI verde y cobertura mínima; renovate para dependencias.

### CD (por tag `v*`)
1. Build + push imágenes a GHCR.
2. **Staging:** deploy automático del tag → `alembic upgrade head` (prestart) → smoke tests (login + health).
3. **Producción:** deploy manual aprobado; estrategia de migración según §15/16 de `modelo-base-de-datos.md` (expand/contract, zero-downtime).

### Salud
- `/health` (liveness) y `/health/ready` (DB, Redis) expuestos; Prometheus en fase reportes.

---

## 15. Orden de desarrollo (congelado)

Cada módulo: **backend completo (dominio→UC→repos→API→tests) → migración si aplica → frontend completo → documentación `docs/modulos/<modulo>.md`** → aprobación antes de pasar al siguiente.

1. Autenticación (login password/PIN/QR/RFID, refresh, sesión operaria, kiosko)
2. Usuarios y Roles (usuarios, roles, permisos, matriz RN §18, auditoría de cambios)
3. Catálogos (estados, causas, defectos, scrap, alarmas, prioridades, unidades, colores)
4. Plantas (CRUD, configuraciones_sistema)
5. Máquinas (áreas, máquinas, kioskos, estado derivado)
6. Turnos (turnos, turnos_dias, excepciones, deducción del turno vigente)
7. Órdenes de Producción (OP + asignación + estados)
8. Producción (runtime, contadores, eventos, cierre con KPIs)
9. Paradas (causas, cierre, clasificación, alertas)
10. Calidad (planes, inspecciones, defectos, NC, acciones correctivas, scrap)
11. Dashboards (supervisor tiempo real, gerencial)
12. Reportes (exportaciones, programados)
13. Integraciones (OPC-UA, ERP, notificaciones externas)

---

## 16. Decisiones pendientes de tu aprobación (solo para arrancar el código)

| # | Decisión | Opción recomendada |
|---|---|---|
| E-1 | **Python 3.12 + Node 20 LTS** como runtimes | sí |
| E-2 | **PyJWT + Argon2id** (en vez de python-jose/bcrypt) | sí |
| E-3 | **Axios con refresh automático** como cliente HTTP del frontend | sí |
| E-4 | **Tailwind 3.4 + shadcn/ui clásico** (compatible con el flujo actual de shadcn) | sí |
| E-5 | **Rate limiting** con middleware propio (sin dependencia externa pesada) | sí |
| E-6 | Estructura de features: **un directorio por módulo** en frontend y backend (1:1) | sí |
| E-7 | Idioma de interfaces y documentación: **español** (claves i18n en es/en) | sí |
| E-8 | Repositorio: **monorepo con carpeta `docs/`** dentro (como está) | sí |

---

*Fin de la Arquitectura de Software Fase 1. Aprobada, se inicia el **Módulo 1: Autenticación** (backend completo + tests + migración + frontend + documentación).*
