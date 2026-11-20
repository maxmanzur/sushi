import {json,fail,body} from "../../_lib/response.js";
import {makeSession,sessionCookie} from "../../_lib/auth.js";
export async function onRequestPost({request,env}){
  const x=await body(request);
  if(!env.ADMIN_USERS_JSON||!env.COOKIE_SECRET)return fail("Falta configurar ADMIN_USERS_JSON y COOKIE_SECRET en Cloudflare.",503);
  if(!x||typeof x.username!=="string"||typeof x.password!=="string"||x.username.length>80||x.password.length>200)return fail("Usuario o contraseña inválidos.",400);
  let users;
  try{users=JSON.parse(env.ADMIN_USERS_JSON)}catch{return fail("ADMIN_USERS_JSON no contiene un JSON válido.",503)}
  const operatorId=x.username.trim();
  const expected=users&&typeof users==="object"&&!Array.isArray(users)?users[operatorId]:null;
  if(typeof expected!=="string"||!expected||expected!==x.password)return fail("Usuario o contraseña incorrectos.",401);
  const token=await makeSession(env.COOKIE_SECRET,operatorId);
  return new Response(JSON.stringify({ok:true}),{headers:{"Content-Type":"application/json","Set-Cookie":sessionCookie(token),"Cache-Control":"no-store"}});
}
