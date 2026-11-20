import {json,fail} from "../../../_lib/response.js";
import {getAdminSession} from "../../../_lib/auth.js";

export async function onRequestPost({request,params,env}) {
  const admin=await getAdminSession(request,env);
  if(!admin)return fail("No autorizado.",401);
  if(!env.DB)return fail("Base de datos no configurada.",503);
  const id=Number(params.id);
  if(!Number.isSafeInteger(id)||id<1)return fail("Pedido no encontrado.",404);
  try {
    const results=await env.DB.batch([
      env.DB.prepare("UPDATE orders SET payment_status='confirmed',payment_confirmed_at=CURRENT_TIMESTAMP,payment_confirmed_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND payment_status='pending'").bind(admin.operator_id,id),
      env.DB.prepare("INSERT INTO order_events(order_id,status,note) SELECT id,'pago_confirmado','Pago confirmado por operador: ' || ? FROM orders WHERE id=? AND payment_status='confirmed' AND payment_confirmed_by=? AND changes()=1").bind(admin.operator_id,id,admin.operator_id)
    ]);
    if(results[0]?.meta?.changes)return json({ok:true});
    const order=await env.DB.prepare("SELECT id,payment_status FROM orders WHERE id=?").bind(id).first();
    if(!order)return fail("Pedido no encontrado.",404);
    if(order.payment_status==="confirmed")return json({ok:true,already_confirmed:true});
    return fail("No se pudo confirmar el pago.",409);
  } catch {
    return fail("No se pudo confirmar el pago. Verificá que la migración 0002 esté aplicada.",503);
  }
}
