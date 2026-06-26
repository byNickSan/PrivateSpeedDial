// Layer: widget. Currency (net) with a per-currency sparkline.
// History: cbr-xml-daily archive days (RUB; tolerant to missing weekend days) or Frankfurter time-series.
(function () {
  "use strict";
  var PROVIDERS = [["frankfurter", "Frankfurter (ECB)"], ["er-api", "ExchangeRate-API"], ["cbr-xml-daily", "ЦБ РФ (cbr-xml-daily)"]];
  var SVGNS = "http://www.w3.org/2000/svg";

  function origin(cfg) {
    if (cfg.provider === "frankfurter") return "https://api.frankfurter.dev";
    if (cfg.provider === "er-api") return "https://open.er-api.com";
    return "https://www.cbr-xml-daily.ru";
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function cbrArchive(d) { return "https://www.cbr-xml-daily.ru/archive/" + d.getFullYear() + "/" + pad2(d.getMonth() + 1) + "/" + pad2(d.getDate()) + "/daily_json.js"; }

  // Several endpoints: history first, current last. parse() gets the matching array of responses.
  function buildUrls(cfg) {
    var syms = (cfg.symbols || []).join(",");
    if (cfg.provider === "frankfurter") {
      var base = encodeURIComponent(cfg.base || "EUR"), s = encodeURIComponent(syms);
      var end = new Date(), start = new Date(Date.now() - (cfg.chartDays || 10) * 86400000);
      return [
        "https://api.frankfurter.dev/v1/latest?base=" + base + "&symbols=" + s,
        "https://api.frankfurter.dev/v1/" + iso(start) + ".." + iso(end) + "?base=" + base + "&symbols=" + s
      ];
    }
    if (cfg.provider === "er-api") return ["https://open.er-api.com/v6/latest/" + encodeURIComponent(cfg.base || "USD")];
    var urls = [], days = cfg.chart === false ? 0 : (cfg.chartDays || 10);
    for (var i = days; i >= 1; i--) urls.push(cbrArchive(new Date(Date.now() - i * 86400000)));
    urls.push("https://www.cbr-xml-daily.ru/daily_json.js");
    return urls;
  }

  function cbrVal(j, sym) { var e = j && j.Valute && j.Valute[sym]; return e ? +(e.Value / (e.Nominal || 1)).toFixed(2) : null; }

  function parse(json, cfg) {
    var syms = cfg.symbols || [];
    if (cfg.provider === "er-api") {
      var rates = (json[0] && json[0].rates) || {};
      return syms.map(function (s) { return { sym: s, value: rates[s] != null ? rates[s] : null, series: [] }; });
    }
    if (cfg.provider === "frankfurter") {
      var latest = json[0] || {}, ts = json[1] || {};
      var dates = ts.rates ? Object.keys(ts.rates).sort() : [];
      return syms.map(function (s) {
        var series = dates.map(function (d) { return ts.rates[d] ? ts.rates[d][s] : null; }).filter(function (v) { return v != null; });
        var value = (latest.rates && latest.rates[s] != null) ? latest.rates[s] : (series.length ? series[series.length - 1] : null);
        return { sym: s, value: value, series: series };
      });
    }
    // cbr: array of daily snapshots, chronological (last = current); skip missing (null) days.
    return syms.map(function (s) {
      var series = (json || []).map(function (j) { return cbrVal(j, s); }).filter(function (v) { return v != null; });
      return { sym: s, value: series.length ? series[series.length - 1] : null, series: series };
    });
  }

  // Tiny inline sparkline; green if the series rose over the window, red if it fell.
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
    var wrap = D.el("div", { class: "w-fx" });
    (res.data || []).forEach(function (r) {
      var row = D.el("div", { class: "w-fx-row" });
      row.appendChild(D.el("span", { class: "w-fx-sym", text: r.sym }));
      if (r.series && r.series.length > 1) row.appendChild(sparkline(r.series));
      else row.appendChild(D.el("span", { class: "w-fx-spark" }));
      row.appendChild(D.el("b", { class: "w-fx-val", text: r.value != null ? String(r.value) : "—" }));
      wrap.appendChild(row);
    });
    if (res.fromCache) wrap.appendChild(D.el("div", { class: "w-cache", text: ctx.i18n.t("status.cached") }));
    el.appendChild(wrap);
  }

  function splitSyms(v) { return v.split(",").map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean); }

  function renderSettings(el, ctx) {
    var c = ctx.controls, t = ctx.i18n.t, cfg = ctx.cfg();
    el.appendChild(c.row(t("provider.label"), c.sel(PROVIDERS, cfg.provider, function (v) { ctx.commitCfg(function (x) { x.provider = v; }); ctx.cache.set(null); })));
    el.appendChild(c.row(t("provider.symbols"), c.text((cfg.symbols || []).join(","), function (v) { ctx.commitCfg(function (x) { x.symbols = splitSyms(v); }); ctx.cache.set(null); })));
    el.appendChild(c.row(t("fx.chart"), c.check(cfg.chart !== false, function (v) { ctx.commitCfg(function (x) { x.chart = v; }); ctx.cache.set(null); })));
    el.appendChild(c.row(t("fx.chartDays"), c.num(cfg.chartDays || 10, 5, 30, 1, function (v) { ctx.commitCfg(function (x) { x.chartDays = v; }); ctx.cache.set(null); })));
  }

  function defaultConfig() {
    var l = (SD.i18n.current && SD.i18n.current()) || "en";
    var byLang = {
      ru: { provider: "cbr-xml-daily", base: "RUB", symbols: ["USD", "EUR"] },
      de: { provider: "frankfurter", base: "EUR", symbols: ["USD", "GBP"] },
      fr: { provider: "frankfurter", base: "EUR", symbols: ["USD", "GBP"] },
      cs: { provider: "frankfurter", base: "CZK", symbols: ["EUR", "USD"] },
      en: { provider: "frankfurter", base: "USD", symbols: ["EUR", "GBP"] }
    };
    var d = byLang[l] || byLang.en;
    return { provider: d.provider, base: d.base, symbols: d.symbols, chart: true, chartDays: 7 };
  }

  SD.registry.register({
    id: "fx", kind: "net", titleKey: "widget.fx", order: 60,
    providers: PROVIDERS, ttlMin: 180, privacyDataKey: "privacy.dataSymbols", tolerant: true,
    origin: origin, buildUrls: buildUrls, parse: parse, render: render, renderSettings: renderSettings, defaultConfig: defaultConfig
  });
})();
