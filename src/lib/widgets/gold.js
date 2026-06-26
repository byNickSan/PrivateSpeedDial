// Layer: widget. Metals (net). Yahoo Finance futures (gold/silver/platinum/palladium/copper/aluminum)
// with a per-metal sparkline, any display currency (USD converted via er-api), selectable time range.
// MOEX ISS (gold+silver in RUB, no chart) is the RU alternative.
(function () {
  "use strict";
  var PROVIDERS = [["yahoo", "Yahoo Finance"], ["moex", "MOEX (RUB)"]];
  var SVGNS = "http://www.w3.org/2000/svg";
  // id -> { yahoo ticker, MOEX secid (if any), unit suffix }
  var METALS = [
    ["gold", "GC=F", "GLDRUB_TOM", "oz"], ["silver", "SI=F", "SLVRUB_TOM", "oz"],
    ["platinum", "PL=F", "", "oz"], ["palladium", "PA=F", "", "oz"],
    ["copper", "HG=F", "", "lb"], ["aluminum", "ALI=F", "", "t"]
  ];
  function meta(id) { for (var i = 0; i < METALS.length; i++) if (METALS[i][0] === id) return METALS[i]; return null; }
  // Labels embedded here so no per-metal keys need adding to the locale files.
  var NAMES = {
    en: { gold: "Gold", silver: "Silver", platinum: "Platinum", palladium: "Palladium", copper: "Copper", aluminum: "Aluminum", pick: "Metals", currency: "Currency", range: "Range" },
    ru: { gold: "Золото", silver: "Серебро", platinum: "Платина", palladium: "Палладий", copper: "Медь", aluminum: "Алюминий", pick: "Металлы", currency: "Валюта", range: "Период" },
    de: { gold: "Gold", silver: "Silber", platinum: "Platin", palladium: "Palladium", copper: "Kupfer", aluminum: "Aluminium", pick: "Metalle", currency: "Währung", range: "Zeitraum" },
    fr: { gold: "Or", silver: "Argent", platinum: "Platine", palladium: "Palladium", copper: "Cuivre", aluminum: "Aluminium", pick: "Métaux", currency: "Devise", range: "Période" },
    cs: { gold: "Zlato", silver: "Stříbro", platinum: "Platina", palladium: "Palladium", copper: "Měď", aluminum: "Hliník", pick: "Kovy", currency: "Měna", range: "Období" }
  };
  function L(key) { var l = (SD.i18n.current && SD.i18n.current()) || "en"; return (NAMES[l] || NAMES.en)[key] || (NAMES.en[key] || key); }
  var RANGES = ["1mo", "3mo", "6mo", "1y", "5y"];
  function interval(range) { return range === "1y" ? "1wk" : range === "5y" ? "1mo" : "1d"; }

  function selected(cfg) {
    var list = (cfg.metals && cfg.metals.length ? cfg.metals : ["gold"]).filter(meta);
    return list.length ? list : ["gold"];
  }

  function origin(cfg) {
    if (cfg.provider === "moex") return "https://iss.moex.com";
    return "https://query1.finance.yahoo.com";
  }

  function buildUrls(cfg) {
    if (cfg.provider === "moex") {
      var secs = selected(cfg).map(function (id) { return meta(id)[2]; }).filter(Boolean).join(",") || "GLDRUB_TOM";
      return ["https://iss.moex.com/iss/engines/currency/markets/selt/boards/CETS/securities.json?securities=" + secs + "&iss.meta=off&iss.only=marketdata"];
    }
    var range = RANGES.indexOf(cfg.range) >= 0 ? cfg.range : "1mo", iv = interval(range);
    var urls = selected(cfg).map(function (id) {
      return "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(meta(id)[1]) + "?range=" + range + "&interval=" + iv;
    });
    var cur = (cfg.currency || "USD").toUpperCase();
    if (cur !== "USD") urls.push("https://open.er-api.com/v6/latest/USD");   // last url = USD->currency rates
    return urls;
  }

  function parseYahoo(one) {
    var r = one && one.chart && one.chart.result && one.chart.result[0];
    if (!r) return { value: null, series: [] };
    var price = r.meta && r.meta.regularMarketPrice;
    var q = r.indicators && r.indicators.quote && r.indicators.quote[0];
    var series = (q && q.close ? q.close : []).filter(function (v) { return v != null; });
    if (price == null && series.length) price = series[series.length - 1];
    return { value: price, series: series };
  }

  function parse(json, cfg) {
    var ids = selected(cfg);
    if (cfg.provider === "moex") {
      var md = (json[0] && json[0].marketdata) || {}, cols = md.columns || [], rows = md.data || [];
      var iSec = cols.indexOf("SECID"), iLast = cols.indexOf("LAST"), iLcp = cols.indexOf("LCURRENTPRICE");
      return ids.map(function (id) {
        var sec = meta(id)[2], row = null;
        for (var k = 0; k < rows.length; k++) if (rows[k][iSec] === sec) { row = rows[k]; break; }
        var v = row ? (row[iLast] != null ? row[iLast] : row[iLcp]) : null;
        return { id: id, value: v != null ? v : null, unit: "RUB/g", series: [] };
      });
    }
    var cur = (cfg.currency || "USD").toUpperCase(), rate = 1;
    if (cur !== "USD") { var fx = json[ids.length]; var rates = (fx && fx.rates) || {}; rate = rates[cur] || 1; }
    return ids.map(function (id, i) {
      var y = parseYahoo(json[i]);
      var val = y.value != null ? +(y.value * rate).toFixed(meta(id)[3] === "oz" ? 2 : 3) : null;
      return { id: id, value: val, unit: cur + "/" + meta(id)[3], series: y.series.map(function (v) { return v * rate; }) };
    });
  }

  function sparkline(values) {
    var w = 90, h = 22, n = values.length;
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values), span = (max - min) || 1;
    var pts = values.map(function (v, i) { var x = n > 1 ? (i / (n - 1)) * w : 0; var y = h - ((v - min) / span) * (h - 4) - 2; return x.toFixed(1) + "," + y.toFixed(1); }).join(" ");
    var svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 " + w + " " + h); svg.setAttribute("class", "w-fx-spark"); svg.setAttribute("preserveAspectRatio", "none");
    var poly = document.createElementNS(SVGNS, "polyline");
    poly.setAttribute("points", pts); poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", values[n - 1] >= values[0] ? "#16a34a" : "#dc2626");
    poly.setAttribute("stroke-width", "1.5"); poly.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(poly); return svg;
  }

  function render(el, res, ctx) {
    var D = ctx.dom; D.clear(el);
    if (res.error && !res.data) { el.appendChild(D.el("div", { class: "w-err", text: ctx.i18n.t("status.error") })); return; }
    var wrap = D.el("div", { class: "w-fx w-metals" });
    (res.data || []).forEach(function (r) {
      var row = D.el("div", { class: "w-fx-row" });
      row.appendChild(D.el("span", { class: "w-fx-sym", text: L(r.id), title: r.unit }));
      if (r.series && r.series.length > 1) row.appendChild(sparkline(r.series));
      else row.appendChild(D.el("span", { class: "w-fx-spark" }));
      var up = (r.series && r.series.length > 1) ? r.series[r.series.length - 1] >= r.series[0] : null;
      var val = D.el("span", { class: "w-metal-val" });
      if (up !== null) { var arr = D.el("span", { class: "w-metal-arrow", text: up ? "▲" : "▼" }); arr.style.color = up ? "#16a34a" : "#dc2626"; val.appendChild(arr); }
      val.appendChild(D.el("b", { text: r.value != null ? String(r.value) : "—" }));
      row.appendChild(val);
      wrap.appendChild(row);
    });
    if (res.fromCache) wrap.appendChild(D.el("div", { class: "w-cache", text: ctx.i18n.t("status.cached") }));
    el.appendChild(wrap);
    // Auto-heal: a fresh result with missing values (e.g. the first fetch raced the host grant) gets
    // cached as dashes — drop it and refetch. 1st retry after ~2s; if still gaps, retry again at 30s.
    var data = res.data || [];
    var hasGap = data.length && data.some(function (r) { return r.value == null; });
    var tries = el.__metalRetry || 0;
    if (!res.fromCache && hasGap && tries < 2) {
      el.__metalRetry = tries + 1;
      ctx.cache.set(null);
      setTimeout(function () {
        if (!el.isConnected) return;
        var st = SD.store.get();
        var fresh = (st.widgetInstances || []).filter(function (w) { return w.instId === ctx.inst.instId; })[0] || ctx.inst;
        SD.netWidget.load(st, fresh, SD.registry.byId("gold")).then(function (r2) { SD.safe("metals.retry", function () { render(el, r2, ctx); }); });
      }, tries === 0 ? 2000 : 30000);
    }
  }

  function renderSettings(el, ctx) {
    var c = ctx.controls, t = ctx.i18n.t, cfg = ctx.cfg(), D = ctx.dom;
    el.appendChild(c.row(t("provider.label"), c.sel(PROVIDERS, cfg.provider, function (v) { ctx.commitCfg(function (x) { x.provider = v; }); ctx.cache.set(null); })));
    var sel = cfg.metals || ["gold"];
    el.appendChild(D.el("div", { class: "note", text: L("pick") }));
    METALS.forEach(function (m) {
      el.appendChild(c.row(L(m[0]), c.check(sel.indexOf(m[0]) >= 0, function (v) {
        ctx.commitCfg(function (x) {
          x.metals = (x.metals || []).filter(function (q) { return q !== m[0]; });
          if (v) x.metals.push(m[0]);
        });
        ctx.cache.set(null);
      })));
    });
    el.appendChild(c.row(L("currency"), c.text(cfg.currency || "USD", function (v) { ctx.commitCfg(function (x) { x.currency = (v || "USD").toUpperCase(); }); ctx.cache.set(null); })));
    el.appendChild(c.row(L("range"), c.sel(RANGES.map(function (r) { return [r, r.toUpperCase()]; }), cfg.range || "1mo", function (v) { ctx.commitCfg(function (x) { x.range = v; }); ctx.cache.set(null); })));
  }

  function defaultConfig() {
    var l = (SD.i18n.current && SD.i18n.current()) || "en";
    return { provider: "yahoo", metals: ["gold", "silver"], currency: l === "ru" ? "RUB" : "USD", range: "1mo" };
  }

  SD.registry.register({
    id: "gold", kind: "net", titleKey: "widget.gold", order: 80,
    providers: PROVIDERS, ttlMin: 30, tolerant: true, privacyDataKey: "privacy.dataSymbols",
    origin: origin, buildUrls: buildUrls, parse: parse, render: render, renderSettings: renderSettings, defaultConfig: defaultConfig
  });
})();
