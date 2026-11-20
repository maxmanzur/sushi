import {json,fail} from "../../../_lib/response.js";
import {isAdmin} from "../../../_lib/auth.js";

/*
 * Fail-closed mientras Uber no habilite la cuenta y se valide el contrato API
 * correspondiente a Argentina. Esta ruta NO llama a Uber en esta fase.
 */
export async function onRequestPost({request,params,env}) {
  if(!await isAdmin(request,env))return fail("No autorizado.",401);
  if(!env.DB)return fail("Base de datos no configurada.",503);
  const id=Number(params.id);
  if(!Number.isSafeInteger(id)||id<1)return fail("Pedido no encontrado.",404);
  let order;
  try {
    order=await env.DB.prepare("SELECT id,order_number,customer_name,customer_phone,customer_address,delivery_type,payment_status FROM orders WHERE id=?").bind(id).first();
  } catch {
    return fail("Falta aplicar la migración 0002 antes de habilitar despachos.",503);
  }
  if(!order)return fail("Pedido no encontrado.",404);
  if(order.delivery_type!=="delivery")return fail("Este pedido es para retirar; no corresponde Uber Direct.",409);
  if(order.payment_status!=="confirmed")return fail("Primero tenés que confirmar el pago. No se contactó a Uber.",409);
  if(!order.customer_name?.trim()||!order.customer_phone?.trim()||!order.customer_address?.trim())return fail("Faltan nombre, teléfono o dirección. No se contactó a Uber.",409);
  return fail("Uber Direct todavía no está habilitado para despachar. No se solicitó cotización ni se creó ningún envío.",503);
}
