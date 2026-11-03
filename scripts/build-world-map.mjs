#!/usr/bin/env node
// Regenerates public/world-map.svg: the land outline of the world as ONE path (equirectangular, 2 units per
// degree, Antarctica cropped, tiny islands dropped). The page paints it with CSS mask-image so it follows the season colours
// and is cached by the service worker instead of being inlined in every page. Run only when the map style changes: `node scripts/build-world-map.mjs`.
// The output is committed, so the app has no map dependency at build or run time .
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve('world-atlas/land-110m.json'), 'utf8'));
const land = feature(topo, topo.objects.land);

const S = 2; // units per degree
const LAT_MAX = 84;
const LAT_MIN = -58;
const x = (lon) => Math.round((lon + 180) * S);
const y = (lat) => Math.round((LAT_MAX - Math.max(LAT_MIN, Math.min(LAT_MAX, lat))) * S);

const rings = [];
for (const f of land.features ?? [land]) {
  const g = f.geometry ?? f;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const poly of polys) for (const ring of poly) rings.push(ring);
}
let d = '';
let kept = 0;
for (const ring of rings) {
  if (ring.every(([, lat]) => lat < LAT_MIN)) continue; // Antarctica
  // A ring that crosses the antimeridian jumps ~360 degrees between neighbours: break the line there, or it
  // draws a straight stripe across the whole map.
  const segs = [];
  let seg = [];
  let last = '';
  let prevLon = null;
  for (const [lon, lat] of ring) {
    const p = `${x(lon)} ${y(lat)}`;
    if (prevLon !== null && Math.abs(lon - prevLon) > 180 && seg.length) {
      segs.push(seg);
      seg = [];
      last = '';
    }
    if (p !== last) seg.push(p);
    last = p;
    prevLon = lon;
  }
  if (seg.length) segs.push(seg);
  for (const pts of segs) {
    const xs = pts.map((q) => +q.split(' ')[0]);
    const ys = pts.map((q) => +q.split(' ')[1]);
    const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    if (pts.length < 4 || size < 3) continue; // dots smaller than 1.5 degrees
    d += `M${pts.join('L')}Z`;
    kept++;
  }
}
const W = 360 * S;
const H = (LAT_MAX - LAT_MIN) * S;
writeFileSync(
  new URL('../public/world-map.svg', import.meta.url),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><path d="${d}"/></svg>\n`,
);
console.log(`world map: ${kept} shapes, ${(d.length / 1024).toFixed(1)} KB, viewBox 0 0 ${W} ${H}`);
