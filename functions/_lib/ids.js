export function randomId(bytes=24){const data=new Uint8Array(bytes);crypto.getRandomValues(data);return [...data].map(x=>x.toString(16).padStart(2,"0")).join("")}
export function orderNumber(){const d=new Date();const date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("");return date+"-"+randomId(3).toUpperCase()}
