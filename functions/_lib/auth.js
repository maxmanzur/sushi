const enc=new TextEncoder();
function b64(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
async function key(secret){return crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"])}
export async function sign(value,secret){return b64(await crypto.subtle.sign("HMAC",await key(secret),enc.encode(value)))}
export async function makeSession(secret){const payload=b64(enc.encode(JSON.stringify({exp:Date.now()+8*60*60*1000,nonce:crypto.randomUUID()})));return payload+"."+await sign(payload,secret)}
export async function isAdmin(request,env){const cookie=request.headers.get("Cookie")||"";const token=cookie.split(";").map(x=>x.trim()).find(x=>x.startsWith("gotoku_admin="))?.slice(13);if(!token||!env.COOKIE_SECRET)return false;const [payload,sig]=token.split(".");if(!payload||!sig||!await crypto.subtle.verify("HMAC",await key(env.COOKIE_SECRET),decode(sig),enc.encode(payload)))return false;try{return JSON.parse(new TextDecoder().decode(decode(payload))).exp>Date.now()}catch{return false}}
function decode(s){s=s.replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(s.padEnd(Math.ceil(s.length/4)*4,"=")),c=>c.charCodeAt(0))}
export const sessionCookie=value=>`gotoku_admin=${value}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=28800`;
export const clearCookie="gotoku_admin=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=0";
