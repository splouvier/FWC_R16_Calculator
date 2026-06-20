import { webkit, devices } from "playwright";
const b = await webkit.launch();
// real iPhone Safari profile
const c = await b.newContext({ ...devices["iPhone 13"] });
const p = await c.newPage();
const NEW = "https://fwc26-road-to-the-final.vercel.app";
console.log("Engine: WebKit (Safari) · iPhone 13 viewport 390px\n");
let bad = false;
for (const v of ["simulate","bracket","leaders","schedule","standings","about"]) {
  await p.goto(`${NEW}/?a=Canada&b=Portugal&view=${v}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const vw = document.documentElement.clientWidth; let worst=0, el="";
    document.querySelectorAll("*").forEach(n=>{const x=n.getBoundingClientRect(); if(x.width>0&&x.right>vw+1&&x.right>worst){worst=Math.round(x.right);el=n.tagName.toLowerCase()+"."+(n.className||"").toString().slice(0,34);}});
    return { vw, body: document.body.scrollWidth, worst, el, canScrollX: document.documentElement.scrollWidth > vw };
  });
  if (r.body > r.vw+1 || r.worst>0) { bad=true; console.log(`  ${v}: body=${r.body} OVERFLOW ${r.worst} <${r.el}>`); }
  else console.log(`  ${v}: clean (body=${r.body}, horizontal-scroll=${r.canScrollX})`);
}
// also screenshot the two reported-buggy spots on real WebKit
await p.goto(`${NEW}/?a=Canada&b=Portugal&view=simulate`, { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
await p.screenshot({ path: "/tmp/wk_sim.png", fullPage: true });
console.log(bad ? "\n*** OVERFLOW on Safari engine ***" : "\n=== SAFARI/WEBKIT: ALL CLEAN ===");
await b.close();
