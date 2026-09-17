# Neon

Proyecto: `nameless-salad-98358301` (eu-west-2, Postgres 18). Política en `neon.ts`. Skills en `.agents/skills/neon*`. MCP: `.cursor/mcp.json` → `https://mcp.neon.tech/mcp`.

Local sigue en SQLite (`file:./dev.db`). La URL de production vive en `.env.neon.production` (gitignorado, modo `600`). No la copies al `.env` del Cloud Agent ni al grupo Preview de Vercel.

Comprobado contra el pooler: usuario `neondb_owner`, base `neondb`, esquema `public` vacío (solo `plpgsql`). `neon inspect db table-sizes --db-url` y un `SELECT` de catálogo responden. No se ha corrido `prisma migrate` ni seed contra esta rama.

Esta región no tiene Object Storage / Functions / AI Gateway (solo `aws-us-east-2`, `aws-us-east-1`, `aws-eu-central-1`, `aws-ap-southeast-1`). `neon.ts` se queda en `defineConfig({})`.

## URLs

En `.env.neon.production`:

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Pooler, tal cual la console (`sslmode=require&channel_binding=require`) |
| `DATABASE_URL_POOLED` | Misma host pooler, `sslmode=require` (Prisma / node-pg) |
| `DATABASE_URL_UNPOOLED` | Host sin `-pooler`, para `prisma migrate` |

Vercel Production: `DATABASE_URL` = pooled. Preview: otra rama, otra URL.

## CLI (link / deploy)

Hace falta `neon login` en el portátil o `NEON_API_KEY`. La URL de Postgres no autentica el API:

```bash
npm i -g neon@latest
neon login
neon link --project-id nameless-salad-98358301 --branch production -y --no-env-pull
neon deploy --no-env-pull
neon checkout pre --create --no-env-pull
neon env pull --file .env.neon.pre
```

`--no-env-pull` no pisa el SQLite local.

## Comprobar la base (sin API)

```bash
set -a && source .env.neon.production && set +a
neon inspect db table-sizes --db-url "$DATABASE_URL_POOLED"
```
