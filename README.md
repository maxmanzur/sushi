# GOTOKU SUSHI

Aplicación web de menú y pedidos online de GOTOKU SUSHI. El cliente puede elegir envío o retiro, armar su pedido sin crear una cuenta, confirmarlo y consultar su estado mediante un enlace privado. El equipo gestiona pedidos, estados y precios desde el panel administrativo.

## Tecnología

- Cloudflare Pages para publicar los archivos estáticos.
- Cloudflare Pages Functions para la API.
- Cloudflare D1 (SQLite) para categorías, productos y pedidos.
- HTML, CSS y JavaScript nativo; no requiere un proceso de compilación.
- PWA: manifest, service worker e instalación en dispositivos compatibles.

## Estructura del proyecto

```text
db/
  schema.sql                 Estructura de tablas e índices D1
  seed.sql                   Categorías y ajustes iniciales
functions/
  _lib/                      Respuestas, validaciones y sesiones
  api/
    menu.js                  Menú público
    orders.js                Alta de pedidos
    orders/[token].js        Consulta privada del seguimiento
    admin/
      login.js               Inicio de sesión
      logout.js              Cierre de sesión
      orders.js              Listado y filtros de pedidos
      orders/[id].js         Detalle y actualización de estado
      products.js            Listado de productos
      products/[id].js       Actualización de precio y disponibilidad
public/
  admin/index.html           Panel administrativo
  css/app.css                Estilos del menú y seguimiento
  css/admin.css              Estilos del panel
  img/                       Iconos de la PWA
  js/app.js                  Menú, carrito y checkout
  js/api.js                  Cliente HTTP de la API
  js/cart.js                 Carrito local
  js/track.js                Seguimiento del pedido
  index.html                 Menú y compra
  seguimiento.html           Página de seguimiento
  manifest.webmanifest       Configuración instalable
  sw.js                      Caché del shell y menú público
wrangler.toml                Configuración Pages y binding D1
```

## Base de datos D1

El repositorio ya contiene la configuración de la base `sushi-db` con binding `DB` en `wrangler.toml`. Si vas a conectar otra base, creala desde la carpeta raíz del proyecto:

```bash
npx wrangler d1 create sushi-db
```

Copiá el `database_id` que devuelve Cloudflare en `wrangler.toml`, manteniendo el binding con nombre `DB`. No crees una segunda base si vas a reutilizar la ya configurada.

Aplicá primero el esquema y después los datos iniciales en la base remota:

```bash
npx wrangler d1 execute sushi-db --remote --file=db/schema.sql
npx wrangler d1 execute sushi-db --remote --file=db/seed.sql
```

El archivo `seed.sql` crea las categorías Entradas, Rollos, Combinados, Cortes y Adicionales, además de los ajustes iniciales. No carga productos ni precios comerciales.

### Cargar productos

Los precios se guardan como números enteros en pesos argentinos. Para cargar un producto, usá el ID de la categoría correspondiente. Este SQL es un ejemplo ficticio: inserta un producto inactivo para que no aparezca al público hasta que revises sus datos y lo actives desde administración.

```sql
INSERT INTO products (category_id, name, description, price, active, sort_order)
SELECT id, 'EJEMPLO - NO PUBLICAR', 'Registro de ejemplo; reemplazar por datos reales.', 10000, 0, 1
FROM categories
WHERE name = 'Rollos';
```

Un precio `NULL` se muestra como «Precio a confirmar» y el cliente no puede comprar ese producto hasta que tenga un precio válido.

## Configuración de Cloudflare

### 1. Crear el proyecto Pages

1. Subí el repositorio a GitHub y conectá `maxmanzur/sushi` desde Cloudflare Pages.
2. Elegí `main` como rama de producción.
3. Usá la raíz del repositorio como directorio raíz.
4. No hace falta comando de build: es HTML, CSS y JavaScript nativo.
5. El directorio publicado es `public` (también está declarado como `pages_build_output_dir` en `wrangler.toml`).

### 2. Vincular D1

En el proyecto de Pages, abrí **Settings → Functions → D1 database bindings** y agregá:

- Variable name / Binding: `DB`
- D1 database: `sushi-db`

El nombre del binding debe ser exactamente `DB`, porque las funciones lo usan como `env.DB`. Revisá también que el ID de `wrangler.toml` corresponda a esa misma base.

### 3. Configurar secretos

En **Settings → Variables and Secrets**, agregá estos secretos para Production y, si vas a probar previews, también para Preview:

- `ADMIN_PASSWORD`: contraseña privada para entrar a `/admin/`.
- `COOKIE_SECRET`: clave aleatoria larga para firmar las sesiones. Usá una clave distinta de la contraseña y guardala en un lugar seguro.

No escribas estos valores en archivos del repositorio, en el código ni en mensajes públicos. Si cambiás la contraseña, actualizá el secreto `ADMIN_PASSWORD` en Cloudflare y guardá el cambio. Las sesiones existentes pueden seguir vigentes hasta su vencimiento (8 horas); cambiar también `COOKIE_SECRET` invalida las sesiones firmadas con la clave anterior.

## Publicación y acceso

Cada push a la rama `main` genera un nuevo despliegue de producción desde GitHub, según la configuración de Cloudflare Pages.

- Menú público: la URL principal del proyecto.
- Seguimiento: `/seguimiento.html` con el token privado recibido al confirmar el pedido.
- Administración: `/admin/`.

Antes de anunciar el menú, verificá en producción que D1 esté vinculada, que las categorías estén cargadas, que los productos tengan sus precios revisados y que el acceso administrativo funcione.

## Límites conocidos

- La alerta sonora de nuevos pedidos funciona únicamente mientras el panel administrativo está abierto y el sonido fue activado en ese navegador.
- En iPhone y iPad, la instalación se realiza manualmente desde Safari: Compartir → Agregar a inicio.
- La instalación Android depende de que el navegador cumpla los criterios de instalación y emita el evento correspondiente.
- El plan gratuito de Cloudflare tiene cuotas y límites de uso para Pages, Functions y D1. Pueden cambiar; revisá los límites vigentes y el consumo en el panel de Cloudflare. Si se alcanza una cuota, algunas operaciones pueden quedar limitadas hasta el siguiente período o hasta cambiar de plan.
- El menú público puede mostrar la última copia cacheada de los datos del menú si no hay conexión. La creación de pedidos, el seguimiento y la administración requieren conexión y no se guardan en caché.
