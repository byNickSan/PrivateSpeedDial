// Layer: view. Tiny DOM builder so we never assign innerHTML (safer + passes AMO review).
(function () {
  "use strict";
  SD.dom = (function () {
    function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

    // attrs: {class,text,title,type,...}; kids: node | string | array of them.
    function el(tag, attrs, kids) {
      var n = document.createElement(tag);
      if (attrs) {
        Object.keys(attrs).forEach(function (k) {
          var v = attrs[k];
          if (v == null) return;
          if (k === "class") n.className = v;
          else if (k === "text") n.textContent = v;
          else n.setAttribute(k, v);
        });
      }
      if (kids != null) {
        (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
          if (c == null || c === false) return;
          n.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
        });
      }
      return n;
    }

    // Inline SVG icon (stroke = currentColor) — reliable across OSes unlike emoji glyphs.
    var ICON_NS = "http://www.w3.org/2000/svg";
    var ICONS = {
      trash: "M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13",
      folderPlus: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 12v5M9.5 14.5h5",
      plus: "M12 5v14M5 12h14",
      refresh: "M20 11a8 8 0 1 0-.5 4M20 4v6h-6",
      sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M3 12H1M23 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4",
      moon: "M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z",
      monitor: "M3 4h18v13H3zM8 21h8M12 17v4",
      clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
      edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
      chat: "M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z",
      lock: "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4",
      unlock: "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 9.9-1"
    };
    function svg(name, size) {
      var s = document.createElementNS(ICON_NS, "svg");
      s.setAttribute("viewBox", "0 0 24 24");
      s.setAttribute("width", size || 16); s.setAttribute("height", size || 16);
      s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor");
      s.setAttribute("stroke-width", "2"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
      s.setAttribute("class", "icon icon-" + name); s.setAttribute("aria-hidden", "true");
      var p = document.createElementNS(ICON_NS, "path");
      p.setAttribute("d", ICONS[name] || ""); s.appendChild(p);
      return s;
    }
    // Button with an SVG icon and optional text label.
    function iconBtn(name, label, cls) {
      var b = document.createElement("button");
      b.className = cls || "";
      b.appendChild(svg(name));
      if (label) b.appendChild(document.createTextNode(" " + label));
      return b;
    }

    return { clear: clear, el: el, svg: svg, iconBtn: iconBtn };
  })();
})();
