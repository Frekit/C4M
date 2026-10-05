# Asistente ⌘J

El panel propone cambios y espera a que alguien pulse Aplicar. Sin clave no llama a ningún modelo: el resto de la app sigue igual.

## Activar

1. Deja `NEXT_PUBLIC_AI_PANEL` vacío. Con `demo` el panel enseña la conversación de ejemplo y no escribe.
2. Crea una clave en [AI Gateway](https://vercel.com/docs/ai-gateway) y ponla en `AI_GATEWAY_API_KEY`.
3. Elige un id `proveedor/modelo` del catálogo en vivo: `https://ai-gateway.vercel.sh/v1/models`. Ejemplo de forma, no un id fijo: `C4M_AI_MODEL=proveedor/modelo`.
4. Opcional: `C4M_AI_FALLBACK_MODEL` (otro id `proveedor/modelo`). Si el principal falla, el gateway prueba ese.
5. `TOOL_APPROVAL_SECRET` (`openssl rand -base64 32`). Firma cada aprobación para que el cliente no pueda inventarla. La misma clave en todas las instancias. Sin ella el bucle funciona, pero una respuesta de aprobación se puede falsificar.
6. `C4M_AI_MAX_STEPS` (por defecto 8, tope 12).

Reinicia el servidor. El panel deja de decir «IA no configurada» y habla con el modelo.

## Sin clave

Si falta `AI_GATEWAY_API_KEY`, o falta un modelo con `/`, el panel muestra **IA no configurada** y `POST /api/agent` responde 503. La app no se cae.

`APP_ENV=local` y `C4M_AI_MODEL=mock/local` usan un modelo simulado del AI SDK (`MockLanguageModelV4`). No sale a la red. Solo propone meter a `@sarabakes` en la mesa de la campaña abierta. Sigue pidiendo sesión y aprobación. No lo uses fuera de local.

## Coste

Cada turno gasta créditos del AI Gateway (entrada, salida y, si hay fallback, el intento extra). Las lecturas pueden ser dos pasos (herramienta y texto). Las escrituras se paran en la aprobación y, si se aceptan, gastan otro paso. El tope de salida es 1200 tokens y el de pasos es `C4M_AI_MAX_STEPS`.

## Seguridad

- La ruta exige sesión. Sin ella responde 401. `requireUser` redirige en las pantallas; aquí la misma sesión (`getCurrentUser`) devuelve JSON.
- Cada herramienta vuelve a comprobar `can(role, …)`. Si el rol no llega, se deniega con un motivo y no se escribe.
- Las de escritura piden aprobación en el panel (Aplicar / Descartar). El servidor firma la petición con `TOOL_APPROVAL_SECRET`.
- El actor del `AuditEvent` es `C4M IA en nombre de <email>`.
- Los mensajes del turno se guardan en la campaña con visibilidad `INTERNAL`. `/hablar` solo enseña `SHARED` o lo escrito por el cliente.
- `getContract` no devuelve datos bancarios. El email de contacto solo sale si el rol puede enviar a firma o leer el dato de cobro.
- `draftClientMessage` solo crea un borrador `INTERNAL`.
- `queueSignatures` encola; no firma. Exige campaña o contratos: no recorre toda la base.
- `preparePayoutBatch` arma el CSV de la primera página de la cola. No marca nada como pagado.
- El contexto (campaña, contrato, perfil) sale de la ruta y tiene que existir. Si la pantalla ya trae un id, la herramienta no puede cambiarlo por otro.

## Variables

| Variable | Qué hace |
| --- | --- |
| `NEXT_PUBLIC_AI_PANEL` | `demo` = ejemplo. Vacío = agente real o «IA no configurada». |
| `AI_GATEWAY_API_KEY` | Clave del gateway. Sin ella no hay modelo. |
| `C4M_AI_MODEL` | Id `proveedor/modelo`. |
| `C4M_AI_FALLBACK_MODEL` | Id de reserva. |
| `TOOL_APPROVAL_SECRET` | Firma HMAC de las aprobaciones. |
| `C4M_AI_MAX_STEPS` | Pasos del bucle (1–12). |
