# Contratos con creators

Aplicación para registrar influencers, generar su contrato automáticamente, mandarlo a firmar al talento o a su agencia, y seguir qué contenidos se han entregado y cuándo toca pagarlos.

Es la primera fase de un sistema mayor descrito en el documento de flujo financiero multi-sociedad. Lo que **sí** cubre hoy: talento, contratos, firma, contenidos, clientes con distinta liquidación (pieza a pieza vs pack), panel de finanzas (plataforma o packs, y cola de pago a perfiles). Lo que **no** cubre todavía: órdenes de compra, facturas emitidas, cobros de cliente, P&L, caja y multi-sociedad.

La validez del contrato no vive en un smart contract: vive en el PDF, su SHA-256 y la auditoría. El mapa de ficheros e invariantes está en [ARCHITECTURE.md](ARCHITECTURE.md).

## Stack

- Next.js 16 (App Router) con TypeScript y Tailwind v4
- shadcn/ui sobre Base UI
- Prisma con SQLite en desarrollo (preparado para PostgreSQL)
- Autenticación con [Auth0](https://auth0.com/docs/quickstart/webapp/nextjs) (`@auth0/nextjs-auth0`), con modo local para desarrollar sin credenciales
- `pdf-lib` para generar el contrato y el anexo

## Arranque

```bash
npm install
cp .env.example .env.local   # rellena lo que necesites
npx prisma migrate dev       # crea la base y siembra datos mínimos
npm run dev
```

Abre [http://localhost:43127](http://localhost:43127).

La semilla crea un administrador con el correo de `BOOTSTRAP_ADMIN_EMAIL` (por defecto `alvaroromero@creatorsformedia.com`) y unos tipos de cambio de referencia.

## Cómo funciona el flujo

1. **Registrar influencer** (`/creators/nuevo`): Instagram, cliente (Higgsfield, Many Chat, …), contenidos y precios. Al guardar se crea el contrato de ese cliente, en borrador.
2. **Enviar a firma**: se genera un enlace privado con token. El firmante no necesita cuenta.
3. **Firmar** (`/firmar/[token]`): el talento o su agencia rellenan identidad fiscal, **email de cobro (Zexel)**, moneda, situación fiscal y contacto, y aceptan. El IBAN y Wise los gestiona Zexel. Queda rastro de auditoría: nombre, fecha, IP y huella SHA-256 del PDF.
4. **Marcar contenidos publicados** (`/contenidos`): hacen falta el enlace del post y una sola fecha. Si el contrato aún no está firmado, se puede forzar (confirma en el diálogo); el acuerdo sigue pendiente de firma. La tabla pagina de 60 en 60; los contadores (estado, retrasados, devengo) miran todo el conjunto filtrado, no solo la página.
5. **Finanzas** (`/finanzas`): depende del cliente. **Higgsfield** (por contenido + plataforma): se copian los enlaces y se marcan como **en plataforma**. Si la plataforma rechaza, **Error al subir** con una nota saca el ítem de esa cola (sigue Publicado en redes) hasta que se reintente o se marque en plataforma. **Many Chat** y similares (pack): no se cobra ni se paga hasta que ese creator termine todos los contenidos de esa campaña. El cobro a perfiles se ejecuta **en un lote de Zexel**: CSV `email;importe_destino;moneda_destino`, se sube a Zexel Pay y **Lote ya pagado** vacía la cola.
6. **Ampliar o renovar** es de **ese cliente**. Si el coste no cambia, anexo; si cambia, renovación. Para meterle en Many Chat (u otro) mientras sigue con Higgsfield: **Meter con otro cliente** en su ficha, que abre una cadena nueva.

### Reglas de negocio que el sistema impone

- Un contrato con firma enviada o contenidos publicados **no se puede borrar**, solo cancelar. La cancelación conserva historial e importes.
- Un anexo solo es válido si el coste por contenido del creator no cambia.
- El tipo de cambio se congela al crear el contrato, así el margen no se mueve después.
- Los importes se guardan en unidades mínimas (enteros), nunca en coma flotante.
- Los emails de cobro completos solo los ven Admin y Contabilidad. El pago sale por Zexel, no hace falta IBAN en esta app.
- El contrato es de **un cliente**. Ampliar/renovar sigue en Higgsfield; Many Chat se abre como contrato nuevo desde la ficha del creator.
- La liquidación la marca el cliente: por contenido (con o sin plataforma) o al cerrar el pack de esa campaña con ese perfil. El PDF y la pantalla de firma usan esa cláusula: Many Chat no dice que se pague cada pieza publicada.

## Acceso y roles

El acceso es solo por invitación: un administrador invita desde `/equipo` y la persona entra por el enlace recibido. Roles:

| Rol | Puede |
| --- | --- |
| Admin / Finanzas | todo, incluido gestionar el equipo |
| Gestión de creators | registrar creators, crear y renovar contratos, enviar a firma, marcar publicados |
| Contabilidad / Pagos | panel de finanzas: plataforma, packs y lote Zexel |
| Lectura | solo consultar, con los datos bancarios enmascarados |

## Auth0

Este proyecto usa `@auth0/nextjs-auth0` (SDK de servidor). No uses `@auth0/auth0-react`: es para SPAs que gestionan la sesión en el navegador, y aquí la sesión vive en el servidor.

La aplicación en Auth0 debe ser **Regular Web Application**, no SPA: el SDK es un cliente confidencial y necesita `Client Secret`.

```bash
AUTH_MODE=auto          # auto | auth0 | local
AUTH0_DOMAIN=tu-tenant.eu.auth0.com
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_SECRET=           # openssl rand -hex 32
APP_BASE_URL=http://localhost:43127
```

En el dashboard de Auth0:

- Allowed Callback URLs: `http://localhost:43127/auth/callback`
- Allowed Logout URLs: `http://localhost:43127`
- Allowed Web Origins: `http://localhost:43127`
- **Login Experience → Type of Users: Individuals.** Esta app ya es solo por invitación; si el cliente está en Business Users, Auth0 rechaza a quien no pertenezca a una Organization.
- **Application Login URI** (solo con HTTPS de producción, Auth0 no acepta localhost): `https://tu-dominio/auth/login`. Hace falta para invitaciones a Organizations y para el reset de contraseña. `/auth/login` ya reenvía `invitation` y `organization` a `/authorize`.

Entra por `http://localhost:43127`, no por `127.0.0.1`: Auth0 trata esos hosts como distintos y el callback falla.

`AUTH_MODE=local` fuerza el modo local aunque existan credenciales, útil mientras el tenant no está configurado. En modo local basta el correo de una cuenta invitada, sin contraseña; **no es apto para producción**.

Con Auth0 activo, la identidad la da Auth0 y el rol la base de datos: una cuenta válida en Auth0 sin invitación acaba en `/sin-acceso`.

## Migrar a PostgreSQL

El esquema se escribió para que el salto sea barato: sin enums de base de datos, sin campos `Json`, sin tipos nativos y con importes en enteros. Para migrar:

1. Cambia `provider = "sqlite"` por `"postgresql"` en `prisma/schema.prisma`.
2. Pon la URL del servidor en `DATABASE_URL`.
3. Borra `prisma/migrations` y genera la migración inicial contra Postgres, o crea una migración de conversión si ya hay datos que conservar.

## Scripts

- `npm run dev` — desarrollo en el puerto 43127
- `npm run build` / `npm start`
- `npm run verify` — lint, TypeScript y tests (lo que corre el CI)
- `npm test` — reglas de liquidación, colas, importes y firma
- `npm run lint` · `npm run typecheck`
- `npm run db:migrate` · `npm run db:seed` · `npm run db:studio` · `npm run db:reset`
