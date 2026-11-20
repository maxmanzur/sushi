import {json,fail} from "../../../../_lib/response.js";
import {getAdminSession} from "../../../../_lib/auth.js";
import {quote_delivery,create_delivery} from "../../../../_lib/uber-direct.js";

const PICKUP_ADDRESS=JSON.stringify({street_address:["Cavassa 2763"],city:"Caseros",state:"Buenos Aires",country:"AR"});
function clean(value){return typeof value==="string"?value.trim():""}

export async function onRequestPost({request,params,env}) {
  const admin=await getAdminSession(request,env);
  if(!admin)return fail("No autorizado.",401);
  if(!env.DB)return fail("Base de datos no configurada.",503);
  const id=Number(params.id);
  if(!Number.isSafeInteger(id)||id<1)return fail("Pedido no encontrado.",404);

  const dryRun=env.UBER_DRY_RUN==="true";
  const enabled=env.UBER_ENABLED==="true";
  if(!dryRun&&!enabled)return fail("Despacho bloqueado: UBER_ENABLED no está activado. No se contactó a Uber.",503);
  if(!dryRun&&env.UBER_API_CONTRACT_VERIFIED!=="true")return fail("Despacho bloqueado: falta verificar el contrato y los datos requeridos por Uber para Argentina. No se contactó a Uber.",503);

  let manifestItems=null;
  if(!dryRun){
    for(const key of ["UBER_AUTH_URL","UBER_API_BASE_URL","UBER_CLIENT_ID","UBER_CLIENT_SECRET","UBER_CUSTOMER_ID","UBER_PICKUP_PHONE_NUMBER","UBER_MANIFEST_ITEMS_JSON"]){
      if(typeof env[key]!=="string"||!env[key].trim())return fail("Despacho bloqueado: falta configurar "+key+". No se contactó a Uber.",503);
    }
    try{
      manifestItems=JSON.parse(env.UBER_MANIFEST_ITEMS_JSON);
      if(!Array.isArray(manifestItems)||!manifestItems.length)throw new Error();
    }catch{
      return fail("Despacho bloqueado: UBER_MANIFEST_ITEMS_JSON debe contener una lista JSON válida de bultos. No se contactó a Uber.",503);
    }
  }

  let order;
  try {
    order=await env.DB.prepare("SELECT id,order_number,customer_name,customer_phone,customer_address,delivery_type,payment_method,payment_status,status,delivery_status FROM orders WHERE id=?").bind(id).first();
  } catch {
    return fail("Falta aplicar la migración 0002 en la base de Preview.",503);
  }
  if(!order)return fail("Pedido no encontrado.",404);
  if(order.delivery_type!=="delivery")return fail("Este pedido es para retirar; no corresponde despacho.",409);
  if(order.payment_method!=="transfer")return fail("El despacho requiere pago por transferencia.",409);
  if(order.payment_status!=="confirmed")return fail("Primero confirmá que la transferencia fue recibida. No se contactó a Uber.",409);
  if(!clean(order.customer_name)||!clean(order.customer_phone)||!clean(order.customer_address))return fail("Faltan nombre, teléfono o dirección. No se contactó a Uber.",409);
  if(["cancelado","entregado"].includes(order.status))return fail("El pedido está cerrado y no se puede despachar.",409);

  let reservation;
  try{
    reservation=await env.DB.batch([
      env.DB.prepare("INSERT INTO uber_dispatches(order_id,state,requested_by,operator_session_id) SELECT id,'requested',?,? FROM orders WHERE id=? AND delivery_status='not_ready' AND status NOT IN ('cancelado','entregado') ON CONFLICT(order_id) DO NOTHING").bind(admin.operator_id,admin.session_id,id),
      env.DB.prepare("UPDATE orders SET delivery_status='ready',delivery_ready_at=CURRENT_TIMESTAMP,delivery_ready_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND delivery_status='not_ready' AND changes()=1").bind(admin.operator_id,id)
    ]);
  }catch{
    return fail("No se pudo reservar el despacho. Verificá que la migración 0002 esté aplicada.",503);
  }
  if(!reservation[0]?.meta?.changes){
    const previous=await env.DB.prepare("SELECT state,delivery_id,tracking_url FROM uber_dispatches WHERE order_id=?").bind(id).first();
    if(previous)return json({ok:false,duplicate:true,state:previous.state,delivery_id:previous.delivery_id||null,tracking_url:previous.tracking_url||null,message:"Este pedido ya tiene una solicitud de despacho registrada. No se creó otro envío."},409);
    return fail("No se pudo marcar el pedido como listo para entrega.",409);
  }

  if(dryRun){
    await env.DB.prepare("UPDATE uber_dispatches SET state='dry_run',last_error='Simulación local: no se llamó a Uber.',updated_at=CURRENT_TIMESTAMP WHERE order_id=?").bind(id).run();
    return json({ok:true,dry_run:true,message:"Simulación completada. No se contactó a Uber ni se creó un envío real."});
  }

  const quotePayload={
    pickup_address:PICKUP_ADDRESS,
    dropoff_address:JSON.stringify({street_address:[clean(order.customer_address)],country:"AR"})
  };
  try{
    const quote=await quote_delivery(env,quotePayload);
    if(!quote?.id)throw new Error("Uber no devolvió un identificador de cotización.");
    const quoteId=quote.id;
    const quoteFee=quote.fee!==undefined&&quote.fee!==null&&Number.isSafeInteger(Number(quote.fee))?Number(quote.fee):null;
    const quoteCurrency=typeof quote.currency_type==="string"?quote.currency_type:(typeof quote.currency==="string"?quote.currency.toUpperCase():null);
    await env.DB.prepare("UPDATE uber_dispatches SET state='quoted',quote_id=?,quote_fee=?,quote_currency=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=?").bind(String(quoteId),quoteFee,quoteCurrency,id).run();
    const created=await create_delivery(env,{
      quote_id:quoteId,
      pickup_address:PICKUP_ADDRESS,
      pickup_name:"GOTOKU SUSHI",
      pickup_phone_number:env.UBER_PICKUP_PHONE_NUMBER.trim(),
      dropoff_address:quotePayload.dropoff_address,
      dropoff_name:clean(order.customer_name),
      dropoff_phone_number:clean(order.customer_phone),
      manifest_items:manifestItems
    });
    const deliveryId=created?.id;
    if(!deliveryId)throw new Error("Respuesta ambigua: Uber no devolvió delivery_id. No se reintentará automáticamente.");
    const trackingUrl=typeof created.tracking_url==="string"?created.tracking_url:null;
    await env.DB.prepare("UPDATE uber_dispatches SET state='created',delivery_id=?,tracking_url=?,uber_status=?,last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE order_id=?").bind(String(deliveryId),trackingUrl,created.status||null,id).run();
    return json({ok:true,delivery_id:deliveryId,tracking_url:trackingUrl,quote_fee:quoteFee,quote_currency:quoteCurrency,message:"Envío creado. El costo del envío se informa por separado."});
  }catch(error){
    const message=String(error?.message||"Error desconocido").slice(0,500);
    await env.DB.prepare("UPDATE uber_dispatches SET state='failed',last_error=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=?").bind(message,id).run();
    return fail("Despacho detenido: "+message+". No se hará un reintento automático.",502);
  }
}
