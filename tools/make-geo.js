// Builds the radar base data (public-domain Natural Earth):
//   assets/geo/world-110m.json — country polygons (filled landmass + country borders when stroked)
//   assets/geo/cities.json     — major city points + names
// Coordinates rounded to ~11 km. For finer (state/province) borders, point COUNTRIES_URL at
// ne_50m_admin_1_states_provinces.geojson instead (larger file).
//
// Usage:
//   node tools/make-geo.js                              # downloads from Natural Earth
//   node tools/make-geo.js countries.geojson cities.geojson  # use local files instead
//
// Requires Node 18+ (built-in fetch). No npm deps.

var fs = require("fs");
var path = require("path");

// admin-0 = all countries (complete, incl. Europe) → country borders when stroked.
var URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";
var PRECISION = 2;        // decimal places (~1 km) — keeps small (European) admin-1 regions
var MIN_RING = 3;         // drop rings with fewer points
var OUT = path.join(__dirname, "..", "assets", "geo", "world-110m.json");

function round(n) { var f = Math.pow(10, PRECISION); return Math.round(n * f) / f; }

// round coords, drop consecutive duplicates
function thinRing(ring) {
  var out = [], prev = null;
  for (var i = 0; i < ring.length; i++) {
    var p = [round(ring[i][0]), round(ring[i][1])];
    if (!prev || p[0] !== prev[0] || p[1] !== prev[1]) { out.push(p); prev = p; }
  }
  return out;
}

function thinPolygon(rings) {
  return rings.map(thinRing).filter(function (r) { return r.length >= MIN_RING; });
}

function thinGeometry(g) {
  if (!g) return null;
  if (g.type === "Polygon") { var p = thinPolygon(g.coordinates); return p.length ? { type: "Polygon", coordinates: p } : null; }
  if (g.type === "MultiPolygon") {
    var polys = g.coordinates.map(thinPolygon).filter(function (p) { return p.length; });
    return polys.length ? { type: "MultiPolygon", coordinates: polys } : null;
  }
  return null;
}

async function getInput() {
  var arg = process.argv[2];
  if (arg) return JSON.parse(fs.readFileSync(arg, "utf8"));
  var res = await fetch(URL);
  if (!res.ok) throw new Error("download failed: HTTP " + res.status);
  return res.json();
}

(async function () {
  var src = await getInput();
  var features = (src.features || []).map(function (f) {
    var g = thinGeometry(f.geometry);
    return g ? { type: "Feature", geometry: g } : null;   // drop properties to save space
  }).filter(Boolean);
  var out = { type: "FeatureCollection", features: features };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  var kb = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log("wrote " + OUT + " — " + features.length + " features, " + kb + " KB");

  // City labels: Natural Earth 10m populated places (~7000, incl. St Petersburg + small towns).
  // Sorted by population desc so the radar's in-view cap shows the biggest cities first. Optional.
  try {
    // GeoNames cities15000 (TSV): all ~23k cities with population > 15000 (incl. Zelenograd etc.).
    var CITY_URL = "https://raw.githubusercontent.com/river-jade/cities15000/master/cities15000.txt";
    var txt = process.argv[3] ? fs.readFileSync(process.argv[3], "utf8") : await (await fetch(CITY_URL)).text();
    var cities = txt.split("\n").map(function (line) {
      var p = line.split("\t");
      if (p.length < 15) return null;
      var name = p[1], lat = parseFloat(p[4]), lon = parseFloat(p[5]), pop = parseInt(p[14], 10) || 0;
      if (!name || isNaN(lat) || isNaN(lon)) return null;
      return { n: name, lat: round(lat), lon: round(lon), pop: pop };
    }).filter(Boolean);
    cities.sort(function (a, b) { return b.pop - a.pop; });   // biggest first (radar caps in-view labels)
    cities = cities.map(function (c) { return { n: c.n, lat: c.lat, lon: c.lon }; });
    var cOut = path.join(__dirname, "..", "assets", "geo", "cities.json");
    fs.writeFileSync(cOut, JSON.stringify(cities));
    console.log("wrote " + cOut + " — " + cities.length + " cities, " + (fs.statSync(cOut).size / 1024).toFixed(1) + " KB");
  } catch (e) { console.error("cities skipped: " + e.message); }
})().catch(function (e) { console.error(e.message); process.exit(1); });
