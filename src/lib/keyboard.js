// Layer: view. Desktop keyboard nav: arrows move focus across dials, digits switch groups.
// Tab reaches every element and Enter activates the focused one natively (anchors/buttons) — not hijacked here.
(function () {
  "use strict";
  SD.keyboard = (function () {
    function dials() { return Array.prototype.slice.call(document.querySelectorAll("#grid .dial")); }

    function move(delta) {
      var list = dials();
      if (!list.length) return;
      var cur = list.indexOf(document.activeElement);
      var ni = cur < 0 ? (delta > 0 ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, cur + delta));
      list[ni].focus();
    }

    // Don't intercept keys while typing in a field (e.g. the search box).
    function inField(e) {
      var t = (e.target.tagName || "").toLowerCase();
      return t === "input" || t === "textarea" || t === "select" || e.target.isContentEditable;
    }

    function onKey(e) {
      var st = SD.store.get();
      if (!st || !st.settings.animation.keyboardNav) return;
      if (inField(e) || document.querySelector(".modal.open")) return;
      var cols = st.settings.grid.columns || 6;
      switch (e.key) {
        case "ArrowRight": move(1); e.preventDefault(); break;
        case "ArrowLeft": move(-1); e.preventDefault(); break;
        case "ArrowDown": move(cols); e.preventDefault(); break;
        case "ArrowUp": move(-cols); e.preventDefault(); break;
        default:
          if (/^[1-9]$/.test(e.key)) {
            var groups = st.groups.slice().sort(function (a, b) { return a.order - b.order; });
            var g = groups[parseInt(e.key, 10) - 1];
            if (g) SD.store.commit(function (s) { s.settings.activeGroupId = g.id; });
          }
      }
    }

    function init() { document.addEventListener("keydown", onKey); }
    function reset() {}

    return { init: init, reset: reset };
  })();
})();
