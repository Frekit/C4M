# Arquitectura

App Next.js 16 (App Router) para contratos con creators, contenidos y el cobro por Zexel. Un contrato = un cliente. SQLite en desarrollo; el esquema está preparado para PostgreSQL.

## Validez de los contratos (por qué no hay blockchain)

Un smart contract en Ethereum (u otra cadena) **no da validez jurídica** a un contrato de prestación de servicios en España/UE. La validez la da el consentimiento, la identificación de las partes y la prueba de qué se firmó.

Aquí esa prueba es:

1. PDF generado de forma determinista (`src/lib/pdf/contract-pdf.ts`). El texto jurídico vive en `src/lib/domain/contract-copy.ts`.
2. Huella **SHA-256** guardada al firmar (`documentSha256`).
3. Bytes del **PDF firmado** (`documentPdf`): si la plantilla cambia después, se sirve el blob, no un PDF regenerado.
4. Auditoría: quién, cuándo, IP (`src/lib/domain/audit.ts`).
5. Acceso solo por invitación; el firmante entra con token, sin cuenta.

Eso basta para operar y para reconstruir el documento. Una firma electrónica cualificada (eIDAS) o un anclaje on-chain del hash serían capas extra, no un sustituto. No las hay a propósito: añaden custodia de claves, gas y un modelo legal que este producto no usa.

## Glosario

| Término | Significado |
| --- | --- |
| `PUBLISHED` | Ya está en redes. Lo marca Contents. |
| `SUBMITTED` / **En plataforma** | Finanzas lo subió a la plataforma del cliente (Higgsfield). |
| `platformSubmitError` | La plataforma rechazó la subida. Sigue `PUBLISHED`. |
| `paidAt` | Ya se pagó al perfil (lote Zexel). Sale de la cola de cobro. |
| `PER_CONTENT` | Se liquida pieza a pieza (Higgsfield). |
| `PACK` | No se cobra ni se paga hasta cerrar campaña + perfil (Many Chat). |
| `CONDITIONS_ANNEX` | Anexo jurídico: mismos importes, 0 contenidos, firma nueva. |
| `READY` | Línea de campaña con piezas + venta + coste. Aún no es contrato. |
| Oleada (`CampaignProposal`) | Envío de 1–N líneas. No cierra la campaña. |
| Tarifa (`defaultCost*`) | Coste del perfil. La venta es de la línea. |

## Dónde cambiar qué

| Quieres… | Empieza aquí |
| --- | --- |
| ¿Se devenga / se paga? | `src/lib/domain/settlement.ts` |
| Estados de un contenido | `src/lib/domain/rules.ts` |
| Colas de Finanzas | `src/lib/domain/finance-queues.ts` + `finance.ts` |
| Pack vs pieza / plataforma del cliente | `/clientes` (`src/app/(app)/clientes/`) |
| ¿Se puede marcar submitted / error / pagado? | `src/lib/domain/finance-commands.ts` |
| Contenidos (filtros y página) | `src/lib/domain/contents-query.ts` + `contents.ts` |
| Texto y hash del PDF | `src/lib/pdf/` y `src/lib/domain/contract-copy.ts` (+ `payment-copy.ts` para el plazo) |
| Correo de firma / invitación | `src/lib/mail/` |
| Alertas de operación | `src/lib/domain/ops-alerts.ts` |
| Roles | `src/lib/auth/permissions.ts` |
| Auth0 vs local | `src/lib/auth/config.ts` y `src/proxy.ts` |
| Copiar un lote a Zexel | `src/lib/domain/zexel-batch.ts` |
| Historial de pagos del creator | `src/lib/domain/creator-payments.ts` + ficha `/creators/[id]` |
| Mesa de campaña, oleadas, presupuesto | `src/lib/domain/campaign-desk.ts` |

Las páginas en `src/app/` pintan. Las mutations viven en `actions.ts` de cada ruta y delegan las reglas al dominio.

## Foundations (calidad y escala)

No hace falta un API HTTP ni un microservicio para esto. El cuello de calidad es **un solo módulo de invariantes** (`campaign-desk.ts`) + tests, no más endpoints. Las server actions ya son la API interna.

Lo que sí escala la calidad, y ya entra en este corte:

1. Máquina de estados de la línea (listo / oleada / activar) en dominio puro, no en el formulario.
2. Política por campaña (`ALWAYS_ON` / `BUDGET` / `SLATE` + aprobación interna o de cliente).
3. Tarifa en el perfil, venta en la línea.
4. Oleada como objeto; la campaña no se cierra al enviar.

Lo que **no** hay que montar ahora: REST público, portal de cliente, Neon Functions, cola extra. El portal, cuando toque, lee `CampaignProposal` + líneas. El Excel de 50 perfiles es otro render del mismo objeto.

Riesgo técnico que queda: «Registrar influencer» (`/creators/nuevo`) sigue creando contrato al vuelo y se salta la mesa. SQLite aguanta el vibe; el salto a Postgres está en el esquema, no en nuevas APIs.

## Arranque para un CTO

```bash
npm install
cp .env.example .env.local
npx prisma migrate dev
npm run verify    # lint + types + tests
npm run dev       # http://localhost:43127
```

Flujo de producto: [README.md](README.md). Producción (Auth0, Postgres, Resend): [docs/production.md](docs/production.md).
