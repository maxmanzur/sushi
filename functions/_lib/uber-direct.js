let tokenCache={value:null,expiresAt:0};
function required(env,key){const value=env[key];if(typeof value!=="string"||!value.trim())throw new Error("Falta configurar "+key+".");return value.trim()}
async function accessToken(env){
  if(tokenCache.value&&tokenCache.expiresAt>Date.now()+60000)return tokenCache.value;
  const authUrl=required(env,"UBER_AUTH_URL");
  const clientId=required(env,"UBER_CLIENT_ID");
  const clientSecret=required(env,"UBER_CLIENT_SECRET");
  const response=await fetch(authUrl,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,grant_type:"client_credentials",scope:"eats.deliveries"})});
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data?.access_token)throw new Error("Uber OAuth no devolvió un token válido (HTTP "+response.status+").");
  tokenCache={value:data.access_token,expiresAt:Date.now()+Math.max(60,Number(data.expires_in)||0)*1000};
  return tokenCache.value;
}
async function uberRequest(env,path,{method="GET",body}={}){
  const base=required(env,"UBER_API_BASE_URL").replace(/\/$/,"");
  const customerId=required(env,"UBER_CUSTOMER_ID");
  const token=await accessToken(env);
  const response=await fetch(base+"/v1/customers/"+encodeURIComponent(customerId)+path,{method,headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error("Uber Direct respondió HTTP "+response.status+(data?.message?": "+data.message:"")+".");
  return data||{};
}
export async function quote_delivery(env,payload){
  if(!payload||typeof payload!=="object")throw new Error("Faltan datos para cotizar.");
  return uberRequest(env,"/delivery_quotes",{method:"POST",body:payload});
}
export async function create_delivery(env,payload){
  if(!payload||typeof payload!=="object"||!payload.quote_id)throw new Error("La creación requiere quote_id.");
  return uberRequest(env,"/deliveries",{method:"POST",body:payload});
}
export async function get_delivery(env,deliveryId){
  if(!deliveryId)throw new Error("Falta delivery_id.");
  return uberRequest(env,"/deliveries/"+encodeURIComponent(deliveryId));
}
export async function cancel_delivery(env,deliveryId){
  if(!deliveryId)throw new Error("Falta delivery_id.");
  return uberRequest(env,"/deliveries/"+encodeURIComponent(deliveryId),{method:"DELETE"});
}
