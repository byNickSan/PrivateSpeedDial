// Layer: view. Desktop keyboard nav: arrows move focus across dials, digits switch groups.
// Tab reaches every element and Enter activates the focused one natively (anchors/buttons) — not hijacked here.
(function () {
  "use strict";
  SD.keyboard = (function () {
    function dials() { return Array.prototype.slice.call(document.querySelectorAll("#grid .dial")); }
    function tabsList() { return Array.prototype.slice.call(document.querySelectorAll("#tabs .tab")); }
    // Actual columns in the intrinsic grid = number of tiles sharing the first row's offsetTop.
    function gridCols() {
      var list = dials(); if (list.length < 2) return 1;
      var top = list[0].offsetTop, n = 0;
      for (var i = 0; i < list.length && list[i].offsetTop === top; i++) n++;
      return n || 1;
    }

    function move(delta) {
      var list = dials();
      if (!list.length) return;
      var cur = list.indexOf(document.activeElement);
      var ni = cur < 0 ? (delta > 0 ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, cur + delta));
      list[ni].focus();
    }

    // Keyboard alternative to drag-and-drop: Alt+Arrow moves the focused dial by `delta` positions.
    function moveDial(delta, st) {
      if (st.settings.lockDials || st.settings.locked) return false;
      var list = dials(), cur = list.indexOf(document.activeElement);
      if (cur < 0) return false;
      var ni = Math.max(0, Math.min(list.length - 1, cur + delta));
      if (ni === cur) return false;
      var fromId = list[cur].getAttribute("data-id"), toId = list[ni].getAttribute("data-id");
      if (!fromId || !toId || !SD.dnd || !SD.dnd.reorder) return false;
      SD.dnd.reorder(st, fromId, toId);
      // Re-focus the moved dial after the re-render.
      requestAnimationFrame(function () { var el = document.querySelector('#grid .dial[data-id="' + fromId + '"]'); if (el) el.focus(); });
      return true;
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
      var cols = gridCols();
      var ae = document.activeElement;
      // Arrow nav across the GROUP TABS when a tab is focused: ←/→ between tabs, ↓ into the dial grid.
      if (ae && ae.classList && ae.classList.contains("tab")) {
        var tl = tabsList(), ti = tl.indexOf(ae);
        if (e.key === "ArrowRight") { e.preventDefault(); (tl[ti + 1] || tl[0]).focus(); return; }
        if (e.key === "ArrowLeft") { e.preventDefault(); (tl[ti - 1] || tl[tl.length - 1]).focus(); return; }
        if (e.key === "ArrowDown") { e.preventDefault(); var fd = dials()[0]; if (fd) fd.focus(); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); return; }
        // non-arrow (digits) fall through to group switching below
      }
      if (e.altKey && /^Arrow/.test(e.key)) {   // Alt+Arrow = reorder the focused dial (D&D alternative)
        var d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
        if (d != null && moveDial(d, st)) e.preventDefault();
        return;
      }
      switch (e.key) {
        case "ArrowRight": move(1); e.preventDefault(); break;
        case "ArrowLeft": move(-1); e.preventDefault(); break;
        case "ArrowDown": move(cols); e.preventDefault(); break;
        case "ArrowUp": {
          // From the top dial row, ↑ jumps up to the active group tab; otherwise move a row up.
          var list = dials(), cur = list.indexOf(document.activeElement);
          if (cur >= 0 && cur < cols) {
            var tab = document.querySelector("#tabs .tab.active") || document.querySelector("#tabs .tab");
            if (tab) { tab.focus(); e.preventDefault(); break; }
          }
          move(-cols); e.preventDefault(); break;
        }
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
