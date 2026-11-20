# GOTOKU SUSHI — Preparación segura de Uber Direct

## Límites no negociables

- Trabajar en la rama uber-direct-dispatch-setup; no fusionar ni modificar main.
- No ejecutar comandos D1 contra sushi-db.
- No crear envíos reales durante esta fase.
- No crear páginas ni flujos nuevos para clientes; todos los cambios de interfaz están en /admin.
- La única autorización de despacho es el botón/orden administrativa ESTÁ LISTO PARA ENTREGA.
- El estado se guarda en orders.delivery_status='ready', separado de los estados comerciales existentes.
- Antes de reservar el despacho, el servidor exige delivery_type='delivery', payment_method='transfer', payment_status='confirmed', datos completos y pedido no cerrado.
- Origen fijo: Cavassa 2763, Caseros, Buenos Aires, Argentina.
- El costo Uber se guarda por separado del total de productos y se muestra en el panel en la moneda devuelta por Uber.

## Cloudflare Pages y el estado "No deployment available"

El proyecto es HTML/CSS/JavaScript estático con Pages Functions. No tiene un proceso de compilación del frontend: el directorio publicado es public/. wrangler.toml declara pages_build_output_dir = "./public". No agregué un build script ficticio: el proyecto no compila assets.

El archivo Wrangler define:
- Base/producción: DB -> sushi-db.
- Entorno preview: DB -> sushi-preview-db.
- UBER_ENABLED=false, UBER_DRY_RUN=false y UBER_API_CONTRACT_VERIFIED=false en ambos entornos.

La configuración de Wrangler admite overrides preview y D1. Sin embargo, el repositorio por sí solo no demuestra que Cloudflare haya recibido el webhook de GitHub ni creado un deployment. Para el commit de configuración consultado, GitHub no mostraba checks/statuses publicados; no hay evidencia de que haya ocurrido un build fallido. Por eso no se puede atribuir "No deployment available" a un error de código.

Si sigue sin aparecer un Preview, revisar en el panel:

1. Workers & Pages → proyecto sushi → Settings → Builds & deployments → Branch control.
2. Confirmar que Production branch sea main.
3. En Preview branch deployments, elegir "All non-production branches" o incluir uber-direct-dispatch-setup.
4. Revisar Build watch paths: quitar filtros que excluyan archivos del repo.
5. Build configuration: Root directory vacío (raíz del repo), Build command vacío, Build output directory public.
6. Guardar. Ir a Deployments y crear/reintentar un deployment seleccionando uber-direct-dispatch-setup y el commit más reciente de esa rama.
7. Abrir el deployment Preview y comprobar Settings/Bindings: DB debe apuntar al ID de sushi-preview-db (7296331d-e8ae-46b9-9032-ae4bb50cac32). Si muestra sushi-db, detenerse: no ejecutar SQL.

No borrar el binding de producción. Si el panel no permite editarlo, el siguiente deployment debe adoptar el override env.preview del archivo Wrangler. Si no lo adopta, hace falta revisar el log del deployment y la configuración del proyecto en Cloudflare; no se puede verificar ni corregir eso desde GitHub solamente.

## Identidad administrativa individual

El login privado existente ahora pide identificación del operador y contraseña individual. La API valida contra ADMIN_USERS_JSON, que debe configurarse como Secret en Cloudflare Pages → Settings → Variables and Secrets → Preview. Ejemplo de estructura JSON (reemplazar los marcadores localmente):

    {"operador_id":"CONTRASEÑA_INDIVIDUAL"}

También configurar COOKIE_SECRET como Secret aleatorio largo.

No compartir ni guardar esos valores en GitHub ni en el chat. No usar una contraseña compartida entre operadores: la auditoría registra operador y UUID de sesión. Cada persona necesita su propio ID y contraseña.

Los cambios invalidan las sesiones viejas sin identidad; después del despliegue, iniciar sesión nuevamente.

La confirmación de transferencia actualiza pago y agrega order_events en un único DB.batch. Guarda operador y sesión. La ruta de despacho guarda requested_by y operator_session_id.

## Interruptores de seguridad

En Wrangler, ambos entornos quedan con:
- UBER_ENABLED=false
- UBER_DRY_RUN=false
- UBER_API_CONTRACT_VERIFIED=false

Con esos valores, POST /api/admin/orders/:id/dispatch devuelve 503 antes de reservar el pedido, pedir cotización o llamar a Uber.

Para pruebas sin Uber, cambiar solo Preview a UBER_DRY_RUN=true y mantener UBER_ENABLED=false. En ese modo:
- Se registra una sola reserva por order_id en uber_dispatches.
- Se marca orders.delivery_status='ready'.
- Se registra state='dry_run'.
- No se solicita cotización, no se obtiene token OAuth y no se llama a Uber.
- Un segundo intento devuelve conflicto y no crea otra fila.

Al terminar las pruebas, volver UBER_DRY_RUN=false. Nunca cambiar UBER_ENABLED a true en esta fase.

## Preparación de API Uber Direct

functions/_lib/uber-direct.js contiene funciones aisladas:
- quote_delivery(env, payload)
- create_delivery(env, payload)
- get_delivery(env, deliveryId)
- cancel_delivery(env, deliveryId)

Las credenciales se leen exclusivamente de env. El token OAuth se cachea en memoria. La cancelación usa POST /deliveries/{delivery_id}/cancel, no DELETE. No hay endpoint administrativo de cancelación ni automatismo que invoque esa función.

