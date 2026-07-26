import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto('http://localhost:8080/register', { waitUntil: 'networkidle' });
const info = await p.evaluate(() => {
  const sep = document.querySelector('.tr-separator');
  const out = [];
  let el = sep;
  while (el && el !== document.body) {
    const cs = getComputedStyle(el);
    out.push({
      tag: el.tagName + '.' + (el.className || '').toString().slice(0, 70),
      w: Math.round(el.getBoundingClientRect().width),
      x: Math.round(el.getBoundingClientRect().x),
      display: cs.display, flex: cs.flex, minWidth: cs.minWidth, inlineSize: cs.inlineSize,
    });
    el = el.parentElement;
  }
  return out;
});
console.log(JSON.stringify(info, null, 1));
await b.close();
