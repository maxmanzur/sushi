import {json} from "../../_lib/response.js";
import {clearCookie} from "../../_lib/auth.js";
export async function onRequestPost(){return new Response(JSON.stringify({ok:true}),{headers:{"Content-Type":"application/json","Set-Cookie":clearCookie,"Cache-Control":"no-store"}})}
