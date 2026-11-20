import {json,fail} from "../../_lib/response.js";
import {isAdmin} from "../../_lib/auth.js";
const allowed=["nuevo","aceptado","en_preparacion","listo_para_retirar","enviado","entregado","cancelado"];
export async function onRequestGet({request,env}) {
  if(!await isAdmin(request,env))return fail("No autorizado.",401);
  if(!env.DB)return fail("Base de datos no configurada.",503);
  const params=new URL(request.url).searchParams,clauses=[],values=[];
  if(params.has("since")){const since=Number(params.get("since"));if(!Number.isSafeInteger(since)||since<0)return fail("ID inválido.");if(since>0){clauses.push("id>?");values.push(since)}}
  if(params.has("estado")){const estado=params.get("estado");if(!allowed.includes(estado))return fail("Estado inválido.");clauses.push("status=?");values.push(estado)}
  if(params.has("desde")){const desde=params.get("desde"),parsed=new Date(desde+"T00:00:00Z");if(!/^\d{4}-\d{2}-\d{2}$/.test(desde)||Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==desde)return fail("Fecha inválida.");clauses.push("created_at>=?");values.push(desde+" 00:00:00")}
  const where=clauses.length?" WHERE "+clauses.join(" AND "):"";
  const sql="SELECT id,order_number,customer_name,customer_phone,customer_address,delivery_type,payment_method,total,status,created_at,updated_at FROM orders"+where+" ORDER BY id DESC LIMIT 100";
  const rows=await env.DB.prepare(sql).bind(...values).all();
  return json({orders:rows.results});
}