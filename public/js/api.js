export async function api(path, options={}) {
  const response = await fetch(path, { credentials:"same-origin", ...options, headers:{"Content-Type":"application/json",...(options.headers||{})} });
  const data = await response.json().catch(()=>({error:"Respuesta inválida del servidor"}));
  if (!response.ok) throw new Error(data.error || "No se pudo completar la solicitud");
  return data;
}
