const KEY="gotoku-sushi-cart-v1";
export function readCart(){try{return JSON.parse(localStorage.getItem(KEY)||"[]").filter(x=>Number.isInteger(x.id)&&Number.isInteger(x.quantity)&&x.quantity>0)}catch{return []}}
export function saveCart(cart){localStorage.setItem(KEY,JSON.stringify(cart))}
export function addItem(product){const cart=readCart();const item=cart.find(x=>x.id===product.id);if(item)item.quantity++;else cart.push({id:product.id,name:product.name,price:product.price,quantity:1});saveCart(cart);return cart}
export function changeQuantity(id,delta){let cart=readCart().map(x=>x.id===id?{...x,quantity:x.quantity+delta}:x).filter(x=>x.quantity>0);saveCart(cart);return cart}
export function clearCart(){localStorage.removeItem(KEY)}
