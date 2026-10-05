# Asistente ⌘J

El panel propone cambios y espera a que alguien pulse Aplicar. Sin clave, sin modelo o sin secreto de aprobación no llama a ningún modelo: el resto de la app sigue igual.

## Activar

1. Deja `NEXT_PUBLIC_AI_PANEL` vacío. Con `demo` el panel enseña la conversación de ejemplo y no escribe.
2. Crea una clave en [AI Gateway](https://vercel.com/docs/ai-gateway) y ponla en `AI_GATEWAY_API_KEY`.
3. Elige un id `proveedor/modelo` del catálogo en vivo: `https://ai-gateway.vercel.sh/v1/models`. Ejemplo de forma, no un id fijo: `C4M_AI_MODEL=proveedor/modelo`.
4. Opcional: `C4M_AI_FALLBACK_MODEL` (otro id `proveedor/modelo`). Si el principal falla, el gateway prueba ese.
5. `TOOL_APPROVAL_SECRET` (`openssl rand -base64 32`). Obligatoria, de 32 bytes o más. Firma cada aprobación. La misma clave en todas las instancias. Sin ella el panel dice «IA no configurada» y `POST /api/agent` responde 503.
6. `C4M_AI_MAX_STEPS` (por defecto 8, tope 12).
7. `C4M_AI_RATE_PER_MINUTE` (por defecto 20, tope 120). Límite por usuario y por proceso, no compartido entre instancias.

Reinicia el servidor. El panel deja de decir «IA no configurada» y habla con el modelo.

## Sin clave

Si falta el secreto, falta `AI_GATEWAY_API_KEY`, o falta un modelo con `/`, el panel muestra **IA no configurada** y `POST /api/agent` responde 503. La app no se cae.

`APP_ENV=local` y `C4M_AI_MODEL=mock/local` usan un modelo simulado del AI SDK (`MockLanguageModelV4`). No sale a la red. Solo propone meter a `@sarabakes` en la mesa de la campaña abierta. También exige el secreto de 32 bytes, sesión y aprobación. No lo uses fuera de local.

## Coste

Cada turno gasta créditos del AI Gateway (entrada, salida y, si hay fallback, el intento extra). Las lecturas pueden ser dos pasos (herramienta y texto). Las escrituras se paran en la aprobación y, si se aceptan, gastan otro paso. El tope de salida es 1200 tokens y el de pasos es `C4M_AI_MAX_STEPS`.

El límite de `C4M_AI_RATE_PER_MINUTE` corta antes de llamar al modelo (429).

## Seguridad

- La ruta exige sesión. Sin ella responde 401.
- `TOOL_APPROVAL_SECRET` es obligatoria. El SDK solo comprueba la firma HMAC si el secreto está definido; por eso no se arranca el agente sin uno de al menos 32 bytes. Una aprobación inventada, o una cuyo input se ha cambiado, no se ejecuta.
- Al proponer una escritura, el servidor mete en el input `campaignId`, `contractId`, `creatorId` y `actorUserId`. Eso entra en el HMAC. Al ejecutar, tienen que coincidir con la pantalla y con el usuario. Si no hay campaña abierta, las escrituras que la necesitan se rechazan.
- Cada `approvalId` se guarda una vez en `AgentApproval` antes de escribir. Repetirlo no vuelve a ejecutar.
- La tarjeta muestra el efecto calculado en el servidor (handle y nombre reales, importes ya interpretados, contratos y emails de la firma, enlace a publicar, recuento y total del lote). El texto del modelo no se pinta.
- `setLinePrice` mezcla con la fila guardada. Un importe ambiguo (`1.500`, `1,500` o los dos separadores) no se guarda.
- `queueSignatures` solo toca contratos `DRAFT` o `SENT` de la campaña abierta. Deja el correo en cola; no vacía la cola global.
- `preparePayoutBatch` devuelve recuento, total y un enlace. El CSV se descarga en `GET /api/agent/payouts/:id` si la sesión es del mismo usuario y el rol puede `finance:manage`.
- Cada herramienta vuelve a comprobar `can(role, …)`.
- El actor del `AuditEvent` es `C4M IA en nombre de <email>`.
- Los mensajes del turno se guardan en la campaña con visibilidad `INTERNAL`, y solo si el rol tiene `campaigns:manage`. `/hablar` usa `clientThreadWhere`: `SHARED` o lo escrito por el cliente.
- Lo que sale de las herramientas y los mensajes del cliente van entre `<dato-no-fiable>` y `</dato-no-fiable>`. Son datos, no instrucciones.
- El cuerpo se lee con tope de bytes (`AGENT_MAX_BODY_BYTES`, 200000), contando todas las partes del mensaje. Por encima de 40 mensajes se conservan los últimos 40.
- Y y «Aceptar el resto» no aprueban cambios que mandan correo o tocan dinero (`setLinePrice`, `createDraftContract`, `queueSignatures`, `preparePayoutBatch`). Esos se aceptan uno a uno.
- Un error inesperado no se devuelve en crudo al navegador.

## Variables

| Variable | Qué hace |
| --- | --- |
| `NEXT_PUBLIC_AI_PANEL` | `demo` = ejemplo. Vacío = agente real o «IA no configurada». |
| `AI_GATEWAY_API_KEY` | Clave del gateway. Sin ella no hay modelo (salvo el fixture local). |
| `C4M_AI_MODEL` | Id `proveedor/modelo`. |
| `C4M_AI_FALLBACK_MODEL` | Id de reserva. |
| `TOOL_APPROVAL_SECRET` | Obligatoria. Firma HMAC, 32 bytes o más. |
| `C4M_AI_MAX_STEPS` | Pasos del bucle (1–12). |
| `C4M_AI_RATE_PER_MINUTE` | Peticiones por usuario y minuto, en este proceso (1–120, defecto 20). |
