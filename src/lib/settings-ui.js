// Settings modal: layout, typography, animation, theme, background, language, sync, widgets, data.
(function () {
  "use strict";
  SD.settingsUi = (function () {
    var lastClose = null;

    function buildPanel() {
      var state = SD.store.get();
      var node = document.createElement("div");
      node.className = "settings";
      node.appendChild(h3(SD.i18n.t("settings.title")));
      node.appendChild(searchBox(node));
      node.appendChild(sectionLanguage(state));
      node.appendChild(sectionLayout(state));
      node.appendChild(sectionTypography(state));
      node.appendChild(sectionAnimation(state));
      node.appendChild(sectionSearch(state));
      node.appendChild(sectionTheme(state));
      node.appendChild(sectionBackground(state));
      node.appendChild(sectionSync(state));
      node.appendChild(sectionWidgets(state));
      node.appendChild(sectionData(state));
      return node;
    }

    function open() {
      var node = buildPanel();
      var footer = document.createElement("div");
      footer.className = "row end sticky-footer";
      var closeBtn = btn("primary", SD.i18n.t("common.close"));
      footer.appendChild(closeBtn);
      node.appendChild(footer);
      var close = SD.ui.openModal(node);
      lastClose = close;
      closeBtn.addEventListener("click", close);
    }

    // Live filter: hides setting rows whose label doesn't match, and any section left with no visible rows.
    function searchBox(panel) {
      var inp = document.createElement("input");
      inp.type = "search"; inp.className = "settings-search";
      inp.placeholder = SD.i18n.t("settings.search");
      inp.addEventListener("input", function () {
        var q = inp.value.trim().toLowerCase();
        panel.querySelectorAll(".set-section").forEach(function (sec) {
          var any = false;
          sec.querySelectorAll(".set-row").forEach(function (r) {
            var hit = !q || (r.textContent || "").toLowerCase().indexOf(q) >= 0;
            r.style.display = hit ? "" : "none";
            if (hit) any = true;
          });
          sec.style.display = (any || !q) ? "" : "none";
        });
      });
      return inp;
    }

    /* ---------- sections ---------- */

    function sectionLayout(s) {
      var sec = section("settings.section.layout");
      sec.appendChild(row("settings.density", sel([
        ["comfortable", SD.i18n.t("density.comfortable")], ["compact", SD.i18n.t("density.compact")]
      ], s.settings.density || "comfortable", function (v) { commit(function (x) { x.settings.density = v; }); })));
      sec.appendChild(row("settings.tabsAlign", sel([
        ["center", SD.i18n.t("align.center")], ["left", SD.i18n.t("align.left")]
      ], s.settings.tabsAlign || "center", function (v) { commit(function (x) { x.settings.tabsAlign = v; }); })));
      sec.appendChild(row("settings.tabsWrap", check(!!s.settings.tabsWrap, function (v) { commit(function (x) { x.settings.tabsWrap = v; }); })));
      // 0 = Auto (intrinsic grid fits columns to width); >0 pins a fixed count (advanced override).
      sec.appendChild(row("settings.columns", num(s.settings.grid.columns, 0, 12, 1, function (v) { commit(function (x) { x.settings.grid.columns = Math.max(0, v || 0); }); })));
      sec.appendChild(row("settings.rows", num(s.settings.grid.rows, 1, 12, 1, function (v) { commit(function (x) { x.settings.grid.rows = v; }); })));
      sec.appendChild(row("settings.gap", num(s.settings.grid.gap, 0, 64, 1, function (v) { commit(function (x) { x.settings.grid.gap = v; }); })));
      sec.appendChild(row("settings.tileSize", pair(
        num(s.settings.tile.width, 60, 240, 2, function (v) { commit(function (x) { x.settings.tile.width = v; }); }),
        num(s.settings.tile.height, 60, 240, 2, function (v) { commit(function (x) { x.settings.tile.height = v; }); })
      )));
      sec.appendChild(row("settings.radius", num(s.settings.tile.radius, 0, 50, 1, function (v) { commit(function (x) { x.settings.tile.radius = v; }); })));
      sec.appendChild(row("settings.lockDials", check(s.settings.lockDials, function (v) { commit(function (x) { x.settings.lockDials = v; }); })));
      sec.appendChild(row("settings.showDials", check(s.settings.showDials !== false, function (v) { commit(function (x) { x.settings.showDials = v; }); })));
      if (SD.perfMemApi && SD.perfMemApi()) sec.appendChild(row("settings.perfOverlay", check(!!s.settings.perfOverlay, function (v) { commit(function (x) { x.settings.perfOverlay = v; }); })));
      var resetW = btn("ghost", SD.i18n.t("settings.reset"));
      resetW.addEventListener("click", function () { commit(function (x) { x.settings.widgetColWidth = 300; }); });
      sec.appendChild(row("settings.widgetColWidth", pair(
        num(s.settings.widgetColWidth || 300, 300, 700, 10, function (v) { commit(function (x) { x.settings.widgetColWidth = Math.max(300, v || 300); }); }),
        resetW
      )));
      return sec;
    }

    function sectionTypography(s) {
      var sec = section("settings.section.typography");
      function fontOptions() {
        var base = [["", SD.i18n.t("theme.auto")], ["system-ui, sans-serif", "System"], ["ui-monospace, monospace", "Mono"], ["Georgia, serif", "Serif"], ["Arial, sans-serif", "Arial"], ["Roboto, system-ui, sans-serif", "Roboto"], ["Ubuntu, system-ui, sans-serif", "Ubuntu"]];
        (SD.store.get().fontLibrary || []).forEach(function (f) { base.push([f.name, f.name]); });
        return base;
      }
      // Non-bundled web fonts (Roboto/Ubuntu) are downloaded once with consent before applying.
      function pickFont(v, set) {
        var fam = (v || "").split(",")[0].trim();
        var have = (SD.store.get().fontLibrary || []).some(function (f) { return f.name === fam; });
        if ((fam === "Roboto" || fam === "Ubuntu") && !have) {
          SD.fonts.downloadWebFont(fam).then(function (ok) { if (ok) commit(set); });
        } else { commit(set); }
      }
      sec.appendChild(row("settings.fontUi", sel(fontOptions(), s.settings.font.family, function (v) { pickFont(v, function (x) { x.settings.font.family = v || "system-ui, sans-serif"; }); })));
      sec.appendChild(row("settings.fontClock", sel(fontOptions(), s.settings.font.clock, function (v) { pickFont(v, function (x) { x.settings.font.clock = v; }); })));
      sec.appendChild(row("settings.fontNotes", sel(fontOptions(), s.settings.font.notes, function (v) { pickFont(v, function (x) { x.settings.font.notes = v; }); })));
      sec.appendChild(row("settings.fontSize", num(s.settings.font.size, 9, 24, 1, function (v) { commit(function (x) { x.settings.font.size = v; }); })));
      sec.appendChild(row("settings.showLabels", check(s.settings.showLabels, function (v) { commit(function (x) { x.settings.showLabels = v; }); })));
      // uploaded font is registered as @font-face, then appears in the lists above
      var file = document.createElement("input"); file.type = "file"; file.accept = ".ttf,.otf,.woff,.woff2,font/*"; file.style.display = "none";
      file.addEventListener("change", async function () {
        if (!file.files[0]) return;
        var f = await SD.fonts.importFont(file.files[0]);
        commit(function (x) { (x.fontLibrary = x.fontLibrary || []).push(f); });
        SD.fonts.apply(SD.store.get());
        SD.ui.toast("✓");
      });
      var up = btn("ghost", SD.i18n.t("settings.fontUpload"));
      up.addEventListener("click", function () { file.click(); });
      var rowEl = document.createElement("div"); rowEl.className = "row"; rowEl.appendChild(up); rowEl.appendChild(file);
      sec.appendChild(rowEl);
      return sec;
    }

    function sectionAnimation(s) {
      var sec = section("settings.section.animation");
      sec.appendChild(row("settings.animHover", sel([
        ["none", SD.i18n.t("common.none")], ["scale", SD.i18n.t("anim.scale")], ["lift", SD.i18n.t("anim.lift")], ["glow", SD.i18n.t("anim.glow")]
      ], s.settings.animation.hover, function (v) { commit(function (x) { x.settings.animation.hover = v; }); })));
      sec.appendChild(row("settings.animSpeed", num(s.settings.animation.speedMs, 0, 1000, 10, function (v) { commit(function (x) { x.settings.animation.speedMs = v; }); })));
      sec.appendChild(row("settings.animGroupSwitch", sel([
        ["none", SD.i18n.t("common.none")], ["fade", SD.i18n.t("anim.fade")], ["slide", SD.i18n.t("anim.slide")]
      ], s.settings.animation.groupSwitch, function (v) { commit(function (x) { x.settings.animation.groupSwitch = v; }); })));
      sec.appendChild(row("settings.keyboardNav", check(s.settings.animation.keyboardNav, function (v) { commit(function (x) { x.settings.animation.keyboardNav = v; }); })));
      return sec;
    }

    function sectionSearch(s) {
      var sec = section("settings.section.search");
      sec.appendChild(row("search.enable", check(s.settings.search.enabled, function (v) { commit(function (x) { x.settings.search.enabled = v; }); })));
      return sec;
    }

    function sectionTheme(s) {
      var sec = section("settings.section.theme");
      sec.appendChild(row("settings.themeMode", sel([
        ["auto", SD.i18n.t("theme.auto")], ["light", SD.i18n.t("theme.light")], ["dark", SD.i18n.t("theme.dark")], ["custom", SD.i18n.t("theme.custom")]
      ], s.settings.theme.mode || "auto", function (v) { commit(function (x) { x.settings.theme.mode = v; }); })));

      // Separate preferred dark + light scheme; the mode (auto/light/dark) above selects which one applies.
      var darkOpts = s.schemes.filter(function (sc) { return sc.dark; }).map(function (sc) { return [sc.id, sc.name]; });
      var lightOpts = s.schemes.filter(function (sc) { return !sc.dark; }).map(function (sc) { return [sc.id, sc.name]; });
      sec.appendChild(row("settings.darkScheme", sel(darkOpts, s.settings.theme.darkSchemeId || "nord", function (v) { commit(function (x) { x.settings.theme.darkSchemeId = v; }); })));
      sec.appendChild(row("settings.lightScheme", sel(lightOpts, s.settings.theme.lightSchemeId || "paper", function (v) { commit(function (x) { x.settings.theme.lightSchemeId = v; }); })));

      var roles = ["bg", "surface", "text", "accent", "border"];
      var cur = SD.themes.find(s, s.settings.theme.activeSchemeId).colors;
      var editor = document.createElement("div"); editor.className = "scheme-editor";
      var pickers = {};
      roles.forEach(function (rk) {
        var c = document.createElement("input"); c.type = "color"; c.value = cur[rk] && cur[rk][0] === "#" ? cur[rk].slice(0, 7) : "#888888";
        c.title = rk; pickers[rk] = c; editor.appendChild(c);
      });
      var saveScheme = btn("ghost", SD.i18n.t("settings.customScheme"));
      saveScheme.addEventListener("click", function () {
        var id = SD.schema.uid();
        var colors = {}; roles.forEach(function (rk) { colors[rk] = pickers[rk].value; });
        commit(function (x) { x.schemes.push({ id: id, name: "Custom", builtin: false, colors: colors }); x.settings.theme.activeSchemeId = id; x.settings.theme.mode = "custom"; });
        SD.ui.toast("✓");
      });
      editor.appendChild(saveScheme);
      sec.appendChild(editor);
      return sec;
    }

    function sectionBackground(s) {
      var sec = section("settings.section.background");
      var bg = s.settings.background;
      sec.appendChild(row("settings.bgType", sel([
        ["gradient", SD.i18n.t("settings.bgGradient")], ["color", SD.i18n.t("settings.bgColor")],
        ["image", SD.i18n.t("settings.bgImage")], ["autoImage", SD.i18n.t("settings.bgAutoImage")]
      ], bg.type, function (v) {
        if (v === "autoImage") return enableAutoImage();
        commit(function (x) { x.settings.background.type = v; });
      })));

      sec.appendChild(row("settings.gradientPreset", sel([
        ["theme", SD.i18n.t("bg.theme")], ["aurora", SD.i18n.t("bg.aurora")], ["flame", SD.i18n.t("bg.flame")], ["tide", SD.i18n.t("bg.tide")],
        ["conic", SD.i18n.t("bg.conic")], ["conic2", SD.i18n.t("bg.conic2")], ["meadow", SD.i18n.t("bg.meadow")], ["autumn", SD.i18n.t("bg.autumn")], ["vista", SD.i18n.t("bg.vista")], ["aquarium", SD.i18n.t("bg.aquarium")],
        ["custom", SD.i18n.t("bg.custom")]
      ], bg.gradient.preset, function (v) { commit(function (x) { x.settings.background.gradient.preset = v; }); })));
      sec.appendChild(row("settings.gradientAnimated", check(bg.gradient.animated, function (v) { commit(function (x) { x.settings.background.gradient.animated = v; }); })));
      sec.appendChild(row("settings.gradientSpeed", num(bg.gradient.animSpeedMs, 1000, 60000, 500, function (v) { commit(function (x) { x.settings.background.gradient.animSpeedMs = v; }); })));
      sec.appendChild(row("settings.gradientAngle", num(bg.gradient.angle, 0, 360, 5, function (v) { commit(function (x) { x.settings.background.gradient.angle = v; }); })));

      sec.appendChild(row("settings.bgColor", color(bg.color, function (v) { commit(function (x) { x.settings.background.color = v; x.settings.background.type = "color"; }); })));

      var file = document.createElement("input"); file.type = "file"; file.accept = "image/*";
      file.addEventListener("change", async function () {
        if (!file.files[0]) return;
        var entry = await SD.icons.importFile(file.files[0]); // reuse downscale for size sanity
        commit(function (x) { x.settings.background.image = { dataUrl: entry.dataUrl }; x.settings.background.type = "image"; });
      });
      sec.appendChild(row("settings.bgImage", file));

      if (bg.type === "autoImage") {
        sec.appendChild(row("settings.bgAutoProvider", sel([
          ["picsum", SD.i18n.t("bgauto.picsum")], ["loremflickr", SD.i18n.t("bgauto.loremflickr")],
          ["picsumGrayscale", SD.i18n.t("bgauto.picsumGray")], ["custom", SD.i18n.t("provider.custom")]
        ], bg.autoImage.provider, function (v) { switchAutoProvider(v); })));
        if (bg.autoImage.provider === "loremflickr") {
          sec.appendChild(row("settings.bgAutoQuery", text(bg.autoImage.query || "", function (v) {
            commit(function (x) { x.settings.background.autoImage.query = v; x.settings.background.autoImage.cache = null; });
          })));
        }
        sec.appendChild(row("settings.bgAutoInterval", num(bg.autoImage.intervalMin, 1, 1440, 1, function (v) {
          commit(function (x) { x.settings.background.autoImage.intervalMin = v; });
        })));
      }

      sec.appendChild(row("settings.blur", num(bg.blur, 0, 30, 1, function (v) { commit(function (x) { x.settings.background.blur = v; }); })));
      sec.appendChild(row("settings.dim", num(bg.dim, 0, 90, 5, function (v) { commit(function (x) { x.settings.background.dim = v; }); })));
      return sec;
    }

    // auto-image opt-in: privacy consent + host permission for the provider before enabling
    async function enableAutoImage() {
      var ai = SD.store.get().settings.background.autoImage;
      var origin = SD.backgrounds.autoImageOrigin(ai);
      var ok = await SD.ui.privacyConsent(origin, SD.i18n.t("privacy.dataImage"));
      if (!ok) return;
      var granted = await SD.netWidget.ensureHostPermission(origin);
      if (!granted) return;
      commit(function (x) { x.settings.background.type = "autoImage"; x.settings.background.autoImage.enabled = true; x.consents["bg-auto"] = true; });
    }

    // requests the new origin's host permission before switching provider
    async function switchAutoProvider(v) {
      var ai = JSON.parse(JSON.stringify(SD.store.get().settings.background.autoImage));
      ai.provider = v;
      var origin = SD.backgrounds.autoImageOrigin(ai);
      if (origin) {
        var granted = await SD.netWidget.ensureHostPermission(origin);
        if (!granted) return;
      }
      commit(function (x) { x.settings.background.autoImage.provider = v; x.settings.background.autoImage.cache = null; });
    }

    var LANG_OPTS = [["", "Auto"], ["en", "English"], ["ru", "Russian"], ["cs", "Czech"], ["fr", "French"], ["de", "German"]];
    function applyLocale(v) {
      commit(function (x) { x.settings.locale = v || null; });
      SD.i18n.init(v || null).then(function () {
        document.documentElement.lang = SD.i18n.current();
        SD.i18n.applyDom(document);
        SD.render.renderAll(SD.store.get());
        if (lastClose) { lastClose(); }
        open();
      });
    }
    function applyRegion(code) {
      commit(function (x) { x.settings.region = code || null; });
      SD.regions.setCurrent(SD.regions.resolve(code));
      SD.render.renderAll(SD.store.get());
      if (lastClose) { lastClose(); }
      open();
    }
    function sectionLanguage(s) {
      var sec = document.createElement("section"); sec.className = "set-section";
      var h = document.createElement("h4"); h.textContent = SD.i18n.t("settings.section.language"); sec.appendChild(h);
      sec.appendChild(row("onboard.language", sel(LANG_OPTS, s.settings.locale || "", applyLocale)));
      sec.appendChild(row("onboard.country", SD.regions.pickerButton(s.settings.region || "", applyRegion)));
      return sec;
    }

    function sectionSync(s) {
      var sec = section("settings.section.sync");
      if (SD.sync.isSafari()) {
        var note = document.createElement("div"); note.className = "note"; note.textContent = SD.i18n.t("sync.unavailableSafari");
        sec.appendChild(note);
        return sec;
      }
      sec.appendChild(row("settings.syncEnable", check(s.syncEnabled, function (v) {
        commit(function (x) { x.syncEnabled = v; });
        if (v) SD.storage.pushSync(SD.store.get()).catch(function (e) { if (e.code === "quota") SD.ui.toast(SD.i18n.t("sync.quotaExceeded")); });
      })));
      return sec;
    }

    function sectionWidgets() {
      var sec = section("settings.section.widgets");
      var note = document.createElement("div"); note.className = "note"; note.textContent = SD.i18n.t("settings.widgetsHint");
      sec.appendChild(note);
      return sec;
    }

    function sectionData(s) {
      var sec = section("settings.section.data");
      var incImages = check(true, function () {});
      var incSecrets = check(false, function () {});
      sec.appendChild(row("settings.bgImage", incImages));
      sec.appendChild(row("settings.exportSecrets", incSecrets));
      var exp = btn("ghost", SD.i18n.t("settings.export"));
      exp.addEventListener("click", function () {
        SD.backup.exportFile(SD.store.get(), { includeImages: incImages.checked, includeSecrets: incSecrets.checked });
      });
      var file = document.createElement("input"); file.type = "file"; file.accept = "application/json"; file.style.display = "none";
      file.addEventListener("change", async function () {
        if (!file.files[0]) return;
        try {
          var data = await SD.backup.importFile(file.files[0]);
          await SD.store.replace(data);
          SD.reminders.reconcile(SD.store.get());
          location.reload();
        } catch (e) { SD.ui.toast(SD.i18n.t("status.error")); }
      });
      var imp = btn("ghost", SD.i18n.t("settings.import"));
      imp.addEventListener("click", function () { file.click(); });
      var rowEl = document.createElement("div"); rowEl.className = "row";
      rowEl.appendChild(exp); rowEl.appendChild(imp); rowEl.appendChild(file);
      sec.appendChild(rowEl);
      return sec;
    }

    /* ---------- control helpers ---------- */

    function commit(m) { SD.store.commit(m); }
    function h3(t) { var e = document.createElement("h3"); e.textContent = t; return e; }
    function section(titleKey) {
      var s = document.createElement("section"); s.className = "set-section";
      var t = document.createElement("h4"); t.textContent = SD.i18n.t(titleKey); s.appendChild(t);
      return s;
    }
    function row(labelKey, control) {
      var r = document.createElement("label"); r.className = "set-row";
      var span = document.createElement("span"); span.textContent = SD.i18n.t(labelKey);
      r.appendChild(span); r.appendChild(control); return r;
    }
    function pair(a, b) { var d = document.createElement("div"); d.className = "pair"; d.appendChild(a); d.appendChild(b); return d; }
    function num(value, min, max, step, onInput) {
      var i = document.createElement("input"); i.type = "number"; i.value = value; i.min = min; i.max = max; i.step = step;
      i.addEventListener("change", function () { onInput(parseFloat(i.value)); });
      return i;
    }
    function color(value, onInput) {
      var i = document.createElement("input"); i.type = "color"; i.value = (value && value[0] === "#") ? value.slice(0, 7) : "#0f172a";
      i.addEventListener("change", function () { onInput(i.value); });
      return i;
    }
    function text(value, onInput) {
      var i = document.createElement("input"); i.type = "text"; i.value = value || "";
      i.addEventListener("change", function () { onInput(i.value.trim()); });
      return i;
    }
    function check(value, onChange) {
      var i = document.createElement("input"); i.type = "checkbox"; i.checked = !!value;
      i.addEventListener("change", function () { onChange(i.checked); });
      return i;
    }
    function sel(options, value, onChange) {
      var s = document.createElement("select");
      options.forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; s.appendChild(op); });
      s.value = value;
      s.addEventListener("change", function () { onChange(s.value); });
      return s;
    }
    function btn(kind, label) { var b = document.createElement("button"); b.className = "btn " + kind; b.textContent = label; return b; }

    return { open: open, buildPanel: buildPanel };
  })();
})();
