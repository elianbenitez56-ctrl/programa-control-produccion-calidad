# SIGPC — Guía del repositorio

Sistema Integral de Gestión de Producción y Calidad. No es repo git. UI y documentación en español (escribir textos nuevos en español).

Layout del proyecto:
- `backend/` — API FastAPI (Python 3.12) + dominio DDD.
- `frontend/` — SPA Vite + React 18 + TypeScript + Tailwind 3.
- `docs/` — specs normativas (arquitectura, modelo de datos, módulos). Son fuente de verdad de diseño.
- `DISEÑO SCPC/` — referencia visual del sistema de diseño "Industrial Excellence": `DESIGN.md` (tokens) y `code.html` (mock). No tocar; consultar para estilo.

## Frontend (`frontend/`)
- Comandos: `npm run dev` (vite, puerto 5173, `host: true`), `npm run build` (= `tsc -b && vite build`, ~1m40s), `npm run lint` (eslint). **No hay tests**; `npm run build` es la puerta de verificación (tsc con noUnusedLocals falla por variables sin usar).
- El warning de chunk >500 kB (recharts/jspdf) es esperado, no bloquea.
- API: `VITE_API_BASE_URL` (default `http://localhost:8000/api/v1`). El login/restauración depende del backend: `/auth/me` valida `sigpc.access_token`, y si falla limpia tokens y redirige a `/login`.

### Design system (importante)
- `darkMode: ["class"]`. **Todos los colores vienen de variables HSL definidas en `src/index.css`** y mapeadas en `tailwind.config.js` (`colors`, más `sidebar` y `chart.1..5`). Para cambiar un color toca `:root` + `.dark` de index.css; no hardcodear hex en componentes.
- Paleta integrada con el diseño Stitch (`stitch_inapel_mes_industrial_dashboard/`, REFERENCIA VISUAL): primary navy profundo `hsl(234 93% 16%)` (#030b4f), secondary azul `hsl(209 100% 36%)` (#005db6), superficies azul-claro `hsl(229 100% 99%)`, borders `hsl(245 11% 80%)`. El naranja `warning` se conserva como color semántico de alerta; la marca es **INAPEL** (Componente `Brand`). Botón primario `default` = **navy** (`bg-primary`), `secondary` = azul suave. `--radius: 0.5rem` (8px), sidebar colapsable 260px/80px; rail con tooltips. Tipografía Inter (match Stitch).
- Convenciones aprobadas del rediseño: mantener `lucide-react` (los iconos Material Symbols de Stitch se mapean a lucide), los 8 KPIs y 7 gráficas actuales. No consumir CDN de Stitch en runtime.
- Tipografía vía `fontSize` en el config: las clases válidas son `text-headline-lg`, `text-title-md`, `text-label-lg`… el prefijo es `text-`; **`font-headline-lg` etc. NO existen**. Tailwind ignora clases inválidas en silencio y `npm run build` igual pasa (tsc no las ve). Si dudas, verifica que la clase exista en el CSS generado (`dist/assets/*.css`).

### No modificar
`App.tsx` (rutas), `AuthContext`, `ThemeContext`, `lib/api.ts` (axios + refresh), `lib/captura`, `lib/cierre*`, `config/captura.ts`, `formatters`, `utils`, `data/demo.ts` (datos demo), y `pages/modules/*`. Componentes de UI en `components/ui` estilo shadcn (cva + tailwind-merge). Captura de turno = `captura/`; PDF de cierre editado en `lib/cierrePdf.ts` (usa `qrcode`, jsPDF).

## Backend (`backend/`)

- Arranque: activar `.venv` y `uvicorn app.main:app --reload` (FastAPI en 8000, docs en `/docs`). Env vars en `.env` (ver `.env.example`; Postgres local en puerto 5433).
- Layout DDD: `app/{api,application,core,domain,infrastructure}`; errors estándar `{"error":{code,message,details,request_id}}`.
- Migraciones con Alembic (`migrations/`).
- Calidad: `ruff check .` (line-length 100) y `mypy` (strict, plugin pydantic). Tests: `pytest` (`tests/unit|integration`); las de integración están marcadas `integration` y requieren `TEST_DATABASE_URL` (Postgres). asyncio_mode auto.