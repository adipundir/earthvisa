// Generates src/data/world-dots.json - a dot-matrix world map where every dot
// carries the ISO3 of the country it falls in. The landing explorer colors
// the dots by the selected passport's access level per destination (the
// "reach map"). Precomputed so the client ships plain coordinates, no geo
// libraries. Source geometry: world.geo.json (Natural Earth derived,
// ISO A3 feature ids), fetched at generation time - re-run only if the dot
// grid or country set changes: node scripts/build-world-dots.mjs
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const GEO_URL = "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json";
const OUT = join(process.cwd(), "src", "data", "world-dots.json");

// Grid pitch in degrees. 2.4° ≈ 1,100 land dots - dense enough to read as a
// map, light enough to ship (compact triplet arrays, gzips well) and render as plain SVG circles.
const STEP = 2.6;
// Antarctica has no visa corridors and eats 3 rows of dots - drop it.
const SKIP = new Set(["ATA", "ATF", "-99"]);

const res = await fetch(GEO_URL);
if (!res.ok) { console.error(`fetch failed: ${res.status}`); process.exit(1); }
const geo = await res.json();

function inRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inPolygon(lon, lat, poly) {
  if (!inRing(lon, lat, poly[0])) return false;
  for (let h = 1; h < poly.length; h++) if (inRing(lon, lat, poly[h])) return false;
  return true;
}
function inFeature(lon, lat, geom) {
  if (geom.type === "Polygon") return inPolygon(lon, lat, geom.coordinates);
  if (geom.type === "MultiPolygon") return geom.coordinates.some((p) => inPolygon(lon, lat, p));
  return false;
}

const feats = geo.features.filter((f) => f.id && !SKIP.has(f.id));
const dots = [];
for (let lat = 84; lat >= -60; lat -= STEP) {
  for (let lon = -180; lon <= 180; lon += STEP) {
    const hit = feats.find((f) => inFeature(lon, lat, f.geometry));
    if (hit) dots.push({ lon, lat, iso3: hit.id });
  }
}

// Countries whose landmass is smaller than the grid pitch (Singapore, the
// island microstates) would otherwise vanish - give each missing country one
// dot at its geometry's bounding-box centre.
const seen = new Set(dots.map((d) => d.iso3));
for (const f of feats) {
  if (seen.has(f.id)) continue;
  let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
  const walk = (c) => {
    if (typeof c[0] === "number") {
      minLon = Math.min(minLon, c[0]); maxLon = Math.max(maxLon, c[0]);
      minLat = Math.min(minLat, c[1]); maxLat = Math.max(maxLat, c[1]);
    } else c.forEach(walk);
  };
  walk(f.geometry.coordinates);
  dots.push({ lon: (minLon + maxLon) / 2, lat: (minLat + maxLat) / 2, iso3: f.id });
}

// Equirectangular projection into a 0..1000 x 0..520 viewBox (lat 84..-60).
// compact triplets [x, y, iso3] - keys would be 40% of the file
const out = dots.map((d) => [
  Math.round(((d.lon + 180) / 360) * 1000 * 10) / 10,
  Math.round(((84 - d.lat) / 144) * 520 * 10) / 10,
  d.iso3,
]);
writeFileSync(OUT, JSON.stringify(out));
const countries = new Set(out.map((d) => d[2]));
console.log(`src/data/world-dots.json: ${out.length} dots, ${countries.size} countries, ${(JSON.stringify(out).length / 1024).toFixed(1)}KB`);
