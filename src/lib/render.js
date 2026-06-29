// Renders group tabs, the dial grid (with icons), the dial editor, and the widgets panel.
(function () {
  "use strict";
  SD.render = (function () {
    // Cold-load window: show the widget loading shimmer during the first ~1.5s after the page boots,
    // then never again (so settings re-renders don't flash). Timer starts when this script evaluates.
    var appBooting = true;
    setTimeout(function () { appBooting = false; }, 1500);

    function renderAll(state) {
      // Each section guarded independently: a failure in one (e.g. the tab dock) must not blank the whole page.
      SD.safe("renderTabs", function () { renderTabs(state); });
      SD.safe("search", function () { SD.search.render(document.getElementById("search"), SD.ctx); });
      SD.safe("renderGrid", function () { renderGrid(state); });
      SD.safe("renderWidgets", function () { renderWidgets(state); });
    }

    function renderTabs(state) {
      var tabs = document.getElementById("tabs");
      var prevScroll = tabs.scrollLeft;   // innerHTML="" resets it to 0 → restore after rebuild (no click-flicker)
      tabs.innerHTML = "";
      tabs.setAttribute("data-align", state.settings.tabsAlign === "left" ? "left" : "center");
      // Single-line = dock (fisheye, fits all); multi-row when tabsWrap is set.
      var wrap = !!state.settings.tabsWrap;
      tabs.classList.toggle("tabs-wrap", wrap);
      if (tabs.parentElement) tabs.parentElement.classList.toggle("tabs-wrapped", wrap);   // pins controls to top corner
      // Pan-scroll handlers, attached once to the persistent #tabs element (children rebuilt each render).
      if (!tabs.__pan) {
        var touchLike = function () {
          return (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
            /Mobi|Android|iPhone|iPad|iPod|Tablet|Silk/i.test(navigator.userAgent || "");
        };
        // Mouse-position pan: cursor X across the strip maps to scroll position, eased toward the target so it
        // glides. Touch uses native swipe (no pan, no animation). One readable row; scroll reveals the rest.
        var target = 0, raf = null, panning = false;
        var step = function () {
          var max = tabs.scrollWidth - tabs.clientWidth;
          if (max <= 0 || !panning) { raf = null; return; }
          var dx = target - tabs.scrollLeft;
          if (Math.abs(dx) < 0.5) tabs.scrollLeft = target; else tabs.scrollLeft += dx * 0.12;   // gentle ease/decel
          raf = requestAnimationFrame(step);
        };
        tabs.addEventListener("mousemove", function (e) {
          if (touchLike() || tabs.classList.contains("tabs-wrap")) return;
          var max = tabs.scrollWidth - tabs.clientWidth;
          if (max <= 0) { panning = false; return; }
          var r = tabs.getBoundingClientRect(), pad = Math.min(90, r.width * 0.12);   // edge dead-zones reach 0/end
          var ratio = Math.max(0, Math.min(1, (e.clientX - r.left - pad) / (r.width - 2 * pad)));
          target = ratio * max; panning = true;
          if (!raf) raf = requestAnimationFrame(step);
        });
        tabs.addEventListener("mouseleave", function () { panning = false; });
        tabs.addEventListener("wheel", function (e) {
          if (e.deltaY && tabs.scrollWidth > tabs.clientWidth) { tabs.scrollLeft += e.deltaY; target = tabs.scrollLeft; e.preventDefault(); }
        }, { passive: false });
        tabs.__pan = 1;
      }
      var activeTab = null;
      state.groups.slice().sort(byOrder).forEach(function (g) {
        var b = document.createElement("button");
        b.className = "tab" + (g.id === state.settings.activeGroupId ? " active" : "");
        b.textContent = g.name;
        b.addEventListener("click", function () { SD.store.commit(function (s) { s.settings.activeGroupId = g.id; }); });
        b.addEventListener("dblclick", function () { renameGroup(state, g); });
        tabs.appendChild(b);
        if (g.id === state.settings.activeGroupId) activeTab = b;
      });
      var add = document.createElement("button");
      add.className = "tab add"; add.textContent = "+";
      add.title = SD.i18n.t("group.add");
      add.addEventListener("click", function () { addGroup(state); });
      tabs.appendChild(add);
      // Restore scroll across the rebuild; only re-centre when the active tab is actually off-screen (clicking
      // an already-visible tab must NOT jump the strip).
      if (!wrap && tabs.scrollWidth > tabs.clientWidth) {
        tabs.scrollLeft = prevScroll;
        if (activeTab) {
          var aL = activeTab.offsetLeft, aR = aL + activeTab.offsetWidth, vL = tabs.scrollLeft, vR = vL + tabs.clientWidth;
          if (aL < vL + 8 || aR > vR - 8) tabs.scrollLeft = Math.max(0, aL - tabs.clientWidth / 2 + activeTab.offsetWidth / 2);
        }
      }
    }

    function addGroup(state) {
      var name = prompt(SD.i18n.t("group.add"), SD.i18n.t("group.defaultName"));
      if (name == null) return;
      var id = SD.schema.uid();
      SD.store.commit(function (s) {
        s.groups.push({ id: id, name: name || SD.i18n.t("group.defaultName"), order: s.groups.length });
        s.settings.activeGroupId = id;
      });
    }

    function renameGroup(state, g) {
      var name = prompt(SD.i18n.t("group.rename"), g.name);
      if (name == null) return;
      SD.store.commit(function (s) {
        var x = s.groups.filter(function (q) { return q.id === g.id; })[0];
        if (x) x.name = name;
      });
    }

    // Only our own bookmark rows carry this typed payload — checking it (not text/uri-list)
    // avoids treating a dial-reorder drag (dials are <a href>, so they expose a URL) as a bookmark.
    function isBookmarkDrag(e) {
      var ty = e.dataTransfer && e.dataTransfer.types;
      return !!ty && Array.prototype.indexOf.call(ty, "application/x-psd-bookmark") >= 0;
    }
    function readBookmarkDrag(e) {
      var raw = e.dataTransfer.getData("application/x-psd-bookmark");
      if (raw) { try { return JSON.parse(raw); } catch (x) { /* fall through */ } }
      return null;
    }
    // Whole-grid drop zone for bookmark drags: highlights the entire field, copies the bookmark to a dial.
    function attachBookmarkDrop(grid, state) {
      var depth = 0;
      function clear() { depth = 0; grid.classList.remove("bm-drop-active"); }
      grid.addEventListener("dragenter", function (e) {
        if (SD.store.get().settings.locked || !isBookmarkDrag(e)) return;
        e.preventDefault(); depth++; grid.classList.add("bm-drop-active");
      });
      grid.addEventListener("dragover", function (e) {
        if (SD.store.get().settings.locked || !isBookmarkDrag(e)) return;
        e.preventDefault(); e.dataTransfer.dropEffect = "copy";
      });
      grid.addEventListener("dragleave", function (e) {
        if (!isBookmarkDrag(e)) return;
        depth--; if (depth <= 0) clear();
      });
      grid.addEventListener("drop", function (e) {
        if (SD.store.get().settings.locked || !isBookmarkDrag(e)) return;
        e.preventDefault(); clear();
        var bm = readBookmarkDrag(e);
        if (bm) addDialFromBookmark(bm);
      });
    }

    function addDialFromBookmark(bm) {
      if (!bm || !bm.url) return;
      SD.store.commit(function (s) {
        s.dials.push({
          id: SD.schema.uid(), groupId: s.settings.activeGroupId, parentId: null, type: "link",
          title: bm.title || hostname(bm.url) || bm.url, url: bm.url,
          icon: { type: "auto", value: "" }, color: "", order: s.dials.length
        });
      });
    }

    // Signature of everything that affects the dial grid (incl. dnd's lock read). When unchanged we skip the
    // full rebuild so unrelated commits (notes/widgets) don't recreate tiles & reload icon <img> → no flicker.
    function gridSig(state) {
      var gid = state.settings.activeGroupId, s = state.settings;
      var parts = [gid, s.grid.columns, !!s.lockDials, !!s.locked, s.tile.autoFavicon !== false, s.showLabels !== false];
      state.dials.filter(function (d) { return d.groupId === gid && !d.parentId; }).sort(byOrder).forEach(function (d) {
        var ic = d.icon || {};
        parts.push([d.id, d.title || "", d.url || "", ic.type || "", ic.value || "", ic.cachedUrl || "", d.color || "", d.order, d.type || ""].join("|"));
      });
      return parts.join("¦");
    }
    function renderGrid(state) {
      var grid = document.getElementById("grid");
      var sig = gridSig(state);
      if (grid.__sig === sig) return;   // nothing grid-relevant changed → don't rebuild (kills icon flicker)
      grid.__sig = sig;
      grid.innerHTML = "";
      // 0 = Auto (intrinsic auto-fit); >0 = pinned column count (advanced override).
      var cols = state.settings.grid.columns;
      if (cols > 0) { grid.setAttribute("data-grid", "fixed"); grid.style.setProperty("--grid-cols", cols); }
      else grid.removeAttribute("data-grid");
      var gid = state.settings.activeGroupId;
      var dials = state.dials.filter(function (d) { return d.groupId === gid && !d.parentId; }).sort(byOrder);
      dials.forEach(function (d) { grid.appendChild(dialTile(d, state)); });
      var add = document.createElement("button");
      add.className = "dial add-dial";
      add.textContent = "+";
      add.title = SD.i18n.t("dial.add");
      add.addEventListener("click", function () { openDialEditor(state, null); });
      grid.appendChild(add);
      SD.dnd.attach(grid, state);
      // #grid is a persistent element (only its children are re-rendered); attach the bookmark-drop
      // listeners ONCE, or every re-render stacks another drop handler and one drop creates N dials.
      if (!grid.__bmDropAttached) { attachBookmarkDrop(grid, state); grid.__bmDropAttached = true; }
      if (SD.keyboard) SD.keyboard.reset();
    }

    function dialTile(d, state) {
      if (d.type === "folder") return folderTile(d, state);
      var a = document.createElement("a");
      a.className = "dial";
      a.href = normalizeUrl(d.url) || "#";
      a.setAttribute("data-id", d.id);
      a.tabIndex = 0;
      if (d.color) { a.style.setProperty("--tile-color", d.color); a.style.setProperty("--tile-text", SD.themes.onColor(d.color)); }

      var wrap = document.createElement("span");
      wrap.className = "dial-ico-wrap";
      wrap.appendChild(iconNode(d, state));
      a.appendChild(wrap);

      if (state.settings.showLabels) {
        var label = document.createElement("span");
        label.className = "dial-label";
        label.textContent = d.title || hostname(d.url) || d.url || "";
        a.appendChild(label);
      }

      var edit = document.createElement("button");
      edit.className = "dial-edit";
      edit.textContent = "✎";
      edit.title = SD.i18n.t("dial.edit");
      edit.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openDialEditor(state, d); });
      a.appendChild(edit);
      return a;
    }

    function iconNode(d, state) {
      var img = document.createElement("img");
      img.className = "dial-ico";
      img.alt = "";
      var accent = SD.themes.active(state).colors.accent;
      var type = d.icon ? d.icon.type : "auto";
      if (type === "upload" && d.icon.value) {
        img.src = d.icon.value;
      } else if (type === "library") {
        var lib = SD.icons.libraryIcon(state, d.icon.value);
        img.src = lib ? lib.dataUrl : SD.icons.letterDataUrl(d.title, accent, d.url);
      } else if (type === "letter") {
        img.src = SD.icons.letterDataUrl(d.title, accent, d.url);
      } else if ((type === "auto" || type === "favicon") && state.settings.tile.autoFavicon && d.url) {
        img.addEventListener("load", function () { fitIcon(img); });
        if (d.icon && d.icon.cachedUrl) {
          img.src = d.icon.cachedUrl;
          img.addEventListener("error", function () { img.src = SD.icons.letterDataUrl(d.title, accent, d.url); }, { once: true });   // cached icon 404'd → letter
        } else {
          img.src = SD.icons.letterDataUrl(d.title || d.url, accent, d.url);   // instant placeholder
          resolveAndCache(d);   // probe candidates ONCE, cache the first that actually loads
        }
      } else {
        img.src = SD.icons.letterDataUrl(d.title, accent, d.url);
      }
      return img;
    }
    function fmtKB(n) { return n < 1024 ? n + " B" : (n / 1024).toFixed(1) + " KB"; }
    // Designer §4.1: don't upscale a small favicon into a blur — keep it native size, centered, on a
    // tinted chip so it doesn't float. Mark the wrap (not the img) so CSS adds the tint.
    function fitIcon(img) {
      var w = img.naturalWidth || 0, wrap = img.parentNode;
      if (wrap && wrap.classList) wrap.classList.toggle("is-tiny", w > 0 && w < 32);
    }
    // Probe URLs in priority order via a detached Image; resolve to the FIRST that actually loads (null if
    // none). Each URL is requested at most once — no per-render re-probing, no 404 storms.
    function firstThatLoads(urls) {
      var i = 0;
      return new Promise(function (resolve) {
        var next = function () {
          if (i >= urls.length) { resolve(null); return; }
          var u = urls[i++];
          if (!u) { next(); return; }
          var t = new Image();
          t.onload = function () { resolve(u); };
          t.onerror = next;
          t.src = u;
        };
        next();
      });
    }
    // Resolve a dial's icon once per session and cache it. Priority: site HTML/manifest icons (private,
    // needs host permission) → site root favicons → favicon service. Only a URL that VERIFIABLY loads is
    // cached, so a 404 candidate is never stored and never re-fetched on later renders.
    var iconTried = {};
    function resolveAndCache(d) {
      if (!d || !d.id || !d.url || iconTried[d.id] || (d.icon && d.icon.cachedUrl)) return;
      iconTried[d.id] = 1;
      var page = normalizeUrl(d.url);
      var fallback = function () { return firstThatLoads(SD.icons.faviconCandidates(page)); };
      var store = function (url) {
        if (!url) return;
        SD.store.commit(function (s) { var x = s.dials.filter(function (q) { return q.id === d.id; })[0]; if (x) { x.icon = x.icon || { type: "auto", value: "" }; x.icon.cachedUrl = url; } });
      };
      SD.icons.gatherIcons(page).then(function (list) {
        var seen = {}, cands = [];
        (list || []).concat(SD.icons.faviconCandidates(page)).forEach(function (u) { if (u && !seen[u]) { seen[u] = 1; cands.push(u); } });
        return firstThatLoads(cands);
      }, fallback).then(function (url) {
        // ALWAYS cache something (the favicon service URL as last resort) so the probe runs once and never
        // re-fires its candidate 404s on later renders/reloads. Cache bytes (data: URL) when readable.
        url = url || SD.icons.serviceIconUrl(page) || SD.icons.letterDataUrl(d.title || d.url, "", d.url);
        SD.icons.iconToDataUrl(url).then(store, function () { store(url); });
      });
    }
    function setMiniIcon(mi, k, state) {
      var accent = SD.themes.active(state).colors.accent;
      if (k.icon && k.icon.type === "upload" && k.icon.value) { mi.src = k.icon.value; return; }
      if (k.icon && k.icon.type === "library") { var lib = SD.icons.libraryIcon(state, k.icon.value); mi.src = lib ? lib.dataUrl : SD.icons.letterDataUrl(k.title, accent, k.url); return; }
      // Use the cached icon if resolved; otherwise show a letter and resolve once in the background — never
      // probe favicon paths on every folder render (that caused repeated 404s in the console).
      if (k.icon && k.icon.cachedUrl) {
        mi.src = k.icon.cachedUrl;
        mi.addEventListener("error", function () { mi.src = SD.icons.letterDataUrl(k.title || k.url, accent, k.url); }, { once: true });
        return;
      }
      mi.src = SD.icons.letterDataUrl(k.title || k.url, accent, k.url);
      if (k.url && state.settings.tile.autoFavicon) resolveAndCache(k);
    }

    function folderTile(d, state) {
      var el = document.createElement("div");
      el.className = "dial folder";
      el.setAttribute("data-id", d.id);
      el.setAttribute("role", "button");
      el.tabIndex = 0;
      el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFolder(d); } });
      if (d.color) { el.style.setProperty("--tile-color", d.color); el.style.setProperty("--tile-text", SD.themes.onColor(d.color)); }
      var wrap = document.createElement("span"); wrap.className = "dial-ico-wrap";
      var prev = document.createElement("span"); prev.className = "folder-preview";
      var kids = state.dials.filter(function (x) { return x.parentId === d.id; }).sort(byOrder).slice(0, 4);
      if (kids.length) {
        kids.forEach(function (k) { var mi = document.createElement("img"); mi.className = "folder-mini"; mi.alt = ""; setMiniIcon(mi, k, state); prev.appendChild(mi); });
      } else {
        prev.appendChild(SD.dom.el("span", { class: "folder-empty", text: "📁" }));
      }
      wrap.appendChild(prev); el.appendChild(wrap);
      if (state.settings.showLabels) el.appendChild(SD.dom.el("span", { class: "dial-label", text: d.title || "" }));
      var edit = SD.dom.el("button", { class: "dial-edit", text: "✎", title: SD.i18n.t("dial.edit") });
      edit.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openDialEditor(state, d, null); });
      el.appendChild(edit);
      el.addEventListener("click", function () { openFolder(d); });
      return el;
    }

    // folder view; subscribes to the store so it refreshes on edits, unsubscribes when detached
    function openFolder(folder) {
      var node = SD.dom.el("div", { class: "folder-view" });
      node.appendChild(SD.dom.el("h3", { text: folder.title || "" }));
      var grid = SD.dom.el("div", { class: "folder-grid" });
      node.appendChild(grid);
      var unsub;
      function refresh() {
        if (!grid.isConnected) { if (unsub) unsub(); return; }
        SD.dom.clear(grid);
        var st = SD.store.get();
        st.dials.filter(function (x) { return x.parentId === folder.id; }).sort(byOrder).forEach(function (x) { grid.appendChild(dialTile(x, st)); });
        var add = SD.dom.el("button", { class: "dial add-dial", text: "+", title: SD.i18n.t("dial.add") });
        add.addEventListener("click", function () { openDialEditor(SD.store.get(), null, folder.id); });
        grid.appendChild(add);
      }
      SD.ui.openModal(node);
      if (node.parentElement) node.parentElement.classList.add("zoom-in");
      unsub = SD.store.subscribe(refresh);
      refresh();
    }

    // add/edit dial modal; parentId is set when adding inside a folder
    function openDialEditor(state, dial, parentId) {
      var D = SD.dom, t = SD.i18n.t;
      var editing = !!dial;
      var model = dial ? JSON.parse(JSON.stringify(dial)) : { id: SD.schema.uid(), groupId: state.settings.activeGroupId, parentId: parentId || null, title: "", url: "", icon: { type: "auto", value: "" }, color: "", order: state.dials.length };
      if (dial && model.parentId === undefined) model.parentId = null;
      var node = D.el("div", { "class": "dial-editor" });
      node.appendChild(D.el("h3", { text: t(editing ? "dial.edit" : "dial.add") }));

      var fTitle = D.el("input", { "class": "f-title", type: "text" }); fTitle.value = model.title || "";
      var fUrl = D.el("input", { "class": "f-url", type: "url", placeholder: "https://" }); fUrl.value = model.url || "";
      var fColorOn = D.el("input", { "class": "f-color-on", type: "checkbox" }); fColorOn.checked = !!model.color;   // off = theme surface (no forced dark tile)
      var fColor = D.el("input", { "class": "f-color", type: "color" }); fColor.value = model.color || "#1e293b";
      fColor.addEventListener("input", function () { fColorOn.checked = true; });
      var fIcon = D.el("select", { "class": "f-icon" });
      [["auto", "dial.iconAuto"], ["library", "dial.iconLibrary"], ["upload", "dial.iconUpload"], ["letter", "dial.iconLetter"]]
        .forEach(function (o) { fIcon.appendChild(D.el("option", { value: o[0], text: t(o[1]) })); });
      fIcon.value = model.icon.type === "favicon" ? "auto" : model.icon.type;
      var fFile = D.el("input", { type: "file", accept: "image/*,.ico,.svg" }); fFile.style.display = "none";
      var lib = D.el("div", { "class": "icon-library" });

      node.appendChild(D.el("label", {}, [t("dial.title"), fTitle]));

      // folder toggle, top-level only — no nested folders
      var fFolder = D.el("input", { type: "checkbox" });
      fFolder.checked = model.type === "folder";
      if (!model.parentId) node.appendChild(D.el("label", { "class": "set-row" }, [t("dial.folder"), fFolder]));

      var urlLabel = D.el("label", {}, [t("dial.url"), fUrl]);
      var iconRefresh = D.el("button", { "class": "icon-refresh", type: "button", title: t("dial.refreshIcon"), text: "↻" });
      iconRefresh.addEventListener("click", function (ev) {
        ev.preventDefault();
        var go = function () {
          SD.icons.gatherIcons(normalizeUrl(model.url)).then(function (list) {
            if (list[0]) { model.icon = { type: "auto", value: "", cachedUrl: list[0] }; fIcon.value = "auto"; }
            drawIconVariants(list);
          });
        };
        var origin; try { origin = new URL(normalizeUrl(model.url)).origin + "/*"; } catch (e) { origin = null; }
        if (origin && SD.has && SD.has("permissions.request")) SD.api.permissions.request({ origins: [origin] }).then(go, go);   // scoped to this dial's site only
        else go();
      });
      function syncIconRefresh() { iconRefresh.style.display = fIcon.value === "auto" && !fFolder.checked ? "" : "none"; }
      var iconLabel = D.el("label", {}, [t("dial.icon"), fIcon, iconRefresh]);
      var iconVariants = D.el("div", { "class": "icon-variants" });
      node.appendChild(urlLabel);
      node.appendChild(D.el("label", {}, [t("dial.color"), fColorOn, fColor]));
      node.appendChild(iconLabel);
      node.appendChild(fFile);
      node.appendChild(lib);
      node.appendChild(iconVariants);

      // Pick an icon manually from the discovered variants — selected one gets a frame + corner check.
      var variantAdded = {};
      function addVariant(url) {
        if (!url || variantAdded[url]) return; variantAdded[url] = 1;
        var wrap = D.el("div", { "class": "icon-variant-wrap" });
        var b = D.el("button", { "class": "icon-variant" + (model.icon && model.icon.cachedUrl === url ? " sel" : ""), type: "button", title: url });
        var im = document.createElement("img"); im.alt = ""; im.src = url;
        var cap = D.el("span", { "class": "icon-variant-cap", text: "…" });
        im.addEventListener("error", function () { delete variantAdded[url]; wrap.remove(); });   // drop broken candidates
        im.addEventListener("load", function () {
          var dim = (im.naturalWidth || "?") + "×" + (im.naturalHeight || "?");
          cap.textContent = dim;
          // file weight needs a cross-origin read (host permission / CORS); skip silently if blocked
          fetch(url, { credentials: "omit" }).then(function (r) { return r.ok ? r.blob() : null; }).then(function (bl) {
            if (bl) cap.textContent = dim + " · " + fmtKB(bl.size);
          }).catch(function () { });
        });
        b.appendChild(im); b.appendChild(D.el("span", { "class": "icon-variant-check", text: "✓" }));
        b.addEventListener("click", function (e2) {
          e2.preventDefault();
          model.icon = { type: "auto", value: "", cachedUrl: url }; fIcon.value = "auto";
          iconVariants.querySelectorAll(".icon-variant").forEach(function (x) { x.classList.remove("sel"); });
          b.classList.add("sel");
        });
        wrap.appendChild(b); wrap.appendChild(cap);
        iconVariants.appendChild(wrap);
      }
      function drawIconVariants(extra) {
        var show = fIcon.value === "auto" && !fFolder.checked && !!model.url;
        iconVariants.style.display = show ? "" : "none";
        if (!show) return;
        D.clear(iconVariants); variantAdded = {};
        SD.icons.faviconCandidates(normalizeUrl(model.url)).forEach(addVariant);
        if (extra && extra.length) extra.forEach(addVariant);
        else SD.icons.gatherIcons(normalizeUrl(model.url)).then(function (list) { if (iconVariants.isConnected) list.forEach(addVariant); });
      }

      function applyFolderMode() {
        var isF = fFolder.checked;
        urlLabel.style.display = isF ? "none" : "";
        iconLabel.style.display = isF ? "none" : "";
        lib.style.display = isF ? "none" : "";
        syncIconRefresh(); drawIconVariants();
      }
      fFolder.addEventListener("change", applyFolderMode);
      applyFolderMode();

      var cancel = D.el("button", { "class": "btn ghost", text: t("common.cancel") });
      var save = D.el("button", { "class": "btn primary", text: t("common.save") });
      var del = editing ? D.el("button", { "class": "btn ghost", text: t("common.delete") }) : null;
      node.appendChild(D.el("div", { "class": "row end" }, [del, cancel, save]));

      function drawLibrary() {
        D.clear(lib);
        (state.iconLibrary || []).forEach(function (ic) {
          var b = D.el("button", { "class": "lib-ico" + (model.icon.type === "library" && model.icon.value === ic.id ? " sel" : "") });
          var im = document.createElement("img"); im.src = ic.dataUrl; b.appendChild(im);
          b.addEventListener("click", function () { model.icon = { type: "library", value: ic.id }; fIcon.value = "library"; drawLibrary(); });
          lib.appendChild(b);
        });
      }
      drawLibrary();

      fIcon.addEventListener("change", function (e) {
        var v = e.target.value;
        if (v === "upload") fFile.click();
        else { model.icon = { type: v, value: v === "library" ? model.icon.value : "" }; drawLibrary(); }
        syncIconRefresh(); drawIconVariants();
      });
      fUrl.addEventListener("change", function () { drawIconVariants(); });
      syncIconRefresh();

      fFile.addEventListener("change", async function () {
        if (!fFile.files[0]) return;
        var entry = await SD.icons.importFile(fFile.files[0]);
        var id = SD.schema.uid();
        SD.store.commit(function (s) { s.iconLibrary.push({ id: id, name: entry.name, format: entry.format, dataUrl: entry.dataUrl, w: entry.w, h: entry.h, bytes: entry.bytes }); });
        model.icon = { type: "library", value: id };
        fIcon.value = "library";
        drawLibrary();
      });

      var close = SD.ui.openModal(node);
      cancel.addEventListener("click", close);
      if (del) del.addEventListener("click", function () {
        // Deleting a folder also removes the dials it contains.
        SD.store.commit(function (s) { s.dials = s.dials.filter(function (x) { return x.id !== model.id && x.parentId !== model.id; }); });
        close();
      });
      save.addEventListener("click", function () {
        var isFolder = !model.parentId && fFolder.checked;
        model.type = isFolder ? "folder" : "link";
        model.color = fColorOn.checked ? fColor.value : "";
        model.title = fTitle.value.trim().slice(0, 60);
        if (isFolder) {
          model.url = "";
          if (!model.title) model.title = t("dial.folder");
        } else {
          model.url = normalizeUrl(fUrl.value);
          if (!model.title) model.title = prettyName(model.url);
          if (model.icon.type === "auto" || model.icon.type === "letter") model.icon.value = "";
        }
        SD.store.commit(function (s) {
          var existing = s.dials.filter(function (x) { return x.id === model.id; })[0];
          if (existing) Object.assign(existing, model);
          else s.dials.push(model);
        });
        close();
      });
      // Enter in the URL/title field saves the dial (like submitting a form).
      var saveOnEnter = function (e) { if (e.key === "Enter") { e.preventDefault(); save.click(); } };
      fUrl.addEventListener("keydown", saveOnEnter);
      fTitle.addEventListener("keydown", saveOnEnter);
    }

    // instId -> { sig, card }: reuse a card's live DOM (ticking clocks, focused notes) when unrelated state changed
    var widgetCache = {};
    var openWidgetSettings = null;   // instId of the widget whose inline settings panel is open (survives rebuilds)

    // ctx scoped to one instance: cfg()/commitCfg() touch only this instance's config, cache its net cache
    function instCtx(inst) {
      var c = Object.create(SD.ctx);
      var find = function (s) { return (s.widgetInstances || []).filter(function (w) { return w.instId === inst.instId; })[0]; };
      c.inst = inst;
      c.cfg = function () { var x = find(SD.store.get()); return x ? x.config : inst.config; };
      c.commitCfg = function (mut) { SD.store.commit(function (s) { var x = find(s); if (x) mut(x.config); }); };
      c.cache = {
        get: function () { var x = find(SD.store.get()); return x && x.cache; },
        set: function (v) { SD.store.commit(function (s) { var x = find(s); if (x) x.cache = v; }); }
      };
      c.deleteInstance = function () { SD.store.commit(function (s) { s.widgetInstances = (s.widgetInstances || []).filter(function (w) { return w.instId !== inst.instId; }); }); };
      return c;
    }

    // signature of a card's inputs; if unchanged, the card is reused as-is
    function widgetSig(inst) {
      var cfg = inst.config || {};
      var parts = [SD.i18n.current(), inst.instId];
      if (inst.type === "notes") {
        // Hash notes-level settings + item ids only (not text) so typing doesn't rebuild/lose focus.
        var base = cfgNoCache(cfg); delete base.items;
        parts.push(JSON.stringify(base), JSON.stringify((cfg.items || []).map(function (n) { return n.id; })));
      } else {
        parts.push(JSON.stringify(cfgNoCache(cfg)));
      }
      return parts.join("|");
    }
    function cfgNoCache(cfg) { var o = {}; Object.keys(cfg || {}).forEach(function (k) { if (k !== "cache") o[k] = cfg[k]; }); return o; }

    // saved order, skipping instances whose widget type is no longer registered
    function orderedWidgets(state) {
      return (state.widgetInstances || []).filter(function (inst) { return SD.registry.byId(inst.type); });
    }

    var ZONES = ["left", "right", "bottom"];
    // Zone a widget renders in: explicit inst.panel, else a sensible per-type default.
    function panelOf(inst) {
      if (inst.panel === "left" || inst.panel === "right" || inst.panel === "bottom") return inst.panel;
      if (inst.type === "bookmarks") return "left";
      if (inst.type === "feed") return "bottom";
      return "right";
    }

    // reuses unchanged cards so they don't flicker/rebuild on every commit; renders into 3 zones
    function renderWidgets(state) {
      var ordered = orderedWidgets(state);
      var wanted = {};
      ZONES.forEach(function (zone) {
        var panel = document.getElementById("widgets-" + zone);
        if (!panel) return;
        var nodes = ordered.filter(function (inst) { return panelOf(inst) === zone; }).map(function (inst) {
          wanted[inst.instId] = true;
          var sig = widgetSig(inst);
          var cached = widgetCache[inst.instId];
          if (cached && cached.sig === sig) return cached.card;
          var card = widgetCard(inst, state);
          // Hold the previous card's height on the rebuilt net card until its data lands, so the page
          // doesn't jump (the skeleton is shorter than the rendered content) on a settings change.
          var modK = SD.registry.byId(inst.type);
          if (modK && modK.kind === "net") {
            var prev = document.querySelector('.widget-card[data-wid="' + inst.instId + '"]');
            var ph = prev ? prev.getBoundingClientRect().height : 0;
            if (ph > 0) card.style.minHeight = ph + "px";
          }
          widgetCache[inst.instId] = { sig: sig, card: card };
          return card;
        });
        nodes.push(addWidgetControl(zone));
        var same = nodes.length === panel.childNodes.length && nodes.every(function (n, i) { return panel.childNodes[i] === n; });
        if (!same) panel.replaceChildren.apply(panel, nodes);
        attachWidgetDnd(panel, state, zone);
      });
      Object.keys(widgetCache).forEach(function (id) { if (!wanted[id]) delete widgetCache[id]; });
      // reopen an inline settings panel that a rebuild may have dropped
      if (openWidgetSettings && wanted[openWidgetSettings]) {
        var inst = ordered.filter(function (w) { return w.instId === openWidgetSettings; })[0];
        var card = document.querySelector('.widget-card[data-wid="' + openWidgetSettings + '"]');
        if (inst && card && !card.querySelector(".widget-settings")) renderCardSettings(inst, card);
      }
    }

    var widgetDragId = null;
    var dropSlot = null;     // highlighted placeholder shown where the dragged widget will land
    function slot() {
      if (!dropSlot) dropSlot = SD.dom.el("div", { "class": "widget-drop-slot" });
      return dropSlot;
    }
    function clearDnd() {
      if (dropSlot && dropSlot.parentNode) dropSlot.parentNode.removeChild(dropSlot);
      ["left", "right", "bottom"].forEach(function (z) {
        var p = document.getElementById("widgets-" + z);
        if (p) p.classList.remove("zone-drop");
      });
      widgetDragId = null;
    }

    // drag-reorder cards by the title bar; dropping on another zone moves the widget there.
    // A placeholder slot is inserted live so it's clear where the widget will be placed.
    function attachWidgetDnd(panel, state, zone) {
      panel.querySelectorAll(".widget-card").forEach(function (el) {
        if (el.getAttribute("data-dnd")) return;
        el.setAttribute("data-dnd", "1");
        var title = el.querySelector(".widget-title");
        if (title) {
          title.addEventListener("mousedown", function (e) {
            if (SD.store.get().settings.locked) return;
            if (e.target.closest("button,input,select,textarea")) return;
            el.setAttribute("draggable", "true");
          });
          title.addEventListener("mouseup", function () { el.removeAttribute("draggable"); });
        }
        el.addEventListener("dragstart", function (e) {
          // Ignore drags bubbling up from inner content (e.g. bookmark rows) — only a real
          // card drag sets draggable=true via the title bar. Otherwise we'd hijack the row's
          // dataTransfer (effectAllowed) and break the bookmark→grid copy.
          if (el.getAttribute("draggable") !== "true") return;
          widgetDragId = el.getAttribute("data-wid"); e.dataTransfer.effectAllowed = "move";
          setTimeout(function () { el.classList.add("dragging"); }, 0);
        });
        el.addEventListener("dragend", function () { el.removeAttribute("draggable"); el.classList.remove("dragging"); clearDnd(); });
        el.addEventListener("dragover", function (e) {
          if (!widgetDragId) return;
          e.preventDefault();
          // place the slot before or after this card depending on cursor position
          var r = el.getBoundingClientRect();
          var after = zone === "bottom" ? (e.clientX > r.left + r.width / 2) : (e.clientY > r.top + r.height / 2);
          panel.insertBefore(slot(), after ? el.nextSibling : el);
        });
      });
      if (!panel.getAttribute("data-dnd")) {
        panel.setAttribute("data-dnd", "1");
        panel.addEventListener("dragover", function (e) {
          if (!widgetDragId) return;
          e.preventDefault();
          panel.classList.add("zone-drop");
          if (!e.target.closest(".widget-card")) {       // empty area → slot before the add button
            var addBtn = panel.querySelector(".widget-add");
            panel.insertBefore(slot(), addBtn || null);
          }
        });
        panel.addEventListener("dragleave", function (e) {
          if (e.target === panel && !panel.contains(e.relatedTarget)) panel.classList.remove("zone-drop");
        });
        panel.addEventListener("drop", function (e) {
          if (!widgetDragId) return;
          e.preventDefault();
          dropDraggedAtSlot(panel, zone);
          clearDnd();
        });
      }
    }

    // Moves the dragged widget to wherever the placeholder currently sits.
    function dropDraggedAtSlot(panel, zone) {
      var id = widgetDragId;
      var cards = Array.prototype.slice.call(panel.children).filter(function (n) { return n.classList && (n.classList.contains("widget-card") || n === dropSlot); });
      var idx = dropSlot ? cards.indexOf(dropSlot) : -1;
      var beforeCard = null;
      for (var i = idx + 1; i < cards.length; i++) { if (cards[i] !== dropSlot && cards[i].classList.contains("widget-card")) { beforeCard = cards[i]; break; } }
      var beforeId = beforeCard ? beforeCard.getAttribute("data-wid") : null;
      SD.store.commit(function (s) {
        var arr = s.widgetInstances || [];
        var from = arr.findIndex(function (w) { return w.instId === id; });
        if (from < 0) return;
        var moved = arr.splice(from, 1)[0];
        moved.panel = zone;
        var to = beforeId ? arr.findIndex(function (w) { return w.instId === beforeId; }) : arr.length;
        if (to < 0) to = arr.length;
        arr.splice(to, 0, moved);
      });
    }

    function setWidgetPanel(id, zone) {
      SD.store.commit(function (s) {
        var w = (s.widgetInstances || []).filter(function (x) { return x.instId === id; })[0];
        if (w) w.panel = zone;
      });
    }

    // local widgets mount synchronously; net widgets show a skeleton then load+render
    function widgetCard(inst, state) {
      var mod = SD.registry.byId(inst.type);
      var card = document.createElement("div");
      card.className = "widget-card w-" + inst.type;
      card.setAttribute("data-wid", inst.instId);
      var h = document.createElement("div"); h.className = "widget-title";
      var handle = SD.dom.el("span", { "class": "widget-drag", title: SD.i18n.t("widget.drag"), text: "⠿" });
      var label = SD.dom.el("span", { "class": "widget-name", text: SD.i18n.t(mod.titleKey) });
      var gear = SD.dom.el("button", { "class": "widget-gear", title: SD.i18n.t("settings.title"), text: "⚙" });
      gear.addEventListener("click", function () { toggleCardSettings(inst, card); });
      h.appendChild(handle); h.appendChild(label); h.appendChild(gear);
      var body = document.createElement("div"); body.className = "widget-body";
      card.appendChild(h); card.appendChild(body);
      try {
        if (mod.kind === "local") {
          mod.mount(body, instCtx(inst));
          // Real DOM already reserves exact space per unit. Overlay a shimmer during cold load, then drop it.
          // mod.skeleton may be a selector (e.g. ".clock-face") to shimmer each unit separately (per-style
          // shape/size), or true for the whole widget body.
          if (mod.skeleton && appBooting) {
            var units = typeof mod.skeleton === "string" ? Array.prototype.slice.call(body.querySelectorAll(mod.skeleton)) : [];
            if (!units.length) units = [body];
            units.forEach(function (u) { u.classList.add("widget-loading"); });
            var clearLoading = function () { units.forEach(function (u) { u.classList.remove("widget-loading"); }); };
            if (document.fonts && document.fonts.status !== "loaded") {
              var to = setTimeout(clearLoading, 1200);
              document.fonts.ready.then(function () { clearTimeout(to); setTimeout(clearLoading, 200); });
            } else {
              setTimeout(clearLoading, 500);
            }
          }
        } else {
          var skel = function () { SD.dom.clear(body); body.appendChild(SD.dom.el("div", { "class": "skeleton w-skel w-skel-" + inst.type, "aria-hidden": "true" })); };
          var retryNet = function () { skel(); SD.netWidget.load(SD.store.get(), inst, mod, renderNet).then(renderNet); };
          var renderNet = function (res) {
            try {
              if (res && res.error) { showErr(body, retryNet); return; }
              mod.render(body, res, instCtx(inst)); widgetUpdated(body, res); card.style.minHeight = "";
            } catch (e) { console.warn("[speed-dial] render " + inst.type + ":", e); showErr(body, retryNet); }
          };
          skel();
          SD.netWidget.load(state, inst, mod, renderNet).then(renderNet);
        }
      } catch (e) {
        console.warn("[speed-dial] widget " + inst.type + ":", e);
        showErr(body);
      }
      return card;
    }

    var addBtns = {};
    function addWidgetControl(zone) {
      if (!addBtns[zone]) {
        var b = SD.dom.el("button", { "class": "widget-add" });
        b.addEventListener("click", function () { openAddMenu(zone); });
        addBtns[zone] = b;
      }
      addBtns[zone].textContent = "+ " + SD.i18n.t("widget.add");
      return addBtns[zone];
    }
    function openAddMenu(zone) {
      var menu = SD.dom.el("div", { "class": "add-menu" });
      var close = SD.ui.openModal(menu);
      menu.appendChild(SD.dom.el("h3", { text: SD.i18n.t("widget.add") }));
      SD.registry.all().forEach(function (mod) {
        var b = SD.dom.el("button", { "class": "add-menu-item", text: SD.i18n.t(mod.titleKey) });
        b.addEventListener("click", function () { close(); addInstance(mod, zone); });
        menu.appendChild(b);
      });
    }
    async function addInstance(mod, zone) {
      var inst = SD.schema.newInstance(mod.id);
      if (zone) inst.panel = zone;
      if (mod.kind === "net") {
        var ok = await SD.netWidget.ensureForConfig(mod, inst.config);
        if (!ok) return;
      }
      SD.store.commit(function (s) { (s.widgetInstances = s.widgetInstances || []).push(inst); });
    }

    function toggleCardSettings(inst, card) {
      var mod = SD.registry.byId(inst.type);
      if (mod && mod.settingsModal) {
        var box = buildWidgetSettings(inst, instCtx(inst), function () { close(); });
        box.classList.add("widget-settings-modal");
        var close = SD.ui.openModal(box);
        return;
      }
      if (openWidgetSettings === inst.instId) { openWidgetSettings = null; removeCardPanel(card); return; }
      openWidgetSettings = inst.instId;
      renderCardSettings(inst, card);
    }
    function removeCardPanel(card) { var p = card.querySelector(".widget-settings"); if (p) p.remove(); }
    function buildWidgetSettings(inst, ctx, onClose) {
      var mod = SD.registry.byId(inst.type);
      var panel = SD.dom.el("div", { "class": "widget-settings" });
      panel.appendChild(SD.dom.el("div", { "class": "widget-settings-head", text: "⚙ " + SD.i18n.t("settings.title") + " · " + SD.i18n.t(mod.titleKey) }));
      var zoneSel = SD.controls.sel([
        ["left", SD.i18n.t("settings.placeLeft")], ["right", SD.i18n.t("settings.placeRight")], ["bottom", SD.i18n.t("settings.placeBottom")]
      ], panelOf(inst), function (v) { setWidgetPanel(inst.instId, v); });
      panel.appendChild(SD.controls.row(SD.i18n.t("settings.widgetZone"), zoneSel));
      if (typeof mod.renderSettings === "function") SD.safe("settings:" + inst.type, function () { mod.renderSettings(panel, ctx); });
      var del = SD.dom.iconBtn("trash", SD.i18n.t("widget.remove"), "btn danger widget-del");
      del.addEventListener("click", function () {
        if (mod.onDelete) SD.safe("del:" + inst.type, function () { mod.onDelete(inst, ctx); });
        openWidgetSettings = null;
        ctx.deleteInstance();
        onClose();
      });
      var closeBtn = SD.dom.el("button", { "class": "btn ghost widget-settings-close", text: "✕ " + SD.i18n.t("common.close") });
      closeBtn.addEventListener("click", onClose);
      panel.appendChild(SD.dom.el("div", { "class": "widget-settings-actions" }, [del, closeBtn]));
      return panel;
    }
    function renderCardSettings(inst, card) {
      removeCardPanel(card);
      card.appendChild(buildWidgetSettings(inst, instCtx(inst), function () { openWidgetSettings = null; removeCardPanel(card); }));
    }

    // Error state (designer §5): icon + message + Retry, inside the card (not full-screen).
    function showErr(body, onRetry) {
      SD.dom.clear(body);
      var box = SD.dom.el("div", { "class": "w-err" }, [SD.dom.el("span", { text: "⚠ " + SD.i18n.t("status.error") })]);
      if (onRetry) { var b = SD.dom.el("button", { "class": "btn ghost w-retry", text: SD.i18n.t("status.retry") }); b.addEventListener("click", onRetry); box.appendChild(b); }
      body.appendChild(box);
    }
    function fmtClock(ts) { try { return new Date(ts).toLocaleTimeString(SD.i18n.current() || undefined, { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }
    function widgetUpdated(body, res) {
      if (!res || !res.ts) return;
      body.appendChild(SD.dom.el("div", { "class": "widget-updated", text: SD.i18n.t("widget.updated") + " " + fmtClock(res.ts) }));
    }

    function byOrder(a, b) { return (a.order || 0) - (b.order || 0); }

    function hostname(url) { try { return new URL(normalizeUrl(url)).hostname.replace(/^www\./, ""); } catch (e) { return ""; } }

    // adds https:// to a bare address so it opens and resolves a favicon; leaves known schemes alone
    function normalizeUrl(u) {
      u = (u || "").trim();
      if (!u) return "";
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) return u;
      if (/^(mailto:|tel:|chrome:|edge:|about:|file:|view-source:|moz-extension:)/i.test(u)) return u;
      return "https://" + u;
    }

    // auto-title from the domain (e.g. "https://github.com" -> "Github") when title is blank
    function prettyName(url) {
      var h = hostname(url);
      if (!h) return "";
      var parts = h.split(".");
      var name = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
      return (name.charAt(0).toUpperCase() + name.slice(1)).slice(0, 40);
    }

    return { renderAll: renderAll, openDialEditor: openDialEditor, addDialFromBookmark: addDialFromBookmark };
  })();
})();
