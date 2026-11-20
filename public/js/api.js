export async function api(path, options={}) {
  const {timeoutMs=20000,...requestOptions}=options;
  const controller=new AbortController();
  const externalSignal=requestOptions.signal;
  let timedOut=false;
  const abortFromCaller=()=>controller.abort(externalSignal?.reason);
  if(externalSignal){
    if(externalSignal.aborted)abortFromCaller();
    else externalSignal.addEventListener("abort",abortFromCaller,{once:true});
  }
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
  try{
    const response=await fetch(path,{credentials:"same-origin",...requestOptions,signal:controller.signal,headers:{"Content-Type":"application/json",...(requestOptions.headers||{})}});
    const data=await response.json().catch(()=>({error:"Respuesta inválida del servidor"}));
    if(!response.ok)throw new Error(data.error||"No se pudo completar la solicitud");
    return data;
  }catch(error){
    if(timedOut)throw new Error("El servidor no respondió dentro de "+Math.round(timeoutMs/1000)+" segundos. El resultado del despacho puede haberse registrado; actualizá el panel antes de volver a intentarlo.");
    if(error?.name==="AbortError")throw new Error("Solicitud cancelada.");
    throw error;
  }finally{
    clearTimeout(timer);
    if(externalSignal)externalSignal.removeEventListener("abort",abortFromCaller);
  }
}
