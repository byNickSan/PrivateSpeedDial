// Layer: widget. Precipitation map (opt-in, lazy). Hand-rolled slippy map.
// RainViewer radar tiles = precipitation on every base; Natural Earth borders/cities (bundled) or
// external map tiles (Carto/ESRI/…) as the base. No Open-Meteo call budget, no rate limit.
(function () {
  "use strict";
  var TILE = 256;
  var rvCache = null;      // RainViewer maps json { host, frames, ts } — reused across reopens
  var tileImgs = {};       // shared <img> tile cache across reopens (capped) — reload reuses, no re-request
  var TILE_CAP = 600;
  var RV_TTL = 600000, GRID_TTL = 600000;
  var gridCache = {};      // Open-Meteo grids: "z:lat:lon:N" -> { ts, data } (10-min reuse; stale on fail)
  // Open-Meteo free limit ≈ 600 calls/min (each coordinate ≈ 1 call). Keep a rolling 60s budget.
  var CALL_BUDGET = 480;
  var callLog = [];
  function canSpend(w) { var cut = Date.now() - 60000; callLog = callLog.filter(function (e) { return e.ts > cut; }); return callLog.reduce(function (s, e) { return s + e.weight; }, 0) + w <= CALL_BUDGET; }
  function spend(w) { callLog.push({ ts: Date.now(), weight: w }); }
  function rlog() { try { console.info.apply(console, ["[radar]"].concat(Array.prototype.slice.call(arguments))); } catch (e) { /* console may be unavailable */ } }
  // mm/h palette: light blue → blue → green → yellow → orange → red; snow = pale.
  function precipColor(mm, snow) {
    if (snow) return "226,242,254";
    if (mm < 0.3) return "125,205,255"; if (mm < 1) return "56,189,248"; if (mm < 2.5) return "34,197,94";
    if (mm < 5) return "250,204,21"; if (mm < 10) return "249,115,22"; return "239,68,68";
  }
  function isSnow(code) { return (code >= 71 && code <= 77) || code === 85 || code === 86; }

  function lon2x(lon, z) { return (lon + 180) / 360 * Math.pow(2, z); }
  function lat2y(lat, z) { var r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z); }
  function x2lon(x, z) { return x / Math.pow(2, z) * 360 - 180; }
  function y2lat(y, z) { var n = Math.PI - 2 * Math.PI * y / Math.pow(2, z); return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function wrapLon(lon) { return ((lon + 180) % 360 + 360) % 360 - 180; }

  // Loaded per-open and held only for the modal's lifetime, so the idle new-tab keeps no geo data resident.
  async function loadJson(file) {
    try { return await (await fetch(SD.api.runtime.getURL(file))).json(); }
    catch (e) { return false; }
  }

  async function open(cfg, ctx) {
    if (SD.has("permissions.request")) {
      try { await SD.api.permissions.request({ origins: ["https://api.open-meteo.com/*"] }); } catch (e) { /* CORS-enabled; proceed */ }
    }
    var geo = await loadJson("assets/geo/world-110m.json");
    var cities = await loadJson("assets/geo/cities.json");
    mountModal(cfg, ctx, geo, cities);
  }

  function mountModal(cfg, ctx, geo, cities) {
    var D = ctx.dom, t = ctx.i18n.t;
    var W = 600, H = 420;
    var PROVIDERS = [["none", t("radar.mapBundled")], ["voyager", "Carto"], ["dark", "Carto Dark"], ["topo", "OpenTopoMap"], ["esri", "ESRI Topo"], ["esriStreet", "ESRI Streets"], ["esriNatGeo", "ESRI NatGeo"], ["esriSat", "ESRI Imagery"], ["osmde", "OSM.de"]];
    var prov = cfg.radarTiles || "none";
    function tile() { return prov !== "none"; }
    var src = cfg.radarSource || "rainviewer";   // precipitation provider
    function rv() { return src === "rainviewer"; }
    var DETAIL = { low: 10, med: 14, high: 18 };
    var N = DETAIL[cfg.radarDetail] || 14;        // N×N sample grid (Open-Meteo; affects request count)
    var st = { lat: +cfg.lat || 0, lon: +cfg.lon || 0, z: 7 };
    var timer = null, rdTimer = null, tilesReq = 0, tilesDone = 0;
    var rvHost = "", rvFrames = null, rvFrame = 0, grid = null, frame = 0;

    var node = D.el("div", { "class": "radar" });
    var head = D.el("div", { "class": "radar-head" }, [D.el("span", { text: t("radar.title") })]);
    // Provider: RainViewer (real radar, 10-min steps, ~2h) or Open-Meteo (hourly forecast).
    var srcSel = document.createElement("select"); srcSel.className = "radar-mapsel"; srcSel.title = t("radar.source");
    [["rainviewer", "RainViewer · 10 мин"], ["openmeteo", "Open-Meteo · часы"]].forEach(function (p) { var o = document.createElement("option"); o.value = p[0]; o.textContent = p[1]; srcSel.appendChild(o); });
    srcSel.value = src;
    srcSel.addEventListener("change", function () {
      src = srcSel.value;
      if (ctx.commitCfg) ctx.commitCfg(function (x) { x.radarSource = src; });
      grid = null; rvFrames = null; syncMapBtn(); reload();
    });
    // Open-Meteo grid density (more points = finer, but more API calls).
    var detailSel = document.createElement("select"); detailSel.className = "radar-mapsel"; detailSel.title = t("radar.detail");
    [["low", t("radar.detailLow")], ["med", t("radar.detailMed")], ["high", t("radar.detailHigh")]].forEach(function (p) { var o = document.createElement("option"); o.value = p[0]; o.textContent = p[1]; detailSel.appendChild(o); });
    detailSel.value = cfg.radarDetail || "med";
    detailSel.addEventListener("change", function () {
      N = DETAIL[detailSel.value] || 14;
      if (ctx.commitCfg) ctx.commitCfg(function (x) { x.radarDetail = detailSel.value; });
      grid = null; reload();
    });
    var mapSel = document.createElement("select"); mapSel.className = "radar-mapsel"; mapSel.title = t("radar.mapSource");
    PROVIDERS.forEach(function (p) { var o = document.createElement("option"); o.value = p[0]; o.textContent = p[1]; mapSel.appendChild(o); });
    function attribName() { return rv() ? "RainViewer" : "Open-Meteo"; }
    function attribFor(p) { if (p === "none") return "Natural Earth · " + attribName(); if (p.indexOf("esri") === 0) return "© Esri · " + attribName(); if (p === "topo") return "© OpenTopoMap · " + attribName(); if (p === "osmde") return "© OpenStreetMap · " + attribName(); return "© CARTO · OpenStreetMap · " + attribName(); }
    function syncMapBtn() { mapSel.value = prov; srcSel.value = src; detailSel.style.display = rv() ? "none" : ""; if (attribEl) attribEl.textContent = attribFor(prov); }
    mapSel.addEventListener("change", function () {
      prov = mapSel.value;
      if (tile() && st.z > 11) st.z = 11; else if (!tile() && st.z > 8) st.z = 8;
      if (ctx.commitCfg) ctx.commitCfg(function (x) { x.radarTiles = prov; });   // remember the last chosen base map
      syncMapBtn(); reload();
    });
    // external tiles failed to load → fall back to the bundled base
    function fallbackBundled() {
      if (prov === "none") return;
      prov = "none"; if (st.z > 8) st.z = 8;
      if (ctx.commitCfg) ctx.commitCfg(function (x) { x.radarTiles = "none"; });
      SD.ui.toast(t("radar.mapFallback"));
      syncMapBtn(); reload();
    }
    function checkBaseAvailable() {
      if (!tile()) return;
      var z = st.z, n = Math.pow(2, z), c = worldPx(), originX = c.x - W / 2, originY = c.y - H / 2;
      var x0 = Math.floor(originX / TILE), y0 = Math.floor(originY / TILE), x1 = Math.floor((originX + W) / TILE), y1 = Math.floor((originY + H) / TILE);
      var ok = 0, total = 0;
      for (var ty = y0; ty <= y1; ty++) { if (ty < 0 || ty >= n) continue; for (var tx = x0; tx <= x1; tx++) { var u = baseUrl(z, ((tx % n) + n) % n, ty); if (!u) continue; total++; var im = tileImgs[u]; if (im && im.complete && im.naturalWidth) ok++; } }
      if (total && ok === 0) fallbackBundled();
    }
    var closeBtn = D.el("button", { "class": "radar-close", text: "×" });
    head.appendChild(srcSel); head.appendChild(detailSel); head.appendChild(mapSel); head.appendChild(closeBtn); node.appendChild(head);

    var view = D.el("div", { "class": "radar-view" });
    view.style.width = W + "px"; view.style.height = H + "px";
    var canvas = document.createElement("canvas"); canvas.className = "radar-layer-base"; canvas.width = W; canvas.height = H;
    view.appendChild(canvas);
    var loadEl = D.el("div", { "class": "radar-loading" }); loadEl.style.display = "none";
    view.appendChild(loadEl);
    var geoBtn = D.el("button", { "class": "radar-geo", title: t("radar.locate"), text: "◎" });
    geoBtn.addEventListener("click", locateMe);
    view.appendChild(geoBtn);
    node.appendChild(view);

    var playBtn = D.el("button", { "class": "btn ghost", text: "▶" });
    var slider = document.createElement("input"); slider.type = "range"; slider.min = 0; slider.max = 0; slider.step = 1; slider.value = 0; slider.className = "radar-slider";
    var timeLabel = D.el("span", { "class": "radar-time" });
    var zoomOut = D.el("button", { "class": "btn ghost", text: "−" });
    var zoomIn = D.el("button", { "class": "btn ghost", text: "+" });
    var zoomLabel = D.el("span", { "class": "radar-zoom" });
    function syncZoom() { zoomLabel.textContent = "z" + st.z; }
    var coordInput = document.createElement("input"); coordInput.type = "text"; coordInput.className = "radar-coord"; coordInput.placeholder = "lat, lon"; coordInput.title = t("radar.coords");
    node.appendChild(D.el("div", { "class": "radar-timeline" }, [playBtn, slider, timeLabel, coordInput, zoomOut, zoomLabel, zoomIn]));
    var attribEl = D.el("div", { "class": "radar-attrib", text: t("radar.attribution") });
    node.appendChild(attribEl);
    syncMapBtn();

    var search = document.createElement("input");
    search.type = "search"; search.className = "radar-search"; search.placeholder = t("radar.search");
    var results = D.el("div", { "class": "radar-search-results" }); results.hidden = true;
    node.insertBefore(D.el("div", { "class": "radar-search-wrap" }, [search, results]), view);
    var searchTimer;
    search.addEventListener("input", function () {
      clearTimeout(searchTimer);
      var q = search.value.trim();
      if (q.length < 2) { results.hidden = true; return; }
      searchTimer = setTimeout(function () {
        SD.netWidget.fetchJson("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(q) + "&count=6&language=" + ctx.i18n.current()).then(function (j) {
          var list = (j && j.results) || [];
          results.replaceChildren();
          list.forEach(function (r) {
            var label = r.name + (r.admin1 ? ", " + r.admin1 : "") + (r.country_code ? " (" + r.country_code + ")" : "");
            var b = D.el("button", { "class": "radar-search-item", text: label });
            b.addEventListener("click", function () { st.lat = r.latitude; st.lon = r.longitude; results.hidden = true; search.value = r.name; saveCenter(); reload(); });
            results.appendChild(b);
          });
          results.hidden = !list.length;
        }).catch(function () { results.hidden = true; });
      }, 1000);
    });

    var close = SD.ui.openModal(node);
    closeBtn.addEventListener("click", function () { stop(); clearTimeout(reloadTimer); clearTimeout(rdTimer); clearTimeout(searchTimer); clearInterval(fakeTimer); gen++; close(); });

    function worldPx() { return { x: lon2x(st.lon, st.z) * TILE, y: lat2y(st.lat, st.z) * TILE }; }

    function drawBase(ctx2) {
      var c = worldPx(), originX = c.x - W / 2, originY = c.y - H / 2;
      ctx2.clearRect(0, 0, W, H);
      ctx2.fillStyle = "#0b1320"; ctx2.fillRect(0, 0, W, H);
      function projX(lon) { return lon2x(lon, st.z) * TILE - originX; }
      function projY(lat) { return lat2y(lat, st.z) * TILE - originY; }
      if (geo && geo.features) {
        ctx2.fillStyle = "#1f2b3d"; ctx2.strokeStyle = "#52688c"; ctx2.lineWidth = 0.8;
        geo.features.forEach(function (f) { drawGeom(ctx2, f.geometry, projX, projY); });
      }
      ctx2.strokeStyle = "rgba(255,255,255,.07)"; ctx2.lineWidth = 1; ctx2.beginPath();
      for (var lon = -180; lon <= 180; lon += 30) { var x = projX(lon); ctx2.moveTo(x, 0); ctx2.lineTo(x, H); }
      for (var lat = -60; lat <= 60; lat += 30) { var y = projY(lat); ctx2.moveTo(0, y); ctx2.lineTo(W, y); }
      ctx2.stroke();
      if (cities && cities.length) {
        ctx2.fillStyle = "#cbd5e1"; ctx2.font = "11px system-ui, sans-serif"; ctx2.textBaseline = "middle";
        ctx2.shadowColor = "rgba(0,0,0,.85)"; ctx2.shadowBlur = 2;
        var shown = 0, placed = [];   // skip any label that would overlap an already-placed one (declutter)
        for (var ci = 0; ci < cities.length && shown < 40; ci++) {
          var cc = cities[ci], cx = projX(cc.lon), cy = projY(cc.lat);
          if (cx < 4 || cx > W - 4 || cy < 8 || cy > H - 8) continue;
          var rect = { x: cx + 4, y: cy - 8, w: ctx2.measureText(cc.n).width + 8, h: 16 };
          var clash = false;
          for (var pi = 0; pi < placed.length; pi++) { var p = placed[pi]; if (rect.x < p.x + p.w && rect.x + rect.w > p.x && rect.y < p.y + p.h && rect.y + rect.h > p.y) { clash = true; break; } }
          if (clash) continue;
          placed.push(rect);
          ctx2.beginPath(); ctx2.arc(cx, cy, 2, 0, Math.PI * 2); ctx2.fill();
          ctx2.fillText(cc.n, cx + 5, cy);
          shown++;
        }
        ctx2.shadowBlur = 0;
      }
      var mx = projX(st.lon), my = projY(st.lat);
      var mpp = 156543.034 * Math.cos(st.lat * Math.PI / 180) / Math.pow(2, st.z);
      ctx2.strokeStyle = "rgba(56,189,248,.35)"; ctx2.lineWidth = 1;
      [100, 300, 600].forEach(function (km) { var r = km * 1000 / mpp; if (r >= 8 && r <= 1200) { ctx2.beginPath(); ctx2.arc(mx, my, r, 0, Math.PI * 2); ctx2.stroke(); } });
      ctx2.fillStyle = "#38bdf8"; ctx2.strokeStyle = "#fff"; ctx2.lineWidth = 2;
      ctx2.beginPath(); ctx2.arc(mx, my, 5, 0, Math.PI * 2); ctx2.fill(); ctx2.stroke();
    }
    function drawGeom(ctx2, g, projX, projY) {
      if (!g) return;
      var polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
      polys.forEach(function (poly) {
        ctx2.beginPath();
        poly.forEach(function (ring) { ring.forEach(function (pt, i) { var x = projX(pt[0]), y = projY(pt[1]); if (i === 0) ctx2.moveTo(x, y); else ctx2.lineTo(x, y); }); ctx2.closePath(); });
        ctx2.fill(); ctx2.stroke();
      });
    }

    // Base (borders + cities) drawn once per view to an offscreen canvas; each frame blits it + precip.
    var baseCanvas = document.createElement("canvas"); baseCanvas.width = W; baseCanvas.height = H;
    var baseKey = "";
    function ensureBase() {
      var k = st.z + ":" + st.lat.toFixed(3) + ":" + st.lon.toFixed(3);
      if (k === baseKey) return;
      baseKey = k;
      drawBase(baseCanvas.getContext("2d"));
    }
    function scheduleRedraw() { clearTimeout(rdTimer); rdTimer = setTimeout(redraw, 70); }
    function setLoading(msg) { if (msg) { loadEl.textContent = msg; loadEl.style.display = ""; } else loadEl.style.display = "none"; }
    function loadingPct() {
      var pct = tilesReq ? Math.round(tilesDone / tilesReq * 100) : 100;
      if (pct < 100) setLoading(t("feed.loading") + " " + pct + "%");
      else if ((loadEl.textContent || "").indexOf("%") >= 0) setLoading("");   // tiles done — clear the % (keep any grid "Loading…")
    }
    function tileImage(url, isBase) {
      var im = tileImgs[url];
      if (im) return im;   // cross-open cache — reload won't refetch the tile
      im = new Image(); im.crossOrigin = "anonymous"; tilesReq++;
      im.onload = function () { tilesDone++; loadingPct(); if (isBase) tileBaseKey = ""; scheduleRedraw(); };
      im.onerror = function () { tilesDone++; loadingPct(); };
      im.src = url; tileImgs[url] = im;
      var keys = Object.keys(tileImgs);
      if (keys.length > TILE_CAP) delete tileImgs[keys[0]];
      return im;
    }
    function baseUrl(z, x, y) {
      switch (prov) {
        case "voyager": return "https://basemaps.cartocdn.com/rastertiles/voyager/" + z + "/" + x + "/" + y + ".png";
        case "dark": return "https://basemaps.cartocdn.com/dark_all/" + z + "/" + x + "/" + y + ".png";
        case "topo": return "https://tile.opentopomap.org/" + z + "/" + x + "/" + y + ".png";
        case "esri": return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/" + z + "/" + y + "/" + x;
        case "esriStreet": return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/" + z + "/" + y + "/" + x;
        case "esriNatGeo": return "https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/" + z + "/" + y + "/" + x;
        case "esriSat": return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/" + z + "/" + y + "/" + x;
        case "osmde": return "https://tile.openstreetmap.de/" + z + "/" + x + "/" + y + ".png";
      }
      return "";
    }
    // Draws a tile layer at zoom `z` (default base zoom). When z < st.z the z-tiles are scaled up by
    // 2^(st.z−z) so a lower-res layer can overlay the detailed
    // map using the lower-res tiles we already cached — same data, fewer/reused requests.
    function drawTiles(ctx2, urlFor, alpha, isBase, z) {
      z = z || st.z;
      var s = Math.pow(2, st.z - z), n = Math.pow(2, z);
      var centerX = lon2x(st.lon, z) * TILE, centerY = lat2y(st.lat, z) * TILE;
      var x0 = Math.floor((centerX - (W / 2) / s) / TILE), x1 = Math.floor((centerX + (W / 2) / s) / TILE);
      var y0 = Math.floor((centerY - (H / 2) / s) / TILE), y1 = Math.floor((centerY + (H / 2) / s) / TILE);
      var size = TILE * s;
      ctx2.save(); if (alpha != null) ctx2.globalAlpha = alpha;
      for (var ty = y0; ty <= y1; ty++) {
        if (ty < 0 || ty >= n) continue;
        for (var tx = x0; tx <= x1; tx++) {
          var url = urlFor(z, ((tx % n) + n) % n, ty); if (!url) continue;
          var im = tileImage(url, isBase);
          if (im.complete && im.naturalWidth) ctx2.drawImage(im, (tx * TILE - centerX) * s + W / 2, (ty * TILE - centerY) * s + H / 2, size + 1, size + 1);
        }
      }
      ctx2.restore();
    }
    // Base map tiles are static per view — composite them once to an offscreen canvas, re-render only
    // when the view changes or a new base tile loads (not every animation frame).
    var tileBase = document.createElement("canvas"); tileBase.width = W; tileBase.height = H;
    var tileBaseKey = "";
    function ensureTileBase() {
      var k = prov + ":" + st.z + ":" + st.lat.toFixed(4) + ":" + st.lon.toFixed(4);
      if (k === tileBaseKey) return;
      var b = tileBase.getContext("2d");
      b.clearRect(0, 0, W, H); b.fillStyle = "#0b1320"; b.fillRect(0, 0, W, H);
      drawTiles(b, baseUrl, 1, true);
      tileBaseKey = k;
    }
    function drawMarker(ctx2) {
      var c = worldPx(), mx = lon2x(st.lon, st.z) * TILE - (c.x - W / 2), my = lat2y(st.lat, st.z) * TILE - (c.y - H / 2);
      ctx2.fillStyle = "#38bdf8"; ctx2.strokeStyle = "#fff"; ctx2.lineWidth = 2;
      ctx2.beginPath(); ctx2.arc(mx, my, 5, 0, Math.PI * 2); ctx2.fill(); ctx2.stroke();
    }
    // Open-Meteo forecast grid: N×N points across the viewport → hourly precip cells (many hours).
    function samplePoints() {
      var c = worldPx(), originX = c.x - W / 2, originY = c.y - H / 2, pts = [];
      for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
        var wx = originX + (i / (N - 1)) * W, wy = originY + (j / (N - 1)) * H;
        pts.push({ lat: clamp(y2lat(wy / TILE, st.z), -85, 85), lon: wrapLon(x2lon(wx / TILE, st.z)) });
      }
      return pts;
    }
    async function fetchGrid() {
      var key = st.z + ":" + st.lat.toFixed(2) + ":" + st.lon.toFixed(2) + ":" + N;
      var hit = gridCache[key];
      if (hit && (Date.now() - hit.ts) < GRID_TTL) { rlog("open-meteo: grid cache hit"); return hit.data; }   // fresh cache — no request
      var pts = samplePoints();
      if (!canSpend(pts.length)) { rlog("open-meteo: call budget exceeded (need", pts.length, ") —", hit ? "serving stale cache" : "no data"); if (hit) return hit.data; var e = new Error("rate"); e.rate = true; throw e; }
      spend(pts.length);
      var lats = pts.map(function (p) { return p.lat.toFixed(3); }).join(",");
      var lons = pts.map(function (p) { return p.lon.toFixed(3); }).join(",");
      var url = "https://api.open-meteo.com/v1/forecast?latitude=" + lats + "&longitude=" + lons + "&hourly=precipitation,weather_code&forecast_days=2&timezone=auto";
      try {
        var json = await SD.netWidget.fetchJson(url);
        var arr = Array.isArray(json) ? json : [json];
        var times = (arr[0] && arr[0].hourly && arr[0].hourly.time) || [];
        var now = Date.now(), start = 0;
        for (var k = 0; k < times.length; k++) { if (Date.parse(times[k]) >= now - 1800000) { start = k; break; } }
        var data = { pts: pts, results: arr, times: times, start: start };
        gridCache[key] = { ts: Date.now(), data: data };
        return data;
      } catch (err) { if (hit) return hit.data; throw err; }   // on error → stale cache
    }
    function drawPrecip(ctx2) {
      if (!grid) return;
      var c = worldPx(), originX = c.x - W / 2, originY = c.y - H / 2;
      var cw = W / (N - 1) + 1, ch = H / (N - 1) + 1;
      grid.pts.forEach(function (p, k) {
        var res = grid.results[k]; if (!res || !res.hourly) return;
        var mm = (res.hourly.precipitation || [])[frame];
        if (!mm || mm <= 0) return;
        var col = precipColor(mm, isSnow((res.hourly.weather_code || [])[frame]));
        var a = clamp(0.35 + mm / 6 * 0.5, 0.35, 0.85);
        var x = lon2x(p.lon, st.z) * TILE - originX, y = lat2y(p.lat, st.z) * TILE - originY;
        if (x < -cw || x > W + cw || y < -ch || y > H + ch) return;
        ctx2.fillStyle = "rgba(" + col + "," + a + ")";
        ctx2.fillRect(Math.round(x - cw / 2), Math.round(y - ch / 2), Math.ceil(cw), Math.ceil(ch));
      });
    }
    // RainViewer real-radar tiles — the precip layer on every base. RainViewer data tops out at z7,
    // so we always request z≤7 and let drawTiles scale it up over a more detailed base map.
    function rvZoom() { return Math.min(st.z, 7); }
    function rvUrl(z, x, y) { var f = rvFrames && rvFrames[rvFrame]; return f ? rvHost + f.path + "/256/" + z + "/" + x + "/" + y + "/4/1_1.png" : ""; }
    // Preload every frame's visible tiles up front so the FIRST playback is smooth (no slideshow
    // flicker from tiles loading on the fly).
    function prefetchFrames() {
      if (!rvFrames || !rvFrames.length) return;
      var z = rvZoom(), n = Math.pow(2, z);
      var centerX = lon2x(st.lon, z) * TILE, centerY = lat2y(st.lat, z) * TILE;
      var x0 = Math.floor((centerX - W / 2) / TILE), x1 = Math.floor((centerX + W / 2) / TILE);
      var y0 = Math.floor((centerY - H / 2) / TILE), y1 = Math.floor((centerY + H / 2) / TILE);
      rvFrames.forEach(function (f) {
        for (var ty = y0; ty <= y1; ty++) { if (ty < 0 || ty >= n) continue; for (var tx = x0; tx <= x1; tx++) { tileImage(rvHost + f.path + "/256/" + z + "/" + (((tx % n) + n) % n) + "/" + ty + "/4/1_1.png", false); } }
      });
    }
    var rvNow = 0;
    function applyRv() { rvFrame = Math.min(rvNow, Math.max(0, rvFrames.length - 1)); slider.max = Math.max(0, rvFrames.length - 1); slider.value = rvFrame; }
    function loadRainviewer() {
      if (rvFrames) return Promise.resolve();
      if (rvCache && (Date.now() - rvCache.ts) < RV_TTL) { rlog("rainviewer: cache hit", rvCache.frames.length, "frames"); rvHost = rvCache.host; rvFrames = rvCache.frames.slice(); rvNow = rvCache.now; applyRv(); return Promise.resolve(); }
      rlog("rainviewer: fetching weather-maps.json…");
      return SD.netWidget.fetchJson("https://api.rainviewer.com/public/weather-maps.json").then(function (j) {
        rvHost = j.host || "https://tilecache.rainviewer.com";
        var past = (j.radar && j.radar.past) || [];
        rvFrames = past.concat((j.radar && j.radar.nowcast) || []);   // past frames + nearest nowcast
        rvNow = Math.max(0, past.length - 1);   // default frame = now
        rvCache = { host: rvHost, frames: rvFrames.slice(), ts: Date.now(), now: rvNow };
        rlog("rainviewer: fetched", rvFrames.length, "frames");
        applyRv();
      }).catch(function (e) { rlog("rainviewer: fetch failed", e && e.message, "— using", rvCache ? "stale cache" : "nothing"); if (rvCache) { rvHost = rvCache.host; rvFrames = rvCache.frames.slice(); rvNow = rvCache.now; applyRv(); } else rvFrames = []; });
    }
    function framesLen() { return rv() ? (rvFrames ? rvFrames.length : 0) : (grid && grid.times ? grid.times.length : 0); }

    // Precip layer = RainViewer tiles (real radar, z≤7 scaled) OR the Open-Meteo forecast grid.
    function redraw() {
      var ctx2 = canvas.getContext("2d");
      ctx2.clearRect(0, 0, W, H);
      if (tile()) { ensureTileBase(); ctx2.drawImage(tileBase, 0, 0); }
      else { ensureBase(); ctx2.drawImage(baseCanvas, 0, 0); }
      if (rv()) drawTiles(ctx2, rvUrl, 0.72, false, rvZoom());
      else drawPrecip(ctx2);
      drawMarker(ctx2);
    }

    function showFrame(f) {
      slider.value = f;
      if (rv()) {
        rvFrame = f;
        var rts = rvFrames && rvFrames[f] && rvFrames[f].time;
        timeLabel.textContent = rts ? new Date(rts * 1000).toLocaleString(ctx.i18n.current(), { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "";
      } else {
        frame = f;
        var ts = grid && grid.times[f];
        timeLabel.textContent = ts ? new Date(ts).toLocaleString(ctx.i18n.current(), { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
      }
      redraw();
    }

    // The grid is a single request (no per-byte %), so show a smooth perceived progress 5→90 % that
    // jumps to 100 % on completion — a real, visible indicator instead of a bare "Loading" word.
    var fakeTimer = null;
    function startFakeProgress() { var p = 5; setLoading(t("feed.loading") + " 5%"); clearInterval(fakeTimer); fakeTimer = setInterval(function () { p = Math.min(90, p + Math.max(1, Math.round((94 - p) * 0.18))); setLoading(t("feed.loading") + " " + p + "%"); }, 180); }
    function stopFakeProgress(done) { clearInterval(fakeTimer); fakeTimer = null; if (done) { setLoading(t("feed.loading") + " 100%"); setTimeout(function () { if (!fakeTimer) setLoading(""); }, 350); } else setLoading(""); }

    // Debounce the fetch so rapid zoom clicks make one request.
    var reloadTimer, gen = 0;
    function reload() {
      gen++; var myGen = gen;
      rlog("reload", { src: src, base: prov, lat: st.lat.toFixed(3), lon: st.lon.toFixed(3), z: st.z, N: N });
      syncCoord();
      syncZoom();
      redraw();
      if (tile()) setTimeout(function () { if (myGen === gen) checkBaseAvailable(); }, 4500);
      if (rv()) {   // RainViewer: CORS-free, no call budget — frame tiles report a real % via loadingPct
        clearInterval(fakeTimer); fakeTimer = null;
        loadRainviewer().then(function () { if (myGen === gen) { rlog("rainviewer frames:", framesLen()); prefetchFrames(); showFrame(rvFrame); } });
        return;
      }
      startFakeProgress();
      clearTimeout(reloadTimer);   // Open-Meteo: debounce + budget to stay under the limit
      reloadTimer = setTimeout(function () {
        rlog("open-meteo fetchGrid…");
        fetchGrid().then(function (g) {
          if (myGen !== gen) return;
          stopFakeProgress(true);
          grid = g; slider.max = Math.max(0, g.times.length - 1); slider.value = g.start;
          rlog("open-meteo grid OK: frames=", g.times.length, "start=", g.start);
          showFrame(g.start);
        }).catch(function (e) {
          if (myGen !== gen) return;
          stopFakeProgress(false);
          rlog("open-meteo grid FAILED:", e && e.rate ? "rate-limited (call budget)" : (e && e.message));
          timeLabel.textContent = ctx.i18n.t(e && e.rate ? "radar.rateLimited" : "status.error");
          SD.ui.toast(ctx.i18n.t(e && e.rate ? "radar.rateLimited" : "status.error"));
        });
      }, 500);
    }

    slider.addEventListener("input", function () { showFrame(parseInt(slider.value, 10)); });
    function zoomTo(dz) { st.z = clamp(st.z + dz, 3, tile() ? 11 : 12); reload(); }
    zoomIn.addEventListener("click", function () { zoomTo(1); });
    zoomOut.addEventListener("click", function () { zoomTo(-1); });
    function syncCoord() { coordInput.value = st.lat.toFixed(3) + ", " + st.lon.toFixed(3); }
    function saveCenter() { if (ctx.commitCfg) ctx.commitCfg(function (x) { x.lat = st.lat; x.lon = st.lon; }); }
    coordInput.addEventListener("change", function () {
      var m = coordInput.value.split(","), la = parseFloat(m[0]), lo = parseFloat(m[1]);
      if (isFinite(la) && isFinite(lo)) { st.lat = clamp(la, -85, 85); st.lon = wrapLon(lo); saveCenter(); reload(); }
    });
    canvas.addEventListener("click", function (e) {
      var rect = canvas.getBoundingClientRect();
      var px = (e.clientX - rect.left) * (W / rect.width), py = (e.clientY - rect.top) * (H / rect.height);
      var c = worldPx(), originX = c.x - W / 2, originY = c.y - H / 2;
      st.lon = wrapLon(x2lon((originX + px) / TILE, st.z)); st.lat = clamp(y2lat((originY + py) / TILE, st.z), -85, 85);
      saveCenter(); reload();
    });
    canvas.classList.add("radar-pickable");
    var waitFrames = null;
    playBtn.addEventListener("click", function () { if (timer || waitFrames) stop(); else play(); });
    function startTimer(len) {
      playBtn.textContent = "⏸";
      // Self-stop if the modal was closed by any path (backdrop click) so the scope + geo data can be freed.
      timer = setInterval(function () { if (!view.isConnected) { stop(); return; } var cur = rv() ? rvFrame : frame; showFrame((cur + 1) % len); }, 700);
    }
    function play() {
      var len = framesLen();
      if (len) { rlog("play: start, frames=", len); startTimer(len); return; }
      // Clicked before frames finished loading — show "armed" state and start as soon as they arrive.
      rlog("play: no frames yet (" + src + ") — waiting for load…");
      playBtn.textContent = "⏸";
      var tries = 0;
      waitFrames = setInterval(function () {
        var l = framesLen();
        if (l && view.isConnected) { rlog("play: frames arrived (", l, ") — starting"); clearInterval(waitFrames); waitFrames = null; startTimer(l); }
        else if (++tries > 24 || !view.isConnected) { rlog("play: gave up waiting for frames (still 0)"); clearInterval(waitFrames); waitFrames = null; playBtn.textContent = "▶"; }
      }, 300);
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
      if (waitFrames) { clearInterval(waitFrames); waitFrames = null; }
      playBtn.textContent = "▶";
    }

    // GPS centring — browser prompts; no manifest permission needed.
    function locateMe() {
      if (!navigator.geolocation) { SD.ui.toast(ctx.i18n.t("status.error")); return; }
      navigator.geolocation.getCurrentPosition(
        function (pos) { st.lat = pos.coords.latitude; st.lon = pos.coords.longitude; saveCenter(); reload(); },
        function () { SD.ui.toast(ctx.i18n.t("status.error")); },
        { timeout: 8000, maximumAge: 300000 }
      );
    }

    reload();
  }

  SD.radar = { open: open };
})();
