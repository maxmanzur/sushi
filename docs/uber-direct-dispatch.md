# GOTOKU SUSHI — Preparación segura de Uber Direct

## Límites no negociables

- Trabajar en la rama uber-direct-dispatch-setup; no fusionar ni modificar main.
- No ejecutar comandos D1 contra sushi-db.
- No crear envíos reales durante esta fase.
- No crear páginas ni flujos nuevos para clientes; todos los cambios de interfaz están en /admin.
- La única autorización de despacho es el botón/orden administrativa ESTÁ LISTO PARA ENTREGA.
- El estado de entrega se registra aparte del estado comercial existente: orders.delivery_status='ready'.
- Antes de despachar, el servidor exige delivery_type='delivery', payment_method='transfer', payment_status='confirmed', datos completos y pedido no cerrado.
- Origen fijo: Cavassa 2763, Caseros, Buenos Aires, Argentina.
- El costo del envío no se mezcla con el total de los productos; se informa aparte.

## Configuración de Cloudflare Pages

El proyecto es HTML/CSS/JavaScript estático con Pages Functions. No tiene un proceso de compilación de frontend: el directorio publicado es public/. wrangler.toml declara pages_build_output_dir = "./public".

El archivo Wrangler define:
- Configuración base/producción: DB -> sushi-db.
- Entorno preview: DB -> sushi-preview-db.
- UBER_ENABLED=false y UBER_DRY_RUN=false tanto en producción como en Preview.

Cloudflare Pages permite definir recursos por entorno en Wrangler, pero el repositorio por sí solo no demuestra que Cloudflare haya recibido un webhook ni creado un deployment. El estado "No deployment available" no aparece como un error de build en GitHub: para el commit consultado no había checks/statuses publicados. Si sigue sin aparecer un Preview, revisar en el panel:

1. Workers & Pages → proyecto sushi → Settings → Builds & deployments → Branch control.
2. Confirmar que Production branch sea main.
3. En Preview branch deployments, elegir "All non-production branches" o incluir uber-direct-dispatch-setup.
4. Revisar Build watch paths: dejar sin filtros que excluyan los archivos del repositorio.
5. Build configuration: Root directory vacío (raíz del repo), Build command vacío, Build output directory public.
6. Guardar. Ir a Deployments y crear/reintentar un deployment seleccionando la rama uber-direct-dispatch-setup y su commit más reciente.
7. Abrir el deployment de Preview y comprobar sus Settings/Bindings: DB debe apuntar al ID de sushi-preview-db (7296331d-e8ae-46b9-9032-ae4bb50cac32). Si muestra sushi-db, detenerse: no ejecutar SQL.

Si el panel no ofrece el cambio de binding porque el Wrangler file ya es fuente de configuración, no borrar el binding de producción. El próximo deployment de Preview debe adoptar el override de env.preview. Si no lo hace, se necesita revisar el log del deployment y la configuración del proyecto en Cloudflare; no se puede corregir desde GitHub solamente.

## Identidad administrativa

El login privado ahora requiere dos datos: identificación del operador y contraseña individual.

Configurar como Secret en Cloudflare Pages → Settings → Variables and Secrets → Preview:
- ADMIN_USERS_JSON: objeto JSON cuyas claves son IDs de operador y cuyos valores son sus contraseñas individuales. Ejemplo de estructura: {"operador_id":"CONTRASEÑA_INDIVIDUAL"}.
- COOKIE_SECRET: secreto aleatorio largo.

No compartir ni guardar esos valores en GitHub. No usar una contraseña compartida entre operadores: la auditoría guarda el operador autenticado y el ID único de la sesión. La identificación es tan confiable como la custodia individual de esas credenciales.

El endpoint de confirmación de pago actualiza el pago y agrega order_events en un único DB.batch. Guarda operador y sesión. El endpoint de despacho registra requested_by y operator_session_id.

## Interruptores de Uber

Los valores de Wrangler se mantienen bloqueados:
- UBER_ENABLED=false
- UBER_DRY_RUN=false

Mientras ambos estén en false (o falten), POST /api/admin/orders/:id/dispatch devuelve 503 antes de contactar a Uber y no reserva el pedido.

