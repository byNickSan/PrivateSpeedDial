// Layer: widget. Notes: multiple free-text notes, debounced autosave + auto-resize. A trailing empty
// draft always sits at the bottom — typing into it creates a note (no "add" button). No network.
(function () {
  "use strict";
  var focusId = null;   // note id to focus after a draft becomes a real note (survives the rebuild)

  function autosize(ta) { ta.style.height = "auto"; ta.style.height = (ta.scrollHeight + 2) + "px"; }
  function styleArea(ta, cfg) { if (cfg.bg) ta.style.background = cfg.bg; if (cfg.fontSize) ta.style.fontSize = cfg.fontSize + "px"; }

  function mount(el, ctx) {
    var D = ctx.dom, cfg = ctx.cfg();
    D.clear(el);
    (cfg.items || []).forEach(function (n) { el.appendChild(noteItem(n, cfg, ctx)); });
    el.appendChild(draftItem(cfg, ctx));
  }

  function noteItem(n, cfg, ctx) {
    var D = ctx.dom;
    var wrap = D.el("div", { "class": "note-item" });
    var ta = document.createElement("textarea");
    ta.className = "notes-area"; ta.rows = 1; ta.value = n.text || "";
    styleArea(ta, cfg);
    ta.setAttribute("placeholder", ctx.i18n.t("notes.placeholder"));
    var timer;
    ta.addEventListener("input", function () {
      autosize(ta);
      clearTimeout(timer);
      timer = setTimeout(function () {
        focusId = n.id;   // keep the caret here across the rebuild the commit triggers
        ctx.commitCfg(function (c) { var x = (c.items || []).filter(function (q) { return q.id === n.id; })[0]; if (x) { x.text = ta.value; x.updatedAt = Date.now(); } });
      }, 400);
    });
    var del = D.el("button", { "class": "note-del", text: "×", title: ctx.i18n.t("common.delete") });
    del.addEventListener("click", function () {
      ctx.commitCfg(function (c) { c.items = (c.items || []).filter(function (q) { return q.id !== n.id; }); });
    });
    wrap.appendChild(del);
    wrap.appendChild(ta);
    requestAnimationFrame(function () {
      autosize(ta);
      if (n.id === focusId) { focusId = null; ta.focus(); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) { /* noop */ } }
    });
    return wrap;
  }

  // always-present empty draft; first keystroke turns it into a real note
  function draftItem(cfg, ctx) {
    var D = ctx.dom;
    var wrap = D.el("div", { "class": "note-item note-draft" });
    var ta = document.createElement("textarea");
    ta.className = "notes-area"; ta.rows = 1;
    styleArea(ta, cfg);
    ta.setAttribute("placeholder", ctx.i18n.t("notes.add"));
    var committed = false;
    ta.addEventListener("input", function () {
      autosize(ta);
      if (!ta.value || committed) return;   // one draft → one note (rebuild swaps in a fresh draft)
      committed = true;
      var id = ctx.schema.uid(), text = ta.value;
      focusId = id;   // restore focus into the new note's textarea after the rebuild
      ctx.commitCfg(function (c) { (c.items = c.items || []).push({ id: id, text: text, updatedAt: Date.now() }); });
    });
    wrap.appendChild(ta);
    requestAnimationFrame(function () { autosize(ta); });
    return wrap;
  }

  function renderSettings(el, ctx) {
    var c = ctx.controls, t = ctx.i18n.t, cfg = ctx.cfg();
    el.appendChild(c.row(t("notes.bg"), c.color(cfg.bg || "", function (v) { ctx.commitCfg(function (x) { x.bg = v; }); })));
    el.appendChild(c.row(t("notes.fontSize"), c.num(cfg.fontSize || 14, 10, 28, 1, function (v) { ctx.commitCfg(function (x) { x.fontSize = v; }); })));
  }

  function defaultConfig() { return { items: [], bg: "", fontSize: 14 }; }

  SD.registry.register({ id: "notes", kind: "local", titleKey: "widget.notes", mount: mount, renderSettings: renderSettings, defaultConfig: defaultConfig, order: 20 });
})();
