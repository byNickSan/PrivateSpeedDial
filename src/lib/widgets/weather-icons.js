// Layer: widget. Colorful inline-SVG weather icons (WMO weather_code -> glyph). Local, themeable, no network.
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";

  function svg(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function group(code) {
    if (code === 0) return "clear";
    if (code === 1 || code === 2) return "partly";
    if (code === 3) return "cloudy";
    if (code === 45 || code === 48) return "fog";
    if (code >= 51 && code <= 57) return "drizzle";
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
    if (code >= 95) return "thunder";
    return "cloudy";
  }

  function sun(cx, cy, r) {
    var g = svg("g", { "class": "wi-sun" });
    g.appendChild(svg("circle", { cx: cx, cy: cy, r: r }));
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      var x1 = cx + Math.cos(a) * (r + 2), y1 = cy + Math.sin(a) * (r + 2);
      var x2 = cx + Math.cos(a) * (r + 6), y2 = cy + Math.sin(a) * (r + 6);
      g.appendChild(svg("line", { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1), "stroke-width": 2, "stroke-linecap": "round" }));
    }
    return g;
  }
  function moon() { return svg("path", { "class": "wi-moon", d: "M28 12a12 12 0 1 0 8 20 10 10 0 0 1-8-20z" }); }
  function cloud(dx, dy, cls) {
    return svg("path", { "class": cls || "wi-cloud", d: "M" + (14 + dx) + " " + (34 + dy) + " a8 8 0 0 1 1-15 11 11 0 0 1 21 3 7 7 0 0 1-2 12z" });
  }
  function drops(cls) {
    var g = svg("g", { "class": cls });
    [16, 24, 32].forEach(function (x, i) { g.appendChild(svg("line", { x1: x, y1: 36 + (i % 2), x2: x - 2, y2: 44 + (i % 2), "stroke-width": 2, "stroke-linecap": "round" })); });
    return g;
  }
  function flakes() {
    var g = svg("g", { "class": "wi-flake" });
    [16, 24, 32].forEach(function (x) { g.appendChild(svg("circle", { cx: x, cy: 40, r: 1.6 })); });
    return g;
  }
  function bolt() { return svg("path", { "class": "wi-bolt", d: "M24 34l-5 8h4l-2 6 7-9h-4l3-5z" }); }

  // isDay (0/1) picks sun/moon for clear/partly
  function el(code, isDay, size) {
    var g = group(code), day = isDay == null ? 1 : isDay;
    var s = svg("svg", { viewBox: "0 0 48 48", "class": "wi wi-" + g, width: size || 40, height: size || 40, "aria-hidden": "true" });
    if (g === "clear") { s.appendChild(day ? sun(24, 24, 10) : moon()); return s; }
    if (g === "partly") { s.appendChild(day ? sun(18, 16, 7) : moon()); s.appendChild(cloud(2, 2)); return s; }
    if (g === "fog") {
      s.appendChild(cloud(0, -2));
      [38, 42].forEach(function (y) { s.appendChild(svg("line", { "class": "wi-fog", x1: 10, y1: y, x2: 38, y2: y, "stroke-width": 2, "stroke-linecap": "round" })); });
      return s;
    }
    s.appendChild(cloud(0, 0));
    if (g === "drizzle" || g === "rain") s.appendChild(drops("wi-drop"));
    else if (g === "snow") s.appendChild(flakes());
    else if (g === "thunder") s.appendChild(bolt());
    return s;
  }

  SD.weatherIcons = { el: el, group: group };
})();
