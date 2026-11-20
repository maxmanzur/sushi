const KEY="gotoku-sushi-cart-v1";
const MAX_QUANTITY=30;
export function readCart(){try{return JSON.parse(localStorage.getItem(KEY)||"[]").filter(x=>Number.isInteger(x.id)&&Number.isInteger(x.quantity)&&x.quantity>0&&x.quantity<=MAX_QUANTITY&&Number.isFinite(x.price)&&x.price>=0)}catch{return []}}
export function saveCart(cart){localStorage.setItem(KEY,JSON.stringify(cart))}
export function addItem(product){const cart=readCart();const item=cart.find(x=>x.id===product.id);if(item){if(item.quantity<MAX_QUANTITY)item.quantity++}else cart.push({id:product.id,name:product.name,price:product.price,quantity:1});saveCart(cart);return cart}
export function changeQuantity(id,delta){const cart=readCart().map(x=>x.id===id?{...x,quantity:Math.max(0,Math.min(MAX_QUANTITY,x.quantity+delta))}:x).filter(x=>x.quantity>0);saveCart(cart);return cart}
export function clearCart(){localStorage.removeItem(KEY)}