import {json,fail,body} from "../_lib/response.js";
import {randomId,orderNumber} from "../_lib/ids.js";

export async function onRequestPost({request,env}) {
  if (!env.DB) return fail("Base de datos no configurada.",503);
  const x=await body(request);
  if (!x || !Array.isArray(x.items) || !x.items.length || x.items.length>40) return fail("Pedido inválido.");

  const name=String(x.customer_name||"").trim();
  const phone=String(x.customer_phone||"").trim();
  const type=x.delivery_type;
  const pay=x.payment_method;
  if (name.length<2 || name.length>80 || phone.length<6 || phone.length>30) return fail("Revisá nombre y teléfono.");
  if (!["pickup","delivery"].includes(type) || !["cash","transfer"].includes(pay)) return fail("Entrega o pago inválido.");

  const address=String(x.customer_address||"").trim();
  if (type==="delivery" && !address) return fail("Ingresá la dirección de entrega.");
  if (address.length>180) return fail("La dirección es demasiado larga.");

  const idem=String(x.idempotency_key||"");
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(idem)) return fail("Clave de pedido inválida.");

  const seen=await env.DB.prepare("SELECT order_number,tracking_token,total FROM orders WHERE idempotency_key=?").bind(idem).first();
  if (seen) return json({order_number:seen.order_number,token:seen.tracking_token,total:seen.total,reused:true});

  const ids=[...new Set(x.items.map(i=>Number(i.product_id)))];
  if (ids.some(i=>!Number.isInteger(i)||i<1)) return fail("Producto inválido.");
  const rows=await env.DB.prepare("SELECT id,name,price FROM products WHERE active=1 AND id IN ("+ids.map(()=>"?").join(",")+")").bind(...ids).all();
  if (rows.results.length!==ids.length) return fail("Hay productos que ya no están disponibles.");

  const map=new Map(rows.results.map(p=>[p.id,p]));
  let subtotal=0;
  const lines=[];
  for (const item of x.items) {
    const p=map.get(Number(item.product_id));
    const q=Number(item.quantity);
    if (!p || !Number.isInteger(q) || q<1 || q>30) return fail("Cantidad inválida.");
    const lineTotal=p.price*q;
    subtotal+=lineTotal;
    lines.push({id:p.id,name:p.name,price:p.price,q,total:lineTotal});
  }
  if (!Number.isSafeInteger(subtotal) || subtotal>100000000) return fail("El pedido supera el máximo permitido.");

  const discount=type==="pickup" && pay==="cash" ? Math.round(subtotal*.10) : 0;
  const total=subtotal-discount;
  const number=orderNumber();
  const token=randomId(24);
  const note=String(x.notes||"").slice(0,500);

  // D1 batch ejecuta estas escrituras en una única transacción.
  // Las líneas e historial obtienen el ID del pedido mediante la clave idempotente.
  const statements=[
    env.DB.prepare("INSERT INTO orders(order_number,tracking_token,idempotency_key,customer_name,customer_phone,customer_address,delivery_type,payment_method,notes,subtotal,discount,total,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(number,token,idem,name,phone,address,type,pay,note,subtotal,discount,total,"pending"),
    ...lines.map(l=>env.DB.prepare("INSERT INTO order_items(order_id,product_id,product_name,unit_price,quantity,line_total) SELECT id,?,?,?,?,? FROM orders WHERE idempotency_key=?")
      .bind(l.id,l.name,l.price,l.q,l.total,idem)),
    env.DB.prepare("INSERT INTO order_events(order_id,status,note) SELECT id,?,? FROM orders WHERE idempotency_key=?")
      .bind("pending","Pedido recibido",idem)
  ];

  try {
    await env.DB.batch(statements);
    return json({order_number:number,token,total},201);
  } catch (e) {
    const duplicate=await env.DB.prepare("SELECT order_number,tracking_token,total FROM orders WHERE idempotency_key=?").bind(idem).first();
    if (duplicate) return json({order_number:duplicate.order_number,token:duplicate.tracking_token,total:duplicate.total,reused:true});
    return fail("No se pudo registrar el pedido.",500);
  }
}