Para pruebas sin Uber, se puede cambiar solo Preview a UBER_DRY_RUN=true, manteniendo UBER_ENABLED=false. En ese modo:
- Se registra una reserva única en uber_dispatches.
- Se marca orders.delivery_status='ready'.
- Se marca el despacho como dry_run.
- No se solicita cotización, no se obtiene token OAuth y no se llama a Uber.
- Un segundo intento para el mismo pedido devuelve conflicto y no crea otro registro.

Al terminar las pruebas, volver UBER_DRY_RUN=false y desplegar Preview nuevamente.

Para una futura habilitación real, mantener UBER_DRY_RUN=false y agregar como secretos/variables únicamente en el entorno aprobado:
- UBER_AUTH_URL
- UBER_API_BASE_URL
- UBER_CLIENT_ID
- UBER_CLIENT_SECRET (Secret)
- UBER_CUSTOMER_ID
- UBER_PICKUP_PHONE_NUMBER (dato del local; no inventar)

No habilitar UBER_ENABLED=true hasta verificar por escrito el acceso de Uber Direct, las credenciales, el contrato API habilitado para Argentina, la dirección de origen y los datos requeridos por Uber.

## Cliente API aislado

functions/_lib/uber-direct.js contiene:
- quote_delivery(env, payload)
- create_delivery(env, payload)
- get_delivery(env, deliveryId)
- cancel_delivery(env, deliveryId)

Las funciones leen credenciales solo desde env, cachean el token OAuth en memoria y no tienen valores reales en el repositorio. No se ejecutan desde polling, webhooks ni cambios de estado. La ruta de despacho es la única que podría llamar a cotización/creación, y solo después de la orden explícita y las validaciones.

La ruta reserva primero uber_dispatches.order_id (UNIQUE). Los intentos repetidos no pueden crear una segunda solicitud. Si Uber responde con error o de forma ambigua, el estado queda registrado y no hay reintento automático. El tracking URL se guarda sin alterarlo y se muestra en el panel privado, con opción de copiarlo para reenviarlo al cliente.

La cancelación está disponible como función aislada, pero no hay endpoint ni automatismo que la invoque. Cualquier futura cancelación debe requerir una orden explícita independiente.

## Inicialización D1 — SOLO Preview

Ejecutar desde la raíz del repositorio, con Wrangler autenticado. Cada comando identifica explícitamente la base remota sushi-preview-db.

Comando 1 — afecta exclusivamente sushi-preview-db:

    npx wrangler d1 execute sushi-preview-db --remote --file=./db/schema.sql

Comando 2 — afecta exclusivamente sushi-preview-db:

    npx wrangler d1 execute sushi-preview-db --remote --file=./migrations/0002_uber_direct.sql

Antes de ejecutar, comprobar el nombre de base que Wrangler muestra. Si aparece sushi-db, cancelar. No ejecutar ninguno de estos comandos sobre producción. El esquema inicial crea las tablas base y la migración agrega pago, estado de entrega y auditoría de despacho.

## Plan de pruebas sin Uber

Primero comprobar en Cloudflare Preview que DB apunta al ID de sushi-preview-db, y aplicar los dos comandos anteriores. Luego activar temporalmente UBER_DRY_RUN=true solo en Preview. Mantener siempre UBER_ENABLED=false.

1. Pedido completo: envío, transferencia confirmada, nombre/teléfono/dirección completos y pedido abierto. Pulsar ESTÁ LISTO PARA ENTREGA. Esperado: respuesta de simulación, delivery_status='ready', una fila uber_dispatches con state='dry_run'; cero llamadas de red a Uber.
2. Datos incompletos: quitar nombre, teléfono o dirección en un pedido de prueba. Esperado: 409; ninguna fila de despacho y ningún contacto con Uber.
3. Retiro: delivery_type='pickup'. Esperado: 409; ninguna fila de despacho.
4. Pago no confirmado: payment_status='pending' o método distinto de transferencia. Esperado: 409; ninguna fila de despacho.
5. Doble clic / repetición: ejecutar dos POST seguidos sobre el mismo pedido completo. Esperado: solo una fila por order_id; el segundo intento informa que ya existe una solicitud y no llama a Uber.

Después, volver UBER_DRY_RUN=false. No se prueba producción ni se habilita Uber en esta etapa.

## Qué queda fuera de esta fase

- No se prueba cobertura, cotización ni creación contra Uber.
- No se inventan teléfono de pickup, alias bancario, tarifas ni credenciales.
- No se realiza envío real.
- No se modifica main ni el repositorio independiente maxmanzur/Gotoku.
