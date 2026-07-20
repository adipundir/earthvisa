// Generates src/app/favicon.ico from the Earth Visa "Orbit" mark.
//
// WHY THIS EXISTS: Next's app/icon.svg only emits an SVG <link rel="icon">.
// Safari (even 17+) is unreliable with SVG-only favicons and falls back to
// requesting /favicon.ico at the site root - if that 404s it shows a generic
// placeholder, which is why the tab icon was missing in Safari but fine in
// Chrome/Firefox. A real multi-size favicon.ico fixes it. Re-run after a brand
// change: node scripts/make-favicon.mjs
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src", "app", "favicon.ico");

// v2 mark: brand-red tile, white planet + orbit, ink node. Rounded corners are
// dropped for the .ico (browsers/OSes crop tab icons to their own shape and a
// full-bleed tile reads more solidly at 16px than a rounded one).
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <rect width="48" height="48" fill="#b23528"/>
  <circle cx="24" cy="24" r="8.5" fill="#ffffff"/>
  <g transform="rotate(-26 24 24)">
    <ellipse cx="24" cy="24" rx="16" ry="6.1" fill="none" stroke="#ffffff" stroke-width="2.6"/>
    <circle cx="40" cy="24" r="3.2" fill="#0b0e14"/>
  </g>
</svg>`;

const sizes = [16, 32, 48];
const pngs = await Promise.all(
  sizes.map((s) => sharp(Buffer.from(svg)).resize(s, s).png().toBuffer()),
);

// Encode an ICO whose images are PNG-compressed (valid since Windows Vista and
// accepted by every current browser incl. Safari). Layout: ICONDIR (6 bytes),
// one 16-byte ICONDIRENTRY per image, then the PNG payloads.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: 1 = icon
header.writeUInt16LE(sizes.length, 4); // image count

const entries = [];
let offset = 6 + sizes.length * 16;
for (let i = 0; i < sizes.length; i++) {
  const s = sizes[i];
  const png = pngs[i];
  const e = Buffer.alloc(16);
  e.writeUInt8(s >= 256 ? 0 : s, 0); // width  (0 => 256)
  e.writeUInt8(s >= 256 ? 0 : s, 1); // height (0 => 256)
  e.writeUInt8(0, 2); // palette count
  e.writeUInt8(0, 3); // reserved
  e.writeUInt16LE(1, 4); // color planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(png.length, 8); // size of PNG data
  e.writeUInt32LE(offset, 12); // offset to PNG data
  entries.push(e);
  offset += png.length;
}

const ico = Buffer.concat([header, ...entries, ...pngs]);
writeFileSync(OUT, ico);
console.log(`Wrote ${OUT} (${sizes.join("/")}px, ${ico.length} bytes)`);
