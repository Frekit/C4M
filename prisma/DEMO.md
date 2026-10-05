# Datos de ejemplo

`npm run db:seed:demo` carga un escenario ficticio para mirar el prototipo con datos. **No son personas, marcas ni campañas reales.** Los handles, nombres y correos son inventados.

No forma parte del seed normal (`npm run db:seed`) y no se ejecuta en producción: el script se detiene si `NODE_ENV=production` o si `DATABASE_URL` no es un SQLite local (`file:…`).

Antes hace falta el seed normal (admin, clientes Higgsfield y Many Chat, tipos de cambio).

Vuelve a ejecutarlo cuando quieras recrear el mismo escenario. Sustituye estas campañas, contratos y perfiles si ya existían:

- Campaña **Navidad 2026** (cliente Higgsfield), ocho perfiles en distintos estados.
- Campaña **Black Friday · Many Chat**.
- Contrato **CTR-2026-001** (34 contenidos), **CTR-2026-002** y **CTR-2026-004**.
- Firma de ejemplo de CTR-2026-004: token `demo-ctr-2026-004` (visto, caduca pronto). Ruta local: `/firmar/demo-ctr-2026-004`.

La línea de la planilla de @martamoda dice 4 reels (como la maqueta). El contrato CTR-2026-001 guarda 34 contenidos para poder evaluar esa pantalla.
