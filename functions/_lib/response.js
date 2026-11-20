export const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
export const fail=(message,status=400)=>json({error:message},status);
export async function body(request){try{return await request.json()}catch{return null}}
