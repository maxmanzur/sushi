import {json,fail} from "../../_lib/response.js";
import {isAdmin} from "../../_lib/auth.js";
const allowed=["nuevo","aceptado","en_preparacion","listo_para_retirar","enviado","entregado","cancelado"];
function validDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const parsed=new Date(value+"T00:00:00Z");
  return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}
function validId(value){return /^\d+$/.test(value)&&Number.isSafeInteger(Number(value))&&Number(value)>0}
export async function onRequestGet({request,env}) {
  if(!await isAdmin(request,env))return fail("No autorizado.",401);
  if(!env.DB)return fail("Base de datos no configurada.",503);
  const params=new URL(request.url).searchParams,clauses=[],values=[];
  if(params.has("since")){
    const raw=params.get("since"),since=Number(raw);
    if(!/^\d+$/.test(raw)||!Number.isSafeInteger(since)||since<0)return fail("ID inválido.");
    if(since>0){clauses.push("id>?");values.push(since)}
  }
  if(params.has("antes")){
    const raw=params.get("antes");
    if(!validId(raw))return fail("ID inválido.");
    clauses.push("id<?");values.push(Number(raw));
  }
  if(params.has("estado")){
    const estado=params.get("estado");
    if(!allowed.includes(estado))return fail("Estado inválido.");
    clauses.push("status=?");values.push(estado);
  }
  if(params.has("desde")){
    const desde=params.get("desde");
    if(!validDate(desde))return fail("Fecha inválida.");
    clauses.push("created_at>=?");values.push(desde+" 00:00:00");
  }
  if(params.has("hasta")){
    const hasta=params.get("hasta");
    if(!validDate(hasta))return fail("Fecha inválida.");
    clauses.push("created_at<?");values.push(hasta+" 24:00:00");
  }
  const where=clauses.length?" WHERE "+clauses.join(" AND "):"";
  const sql="SELECT id,order_number,customer_name,customer_phone,customer_address,delivery_type,payment_method,total,status,payment_status,created_at,updated_at FROM orders"+where+" ORDER BY id DESC LIMIT 100";
  const rows=await env.DB.prepare(sql).bind(...values).all();
  return json({orders:rows.results});
}
