// Layer: view. Small form-control factory shared by the settings panel and widget settings blocks.
(function () {
  "use strict";
  SD.controls = (function () {
    function row(labelText, control) {
      var r = document.createElement("label");
      r.className = "set-row";
      var span = document.createElement("span");
      span.textContent = labelText;
      r.appendChild(span);
      r.appendChild(control);
      return r;
    }
    function section(titleText) {
      var s = document.createElement("section");
      s.className = "set-section";
      var h = document.createElement("h4");
      h.textContent = titleText;
      s.appendChild(h);
      return s;
    }
    function num(value, min, max, step, onInput) {
      var i = document.createElement("input");
      i.type = "number"; i.value = value; i.min = min; i.max = max; i.step = step;
      i.addEventListener("change", function () { onInput(parseFloat(i.value)); });
      return i;
    }
    function text(value, onInput) {
      var i = document.createElement("input");
      i.type = "text"; i.value = value || "";
      i.addEventListener("change", function () { onInput(i.value); });
      return i;
    }
    function color(value, onInput) {
      var i = document.createElement("input");
      i.type = "color"; i.value = (value && value[0] === "#") ? value.slice(0, 7) : "#0f172a";
      i.addEventListener("change", function () { onInput(i.value); });
      return i;
    }
    function check(value, onChange) {
      var i = document.createElement("input");
      i.type = "checkbox"; i.checked = !!value;
      i.addEventListener("change", function () { onChange(i.checked); });
      return i;
    }
    function sel(options, value, onChange) {
      var s = document.createElement("select");
      options.forEach(function (o) {
        var op = document.createElement("option");
        op.value = o[0]; op.textContent = o[1]; s.appendChild(op);
      });
      s.value = value;
      s.addEventListener("change", function () { onChange(s.value); });
      return s;
    }
    function pair(a, b) {
      var d = document.createElement("div");
      d.className = "pair"; d.appendChild(a); d.appendChild(b); return d;
    }
    function btn(kind, label) {
      var b = document.createElement("button");
      b.className = "btn " + kind; b.textContent = label; return b;
    }
    function p2(n) { return (n < 10 ? "0" : "") + n; }
    // A compact clickable chip showing a date/time; click opens a small popover to set it.
    // value is a ms timestamp or null; onChange receives the new ms timestamp or null.
    function dateTimeChip(value, onChange) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "dt-chip";
      function fmt() {
        b.textContent = value ? new Date(value).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : ("⏰ " + SD.i18n.t("dt.set"));
      }
      fmt();
      b.addEventListener("click", function () {
        var base = value ? new Date(value) : new Date();
        var box = SD.dom.el("div", { "class": "dt-pop" });
        var d = document.createElement("input"); d.type = "date";
        var tm = document.createElement("input"); tm.type = "time";
        d.value = base.getFullYear() + "-" + p2(base.getMonth() + 1) + "-" + p2(base.getDate());
        tm.value = value ? (p2(base.getHours()) + ":" + p2(base.getMinutes())) : "";
        box.appendChild(SD.dom.el("h3", { text: SD.i18n.t("dt.title") }));
        box.appendChild(row(SD.i18n.t("dt.date"), d));
        box.appendChild(row(SD.i18n.t("dt.time"), tm));
        var clr = btn("ghost", SD.i18n.t("common.delete"));
        var ok = btn("primary", SD.i18n.t("common.save"));
        box.appendChild(SD.dom.el("div", { "class": "row end" }, [clr, ok]));
        var close = SD.ui.openModal(box);
        ok.addEventListener("click", function () {
          value = d.value ? new Date(d.value + "T" + (tm.value || "09:00")).getTime() : null;
          fmt(); close(); onChange(value);
        });
        clr.addEventListener("click", function () { value = null; fmt(); close(); onChange(null); });
      });
      return b;
    }
    return { row: row, section: section, num: num, text: text, color: color, check: check, sel: sel, pair: pair, btn: btn, dateTimeChip: dateTimeChip };
  })();
})();
