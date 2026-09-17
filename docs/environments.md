# Local, pre y producción

El código es el mismo. Cambian los secretos. Así un agente o un preview no toca la campaña real.

```
local  → tu máquina / Cloud Agent (SQLite, AUTH_MODE=local)
pre    → Vercel Preview o https://pre… (Postgres + Auth0 de ensayo)
prod   → Vercel Production (Postgres + Auth0 + Resend reales)
```

La superficie **pública** no es otro deploy: es `/firmar/[token]` (el talento no tiene cuenta) y `/api/salud` (comprobación sin sesión). El resto de rutas piden invitación.

## Cómo se decide el entorno

1. `APP_ENV=local|pre|prod` si está puesta.
2. Si no: `VERCEL_ENV=production` → prod, `preview` → pre.
3. Si no: local.

`npm run check:env` imprime el informe. En pre/prod (o con `--strict`) falla si el combo es inseguro.

Al arrancar, `src/instrumentation.ts` corta pre/prod si:

- `AUTH_MODE=local`
- la base no es `postgresql://`
- faltan las cuatro variables de Auth0
- no hay `APP_BASE_URL` (en prod, HTTPS)

Local no se corta: este repo sigue siendo usable con SQLite.

## Vercel

Tres grupos de variables, **sin copiar prod a Preview**:

| Grupo | Plantilla | Notas |
| --- | --- | --- |
| Development | `.env.example` | `APP_ENV=local` |
| Preview | `.env.pre.example` | Auth0 **dev**, Postgres/Neon de pre |
| Production | `.env.prod.example` | Auth0 **prod**, Postgres de prod |

Una Application de Auth0 por hostname:

- Pre: callback `https://pre.tu-dominio/auth/callback` (y `*.vercel.app` del preview)
- Prod: callback `https://app.tu-dominio/auth/callback`

No reutilices Client Secret. Un tenant `*-dev` y otro de prod es lo más limpio.

## Postgres

Local: `file:./dev.db`. Pre/prod: Neon (proyecto `nameless-salad-98358301`) o `docker compose up -d db`.

El CLI de Neon y `neon.ts` viven en este repo. La URL de production ya está en `.env.neon.production` (gitignorado; la base está vacía). El Cloud Agent **no** abre el navegador de Álvaro: `neon link` / `neon deploy` / crear la rama `pre` piden `neon login` en el portátil o `NEON_API_KEY`. Después:

```bash
neon link --project-id nameless-salad-98358301 --branch production -y --no-env-pull
neon deploy --no-env-pull
neon env pull --file .env.neon.production
```

`--no-env-pull` evita pisar el `DATABASE_URL` de SQLite en `.env`. La URL de Neon va a un fichero aparte (gitignorado) y a las variables de Vercel. Detalle en [neon.md](neon.md).

Neon con branch por preview es el hueco bueno para vibe coding: cada PR rompe su copia, no Higgsfield. El `provider` de Prisma en este repo sigue en `sqlite` para no tumbar el desarrollo. Antes de la primera campaña en pre, cambia a `postgresql` y regenera migraciones como indica [production.md](production.md).

## Correo

En pre, el asunto sale con `[PRE] ` para no confundirlo con un envío real. Usa otro `MAIL_FROM` o deja `RESEND_API_KEY` vacía.

## Semilla

`prisma db seed` está prohibido en prod salvo `ALLOW_PROD_SEED=1`. No lo pongas en Vercel Production.

## Cursor / vibe coding

El Cloud Agent usa el entorno **local** (`.cursor/environment.json`). No le pases `DATABASE_URL` ni `AUTH0_CLIENT_SECRET` de prod. Trabaja en rama: el Preview de Vercel es la pre automática.

## Comprobar

- `/estado` (sesión): entorno, base, semilla, avisos.
- `GET /api/salud` (público): `{ env, database, ok }`.
- Banner ámbar solo en pre.
