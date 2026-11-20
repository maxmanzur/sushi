import {json,fail} from "../../_lib/response.js";
import {isAdmin} from "../../_lib/auth.js";
export async function onRequestGet({request,env}){
  if(!await isAdmin(request,env))return fail("No autorizado.",401);
  if(!env.DB)return fail("Base de datos no configurada.",503);
  const r=await env.DB.prepare("SELECT p.id,p.category_id,c.name AS category_name,c.sort_order AS category_sort_order,p.name,p.description,p.price,p.active,p.sort_order FROM products p JOIN categories c ON c.id=p.category_id ORDER BY c.sort_order,c.id,p.sort_order,p.id").all();
  return json({products:r.results});
}
