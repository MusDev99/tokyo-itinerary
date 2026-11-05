// Phone-class performance check (Playwright, Pixel 5, CPU throttled).
// Usage: SHEETS_FIXTURE=1 npm run dev  (other terminal)  then  node scripts/perf-check.mjs [baseUrl] [tripPath]
// Reports: time from tap to first feedback and to the new tab's content, JS bytes on first load, scroll frame times.
import { createRequire } from 'node:module';
// Playwright is installed globally in this repo's dev environments: resolve it the CommonJS way (honours NODE_PATH)
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const base = process.argv[2] || 'http://localhost:4399';
const trip = process.argv[3] || '/japan/tokyo';
const THROTTLE = Number(process.env.CPU_THROTTLE || 4);

const pct = (arr, p) => (arr.length ? [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))] : 0);
const ms = (n) => `${Math.round(n)} ms`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 5'] });
// The Astro dev toolbar overlaps the bottom dock and swallows taps: hide it on every page
await ctx.addInitScript(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style');
    st.textContent = 'astro-dev-toolbar{display:none!important}';
    document.head.appendChild(st);
  });
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

let jsBytes = 0;
page.on('response', async (r) => {
  if (r.request().resourceType() === 'script') jsBytes += Number((await r.headers())['content-length'] || 0);
});

const t0 = Date.now();
await page.goto(`${base}${trip}/overview`, { waitUntil: 'networkidle' });
const firstLoad = Date.now() - t0;

const rows = [];
for (const [label, suffix] of [['Itinerary', ''], ['Pocket', '/pocket'], ['Analysis', '/analysis'], ['Overview', '/overview']]) {
  const target = `${trip}${suffix}`;
  const link = page.locator(`#trip-bottom-nav a[href="${target}"]`);
  if (!(await link.count())) continue;
  await page.evaluate(() => {
    window.__perf = { feedback: 0, t: performance.now() };
    const mark = () => { if (!window.__perf.feedback) window.__perf.feedback = performance.now() - window.__perf.t; };
    new MutationObserver(mark).observe(document.documentElement, { attributes: true, attributeFilter: ['data-nav', 'aria-busy'] });
    document.addEventListener('click', () => { window.__perf.t = performance.now(); }, { capture: true, once: true });
    document.querySelectorAll('a[data-pending]').forEach(() => mark());
  });
  const start = Date.now();
  await link.click();
  await page.waitForURL(`**${target}`, { timeout: 15000 });
  await page.waitForLoadState('load');
  await page.waitForSelector('#trip-bottom-nav');
  rows.push({ tab: label, content: Date.now() - start });
  await page.waitForTimeout(400);
}

// Scroll smoothness on the itinerary
await page.goto(`${base}${trip}`, { waitUntil: 'networkidle' });
const frames = await page.evaluate(async () => {
  const deltas = [];
  let last = performance.now();
  let stop = false;
  const tick = (t) => { deltas.push(t - last); last = t; if (!stop) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  for (let i = 0; i < 40; i++) { window.scrollBy(0, 60); await new Promise((r) => setTimeout(r, 30)); }
  stop = true;
  return deltas.slice(2);
});

console.log(`\nPixel 5, CPU x${THROTTLE}, ${base}${trip}`);
console.log(`first load (networkidle): ${ms(firstLoad)}   JS transferred: ${(jsBytes / 1024).toFixed(0)} KB (dev server: unminified, compare before/after only)`);
console.table(rows.map((r) => ({ tab: r.tab, 'tap -> content': ms(r.content) })));
console.log(`scroll frames: n=${frames.length}  p50=${ms(pct(frames, 0.5))}  p95=${ms(pct(frames, 0.95))}  >32ms: ${frames.filter((d) => d > 32).length}`);
await browser.close();
