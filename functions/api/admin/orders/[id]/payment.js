import {json,fail} from "../../../_lib/response.js";
import {isAdmin} from "../../../_lib/auth.js";

export async function onRequestPost({request,params,env}) {
  if(!await isAdmin(request,env))return fail("No autorizado.",401);
  if(!env.DB)return fail("Base de datos no configurada.",503);
  const id=Number(params.id);
  if(!Number.isSafeInteger(id)||id<1)return fail("Pedido no encontrado.",404);
  try {
    const result=await env.DB.prepare("UPDATE orders SET payment_status='confirmed',payment_confirmed_at=CURRENT_TIMESTAMP,payment_confirmed_by='admin_session',updated_at=CURRENT_TIMESTAMP WHERE id=? AND payment_status='pending'").bind(id).run();
    if(!result.meta?.changes) {
      const order=await env.DB.prepare("SELECT id,payment_status FROM orders WHERE id=?").bind(id).first();
      if(!order)return fail("Pedido no encontrado.",404);
      if(order.payment_status==="confirmed")return json({ok:true,already_confirmed:true});
      return fail("No se pudo confirmar el pago.",409);
    }
    await env.DB.prepare("INSERT INTO order_events(order_id,status,note) VALUES(?,'pago_confirmado','Pago confirmado manualmente por administración.')").bind(id).run();
    return json({ok:true});
  } catch {
    return fail("No se pudo confirmar el pago. Verificá que la migración 0002 esté aplicada.",503);
  }
}
