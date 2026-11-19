// Generates the app icons (PNG) and favicon (SVG) into public/.
// Run: node scripts/generate-icons.mjs
//
// No image libraries: the icon is drawn from simple shapes (a peso sign on a blue
// square), rasterized with 4x4 supersampling, and encoded with Node's built-in zlib.
// Full-bleed square on purpose: iOS rounds the corners itself, and Android's
// maskable crop stays clear of the glyph (it sits inside the 80% safe zone).
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(outDir, { recursive: true });

const BG = [0x25, 0x63, 0xeb]; // --accent (light)
const FG = [0xff, 0xff, 0xff];

// Glyph geometry in unit coordinates (0..1), shared by the PNG and SVG outputs.
const stem = { x0: 0.355, x1: 0.445, y0: 0.24, y1: 0.78 };
const bowl = { cx: 0.47, cy: 0.405, rOuter: 0.165, rInner: 0.075 };
const bars = [
  { x0: 0.27, x1: 0.7, y0: 0.335, y1: 0.375 },
  { x0: 0.27, x1: 0.7, y0: 0.435, y1: 0.475 },
];

function inRect(x, y, r) {
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}

/** True if (x, y) is inside the peso sign. */
function inGlyph(x, y) {
  if (inRect(x, y, stem)) return true;
  if (bars.some((b) => inRect(x, y, b))) return true;
  // The P's bowl: right half of a ring, joined to the stem by its top and bottom arms.
  const dx = x - bowl.cx;
  const dy = y - bowl.cy;
  const d = Math.hypot(dx, dy);
  if (dx >= 0 && d <= bowl.rOuter && d >= bowl.rInner) return true;
  const top = { x0: stem.x0, x1: bowl.cx, y0: bowl.cy - bowl.rOuter, y1: bowl.cy - bowl.rInner };
  const bottom = { x0: stem.x0, x1: bowl.cx, y0: bowl.cy + bowl.rInner, y1: bowl.cy + bowl.rOuter };
  return inRect(x, y, top) || inRect(x, y, bottom);
}

function renderRgb(size) {
  const SS = 4;
  const rows = [];
  for (let py = 0; py < size; py += 1) {
    const row = Buffer.alloc(1 + size * 3); // leading 0 = PNG filter "none"
    for (let px = 0; px < size; px += 1) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          if (inGlyph((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size)) hits += 1;
        }
      }
      const a = hits / (SS * SS);
      for (let c = 0; c < 3; c += 1) {
        row[1 + px * 3 + c] = Math.round(BG[c] * (1 - a) + FG[c] * a);
      }
    }
    rows.push(row);
  }
  return Buffer.concat(rows);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // color type: RGB (opaque, as iOS expects)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(renderRgb(size), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outputs = {
  'apple-touch-icon.png': 180, // iOS home screen
  'pwa-192x192.png': 192,
  'pwa-512x512.png': 512,
  'maskable-512x512.png': 512,
};
for (const [name, size] of Object.entries(outputs)) {
  writeFileSync(join(outDir, name), png(size));
  console.log(`wrote public/${name}`);
}

// Favicon: same shapes as SVG, with rounded corners for browser tabs.
const r = (rect) =>
  `<rect x="${rect.x0 * 100}" y="${rect.y0 * 100}" width="${(rect.x1 - rect.x0) * 100}" height="${(rect.y1 - rect.y0) * 100}"/>`;
const { cx, cy, rOuter, rInner } = bowl;
const bowlPath =
  `M${stem.x0 * 100} ${(cy - rOuter) * 100}H${cx * 100}` +
  `A${rOuter * 100} ${rOuter * 100} 0 0 1 ${cx * 100} ${(cy + rOuter) * 100}H${stem.x0 * 100}` +
  `V${(cy + rInner) * 100}H${cx * 100}` +
  `A${rInner * 100} ${rInner * 100} 0 0 0 ${cx * 100} ${(cy - rInner) * 100}H${stem.x0 * 100}Z`;
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
  `<rect width="100" height="100" rx="22" fill="#2563eb"/>` +
  `<g fill="#fff">${r(stem)}${bars.map(r).join('')}<path d="${bowlPath}"/></g></svg>\n`;
writeFileSync(join(outDir, 'favicon.svg'), svg);
console.log('wrote public/favicon.svg');
