#!/usr/bin/env node
/**
 * scripts/build-india-map.mjs: builds the India map (design.md §Visual system 4) from DataMeet's state boundaries.
 *
 * Source: States/Admin2 (.shp + .dbf) from https://github.com/datameet/maps (DataMeet India community, CC BY 4.0;
 * J&K and Ladakh follow the Survey of India map since 2021, datameet/maps#70). Approved as the source in D-052.
 * Download the four Admin2 files, then:  node scripts/build-india-map.mjs <folder with Admin2.*>
 *
 * Writes packages/shared/src/india-map/india-map.json (web and app) and design/mockups/shared/india-map.js (the
 * mockup). Dependency-free: reads the shapefile, projects (equirectangular, scaled at 23°N), simplifies each ring
 * (Douglas-Peucker) and keeps one SVG path per region, keyed by the storefront's region slug, plus a marker point
 * (the middle of each region's largest ring) for regions too small to point at.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node scripts/build-india-map.mjs <folder with Admin2.shp/.dbf>');
const shp = readFileSync(path.join(dir, 'Admin2.shp'));
const dbf = readFileSync(path.join(dir, 'Admin2.dbf'));

// --- dbf: record names (first character field)
const nRec = dbf.readUInt32LE(4), headLen = dbf.readUInt16LE(8), recLen = dbf.readUInt16LE(10);
const fieldLen = dbf[32 + 16];
const names = [];
for (let i = 0; i < nRec; i++) {
  const off = headLen + i * recLen + 1;
  names.push(dbf.toString('latin1', off, off + fieldLen).trim());
}

// --- shp: polygon records (type 5) → rings of [lon, lat]
const shapes = [];
let off = 100;
while (off < shp.length) {
  const len = shp.readInt32BE(off + 4) * 2;
  const rec = off + 8;
  if (shp.readInt32LE(rec) === 5) {
    const nParts = shp.readInt32LE(rec + 36), nPts = shp.readInt32LE(rec + 40);
    const parts = [];
    for (let p = 0; p < nParts; p++) parts.push(shp.readInt32LE(rec + 44 + p * 4));
    const pts = rec + 44 + nParts * 4;
    shapes.push(parts.map((start, p) => {
      const end = p + 1 < nParts ? parts[p + 1] : nPts;
      const ring = [];
      for (let k = start; k < end; k++) ring.push([shp.readDoubleLE(pts + k * 16), shp.readDoubleLE(pts + k * 16 + 8)]);
      return ring;
    }));
  } else shapes.push([]);
  off = rec + len;
}

// --- projection
const K = Math.cos((23 * Math.PI) / 180);
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const [lon, lat] of shapes.flat(2)) {
  minX = Math.min(minX, lon * K); maxX = Math.max(maxX, lon * K);
  minY = Math.min(minY, -lat); maxY = Math.max(maxY, -lat);
}
const W = 1000, S = W / (maxX - minX), H = Math.round((maxY - minY) * S);
const proj = ([lon, lat]) => [(lon * K - minX) * S, (-lat - minY) * S];

// --- Douglas-Peucker
function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, d2 = dx * dx + dy * dy || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const t = Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / d2));
      const ex = ax + t * dx - pts[i][0], ey = ay + t * dy - pts[i][1], e = ex * ex + ey * ey;
      if (e > max) { max = e; idx = i; }
    }
    if (max > tol * tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const area = (r) => Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);

const slug = (n) => n.toLowerCase().replace(/&/g, 'and').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
const SLUGS = { 'andaman-and-nicobar': 'andaman-and-nicobar-islands' };
const TINY = new Set(['lakshadweep', 'andaman-and-nicobar-islands', 'puducherry', 'dadra-and-nagar-haveli-and-daman-and-diu', 'goa', 'chandigarh', 'delhi']);

const paths = {};
const centers = {};
names.forEach((name, i) => {
  const s = SLUGS[slug(name)] ?? slug(name);
  const tiny = TINY.has(s);
  const big = shapes[i].map((ring) => ring.map(proj)).sort((x, y) => area(y) - area(x))[0];
  const xs = big.map((p) => p[0]), ys = big.map((p) => p[1]);
  centers[s] = [Math.round((Math.min(...xs) + Math.max(...xs)) / 2), Math.round((Math.min(...ys) + Math.max(...ys)) / 2)];
  paths[s] = shapes[i]
    .map((ring) => ring.map(proj))
    .filter((r) => area(r) > (tiny ? 0.04 : 2)) // drop specks, keep small islands and enclaves
    .map((r) => simplify(r, tiny ? 0.15 : 1.1))
    .filter((r) => r.length >= 3)
    .map((r) => 'M' + r.map((p) => p[0].toFixed(tiny ? 1 : 0) + ' ' + p[1].toFixed(tiny ? 1 : 0)).join('L') + 'Z')
    .join('');
});

const map = { viewBox: `0 0 ${W} ${H}`, paths, centers };
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
writeFileSync(path.join(root, 'packages/shared/src/india-map/india-map.json'), JSON.stringify(map) + '\n');
writeFileSync(
  path.join(root, 'design/mockups/shared/india-map.js'),
  `/* Generated by scripts/build-india-map.mjs from DataMeet India state boundaries (CC BY 4.0,\n * https://github.com/datameet/maps). Do not edit by hand. */\nwindow.IWC = window.IWC || {};\nIWC.indiaMap = ${JSON.stringify(map)};\n`,
);
console.log(Object.keys(paths).length, 'regions written');
