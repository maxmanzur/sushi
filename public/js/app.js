import {api} from "./api.js";
import {readCart,addItem,changeQuantity,removeItem,clearCart} from "./cart.js";
const $=s=>document.querySelector(s);
const DELIVERY_KEY="gotoku-sushi-entrega";
const IOS_HINT_KEY="gotoku-sushi-ios-hint";
let products=[],category="all",categories=[];
let deferredInstallPrompt=null;
const installButton=$("#install-app");
const iosInstallHint=$("#ios-install-hint");
function isStandalone(){return window.matchMedia?.("(display-mode: standalone)").matches===true||navigator.standalone===true}
function isIosSafari(){
 const ua=navigator.userAgent||"";
 const ios=/iPhone|iPad|iPod/i.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
 return ios&&/Safari/i.test(ua)&&!/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
}
function updateInstallUI(){
 const installed=isStandalone();
 if(installButton)installButton.hidden=installed||!deferredInstallPrompt;
 if(iosInstallHint)iosInstallHint.hidden=!isIosSafari()||installed||localStorage.getItem(IOS_HINT_KEY)==="1"||$("#menu-view").hidden;
}
window.addEventListener("beforeinstallprompt",event=>{
 if(isStandalone())return;
 event.preventDefault();
 deferredInstallPrompt=event;
 updateInstallUI();
});
window.addEventListener("appinstalled",()=>{
 deferredInstallPrompt=null;
 updateInstallUI();
});
const money=n=>new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function notice(message){const el=$("#notice");el.textContent=message;el.hidden=false}
function deliveryType(){return localStorage.getItem(DELIVERY_KEY)==="delivery"?"delivery":"pickup"}
function setDelivery(type){localStorage.setItem(DELIVERY_KEY,type);$("#delivery-type").value=type;$("#checkout-delivery-label").textContent=type==="delivery"?"Envío a domicilio":"Retiro por el local";$("#delivery-summary").textContent=type==="delivery"?"Modalidad: envío a domicilio":"Modalidad: retiro por el local";$("#address-field").hidden=type!=="delivery";$("#customer-address").required=type==="delivery";const cash=$("#payment-method").querySelector('option[value="cash"]');cash.disabled=type==="delivery";if(type==="delivery")$("#payment-method").value="transfer";syncDiscountHint();renderCart()}
function showMenu(){if(!localStorage.getItem(DELIVERY_KEY))return;$("#welcome").hidden=true;$("#menu-view").hidden=false;setDelivery(deliveryType());updateInstallUI()}
function renderCategories(){const all='<button class="category-chip active" type="button" data-category="all">Todo</button>';$("#categories").innerHTML=all+categories.map(c=>'<button class="category-chip" type="button" data-category="'+c.id+'">'+esc(c.name)+'</button>').join("")}
function renderProducts(){const list=products.filter(p=>category==="all"||String(p.category_id)===category);$("#category-title").textContent=category==="all"?"Todo el menú":(categories.find(c=>String(c.id)===category)?.name||"Menú");$("#products").innerHTML=list.length?list.map(p=>'<article class="product-card">'+(p.image?'<img class="product-image" src="'+esc(p.image)+'" alt="'+esc(p.name)+'" loading="lazy">':"")+'<div class="product-content"><h3>'+esc(p.name)+'</h3><p>'+esc(p.description||"")+'</p><div class="product-bottom"><span class="price">'+(p.comprable?money(p.price):"Precio a confirmar")+'</span>'+(p.comprable?'<div class="product-buy"><div class="quantity-selector" aria-label="Cantidad de '+esc(p.name)+'"><button type="button" data-qty-down="'+p.id+'" aria-label="Restar una unidad">−</button><output data-qty-value="'+p.id+'">1</output><button type="button" data-qty-up="'+p.id+'" aria-label="Sumar una unidad">+</button></div><button class="button button-primary" type="button" data-add="'+p.id+'">Agregar</button></div>':'<button class="button button-primary" type="button" disabled aria-disabled="true">No disponible</button>')+'</div></div></article>').join(""):'<p class="empty-message">Todavía no hay productos publicados en esta categoría.</p>'}
function totals(){const cart=readCart(),subtotal=cart.reduce((n,x)=>n+x.price*x.quantity,0),appliesDiscount=deliveryType()==="pickup"&&$("#payment-method").value==="cash",discount=appliesDiscount?Math.round(subtotal*.1):0;return {cart,subtotal,discount,total:subtotal-discount,appliesDiscount}}
function syncDiscountHint(){$("#discount-hint").textContent=deliveryType()==="pickup"?"10% de descuento aplicado solo en retiro + efectivo.":"Para envíos, el pago es únicamente por transferencia."}
function renderCart(){const {cart,subtotal,discount,total,appliesDiscount}=totals();const count=cart.reduce((n,x)=>n+x.quantity,0);$("#cart-count").textContent=count;$("#bar-count").textContent=count+" "+(count===1?"producto":"productos");$("#bar-total").textContent=money(total);$("#cart-bar").hidden=!cart.length;$("#cart-items").innerHTML=cart.length?cart.map(x=>'<div class="cart-row"><div><strong>'+esc(x.name)+'</strong><div class="muted">'+money(x.price)+' c/u</div></div><div class="cart-actions"><button type="button" data-minus="'+x.id+'" aria-label="Quitar una unidad de '+esc(x.name)+'">−</button><span>'+x.quantity+'</span><button type="button" data-plus="'+x.id+'" aria-label="Agregar una unidad de '+esc(x.name)+'" '+(x.quantity>=30?"disabled":"")+' >+</button><button type="button" class="remove-item" data-remove="'+x.id+'" aria-label="Eliminar '+esc(x.name)+'">Eliminar</button></div></div>').join(""):'<p class="muted">Tu carrito está vacío. Elegí tus favoritos del menú.</p>';$("#cart-summary").innerHTML='<div class="cart-summary"><p class="summary-line"><span>Subtotal</span><b>'+money(subtotal)+'</b></p>'+(appliesDiscount?'<p class="summary-line"><span>Descuento</span><b>−'+money(discount)+'</b></p>':"")+'<p class="summary-total"><span>Total estimado</span><strong>'+money(total)+'</strong></p>'+(deliveryType()==="delivery"?'<p class="form-footnote">El costo de envío se informa por separado.</p>':"")+'</div>';$("#submit-order").disabled=!cart.length}
$("#welcome").addEventListener("click",e=>{const b=e.target.closest("[data-delivery]");if(!b)return;setDelivery(b.dataset.delivery);showMenu()});
$("#change-delivery").addEventListener("click",()=>{$("#menu-view").hidden=true;$("#welcome").hidden=false;$("#cart-bar").hidden=true;window.scrollTo({top:0,behavior:"smooth"})});
installButton.addEventListener("click",async()=>{
 if(!deferredInstallPrompt)return;
 const promptEvent=deferredInstallPrompt;
 deferredInstallPrompt=null;
 updateInstallUI();
 try{await promptEvent.prompt();await promptEvent.userChoice}catch{}
 updateInstallUI();
});
$("#close-ios-install-hint").addEventListener("click",()=>{
 localStorage.setItem(IOS_HINT_KEY,"1");
 updateInstallUI();
});
$("#products").addEventListener("click",e=>{const down=e.target.closest("[data-qty-down]"),up=e.target.closest("[data-qty-up]"),add=e.target.closest("[data-add]");if(down||up){const id=Number(down?down.dataset.qtyDown:up.dataset.qtyUp),out=$('[data-qty-value="'+id+'"]'),value=Number(out.textContent)||1;out.textContent=String(Math.max(1,Math.min(30,value+(up?1:-1))));return}if(!add||add.disabled)return;const p=products.find(x=>x.id===Number(add.dataset.add));if(p&&p.comprable){const quantity=Number($('[data-qty-value="'+p.id+'"]').textContent)||1;addItem(p,quantity);$('[data-qty-value="'+p.id+'"]').textContent="1";renderCart();notice("Agregado a tu pedido.")}});
$("#categories").addEventListener("click",e=>{const b=e.target.closest("[data-category]");if(!b)return;category=b.dataset.category;document.querySelectorAll(".category-chip").forEach(x=>x.classList.toggle("active",x===b));renderProducts()});
function openCart(){if(!localStorage.getItem(DELIVERY_KEY)){notice("Primero elegí envío o retiro.");return}$("#cart-dialog").showModal();renderCart()}
$("#cart-toggle").addEventListener("click",openCart);$("#cart-bar-toggle").addEventListener("click",openCart);$("#cart-close").addEventListener("click",()=>$("#cart-dialog").close());
$("#cart-items").addEventListener("click",e=>{const plus=e.target.closest("[data-plus]"),minus=e.target.closest("[data-minus]"),remove=e.target.closest("[data-remove]");if(remove)removeItem(Number(remove.dataset.remove));else if(plus)changeQuantity(Number(plus.dataset.plus),1);else if(minus)changeQuantity(Number(minus.dataset.minus),-1);renderCart()});
$("#payment-method").addEventListener("change",()=>{syncDiscountHint();renderCart()});
$("#checkout-form").addEventListener("submit",async e=>{e.preventDefault();const cart=readCart();if(!cart.length){notice("Agregá productos antes de confirmar.");return}const f=new FormData(e.currentTarget),idemKey="gotoku-sushi-pending-order";let idem=localStorage.getItem(idemKey);if(!idem){idem=crypto.randomUUID();localStorage.setItem(idemKey,idem)}const type=deliveryType(),pay=f.get("payment_method"),address=String(f.get("customer_address")||"").trim();if(type==="delivery"&&!address){$("#customer-address").focus();notice("Completá la dirección para el envío.");return}if(type==="delivery"&&pay!=="transfer"){notice("El envío se abona únicamente por transferencia.");return}const payload={items:cart.map(x=>({product_id:x.id,quantity:x.quantity})),customer_name:f.get("customer_name"),customer_phone:f.get("customer_phone"),customer_address:address,delivery_type:type,payment_method:pay,notes:f.get("notes"),idempotency_key:idem,website:f.get("website")};const btn=$("#submit-order");btn.disabled=true;btn.textContent="Enviando pedido…";try{const result=await api("/api/orders",{method:"POST",body:JSON.stringify(payload)});clearCart();localStorage.removeItem(idemKey);location.href="/seguimiento.html?token="+encodeURIComponent(result.token)+"&nuevo=1"}catch(err){notice(err.message||"No se pudo enviar el pedido. Intentá nuevamente.")}finally{btn.disabled=false;btn.textContent="Confirmar pedido";renderCart()}});
async function init(){try{const data=await api("/api/menu");products=Array.isArray(data.products)?data.products:[];categories=Array.isArray(data.categories)?data.categories:[];renderCategories();renderProducts();$("#menu-status").textContent=products.length+" productos"}catch(e){$("#menu-status").textContent="Menú no disponible";const el=$("#notice");el.textContent=e.message;el.hidden=false}if(localStorage.getItem(DELIVERY_KEY)==="delivery"||localStorage.getItem(DELIVERY_KEY)==="pickup")showMenu();renderCart()}
updateInstallUI();
init();