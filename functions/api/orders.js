import {json,fail,body} from "../_lib/response.js";
import {randomId,orderNumber} from "../_lib/ids.js";
import {validateOrder} from "../_lib/validate.js";
export async function onRequestPost({request,env}) {
  const x=await body(request);
  if(x&&String(x.website||"").trim())return json({order_number:orderNumber(),token:randomId(24),total:0},200);
  if(!env.DB)return fail("Base de datos no configurada.",503);
  const validation=validateOrder(x);
  if(validation.error)return fail(validation.error);
  const {name,phone,type,pay,address,idem}=validation.value;
  if(type==="delivery"&&pay==="cash")return fail("El envío se paga únicamente por transferencia.");
  const seen=await env.DB.prepare("SELECT order_number,tracking_token,total FROM orders WHERE idempotency_key=?").bind(idem).first();
  if(seen)return json({order_number:seen.order_number,token:seen.tracking_token,total:seen.total,reused:true});
  const recent=await env.DB.prepare("SELECT COUNT(*) AS total FROM orders WHERE customer_phone=? AND created_at >= datetime('now','-10 minutes')").bind(phone).first();
  if(Number(recent?.total||0)>=3)return fail("Demasiados pedidos seguidos. Intentá de nuevo en unos minutos.",429);
  const ids=[...new Set(x.items.map(i=>Number(i?.product_id)))];
  if(ids.some(i=>!Number.isInteger(i)||i<1))return fail("Producto inválido.");
  const rows=await env.DB.prepare("SELECT id,name,price FROM products WHERE active=1 AND id IN ("+ids.map(() => "?").join(",")+")").bind(...ids).all();
  if(rows.results.length!==ids.length)return fail("Hay productos que ya no están disponibles.");
  if(rows.results.some(p=>p.price===null))return fail("Hay productos sin precio confirmado.");
  const map=new Map(rows.results.map(p=>[p.id,p]));
  let subtotal=0;const lines=[];
  for(const item of x.items){
    const p=map.get(Number(item?.product_id)),q=Number(item?.quantity);
    if(!p||!Number.isInteger(q)||q<1||q>30)return fail("Cantidad inválida.");
    const lineTotal=p.price*q;subtotal+=lineTotal;
    lines.push({id:p.id,name:p.name,price:p.price,q,total:lineTotal});
  }
  if(!Number.isSafeInteger(subtotal)||subtotal>100000000)return fail("El pedido supera el máximo permitido.");
  const discount=type==="pickup"&&pay==="cash"?Math.round(subtotal*.10):0,total=subtotal-discount;
  const number=orderNumber(),token=randomId(24),note=String(x.notes||"").slice(0,500);
  const statements=[
    env.DB.prepare("INSERT INTO orders(order_number,tracking_token,idempotency_key,customer_name,customer_phone,customer_address,delivery_type,payment_method,notes,subtotal,discount,total,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(number,token,idem,name,phone,address,type,pay,note,subtotal,discount,total,"nuevo"),
    ...lines.map(l=>env.DB.prepare("INSERT INTO order_items(order_id,product_id,product_name,unit_price,quantity,line_total) SELECT id,?,?,?,?,? FROM orders WHERE idempotency_key=?").bind(l.id,l.name,l.price,l.q,l.total,idem)),
    env.DB.prepare("INSERT INTO order_events(order_id,status,note) SELECT id,?,? FROM orders WHERE idempotency_key=?").bind("nuevo","Pedido recibido",idem)
  ];
  try{await env.DB.batch(statements);return json({order_number:number,token,total},201)}
  catch(e){const duplicate=await env.DB.prepare("SELECT order_number,tracking_token,total FROM orders WHERE idempotency_key=?").bind(idem).first();if(duplicate)return json({order_number:duplicate.order_number,token:duplicate.tracking_token,total:duplicate.total,reused:true});return fail("No se pudo registrar el pedido.",500)}
}
