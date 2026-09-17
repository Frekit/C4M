# Neon

Proyecto: `nameless-salad-98358301`. Política en `neon.ts`. Skills del agente en `.agents/skills/neon*`. MCP de Cursor: `.cursor/mcp.json` → `https://mcp.neon.tech/mcp`.

Local sigue en SQLite. Neon es pre/prod. No copies `DATABASE_URL` de production al `.env` del Cloud Agent.

## En el portátil (hace falta tu sesión)

El CLI no puede terminar `neon login` en este Cloud Agent: el callback es `http://127.0.0.1/…` de la VM, no de tu navegador. En tu máquina:

```bash
npm i -g neon@latest
neon login
cd /ruta/del/repo
neon link --project-id nameless-salad-98358301 --branch production -y --no-env-pull
neon deploy --no-env-pull
neon env pull --file .env.neon.production
```

O exporta `NEON_API_KEY` (console → Account settings → API keys) y los mismos `link` / `deploy` funcionan aquí sin navegador.

`--no-env-pull` deja intacto el `DATABASE_URL=file:./dev.db`. La URL de Neon va a `.env.neon.production` (gitignorado) y a Vercel.

## Ramas

| Rama Neon | Uso |
| --- | --- |
| `production` | prod. Solo Vercel Production. |
| una rama hija (p. ej. `pre`) | Preview / ensayo. Créala con `neon checkout pre --create --no-env-pull` cuando esté el login. |

No operes la campaña de 1.000–2.000 talentos contra `production` desde el agente.

## Comprobar

```bash
neon --version
neon profile list -o json    # account distinto de "-"
neon projects get nameless-salad-98358301
neon config plan
```
