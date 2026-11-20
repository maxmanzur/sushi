import {api} from "./api.js";
const $=s=>document.querySelector(s);
const msg=s=>{const e=$("#admin-message");e.textContent=s;e.hidden=false};
const statusLabels={nuevo:"Nuevo",aceptado:"Aceptado",en_preparacion:"En preparación",listo_para_retirar:"Listo para retirar",enviado:"Enviado",entregado:"Entregado",cancelado:"Cancelado"};
const nextStatuses=["aceptado","en_preparacion","listo_para_retirar","enviado","entregado","cancelado"];
let audio=null,soundEnabled=false,lastKnownId=0,pollTimer=null,hasMoreOrders=false,loadingMore=false;
function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function money(value){return new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(Number(value)||0)}
function labelType(value){return value==="delivery"?"Envío":"Retiro"}
function labelPayment(value){return value==="cash"?"Efectivo":value==="transfer"?"Transferencia":esc(value)}
function localDate(value){if(!value)return "—";const raw=String(value),normalized=/Z$|[+-]\d{2}:?\d{2}$/.test(raw)?raw:raw.replace(" ","T")+"Z",date=new Date(normalized);return Number.isNaN(date.getTime())?esc(raw):new Intl.DateTimeFormat("es-AR",{dateStyle:"short",timeStyle:"short"}).format(date)}
function quoteFeeLabel(value,currency){try{return new Intl.NumberFormat("es-AR",{style:"currency",currency:String(currency).toUpperCase()}).format(Number(value)/100)}catch{return String(value)+" centavos "+String(currency||"")}}
function beep(){if(!audio||!soundEnabled)return;try{const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.connect(gain);gain.connect(audio.destination);oscillator.frequency.value=880;gain.gain.setValueAtTime(.12,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.4);oscillator.start();oscillator.stop(audio.currentTime+.4)}catch{}}
function filtersQuery(){const p=new URLSearchParams();if($("#filter-status").value)p.set("estado",$("#filter-status").value);if($("#filter-date").value)p.set("desde",$("#filter-date").value);if($("#filter-until").value)p.set("hasta",$("#filter-until").value);return p.toString()}
function orderMarkup(order){
  const id=Number(order.id),isNew=order.status==="nuevo",state=statusLabels[order.status]||String(order.status??""),paid=order.payment_status==="confirmed";
  const controls=isNew?'<div class="order-actions"><button class="button button-primary" type="button" data-action="accept" data-id="'+id+'">Aceptar</button><button class="button button-danger" type="button" data-action="reject" data-id="'+id+'">Rechazar</button></div>':'<label class="status-control">Cambiar estado<select data-status="'+id+'"><option value="">Seleccionar…</option>'+nextStatuses.map(s=>'<option value="'+s+'">'+statusLabels[s]+'</option>').join("")+'</select></label>';
  const alreadyDispatched=Boolean(order.dispatch_state);
  const tracking=(order.tracking_url||order.quote_fee!==null&&order.quote_fee!==undefined)?'<div class="tracking-actions">'+(order.quote_fee!==null&&order.quote_fee!==undefined?'<span>Costo Uber informado aparte: '+quoteFeeLabel(order.quote_fee,order.quote_currency)+'</span>':"")+(order.tracking_url?'<a href="'+esc(order.tracking_url)+'" target="_blank" rel="noopener noreferrer">Ver seguimiento Uber</a><button class="button" type="button" data-copy-tracking="'+esc(order.tracking_url)+'">Copiar enlace</button>':"")+'</div>':"";
  const dispatchControls=order.delivery_type==="delivery"?'<div class="dispatch-actions"><span class="payment-state">Pago: '+(paid?"Confirmado":"Pendiente")+'</span><span class="payment-state">Entrega: '+(order.delivery_status==="ready"?"ESTÁ LISTO PARA ENTREGA":"Pendiente")+'</span>'+(order.payment_method==="transfer"&&!paid?'<button class="button" type="button" data-payment="'+id+'">Confirmar transferencia</button>':order.payment_method!=="transfer"?'<span class="payment-state">Pago no apto para Uber</span>':"")+'<button class="button button-primary" type="button" data-dispatch="'+id+'"'+(paid&&!alreadyDispatched?"":" disabled title=\"Pago pendiente o despacho ya registrado\"")+'>'+(alreadyDispatched?"SOLICITUD REGISTRADA":"ESTÁ LISTO PARA ENTREGA")+'</button>'+tracking+'</div>':"";
  return '<article class="order-card'+(isNew?' order-new':'')+'" data-order-id="'+id+'"><div class="order-top"><div><p class="order-number">Pedido #'+esc(order.order_number)+'</p><h3>'+esc(order.customer_name)+'</h3></div><span class="status-pill status-'+esc(order.status)+'">'+esc(state)+'</span></div><div class="order-meta"><span>'+esc(order.customer_phone)+'</span><span>'+labelType(order.delivery_type)+'</span><span>'+labelPayment(order.payment_method)+'</span><span>'+localDate(order.created_at)+'</span></div><p class="order-total">'+money(order.total)+'</p><div class="order-bottom"><button class="button" type="button" data-detail="'+id+'">Ver detalle</button>'+controls+dispatchControls+'</div><div class="order-detail" id="detail-'+id+'" hidden></div></article>';
}
function renderOrders(orders){$("#orders").innerHTML=orders.length?orders.map(orderMarkup).join(""):'<p class="empty-orders">No hay pedidos para estos filtros.</p>';updateLoadMoreButton()}
function updateLoadMoreButton(){const button=$("#load-more");button.hidden=!hasMoreOrders;button.disabled=loadingMore;button.textContent=loadingMore?"Cargando…":"Cargar más"}
function productMarkup(product){
  return '<article class="product-card admin-product'+(product.active?"":" product-inactive")+'"><div class="product-heading"><b>'+esc(product.name)+'</b><span class="product-state">'+(product.active?"Activo":"Inactivo")+'</span></div>'+
    (product.description?'<p class="product-description">'+esc(product.description)+'</p>':"")+
    '<p class="product-price">'+(product.price===null?"A confirmar":money(product.price))+'</p>'+
    '<form data-product="'+Number(product.id)+'" class="cart-actions"><label class="price-field">Precio<input name="price" type="number" min="0" max="100000000" step="1" inputmode="numeric" value="'+(product.price===null?"":esc(product.price))+'" aria-label="Precio de '+esc(product.name)+'" placeholder="A confirmar"><small>Dejá el campo vacío para indicar “A confirmar”. El cliente no podrá comprarlo.</small></label>'+
    '<label class="active-field"><input name="active" type="checkbox" '+(product.active?"checked":"")+'> Activo (visible y disponible para comprar)</label><button class="button" type="submit">Guardar</button></form></article>';
}
function renderProducts(products){
  const groups=new Map();
  for(const product of products){const key=String(product.category_id);if(!groups.has(key))groups.set(key,{name:product.category_name||"Sin categoría",products:[]});groups.get(key).products.push(product)}
  $("#products").innerHTML=[...groups.values()].map(group=>'<section class="product-category"><h3>'+esc(group.name)+'</h3><div class="product-category-list">'+group.products.map(productMarkup).join("")+'</div></section>').join("")||"<p>No hay productos.</p>";
}
async function refreshOrders({append=false}={}){
  const query=filtersQuery(),data=await api("/api/admin/orders"+(query?"?"+query:"")),orders=data.orders||[];
  if(append){const existing=new Set([...$("#orders").querySelectorAll("[data-order-id]")].map(node=>node.dataset.orderId));const fresh=orders.filter(order=>!existing.has(String(order.id)));if(fresh.length)$("#orders").insertAdjacentHTML("beforeend",fresh.map(orderMarkup).join(""))}
  else renderOrders(orders);
  hasMoreOrders=orders.length===100;updateLoadMoreButton();return orders;
}
async function loadProducts(){const data=await api("/api/admin/products");renderProducts(data.products||[])}
async function refreshOrdersOnly(){try{await refreshOrders();$("#admin-message").hidden=true}catch(error){if(error.message==="No autorizado.")showLogin();msg(error.message)}}
async function poll(){
  if($("#panel").hidden||document.visibilityState!=="visible")return;
  try{const orders=await refreshOrders();const newest=orders.reduce((max,order)=>Math.max(max,Number(order.id)||0),0);if(newest>lastKnownId){lastKnownId=newest;beep()}}
  catch(error){if(error.message==="No autorizado.")showLogin();else msg(error.message)}
}
function showLogin(){$("#panel").hidden=true;$("#login").hidden=false;if(pollTimer){clearInterval(pollTimer);pollTimer=null}}
async function showPanel(){
  $("#login").hidden=true;$("#panel").hidden=false;
  const baseline=await api("/api/admin/orders");
  lastKnownId=(baseline.orders||[]).reduce((max,order)=>Math.max(max,Number(order.id)||0),0);
  if(filtersQuery())await refreshOrders();
  else{const orders=baseline.orders||[];renderOrders(orders);hasMoreOrders=orders.length===100;updateLoadMoreButton()}
  await loadProducts();
  if(!pollTimer)pollTimer=setInterval(poll,8000);
}
$("#login").addEventListener("submit",async event=>{event.preventDefault();try{await api("/api/admin/login",{method:"POST",body:JSON.stringify({username:new FormData(event.currentTarget).get("username"),password:new FormData(event.currentTarget).get("password")})});await showPanel()}catch(error){if(error.message==="No autorizado.")showLogin();msg(error.message)}});
$("#logout").addEventListener("click",async()=>{try{await api("/api/admin/logout",{method:"POST",body:"{}"});location.reload()}catch(error){msg(error.message)}});
$("#sound-toggle").addEventListener("click",async()=>{try{const AudioContextClass=window.AudioContext||window.webkitAudioContext;if(!AudioContextClass){msg("Este navegador no permite activar el sonido.");return}if(!audio)audio=new AudioContextClass();if(audio.state==="suspended")await audio.resume();soundEnabled=true;beep();$("#sound-toggle").textContent="Sonido activado";$("#sound-toggle").disabled=true}catch{msg("No se pudo activar el sonido.")}});
$("#filter-status").addEventListener("change",refreshOrdersOnly);
$("#filter-date").addEventListener("change",refreshOrdersOnly);
$("#filter-until").addEventListener("change",refreshOrdersOnly);
$("#load-more").addEventListener("click",async()=>{
  if(loadingMore||!hasMoreOrders)return;
  const ids=[...$("#orders").querySelectorAll("[data-order-id]")].map(node=>Number(node.dataset.orderId)).filter(Number.isSafeInteger);
  if(!ids.length)return;
  loadingMore=true;updateLoadMoreButton();
  try{const p=new URLSearchParams(filtersQuery());p.set("antes",String(Math.min(...ids)));const data=await api("/api/admin/orders?"+p.toString()),orders=data.orders||[];const existing=new Set([...$("#orders").querySelectorAll("[data-order-id]")].map(node=>node.dataset.orderId));const fresh=orders.filter(order=>!existing.has(String(order.id)));if(fresh.length)$("#orders").insertAdjacentHTML("beforeend",fresh.map(orderMarkup).join(""));hasMoreOrders=orders.length===100}
  catch(error){if(error.message==="No autorizado.")showLogin();msg(error.message)}
  finally{loadingMore=false;updateLoadMoreButton()}
});
$("#orders").addEventListener("click",async event=>{
  const detailButton=event.target.closest("[data-detail]"),actionButton=event.target.closest("[data-action]"),paymentButton=event.target.closest("[data-payment]"),dispatchButton=event.target.closest("[data-dispatch]");
  const copyTrackingButton=event.target.closest("[data-copy-tracking]");
  if(copyTrackingButton){try{await navigator.clipboard.writeText(copyTrackingButton.dataset.copyTracking);msg("Enlace de seguimiento copiado. Podés reenviarlo al cliente.")}catch{msg("No se pudo copiar el enlace. Abrilo y copialo manualmente.")}}
  if(detailButton){
    const id=detailButton.dataset.detail,box=$("#detail-"+id);
    if(!box.hidden){box.hidden=true;detailButton.textContent="Ver detalle";return}
    try{
      const data=await api("/api/admin/orders/"+id),order=data.order;
      const address=order.delivery_type==="delivery"?'<p><strong>Dirección:</strong> '+esc(order.customer_address||"—")+'</p>':"";
      const notes=order.notes?'<p><strong>Observaciones:</strong> '+esc(order.notes)+'</p>':"";
      box.innerHTML='<div class="detail-grid"><p><strong>Cliente:</strong> '+esc(order.customer_name)+'</p><p><strong>Teléfono:</strong> '+esc(order.customer_phone)+'</p><p><strong>Tipo:</strong> '+labelType(order.delivery_type)+'</p>'+address+'<p><strong>Pago:</strong> '+labelPayment(order.payment_method)+'</p><p><strong>Subtotal:</strong> '+money(order.subtotal)+'</p><p><strong>Descuento:</strong> −'+money(order.discount)+'</p><p><strong>Total:</strong> '+money(order.total)+'</p></div><h4>Productos</h4><ul>'+data.items.map(item=>'<li>'+esc(item.quantity)+' × '+esc(item.product_name)+' — '+money(item.line_total)+'</li>').join("")+'</ul>'+notes+'<h4>Historial</h4><ul>'+data.events.map(entry=>'<li>'+esc(statusLabels[entry.status]||entry.status)+' — '+localDate(entry.created_at)+(entry.note?' · '+esc(entry.note):"")+'</li>').join("")+'</ul>';
      box.hidden=false;detailButton.textContent="Ocultar detalle";
    }catch(error){msg(error.message)}
  }
  if(paymentButton){
    const id=paymentButton.dataset.payment;
    if(!window.confirm("¿Confirmás que el pago de este pedido fue recibido?"))return;
    try{await api("/api/admin/orders/"+id+"/payment",{method:"POST",body:"{}"});await refreshOrdersOnly()}catch(error){msg(error.message)}
  }
  if(dispatchButton){
    const id=dispatchButton.dataset.dispatch;
    if(dispatchButton.disabled)return;
    const originalText=dispatchButton.textContent.trim()||"ESTÁ LISTO PARA ENTREGA";
    dispatchButton.disabled=true;
    dispatchButton.textContent="ENVIANDO…";
    dispatchButton.setAttribute("aria-busy","true");
    dispatchButton.classList.add("dispatch-pending");
    try{
      const result=await api("/api/admin/orders/"+id+"/dispatch",{method:"POST",body:"{}",timeoutMs:20000});
      await refreshOrders();
      msg(result.message||"Solicitud procesada.");
    }catch(error){
      if(error.message.startsWith("El servidor no respondió")){
        try{await refreshOrders()}catch{}
      }
      dispatchButton.disabled=false;
      dispatchButton.textContent=originalText;
      dispatchButton.removeAttribute("aria-busy");
      dispatchButton.classList.remove("dispatch-pending");
      msg(error.message);
    }
  }
  if(actionButton){
    const id=actionButton.dataset.id,status=actionButton.dataset.action==="accept"?"aceptado":"cancelado";
    if(status==="cancelado"&&!window.confirm("¿Rechazar y cancelar este pedido?"))return;
    try{await api("/api/admin/orders/"+id,{method:"PATCH",body:JSON.stringify({status})});await refreshOrdersOnly()}catch(error){msg(error.message)}
  }
});
$("#orders").addEventListener("change",async event=>{const select=event.target.closest("[data-status]");if(!select||!select.value)return;try{await api("/api/admin/orders/"+select.dataset.status,{method:"PATCH",body:JSON.stringify({status:select.value})});await refreshOrdersOnly()}catch(error){msg(error.message)}});
$("#products").addEventListener("submit",async event=>{
  const form=event.target.closest("[data-product]");if(!form)return;event.preventDefault();
  const raw=String(new FormData(form).get("price")??"").trim();
  if(raw!==""&&!/^(0|[1-9]\d*)$/.test(raw)){msg("El precio debe ser un número entero entre 0 y 100000000.");return}
  const price=raw===""?null:Number(raw);
  if(price!==null&&(!Number.isSafeInteger(price)||price<0||price>100000000)){msg("El precio debe ser un número entero entre 0 y 100000000.");return}
  try{await api("/api/admin/products/"+form.dataset.product,{method:"PATCH",body:JSON.stringify({price,active:form.elements.active.checked})});msg("Producto actualizado.");await loadProducts()}
  catch(error){msg(error.message)}
});
(async()=>{try{await showPanel()}catch(error){showLogin();if(error.message!=="No autorizado.")msg(error.message)}})();
