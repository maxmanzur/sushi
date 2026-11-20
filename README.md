# GOTOKU SUSHI

Sistema web de pedidos para GOTOKU SUSHI.

## Stack
- Cloudflare Pages + Pages Functions
- Cloudflare D1 (SQLite)
- HTML, CSS y JavaScript nativo
- PWA instalable

## Preparación pendiente
1. Crear una base D1 real en Cloudflare.
2. Ejecutar `db/schema.sql` y luego `db/seed.sql` en esa base.
3. Configurar el binding D1 con nombre `DB` en Pages.
4. Crear los secretos `ADMIN_PASSWORD` y `COOKIE_SECRET` para Production y Preview.
5. Cargar categorías y productos reales desde D1 antes de publicar el menú.

No contiene productos, precios, direcciones ni datos de contacto inventados.
