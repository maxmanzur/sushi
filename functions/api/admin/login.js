import {json,fail,body} from "../../_lib/response.js";
import {makeSession,sessionCookie} from "../../_lib/auth.js";
export async function onRequestPost({request,env}){
  const x=await body(request);
  if(!env.ADMIN_PASSWORD||!env.COOKIE_SECRET||!env.ADMIN_OPERATOR_ID)return fail("Faltan ADMIN_PASSWORD, COOKIE_SECRET o ADMIN_OPERATOR_ID en Cloudflare.",503);
  if(!x||typeof x.password!=="string"||x.password.length>200||x.password!==env.ADMIN_PASSWORD)return fail("Contraseña incorrecta.",401);
  const token=await makeSession(env.COOKIE_SECRET,String(env.ADMIN_OPERATOR_ID).trim());
  return new Response(JSON.stringify({ok:true}),{headers:{"Content-Type":"application/json","Set-Cookie":sessionCookie(token),"Cache-Control":"no-store"}});
}
