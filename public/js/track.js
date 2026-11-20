import {api} from "./api.js";
const el=document.querySelector("#tracking"),token=new URLSearchParams(location.search).get("token");
const labels={nuevo:"Nuevo",aceptado:"Aceptado",en_preparacion:"En preparación",listo_para_retirar:"Listo para retirar",enviado:"Enviado",entregado:"Entregado",cancelado:"Cancelado"};
async function load(){if(!token){el.textContent="Falta el código privado de seguimiento.";return}try{const d=await api("/api/orders/"+encodeURIComponent(token));el.innerHTML='<h2>Pedido #'+d.order.order_number+'</h2><p>Estado: <b>'+(labels[d.order.status]||safe(d.order.status))+'</b></p><p>Total: <b>'+new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(d.order.total)+'</b></p><ul>'+d.items.map(i=>'<li>'+i.quantity+' × '+safe(i.product_name)+'</li>').join("")+'</ul><p class="muted">Actualizado: '+safe(d.order.updated_at)+'</p>'}catch(e){el.textContent=e.message}}
function safe(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
load();setInterval(load,15000);
