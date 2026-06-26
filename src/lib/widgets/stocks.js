// Layer: widget. Stocks (net). MOEX ISS (no key, CORS): index + per-symbol sparkline. RU market only.
(function () {
  "use strict";
  var PROVIDERS = [["moex", "MOEX ISS"]];
  var SVGNS = "http://www.w3.org/2000/svg";

  function origin() {
    return "https://iss.moex.com";
  }

  // ISO date (YYYY-MM-DD) `days` days before now — start of the index candle history.
  function since(days) {
    var d = new Date(Date.now() - days * 86400000);
    return d.toISOString().slice(0, 10);
  }

  // MOEX needs two endpoints: per-symbol last prices, and daily candles for the headline index.
  function buildUrls(cfg) {
    var idx = (cfg.indexSym || "IMOEX").toUpperCase();
    var securities = "https://iss.moex.com/iss/engines/stock/markets/shares/securities.json?securities=" +
      encodeURIComponent((cfg.symbols || []).join(",")) + "&iss.meta=off&iss.only=marketdata";
    var candles = "https://iss.moex.com/iss/engines/stock/markets/index/securities/" + encodeURIComponent(idx) +
      "/candles.json?interval=24&from=" + since(30) + "&iss.meta=off&iss.only=candles";
    return [securities, candles];
  }

  function parse(json, cfg) {
    var secJson = json[0] || {}, candleJson = json[1] || {};
    var md = secJson.marketdata || {};
    var cols = md.columns || [], rows = md.data || [];
    var iSec = cols.indexOf("SECID"), iLast = cols.indexOf("LAST");
    var out = {};
    rows.forEach(function (r) { var sec = r[iSec]; if (sec && out[sec] == null && r[iLast] != null) out[sec] = r[iLast]; });
    var symbols = (cfg.symbols || []).map(function (s) { return { sym: s, value: out[s] != null ? out[s] : null }; });
    var cd = candleJson.candles || {};
    var ccols = cd.columns || [], crows = cd.data || [];
    var iClose = ccols.indexOf("close");
    var closes = iClose >= 0 ? crows.map(function (r) { return r[iClose]; }).filter(function (v) { return v != null; }) : [];
    var index = null;
    if (closes.length) {
      var last = closes[closes.length - 1], first = closes[0];
      index = { sym: (cfg.indexSym || "IMOEX").toUpperCase(), value: last, changePct: first ? ((last - first) / first) * 100 : 0, spark: closes };
    }
    return { index: index, symbols: symbols, currency: cfg.currency || "RUB" };
  }

  // Inline SVG sparkline from a series of closes; green when up over the window, red when down.
  function sparkline(values, up) {
    var w = 240, h = 36, n = values.length;
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    var span = (max - min) || 1;
    var pts = values.map(function (v, i) {
      var x = n > 1 ? (i / (n - 1)) * w : 0;
      var y = h - ((v - min) / span) * (h - 4) - 2;
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    var svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("class", "w-spark");
    svg.setAttribute("preserveAspectRatio", "none");
    var poly = document.createElementNS(SVGNS, "polyline");
    poly.setAttribute("points", pts);
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", up ? "#16a34a" : "#dc2626");
    poly.setAttribute("stroke-width", "2");
    poly.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(poly);
    return svg;
  }

  function fmt(v) { return (typeof v === "number") ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"; }

  function render(el, res, ctx) {
    var D = ctx.dom; D.clear(el);
    if (res.error && !res.data) { el.appendChild(D.el("div", { class: "w-err", text: ctx.i18n.t("status.error") })); return; }
    var data = res.data || {};
    var wrap = D.el("div", { class: "w-stocks" });
    var idx = data.index;
    if (idx) {
      var up = (idx.changePct || 0) >= 0;
      var head = D.el("div", { class: "w-index" });
      head.appendChild(D.el("div", { class: "w-index-top" }, [
        D.el("span", { class: "w-index-sym", text: idx.sym }),
        D.el("b", { class: "w-index-val", text: fmt(idx.value) }),
        D.el("span", { class: "w-index-chg " + (up ? "up" : "down"), text: (up ? "▲ " : "▼ ") + Math.abs(idx.changePct).toFixed(2) + "%" })
      ]));
      if (idx.spark && idx.spark.length > 1) head.appendChild(sparkline(idx.spark, up));
      wrap.appendChild(head);
    }
    (data.symbols || []).forEach(function (r) {
      wrap.appendChild(D.el("div", { class: "w-row" }, [
        D.el("span", { text: r.sym }),
        D.el("b", { text: r.value != null ? fmt(r.value) + " " + (data.currency || "") : "—" })
      ]));
    });
    if (res.fromCache) wrap.appendChild(D.el("div", { class: "w-cache", text: ctx.i18n.t("status.cached") }));
    el.appendChild(wrap);
  }

  function renderSettings(el, ctx) {
    var c = ctx.controls, t = ctx.i18n.t, cfg = ctx.cfg();
    el.appendChild(c.row(t("provider.index"), c.text(cfg.indexSym || "IMOEX", function (v) { ctx.commitCfg(function (x) { x.indexSym = v.toUpperCase(); }); ctx.cache.set(null); })));
    el.appendChild(c.row(t("provider.symbols"), c.text((cfg.symbols || []).join(","), function (v) { ctx.commitCfg(function (x) { x.symbols = v.split(",").map(function (s) { return s.trim().toUpperCase(); }).filter(Boolean); }); ctx.cache.set(null); })));
    el.appendChild(c.row(t("provider.currency"), c.text(cfg.currency || "RUB", function (v) { ctx.commitCfg(function (x) { x.currency = v.toUpperCase(); }); })));
  }
  function defaultConfig() { return { provider: "moex", indexSym: "IMOEX", currency: "RUB", symbols: ["SBER", "GAZP"] }; }

  SD.registry.register({
    id: "stocks", kind: "net", titleKey: "widget.stocks", order: 70,
    providers: PROVIDERS, ttlMin: 15, privacyDataKey: "privacy.dataSymbols",
    origin: origin, buildUrls: buildUrls, parse: parse, render: render, renderSettings: renderSettings, defaultConfig: defaultConfig
  });
})();