Variables/secretos previstos para una futura conexión:
- UBER_AUTH_URL
- UBER_API_BASE_URL
- UBER_CLIENT_ID
- UBER_CLIENT_SECRET (Secret)
- UBER_CUSTOMER_ID
- UBER_PICKUP_PHONE_NUMBER
- UBER_MANIFEST_ITEMS_JSON (JSON con los datos reales de bultos; no usar dimensiones/peso inventados)

La ruta de despacho exige además UBER_API_CONTRACT_VERIFIED=true antes de cualquier llamada real. Se mantiene false hasta que Uber confirme el contrato habilitado para Argentina, si hacen falta coordenadas, los datos obligatorios de pickup/dropoff y la estructura del manifiesto. El código actual no geocodifica ni envía latitud/longitud; si Uber confirma que son obligatorias en Argentina, hay que agregar esos campos y probarlos antes de habilitar este interruptor. La dirección de origen está fija en código; no se acepta que el navegador la cambie.

La cotización usa el fee devuelto por Uber en unidad menor (centavos) y guarda fee/currency por separado. El panel convierte ese valor usando el código de moneda devuelto por Uber; nunca estima ni inventa un costo. La creación guarda delivery_id y tracking_url exactamente como los devuelve Uber. El panel permite abrir y copiar el tracking URL para reenviarlo al cliente.

La API legacy de Uber Direct documentada actualmente usa OAuth client_credentials con scope eats.deliveries, POST /v1/customers/{customer_id}/delivery_quotes, POST /v1/customers/{customer_id}/deliveries, GET del delivery y POST /cancel. Uber también documenta endpoints nuevos /v1/eats/deliveries/estimates y /v1/eats/deliveries/orders que pueden requerir aprobación escrita. No se elige ni activa una versión para Argentina hasta confirmación de Uber. Referencias: https://developer.uber.com/docs/deliveries/get-started y https://developer.uber.com/docs/deliveries/direct/guides/overview.

La ruta reserva primero uber_dispatches.order_id (UNIQUE). Los intentos repetidos no pueden crear un segundo despacho. Si una llamada real devuelve error o respuesta ambigua, se registra el fallo y no hay reintento automático; antes de cualquier recuperación se debe consultar el estado con get_delivery.

## Inicialización D1 — SOLO Preview

Ejecutar desde la raíz del repositorio con Wrangler autenticado. Cada comando apunta explícitamente a la base remota sushi-preview-db.

Comando 1 — afecta exclusivamente sushi-preview-db:

    npx wrangler d1 execute sushi-preview-db --remote --file=./db/schema.sql

Comando 2 — afecta exclusivamente sushi-preview-db:

    npx wrangler d1 execute sushi-preview-db --remote --file=./migrations/0002_uber_direct.sql

Antes de ejecutar, comprobar que Wrangler muestre sushi-preview-db. Si aparece sushi-db, cancelar. No ejecutar estos comandos sobre producción. Ejecutar la migración 0002 una sola vez: sus ALTER TABLE no son repetibles. El esquema inicial crea las tablas base y la migración agrega confirmación de pago, estado de entrega y auditoría de despacho.\n\nOpcional para preparar un producto de prueba sin inventar un precio — afecta exclusivamente sushi-preview-db:\n\n    npx wrangler d1 execute sushi-preview-db --remote --file=./db/preview-test-fixture.sql\n\nDespués de iniciar sesión en /admin, buscar PRUEBAS PREVIEW y asignar al producto temporal un precio de prueba que elijas. No es un precio comercial. Esto permite crear pedidos desde el menú Preview sin copiar productos ni datos de producción.

## Plan de pruebas sin Uber

1. Verificar el deployment Preview y el binding DB -> sushi-preview-db. Aplicar schema y migración usando los dos comandos anteriores.
2. Configurar ADMIN_USERS_JSON y COOKIE_SECRET como Secrets en Preview. Iniciar sesión con una identidad de operador individual.
3. Activar temporalmente UBER_DRY_RUN=true solo en Preview. Mantener UBER_ENABLED=false y UBER_API_CONTRACT_VERIFIED=false.
4. Pedido completo: envío, transferencia confirmada, nombre/teléfono/dirección completos y pedido abierto. Pulsar ESTÁ LISTO PARA ENTREGA. Esperado: simulación; delivery_status='ready'; una fila uber_dispatches con state='dry_run'; cero llamadas de red a Uber.
5. Datos incompletos: pedido de prueba sin nombre, teléfono o dirección. Esperado: 409; ninguna fila de despacho.
6. Retiro: delivery_type='pickup'. Esperado: 409; ninguna fila de despacho.
7. Pago no confirmado o medio distinto de transferencia. Esperado: 409; ninguna fila de despacho.
8. Doble clic/repetición: enviar dos POST sobre el mismo pedido completo. Esperado: una fila por order_id; el segundo intento informa que ya existe y no llama a Uber.
9. Comprobar que, con UBER_DRY_RUN=false y UBER_ENABLED=false, el endpoint responde 503 sin reservar ni contactar Uber.
10. Volver UBER_DRY_RUN=false después de las pruebas.

No se ejecutaron estas pruebas contra Cloudflare porque Preview todavía no tiene deployment confirmado ni se ha aplicado la migración a sushi-preview-db.

## Fuera de alcance

- No se prueba cobertura, cotización ni creación contra Uber.
- No se inventan teléfonos, coordenadas, alias bancarios, tarifas ni credenciales.
- No se realiza envío real.
- No se modifica main ni el repositorio independiente maxmanzur/Gotoku.

<!-- Preview deploy trigger: documentation-only change; no functional code or database changes. -->
