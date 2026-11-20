export function validateOrder(x) {
  if (!x || !Array.isArray(x.items) || !x.items.length || x.items.length > 40) return {error:"Pedido inválido."};
  const name=String(x.customer_name||"").trim(), phone=String(x.customer_phone||"").trim();
  const type=x.delivery_type, pay=x.payment_method;
  if(name.length<2||name.length>80||phone.length<6||phone.length>30)return {error:"Revisá nombre y teléfono."};
  if(!["pickup","delivery"].includes(type)||!["cash","transfer"].includes(pay))return {error:"Entrega o pago inválido."};
  const address=String(x.customer_address||"").trim();
  if(type==="delivery"&&!address)return {error:"Ingresá la dirección de entrega."};
  if(address.length>180)return {error:"La dirección es demasiado larga."};
  const idem=String(x.idempotency_key||"");
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(idem))return {error:"Clave de pedido inválida."};
  return {value:{name,phone,type,pay,address,idem}};
}
