# Foundations

Base de la aplicación: Next.js (App Router), TypeScript, Tailwind, shadcn/ui y autenticación con [Auth0](https://auth0.com/docs/quickstart/webapp/nextjs).

Sin credenciales de Auth0 la app arranca igual, con una sesión local de desarrollo.

## Arranque

```bash
npm install
npm run dev
```

Abre [http://localhost:43127](http://localhost:43127).

## Auth0

Este proyecto usa `@auth0/nextjs-auth0` (SDK de servidor). No uses `@auth0/auth0-react`: ese es para SPAs que gestionan la sesión en el navegador y aquí la sesión vive en el servidor.

Consecuencia práctica: la aplicación en Auth0 debe ser **Regular Web Application**, no Single Page Application. El SDK es un cliente confidencial y necesita `Client Secret`; una app de tipo SPA tiene el método de autenticación en `none` y no expone secret, por lo que no sirve.

1. Crea (o cambia a) una aplicación **Regular Web Application** en el [dashboard de Auth0](https://manage.auth0.com/).
2. Copia `.env.example` a `.env.local` y rellena:

```bash
AUTH0_DOMAIN=tu-tenant.eu.auth0.com
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_SECRET=   # openssl rand -hex 32
APP_BASE_URL=http://localhost:43127
```

3. En Auth0 configura:

- Allowed Callback URLs: `http://localhost:43127/auth/callback`
- Allowed Logout URLs: `http://localhost:43127`
- Allowed Web Origins: `http://localhost:43127`

El SDK v4 monta `/auth/login`, `/auth/callback` y `/auth/logout` a través de `src/proxy.ts`. La sesión de servidor vive en `src/lib/auth`.

## Contratos útiles

- `getCurrentUser()` — usuario Auth0 o local
- `requireUser()` — protege páginas de servidor
- `GET /api/me` — mismo usuario en JSON
- `/cuenta` — ruta protegida
- `/estado` — checklist de variables

## Scripts

- `npm run dev` — desarrollo en el puerto 43127
- `npm run build` — build de producción
- `npm run lint`
- `npm run typecheck`
