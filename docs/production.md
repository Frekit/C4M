# Producción

SQLite y `AUTH_MODE=local` son de desarrollo. **Antes de una campaña de 1.000–2.000 talentos** hace falta Postgres, índices y cola de correo. El recorte de trabajo es la campaña, no el número de usuarios de la app.

Local, pre y prod no se mezclan: ver [environments.md](environments.md). `APP_ENV` (o `VERCEL_ENV`) decide las reglas; el arranque corta pre/prod si hay `AUTH_MODE=local` o SQLite.

## Auth0

1. `AUTH_MODE=auth0` (no `local`).
2. App **Regular Web Application**, Type of Users: **Individuals**.
3. `APP_BASE_URL=https://tu-dominio` (HTTPS).
4. Callback: `https://tu-dominio/auth/callback`
5. Logout: `https://tu-dominio`
6. Application Login URI: `https://tu-dominio/auth/login`
7. `AUTH0_SECRET` de 32 bytes (`openssl rand -hex 32`).

El modo local no tiene contraseña: no lo uses fuera de esta máquina.

## PostgreSQL

El esquema de Prisma no usa enums de base, JSON nativo ni `@db.*`. En local el provider sigue en SQLite (esta máquina no tiene Docker) **con los índices de colas**:

- `Deliverable(contractId)`
- `Deliverable(status, campaignId, paidAt)`
- `Deliverable(status, paidAt)`
- `SignatureRequest(status, expiresAt)`
- `Contract(status, createdAt)`
- `MailJob(status, createdAt)`

El salto a Postgres:

```bash
# 1. Postgres: Neon (nameless-salad-98358301) o docker compose up -d db
#    neon login && neon link --project-id nameless-salad-98358301 --branch production -y --no-env-pull
#    neon env pull --file .env.neon.production
# 2. En prisma/schema.prisma: provider = "postgresql"
# 3. DATABASE_URL= la pooled de Neon (o postgresql://contratos:contratos@localhost:5432/contratos)
# 4. Primera vez, sin datos SQLite que conservar:
rm -rf prisma/migrations
npx prisma migrate dev --name init_postgres
```

Si ya hay datos en SQLite, no borres migraciones: exporta y carga, o monta una migración de conversión. El CI sigue generando el cliente contra el `schema.prisma` del repo (SQLite) hasta que cambies el provider.

Una campaña masiva **no** se opera sobre SQLite: el autosave de contenidos y las firmas concurrentes saturan el fichero.

## Correo (Resend)

Sin `RESEND_API_KEY` la app **sigue funcionando**: genera el enlace de firma y de invitación para copiarlo. Con la key, encola el correo (`MailJob`) y lo procesa a tandas de 20. El click de «enviar a firma» ya no hace un `fetch` síncrono por cada contrato de la campaña.

```
RESEND_API_KEY=re_...
MAIL_FROM="Creators For Media <firma@tu-dominio>"
```

El dominio de `MAIL_FROM` tiene que estar verificado en Resend. `/estado` enseña cuántos correos quedan en cola.

## Comprobar

`/estado` enseña Auth0, correo y tipos de cambio. `/auditoria` los últimos eventos (quién envió a firma, quién marcó pagado).
