import {api} from "./api.js";
const el=document.querySelector("#tracking");
const params=new URLSearchParams(location.search);
const token=params.get("token")||"";
const isNew=params.get("nuevo")==="1";
const labels={nuevo:"Nuevo",aceptado:"Aceptado",en_preparacion:"En preparación",listo_para_retirar:"Listo para retirar",enviado:"Enviado",entregado:"Entregado",cancelado:"Cancelado"};
const money=n=>new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(Number(n)||0);
function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function formatDate(value){if(!value)return "—";const raw=String(value);const date=new Date(raw.includes("T")?raw:raw.replace(" ","T")+"Z");return Number.isNaN(date.getTime())?"—":new Intl.DateTimeFormat("es-AR",{dateStyle:"short",timeStyle:"short"}).format(date)}
function notFound(){el.innerHTML='<section class="tracking-error"><h2>No encontramos este pedido.</h2><a class="text-button" href="/">Volver al menú</a></section>'}
async function load(){
 if(!/^[a-f0-9]{48}$/.test(token)){notFound();return}
 try{
  const data=await api("/api/orders/"+encodeURIComponent(token));
  const order=data.order||{};
  const items=Array.isArray(data.items)?data.items:[];
  const status=labels[order.status]||esc(order.status||"Sin estado");
  const cancelled=order.status==="cancelado";
  const link=location.origin+"/seguimiento.html?token="+encodeURIComponent(token);
  const confirmation=isNew?'<section class="tracking-confirmation"><p class="eyebrow">GOTOKU SUSHI</p><h2>¡Recibimos tu pedido!</h2><p class="tracking-order-number">Número de pedido: <strong>#'+esc(order.order_number)+'</strong></p><label class="tracking-link-label" for="tracking-link">Enlace privado de seguimiento</label><div class="tracking-copy-row"><input id="tracking-link" class="tracking-link-input" type="text" readonly value="'+esc(link)+'"><button id="copy-tracking-link" class="button button-primary" type="button">Copiar enlace</button></div><p id="copy-feedback" class="muted" role="status" aria-live="polite"></p><p class="tracking-save-note">Guardá este enlace: es la única forma de consultar tu pedido sin cuenta.</p></section>':'';
  el.innerHTML=confirmation+'<section class="tracking-details"><p class="eyebrow">TU PEDIDO</p><h2>Pedido #'+esc(order.order_number)+'</h2><p class="tracking-status'+(cancelled?' tracking-cancelled':'')+'">Estado: <strong>'+status+'</strong></p><p class="tracking-total">Total: <strong>'+money(order.total)+'</strong></p><h3>Productos</h3><ul class="tracking-items">'+items.map(item=>'<li><span>'+esc(item.quantity)+' × '+esc(item.product_name)+'</span></li>').join("")+'</ul><p class="muted tracking-updated">Actualizado: '+esc(formatDate(order.updated_at))+'</p></section>';
  const copyButton=el.querySelector("#copy-tracking-link");
  if(copyButton)copyButton.addEventListener("click",async()=>{
   const field=el.querySelector("#tracking-link"),feedback=el.querySelector("#copy-feedback");
   try{await navigator.clipboard.writeText(field.value);feedback.textContent="Enlace copiado."}
   catch{field.focus();field.select();field.setSelectionRange(0,field.value.length);feedback.textContent="No se pudo copiar automáticamente. El enlace quedó seleccionado para copiarlo."}
  });
 }catch(error){notFound()}
}
load();
setInterval(load,15000);
