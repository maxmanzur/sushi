import {json,fail,body} from "../../../_lib/response.js";
import {isAdmin} from "../../../_lib/auth.js";

const allowed=["confirmed","preparing","ready","delivered","cancelled"];

export async function onRequestGet({request,params,env}) {
  if (!await isAdmin(request,env)) return fail("No autorizado.",401);
  if (!env.DB) return fail("Base de datos no configurada.",503);
  const id=Number(params.id);
  if (!Number.isInteger(id)||id<1) return fail("Pedido no encontrado.",404);
  const order=await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first();
  if (!order) return fail("Pedido no encontrado.",404);
  const [items,events]=await Promise.all([
    env.DB.prepare("SELECT product_name,unit_price,quantity,line_total FROM order_items WHERE order_id=?").bind(id).all(),
    env.DB.prepare("SELECT status,note,created_at FROM order_events WHERE order_id=? ORDER BY id").bind(id).all()
  ]);
  return json({order,items:items.results,events:events.results});
}

export async function onRequestPatch({request,params,env}) {
  if (!await isAdmin(request,env)) return fail("No autorizado.",401);
  if (!env.DB) return fail("Base de datos no configurada.",503);
  const id=Number(params.id);
  const x=await body(request);
  if (!Number.isInteger(id)||id<1||!x||!allowed.includes(x.status)) return fail("Estado inválido.");
  const note=String(x.note||"").slice(0,250);
  try {
    const result=await env.DB.batch([
      env.DB.prepare("UPDATE orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(x.status,id),
      env.DB.prepare("INSERT INTO order_events(order_id,status,note) SELECT id,?,? FROM orders WHERE id=?").bind(x.status,note,id)
    ]);
    if (!result[0]?.meta?.changes) return fail("Pedido no encontrado.",404);
    return json({ok:true});
  } catch {
    return fail("No se pudo actualizar el pedido.",500);
  }
}
