const KEY="gotoku-sushi-cart-v1";
const MAX_QUANTITY=30;
function minOf(x){const m=Math.floor(Number(x&&x.min));return Number.isInteger(m)&&m>=1?Math.min(m,MAX_QUANTITY):1}
export function readCart(){try{return JSON.parse(localStorage.getItem(KEY)||"[]").filter(x=>Number.isInteger(x.id)&&Number.isInteger(x.quantity)&&x.quantity>0&&x.quantity<=MAX_QUANTITY&&Number.isFinite(x.price)&&x.price>=0).map(x=>{const min=minOf(x);return {...x,min,quantity:Math.max(min,x.quantity)}})}catch{return []}}
export function saveCart(cart){localStorage.setItem(KEY,JSON.stringify(cart))}
export function addItem(product,quantity=1){const cart=readCart(),min=Math.max(1,Math.min(MAX_QUANTITY,Math.floor(Number(product.cantidad_minima)||1))),amount=Math.max(min,Math.min(MAX_QUANTITY,Math.floor(Number(quantity)||min)));const item=cart.find(x=>x.id===product.id);if(item){item.min=min;item.quantity=Math.max(min,Math.min(MAX_QUANTITY,item.quantity+amount))}else cart.push({id:product.id,name:product.name,price:product.price,min,quantity:amount});saveCart(cart);return cart}
export function removeItem(id){const cart=readCart().filter(x=>x.id!==id);saveCart(cart);return cart}
export function changeQuantity(id,delta){const cart=readCart().map(x=>x.id===id?{...x,quantity:Math.max(x.min,Math.min(MAX_QUANTITY,x.quantity+delta))}:x);saveCart(cart);return cart}
export function reconcileCart(products){const byId=new Map(products.map(p=>[p.id,p]));const cart=readCart().filter(x=>{const p=byId.get(x.id);return p&&p.comprable}).map(x=>{const p=byId.get(x.id),min=Math.max(1,Math.min(MAX_QUANTITY,Math.floor(Number(p.cantidad_minima)||1)));return {...x,name:p.name,price:p.price,min,quantity:Math.max(min,Math.min(MAX_QUANTITY,x.quantity))}});saveCart(cart);return cart}
export function clearCart(){localStorage.removeItem(KEY)}
