import {json,fail} from "../../_lib/response.js";
import {isAdmin} from "../../_lib/auth.js";
export async function onRequestGet({request,env}){if(!await isAdmin(request,env))return fail("No autorizado.",401);if(!env.DB)return fail("Base de datos no configurada.",503);const r=await env.DB.prepare("SELECT id,category_id,name,description,price,active,sort_order FROM products ORDER BY category_id,sort_order,id").all();return json({products:r.results})}
