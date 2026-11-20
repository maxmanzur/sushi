const enc=new TextEncoder();
function b64(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function decode(s){s=s.replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(s.padEnd(Math.ceil(s.length/4)*4,"=")),c=>c.charCodeAt(0))}
async function key(secret){return crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"])}
export async function sign(value,secret){return b64(await crypto.subtle.sign("HMAC",await key(secret),enc.encode(value)))}
export async function makeSession(secret,operatorId){const payload=b64(enc.encode(JSON.stringify({exp:Date.now()+8*60*60*1000,operator_id:operatorId,session_id:crypto.randomUUID()})));return payload+"."+await sign(payload,secret)}
export async function getAdminSession(request,env){
  const cookie=request.headers.get("Cookie")||"";
  const token=cookie.split(";").map(x=>x.trim()).find(x=>x.startsWith("gotoku_admin="))?.slice(13);
  if(!token||!env.COOKIE_SECRET)return null;
  const [payload,sig]=token.split(".");
  if(!payload||!sig)return null;
  try{
    if(!await crypto.subtle.verify("HMAC",await key(env.COOKIE_SECRET),decode(sig),enc.encode(payload)))return null;
    const claims=JSON.parse(new TextDecoder().decode(decode(payload)));
    if(!claims.exp||claims.exp<=Date.now()||!claims.operator_id||!claims.session_id)return null;
    return {operator_id:claims.operator_id,session_id:claims.session_id};
  }catch{return null}
}
export async function isAdmin(request,env){return Boolean(await getAdminSession(request,env))}
export const sessionCookie=value=>`gotoku_admin=${value}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=28800`;
export const clearCookie="gotoku_admin=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=0";
