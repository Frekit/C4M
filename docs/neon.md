# Neon

Proyecto **Firebit Agentic** (`nameless-salad-98358301`), org `org-empty-math-44187506`, región `aws-eu-west-2`, Postgres 18. El directorio está enlazado: `.neon` apunta a la rama `production`. `neon.ts` es `defineConfig({})` y `neon deploy` no cambió nada (solo Postgres).

| Rama | Id | Uso | Fichero local (gitignorado) |
| --- | --- | --- | --- |
| `production` | `br-rough-star-za0l7kqw` | Vercel Production | `.env.neon.production` |
| `pre` | `br-patient-credit-zaa91hu5` | Preview / ensayo | `.env.neon.pre` |

Local sigue en SQLite (`file:./dev.db`). Esas URLs no van al `.env` del Cloud Agent.

`public` está vacío: no se ha corrido `prisma migrate` ni seed. Esta región no tiene Object Storage / Functions / AI Gateway.

## CLI

El perfil `local` del CLI guarda la API key en `~/.config/neon` (fuera del repo). En esta VM también está `NEON_API_KEY` en `.env.neon.production`.

```bash
export NEON_API_KEY=…   # o neon profile + NEON_PROFILE=local
neon link --project-id nameless-salad-98358301 --branch production -y --no-env-pull
neon deploy --no-env-pull
neon env pull --file .env.neon.production --service postgres
neon env pull --branch pre --file .env.neon.pre --service postgres
```

`--no-env-pull` en `link` / `deploy` / `checkout` no pisa el SQLite.

## Comprobar

```bash
neon me
neon status
neon branches list
neon inspect db table-sizes --db-url "$DATABASE_URL"
```
