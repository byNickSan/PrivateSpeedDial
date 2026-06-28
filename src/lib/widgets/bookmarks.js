// Layer: widget. Bookmarks (local): browser bookmark folders for clustering, with full
// management — add/edit/delete/move bookmarks and create/delete folders — acting on the real
// browser bookmarks. Needs the optional "bookmarks" permission (requested from a click).
// Rows are draggable onto the grid (any tile / the "+") to create a dial, and onto each other
// or a folder header to move the real bookmark; a tap "＋" does the same on touch.
(function () {
  "use strict";
  var treeCache = null;
  var DT = "application/x-psd-bookmark";
  function noop() {}

  function hasApi() { return SD.has("bookmarks.getTree"); }
  function canWrite() { return SD.has("bookmarks.create") && SD.has("bookmarks.remove"); }

  async function granted() {
    if (!SD.has("permissions.contains")) return hasApi();
    try { return await SD.api.permissions.contains({ permissions: ["bookmarks"] }); }
    catch (e) { return hasApi(); }
  }
  async function request() {
    if (!SD.has("permissions.request")) return hasApi();
    try { return await SD.api.permissions.request({ permissions: ["bookmarks"] }); }
    catch (e) { return false; }
  }
  function loadTree() {
    if (treeCache) return Promise.resolve(treeCache);
    return SD.api.bookmarks.getTree().then(function (t) { treeCache = t; return t; });
  }

  // Folders that hold at least one direct bookmark; keep node ids/parent/index for editing.
  function collectFolders(nodes, acc) {
    (nodes || []).forEach(function (n) {
      if (n.url) return;
      var items = (n.children || []).filter(function (c) { return c.url; }).map(function (c) {
        return { id: c.id, title: c.title || c.url, url: c.url, parentId: c.parentId, index: c.index };
      });
      if (items.length) acc.push({ id: n.id, title: n.title || "—", items: items });
      if (n.children) collectFolders(n.children, acc);
    });
    return acc;
  }
  // Every folder (incl. empty), indented by depth — for the parent pickers.
  function collectAllFolders(nodes, depth, acc) {
    (nodes || []).forEach(function (n) {
      if (n.url) return;
      acc.push({ id: n.id, title: (depth ? new Array(depth + 1).join("— ") : "") + (n.title || "—") });
      if (n.children) collectAllFolders(n.children, depth + 1, acc);
    });
    return acc;
  }
  function allFolders() {
    return loadTree().then(function (t) { return collectAllFolders((t[0] && t[0].children) || [], 0, []); });
  }

  function faviconImg(url) {
    var img = document.createElement("img");
    img.className = "bm-fav"; img.alt = ""; img.loading = "lazy"; img.draggable = false;
    img.src = SD.icons.faviconUrl(url);
    img.addEventListener("error", function () { img.style.visibility = "hidden"; });
    return img;
  }
  function dragPayload(e) {
    var raw = e.dataTransfer.getData(DT);
    if (raw) { try { return JSON.parse(raw); } catch (x) { /* ignore */ } }
    return null;
  }
  function moveTo(srcId, parentId, index, refresh) {
    if (!SD.has("bookmarks.move") || !srcId) return;
    var dest = { parentId: parentId };
    if (typeof index === "number") dest.index = index;
    SD.api.bookmarks.move(srcId, dest).then(function () { treeCache = null; refresh(); }).catch(function () {});
  }

  // --- modals -------------------------------------------------------------
  function folderSelect(folders, value) { return SD.controls.sel(folders.map(function (f) { return [f.id, f.title]; }), value || (folders[0] && folders[0].id), noop); }

  function editBookmark(it, refresh) {
    allFolders().then(function (folders) {
      var c = SD.controls, t = SD.i18n.t, D = SD.dom;
      var box = D.el("div", { "class": "bm-edit" });
      var title = c.text(it.title, noop), url = c.text(it.url, noop), parent = folderSelect(folders, it.parentId);
      box.appendChild(D.el("h3", { text: t("bookmarks.edit") }));
      box.appendChild(c.row(t("dial.title"), title));
      box.appendChild(c.row(t("dial.url"), url));
      box.appendChild(c.row(t("bookmarks.folder"), parent));
      var del = c.btn("ghost", t("common.delete")), save = c.btn("primary", t("common.save"));
      box.appendChild(D.el("div", { "class": "row end" }, [del, save]));
      var close = SD.ui.openModal(box);
      save.addEventListener("click", function () {
        SD.api.bookmarks.update(it.id, { title: title.value, url: url.value }).then(function () {
          if (parent.value && parent.value !== it.parentId) return SD.api.bookmarks.move(it.id, { parentId: parent.value });
        }).then(function () { close(); treeCache = null; refresh(); }).catch(function () { close(); });
      });
      del.addEventListener("click", function () {
        SD.api.bookmarks.remove(it.id).then(function () { close(); treeCache = null; refresh(); }).catch(function () { close(); });
      });
    });
  }

  function addBookmarkModal(defaultParent, refresh) {
    allFolders().then(function (folders) {
      var c = SD.controls, t = SD.i18n.t, D = SD.dom;
      var box = D.el("div", { "class": "bm-edit" });
      var title = c.text("", noop), url = c.text("", noop), parent = folderSelect(folders, defaultParent);
      url.placeholder = "https://…";
      box.appendChild(D.el("h3", { text: t("bookmarks.addBm") }));
      box.appendChild(c.row(t("dial.title"), title));
      box.appendChild(c.row(t("dial.url"), url));
      box.appendChild(c.row(t("bookmarks.folder"), parent));
      var save = c.btn("primary", t("common.save"));
      box.appendChild(D.el("div", { "class": "row end" }, [save]));
      var close = SD.ui.openModal(box);
      save.addEventListener("click", function () {
        var u = (url.value || "").trim();
        if (!/^https?:\/\//i.test(u)) return;
        SD.api.bookmarks.create({ parentId: parent.value, title: title.value || u, url: u })
          .then(function () { close(); treeCache = null; refresh(); }).catch(function () { close(); });
      });
    });
  }

  function newFolderModal(defaultParent, refresh) {
    allFolders().then(function (folders) {
      var c = SD.controls, t = SD.i18n.t, D = SD.dom;
      var box = D.el("div", { "class": "bm-edit" });
      var name = c.text("", noop), parent = folderSelect(folders, defaultParent);
      box.appendChild(D.el("h3", { text: t("bookmarks.newFolder") }));
      box.appendChild(c.row(t("dial.title"), name));
      box.appendChild(c.row(t("bookmarks.folder"), parent));
      var save = c.btn("primary", t("common.save"));
      box.appendChild(D.el("div", { "class": "row end" }, [save]));
      var close = SD.ui.openModal(box);
      save.addEventListener("click", function () {
        if (!(name.value || "").trim()) return;
        SD.api.bookmarks.create({ parentId: parent.value, title: name.value.trim() })
          .then(function () { close(); treeCache = null; refresh(); }).catch(function () { close(); });
      });
    });
  }

  // --- rendering ----------------------------------------------------------
  function bookmarkRow(it, ctx, refresh) {
    var D = ctx.dom, t = ctx.i18n.t;
    var a = D.el("a", { "class": "bm-item", href: it.url, title: it.url });
    a.appendChild(faviconImg(it.url));
    a.appendChild(D.el("span", { "class": "bm-item-name", text: it.title }));
    var toDial = D.el("button", { "class": "bm-todial", text: "＋", title: t("bookmarks.toDial") });
    toDial.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      if (SD.render && SD.render.addDialFromBookmark) SD.render.addDialFromBookmark({ url: it.url, title: it.title });
      SD.ui.toast(t("bookmarks.added"));
    });
    a.appendChild(toDial);
    if (canWrite()) {
      var edit = D.el("button", { "class": "bm-edit-btn", text: "✎", title: t("common.edit") });
      edit.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); editBookmark(it, refresh); });
      a.appendChild(edit);
    }
    a.setAttribute("draggable", "true");
    a.addEventListener("dragstart", function (e) {
      e.dataTransfer.setData(DT, JSON.stringify({ id: it.id, url: it.url, title: it.title }));
      e.dataTransfer.setData("text/uri-list", it.url);
      e.dataTransfer.setData("text/plain", it.url);
      e.dataTransfer.effectAllowed = "copyMove";
    });
    a.addEventListener("dragover", function (e) {
      if (Array.prototype.indexOf.call(e.dataTransfer.types, DT) < 0) return;
      e.preventDefault(); a.classList.add("bm-drop");
    });
    a.addEventListener("dragleave", function () { a.classList.remove("bm-drop"); });
    a.addEventListener("drop", function (e) {
      a.classList.remove("bm-drop");
      var p = dragPayload(e);
      if (!p || !p.id || p.id === it.id) return;
      e.preventDefault(); e.stopPropagation();
      moveTo(p.id, it.parentId, it.index, refresh);
    });
    return a;
  }

  function folderBlock(f, cfg, ctx, refresh) {
    var D = ctx.dom, t = ctx.i18n.t;
    var block = D.el("div", { "class": "bm-folder" });
    var head = D.el("div", { "class": "bm-folder-head" });
    var toggle = D.el("button", { "class": "bm-folder-toggle" });
    var caret = D.el("span", { "class": "bm-caret", text: "▾" });
    toggle.appendChild(caret);
    toggle.appendChild(D.el("span", { "class": "bm-folder-name", text: f.title }));
    if (cfg.accent) toggle.style.color = cfg.accent;
    toggle.addEventListener("click", function () { var c = block.classList.toggle("collapsed"); caret.textContent = c ? "▸" : "▾"; });
    head.appendChild(toggle);
    if (canWrite()) {
      var addB = D.iconBtn("plus", "", "bm-fact"); addB.title = t("bookmarks.addBm");
      addB.addEventListener("click", function (e) { e.stopPropagation(); addBookmarkModal(f.id, refresh); });
      var addF = D.iconBtn("folderPlus", "", "bm-fact"); addF.title = t("bookmarks.newFolder");
      addF.addEventListener("click", function (e) { e.stopPropagation(); newFolderModal(f.id, refresh); });
      var delF = D.iconBtn("trash", "", "bm-fact"); delF.title = t("bookmarks.delFolder");
      delF.addEventListener("click", function (e) {
        e.stopPropagation();
        if (window.confirm(t("bookmarks.delFolderConfirm"))) SD.api.bookmarks.removeTree(f.id).then(function () { treeCache = null; refresh(); }).catch(function () {});
      });
      head.appendChild(addB); head.appendChild(addF); head.appendChild(delF);
    }
    head.addEventListener("dragover", function (e) {
      if (Array.prototype.indexOf.call(e.dataTransfer.types, DT) < 0) return;
      e.preventDefault(); head.classList.add("bm-drop");
    });
    head.addEventListener("dragleave", function () { head.classList.remove("bm-drop"); });
    head.addEventListener("drop", function (e) {
      head.classList.remove("bm-drop");
      var p = dragPayload(e);
      if (!p || !p.id) return;
      e.preventDefault(); e.stopPropagation();
      moveTo(p.id, f.id, null, refresh);
    });
    var list = D.el("div", { "class": "bm-list" });
    f.items.forEach(function (it) { list.appendChild(bookmarkRow(it, ctx, refresh)); });
    block.appendChild(head); block.appendChild(list);
    return block;
  }

  function renderFolders(wrap, tree, cfg, ctx, refresh) {
    var D = ctx.dom, t = ctx.i18n.t;
    var folders = collectFolders((tree[0] && tree[0].children) || [], []);
    if (cfg.nav === "dropdown" && folders.length) {
      var sel = document.createElement("select");
      sel.className = "bm-select";
      folders.forEach(function (f, i) {
        var op = document.createElement("option");
        op.value = String(i); op.textContent = f.title + " (" + f.items.length + ")";
        sel.appendChild(op);
      });
      var list = D.el("div", { "class": "bm-list" });
      function show(i) { D.clear(list); folders[i].items.forEach(function (it) { list.appendChild(bookmarkRow(it, ctx, refresh)); }); }
      sel.addEventListener("change", function () { show(+sel.value); });
      wrap.appendChild(sel); wrap.appendChild(list); show(0);
    } else if (folders.length) {
      folders.forEach(function (f) { wrap.appendChild(folderBlock(f, cfg, ctx, refresh)); });
    } else {
      wrap.appendChild(D.el("div", { "class": "bm-empty", text: t("bookmarks.empty") }));
    }
  }

  function managementBar(refresh) {
    var D = SD.dom, t = SD.i18n.t;
    var row = D.el("div", { "class": "bm-manage" });
    var addB = D.iconBtn("plus", t("bookmarks.addBm"), "btn ghost");
    addB.addEventListener("click", function () { addBookmarkModal("", refresh); });
    var addF = D.iconBtn("folderPlus", t("bookmarks.newFolder"), "btn ghost");
    addF.addEventListener("click", function () { newFolderModal("", refresh); });
    row.appendChild(addB); row.appendChild(addF);
    return row;
  }

  function mount(el, ctx) {
    var D = ctx.dom, t = ctx.i18n.t, cfg = ctx.cfg();
    function refresh() { mount(el, ctx); }
    D.clear(el);
    var bar = D.el("div", { "class": "bm-bar bm-bar-click", title: t("bookmarks.collapse") });
    bar.appendChild(D.el("span", { "class": "bm-collapse", text: cfg.collapsed ? "▸" : "▾" }));
    bar.appendChild(D.el("span", { "class": "bm-bar-label", text: t("widget.bookmarks") }));
    bar.appendChild(D.el("span", { "class": "bm-bar-spacer" }));
    var help = D.el("span", { "class": "bm-help", text: "?", "data-tip": t("bookmarks.dragHint"), "aria-label": t("bookmarks.dragHint"), tabindex: "0", role: "button" });
    help.addEventListener("click", function (e) { e.stopPropagation(); });
    bar.appendChild(help);
    bar.addEventListener("click", function () { ctx.commitCfg(function (x) { x.collapsed = !x.collapsed; }); });
    el.appendChild(bar);
    if (cfg.collapsed) return;

    var wrap = D.el("div", { "class": "bm-body design-" + (cfg.design || "list") });
    el.appendChild(wrap);
    if (!hasApi() && !SD.has("permissions.request")) {
      wrap.appendChild(D.el("div", { "class": "w-err", text: t("bookmarks.unsupported") }));
      return;
    }
    granted().then(function (ok) {
      if (!ok) {
        var btn = SD.controls.btn("primary", t("bookmarks.enable"));
        btn.classList.add("bm-enable");
        btn.addEventListener("click", function () { request().then(function (g) { if (g) { treeCache = null; refresh(); } }); });
        wrap.appendChild(btn);
        return;
      }
      if (canWrite()) wrap.appendChild(managementBar(refresh));
      loadTree().then(function (tree) { renderFolders(wrap, tree, cfg, ctx, refresh); })
        .catch(function () { wrap.appendChild(D.el("div", { "class": "w-err", text: t("status.error") })); });
    });
  }

  function renderSettings(el, ctx) {
    var c = ctx.controls, t = ctx.i18n.t, cfg = ctx.cfg();
    el.appendChild(c.row(t("bookmarks.nav"), c.sel([["tree", t("bookmarks.navTree")], ["dropdown", t("bookmarks.navDropdown")]], cfg.nav || "tree", function (v) { ctx.commitCfg(function (x) { x.nav = v; }); })));
    el.appendChild(c.row(t("bookmarks.design"), c.sel([["list", t("bookmarks.designList")], ["compact", t("bookmarks.designCompact")]], cfg.design || "list", function (v) { ctx.commitCfg(function (x) { x.design = v; }); })));
    el.appendChild(c.row(t("bookmarks.accent"), c.color(cfg.accent || "#3b82f6", function (v) { ctx.commitCfg(function (x) { x.accent = v; }); })));
    el.appendChild(c.row(t("bookmarks.collapse"), c.check(cfg.collapsed, function (v) { ctx.commitCfg(function (x) { x.collapsed = v; }); })));
  }

  function defaultConfig() { return { collapsed: false, nav: "tree", design: "list", accent: "" }; }

  SD.registry.register({
    id: "bookmarks", kind: "local", titleKey: "widget.bookmarks", order: 15,
    mount: mount, renderSettings: renderSettings, defaultConfig: defaultConfig
  });
})();
