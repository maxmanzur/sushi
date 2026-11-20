# GOTOKU SUSHI — Contrato de despacho Uber Direct

## Regla operativa obligatoria

Uber Direct solo puede recibir una solicitud de envío cuando el operador autorizado de GOTOKU SUSHI da la orden explícita:

**ESTÁ LISTO PARA ENTREGA**

Ningún otro evento, estado o automatismo equivale a esta autorización.

No autorizan el envío: creación del pedido, confirmación del pago, aceptación, inicio o finalización de preparación, cambio de pantalla, temporizador, polling, webhook, ni una inferencia de la IA.

La orden debe originarse en una acción explícita del operador autenticado. La IA puede preparar/validar datos, pero nunca inferir ni generar por sí sola la autorización.

## Reglas de ejecución

1. La orden explícita inicia el flujo de despacho; no se solicita cotización ni se crea delivery antes de ella.
2. Al recibirla, el servidor vuelve a leer el pedido desde D1. No confía en datos de cliente enviados por el navegador o por el agente.
3. Solo se despacha un pedido de tipo `delivery`.
4. Antes de contactar Uber, se verifica pago confirmado, nombre, teléfono y dirección de entrega completos.
5. Si falta un dato o el pago no está confirmado, se detiene el flujo y se informa el motivo. No se contacta Uber.
6. La operación debe ser idempotente: una segunda orden para el mismo pedido no puede crear un segundo delivery.
7. El servidor registra quién/qué sesión dio la orden, fecha y hora, pedido, resultado de cotización, delivery_id, estado y tracking_url.
8. La creación de delivery solo se considera exitosa si Uber devuelve una respuesta válida con identificador. El tracking_url se almacena y se devuelve sin alterarlo.
9. Si Uber falla o responde de forma ambigua, no se reintenta a ciegas: primero se consulta el estado/resultado para evitar duplicados.
10. Cancelaciones nunca son automáticas; requieren una orden explícita independiente del operador.

## Estado actual comprobado del proyecto

- Repositorio: `maxmanzur/sushi`.
- Rama de producción: `main`.
- Rama de trabajo: `uber-direct-dispatch-setup`.
- Frontend: HTML/CSS/JavaScript nativo en `public/`.
- API: Cloudflare Pages Functions en `functions/api/`.
- Base de datos: Cloudflare D1, binding `DB`, base `sushi-db`.
- Pedidos: tablas `orders`, `order_items`, `order_events` en `db/schema.sql`.
- El pedido existente ya almacena número, nombre, teléfono, dirección, tipo de entrega, método de pago, notas, importes y estado.
- Estados existentes: `nuevo`, `aceptado`, `en_preparacion`, `listo_para_retirar`, `enviado`, `entregado`, `cancelado`.
- El esquema actual no tiene un campo que confirme que una transferencia fue recibida; `payment_method='transfer'` solo indica el medio de pago. No debe confundirse con pago confirmado.

## Implementación inicial en rama de trabajo

Se agregaron en la rama `uber-direct-dispatch-setup`:

- Migración `migrations/0002_uber_direct.sql`: incorpora confirmación de pago en `orders` y tabla `uber_dispatches` con unicidad por pedido.
- Endpoint administrativo `POST /api/admin/orders/:id/payment`: confirma manualmente un pago, solo con sesión admin.
- Endpoint administrativo `POST /api/admin/orders/:id/dispatch`: recibe únicamente la acción explícita del botón **ESTÁ LISTO PARA ENTREGA**, valida pago/datos/tipo y por ahora falla cerrado: no llama a Uber.
- Panel: muestra estado del pago, botón para confirmar recepción del pago y botón de orden explícita de entrega.

**Antes de probar el panel en Preview:** aplicar la migración 0002 a la base D1 de Preview. No aplicar todavía en producción. La ruta de despacho devuelve 503 deliberadamente hasta completar y verificar la integración API de Uber Direct habilitada para Argentina.

## Diseño de implementación

- Mantener D1 como única fuente de verdad. No agregar Google Sheets, otra base ni otra aplicación.
- Agregar un estado específico para pedidos de envío listos para despacho, sin reutilizar `listo_para_retirar`.
- Incorporar confirmación de pago explícita y auditable en el panel administrativo (implementada en la rama de trabajo).
- Incorporar una acción administrativa explícita con el texto **ESTÁ LISTO PARA ENTREGA**. Esa acción es la única que puede invocar el endpoint de despacho (botón y endpoint de validación preparados; llamada a Uber aún bloqueada).
- El endpoint debe validar sesión administrativa, pedido, tipo de entrega, pago confirmado, datos requeridos e idempotencia en el servidor.
- La cotización y creación del delivery se ejecutan como consecuencia de esa única orden explícita; no debe requerirse una segunda orden genérica para iniciar el envío. Si la cotización o Uber devuelven error, se detiene y se informa.
- Guardar la información de Uber asociada al pedido y mostrar el tracking en el panel.
- Credenciales Uber únicamente como secretos de Cloudflare Pages Functions; nunca en HTML, JavaScript público, D1, GitHub ni mensajes.

## Variables/secretos previstos

- `UBER_CLIENT_ID` — secreto/variable del entorno de Functions, según la clasificación requerida por Uber.
- `UBER_CLIENT_SECRET` — secreto.
- `UBER_CUSTOMER_ID` — identificador de cuenta de Uber Direct.
- `UBER_BASE_URL` — configuración de entorno sandbox/producción, definida tras verificar el acceso y documentación de la cuenta.
- `UBER_WEBHOOK_SECRET` — solo si se habilitan webhooks posteriormente.

No cargar valores ficticios. No configurar producción de Uber ni hacer pedidos reales hasta verificar las credenciales, cobertura, endpoint y entorno de la cuenta.

## Origen fijo

GOTOKU SUSHI, Cavassa 2763, Caseros, Buenos Aires, Argentina.

El origen se configura del lado servidor. No se acepta un origen alternativo desde el navegador ni desde la IA.

## Fuera de alcance de esta fase

No crear una tienda nueva, carrito, bot de WhatsApp, Google Sheet, Make, n8n ni una segunda base de datos. No tocar el repositorio independiente `maxmanzur/Gotoku`. No desplegar a producción hasta probar en Preview y validar el flujo completo.
