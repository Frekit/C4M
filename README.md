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

1. **Roster** (`/creators` e `/creators/importar`): Instagram, país y tipo, como en el Excel. Sin precio ni contrato. Luego, en `/campanas/[id]`, se mete el perfil, se le ponen precios para que el cliente valide y, si sí, se activa. La ficha dice si ese Instagram ya está en otra campaña.
2. **Registrar influencer con contrato** (`/creators/nuevo`): Instagram, cliente, contenidos y precios. Al guardar se crea el contrato de ese cliente, en borrador. Pack vs pieza y si hace falta plataforma se corrigen después en `/clientes`.
3. **Enviar a firma**: se genera un enlace privado. Si hay `RESEND_API_KEY`, se manda al correo del talento o su agencia; si no, se copia para pegarlo a mano. El firmante no necesita cuenta.
4. **Firmar** (`/firmar/[token]`): el talento o su agencia rellenan identidad fiscal, **email de cobro (Zexel)**, moneda, situación fiscal y contacto, y aceptan. El IBAN y Wise los gestiona Zexel. Queda rastro de auditoría: nombre, fecha, IP, huella SHA-256 y **el PDF firmado tal cual se aceptó** (no se regenera si cambia la plantilla).
5. **Marcar contenidos publicados** (`/contenidos`): hacen falta el enlace del post y una sola fecha. Si el contrato aún no está firmado, se puede forzar (confirma en el diálogo); el acuerdo sigue pendiente de firma. La tabla pagina de 60 en 60; el creator se busca (no hay 2.000 `<option>`); asignar campaña puede aplicarse al **filtro**, no solo a la página. Los contadores miran el conjunto filtrado.
6. **Finanzas** (`/finanzas`): trabaja **por campaña y por lote** (50 filas, tope 100 ids). **Higgsfield**: copia o descarga un `.txt` de URLs de la tanda y marca En plataforma en el servidor (`updateMany`). «Marcar lote del filtro» no manda 2.000 hidden inputs. **Many Chat** (pack) y **Zexel** también paginan. Publicados sin enlace se abren en Contenidos.
7. **Campaña masiva** (`/campanas/[id]`): banco de trabajo con roster, validación del cliente y contadores SQL. Alta de roster: `/creators/importar`. Firma: «encolar los N del filtro» con cola de correo e informe.
8. **Ampliar o renovar** es de **ese cliente**. Si el coste no cambia, anexo de contenidos; si cambia, renovación. Para meterle en Many Chat (u otro) mientras sigue con Higgsfield: **Meter con otro cliente** en su ficha, que abre una cadena nueva.
9. **Condiciones particulares**: el campaign manager las edita en el propio contrato mientras no esté firmado (si había enlace de firma, se revoca). Si ya firmó, se crea un **anexo de condiciones**: mismos importes, cero contenidos extra, texto nuevo y firma nueva. El PDF original no se toca.

### Reglas de negocio que el sistema impone

- Un enlace de post no se puede repetir: `www`, `/reel` y los `utm` cuentan como el mismo. Si ya está, avisa de qué contrato y número lo tiene.
- Un contrato con firma enviada o contenidos publicados **no se puede borrar**, solo cancelar. La cancelación conserva historial e importes.
- Un anexo de contenidos solo es válido si el coste por contenido del creator no cambia.
- El tipo de cambio se congela al crear el contrato, así el margen no se mueve después.
- Los importes se guardan en unidades mínimas (enteros), nunca en coma flotante.
- Los emails de cobro completos solo los ven Admin y Contabilidad. El pago sale por Zexel, no hace falta IBAN en esta app.
- Al marcar un lote como pagado se congela importe, fecha y quién lo marcó. Queda en la ficha del creator y en auditoría.
- El contrato es de **un cliente**. Ampliar/renovar sigue en Higgsfield; Many Chat se abre como contrato nuevo desde la ficha del creator.
- La liquidación la marca el cliente: por contenido (con o sin plataforma) o al cerrar el pack de esa campaña con ese perfil. Se edita en `/clientes` y se lee en vivo (afecta a contratos ya abiertos). El PDF y la pantalla de firma usan esa cláusula: Many Chat no dice que se pague cada pieza publicada.
- El contrato cubre **contenido orgánico**. Paid media, pauta o cesión para anuncios se negocian aparte.
- El talento instala y mantiene **DM automático** (Many Chat u otra herramienta) durante la campaña.
- Se paga según el **precio y el plazo negociados** en ese documento.

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

## Entornos (local / pre / prod)

El vibe coding no debe apuntar a la campaña real. Mismo código, secretos distintos:

- **Local** — SQLite + `AUTH_MODE=local`. Es el Cloud Agent y tu portátil.
- **Pre** — Preview de Vercel (o `https://pre…`): Postgres y Auth0 de ensayo. Banner ámbar. Los correos salen con `[PRE]`.
- **Prod** — solo `main` en Vercel Production.

La parte **pública** es `/firmar/[token]` y `GET /api/salud`. El resto pide invitación.

Plantillas: `.env.example`, `.env.pre.example`, `.env.prod.example`. Checklist en [docs/environments.md](docs/environments.md). Postgres de pre/prod: proyecto Neon `nameless-salad-98358301` — [docs/neon.md](docs/neon.md). `npm run check:env` valida el combo.

## Migrar a PostgreSQL

El esquema se escribió para que el salto sea barato: sin enums de base de datos, sin campos `Json`, sin tipos nativos y con importes en enteros. La checklist de Auth0, Postgres y Resend está en [docs/production.md](docs/production.md).

En resumen:

1. `docker compose up -d db` (o tu Postgres).
2. Cambia `provider = "sqlite"` por `"postgresql"` en `prisma/schema.prisma`.
3. Pon la URL en `DATABASE_URL`.
4. Primera vez sin datos: borra `prisma/migrations` y `npx prisma migrate dev --name init_postgres`.

`AUTH_MODE=local` **no es apto para producción**.

## Scripts

- `npm run dev` — desarrollo en el puerto 43127
- `npm run build` / `npm start`
- `npm run verify` — lint, TypeScript y tests (lo que corre el CI)
- `npm test` — reglas de liquidación, colas, importes y firma
- `npm run lint` · `npm run typecheck`
- `npm run db:migrate` · `npm run db:seed` · `npm run db:studio` · `npm run db:reset`
