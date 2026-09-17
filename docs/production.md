# Producción

SQLite y `AUTH_MODE=local` son de desarrollo. Cuando haya usuarios reales:

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

El esquema de Prisma no usa enums de base, JSON nativo ni `@db.*`. El salto:

```bash
# 1. Levanta Postgres (opcional, docker compose)
docker compose up -d db

# 2. En prisma/schema.prisma: provider = "postgresql"
# 3. DATABASE_URL="postgresql://contratos:contratos@localhost:5432/contratos"
# 4. Primera vez, sin datos SQLite que conservar:
rm -rf prisma/migrations
npx prisma migrate dev --name init_postgres
```

Si ya hay datos en SQLite, no borres migraciones: exporta y carga, o monta una migración de conversión. El CI sigue generando el cliente contra el `schema.prisma` del repo (SQLite) hasta que cambies el provider.

## Correo (Resend)

Sin `RESEND_API_KEY` la app **sigue funcionando**: genera el enlace de firma y de invitación para copiarlo. Con la key, manda el correo y deja el enlace por si el buzón lo filtra.

```
RESEND_API_KEY=re_...
MAIL_FROM="Creators For Media <firma@tu-dominio>"
```

El dominio de `MAIL_FROM` tiene que estar verificado en Resend.

## Comprobar

`/estado` enseña Auth0, correo y tipos de cambio. `/auditoria` los últimos eventos (quién envió a firma, quién marcó pagado).
