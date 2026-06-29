// New-tab bootstrap: loads state, sets locale, renders, wires UI, applies theme/animation/background.
(function () {
  "use strict";
  var lastGroup = null;

  function applyVisuals(state) {
    SD.fonts.apply(state);
    SD.themes.apply(state);
    SD.animations.apply(state);
    SD.backgrounds.apply(state);
  }

  function onState(state) {
    SD.safe("applyVisuals", function () { applyVisuals(state); });
    SD.safe("renderAll", function () { SD.render.renderAll(state); });
    updateSyncStatus();
    updateThemeToggle(state);
    updateLockToggle(state);
    updateTabsModeToggle(state);
    document.body.classList.toggle("is-locked", !!state.settings.locked);
    document.documentElement.style.setProperty("--widget-col-w", (state.settings.widgetColWidth || 300) + "px");
    document.body.classList.toggle("no-dials", state.settings.showDials === false);
    document.documentElement.setAttribute("data-density", state.settings.density === "compact" ? "compact" : "comfortable");
    applyPerfOverlay(!!state.settings.perfOverlay);
    if (lastGroup !== null && lastGroup !== state.settings.activeGroupId) {
      var grid = document.getElementById("grid");
      grid.classList.remove("anim-in");
      void grid.offsetWidth; // reflow to restart animation
      grid.classList.add("anim-in");
    }
    lastGroup = state.settings.activeGroupId;
  }

  // Fixed top-left memory readout (FPS-counter style). Both performance.memory and
  // measureUserAgentSpecificMemory() are Chromium-only; Firefox/Safari expose no in-page memory API, so
  // there the readout shows "n/a" (a native-messaging helper would be required, out of scope).
  // Per-page JS-memory readout is Chromium-only; expose the capability so the settings toggle can hide
  // itself where no API exists (Firefox/Safari).
  SD.perfMemApi = function () { var p = window.performance; return !!(p && (p.memory || typeof p.measureUserAgentSpecificMemory === "function")); };
  var perfTimer = null;
  function fmtBytes(b) { return b < 1048576 ? (b / 1024).toFixed(2) + " KB" : (b / 1048576).toFixed(2) + " MB"; }
  function readMem(cb) {
    var p = window.performance;
    if (p && p.memory && p.memory.usedJSHeapSize != null) { cb(p.memory.usedJSHeapSize); return; }
    if (p && typeof p.measureUserAgentSpecificMemory === "function") {
      p.measureUserAgentSpecificMemory().then(function (r) { cb(r.bytes); }, function () { cb(null); });
      return;
    }
    cb(null);
  }
  function applyPerfOverlay(on) {
    on = on && SD.perfMemApi();   // no memory API (Firefox/Safari) → never show; nothing to report
    var el = document.getElementById("perf-overlay");
    if (!on) {
      if (perfTimer) { clearInterval(perfTimer); perfTimer = null; }
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement("div");
      el.id = "perf-overlay";
      document.body.appendChild(el);
    }
    var tick = function () { readMem(function (b) { el.textContent = b == null ? "n/a" : fmtBytes(b); }); };
    tick();
    if (!perfTimer) perfTimer = setInterval(tick, 1000);
  }

  function updateSyncStatus() {
    var el = document.getElementById("sync-status");
    var state = SD.store.get();
    if (!state.syncEnabled || SD.sync.isSafari()) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = SD.sync.online() ? SD.i18n.t("sync.online") : SD.i18n.t("sync.offline");
    el.className = "sync-status " + (SD.sync.online() ? "online" : "offline");
  }

  function updateThemeToggle(state) {
    var el = document.getElementById("theme-toggle");
    if (!el) return;
    var mode = state.settings.theme.mode || "auto";
    SD.dom.clear(el);
    el.appendChild(SD.dom.svg(mode === "light" ? "sun" : mode === "dark" ? "moon" : "monitor", 20));
    el.title = SD.i18n.t("settings.themeMode") + ": " + SD.i18n.t("theme." + mode);
  }

  // Quick toggle: single-line dock tabs ↔ multi-row tabs. Mirrors the tabsWrap setting.
  function updateTabsModeToggle(state) {
    var el = document.getElementById("tabsmode-toggle");
    if (!el) return;
    var multi = !!state.settings.tabsWrap;
    SD.dom.clear(el);
    el.appendChild(SD.dom.svg(multi ? "rows" : "oneline", 20));
    el.classList.toggle("active", !multi);
    el.title = SD.i18n.t(multi ? "tabsmode.multi" : "tabsmode.single");
  }

  // Padlock: unlocked = open icon + active (accent) look + editing allowed; locked = closed icon, plain grey.
  function updateLockToggle(state) {
    var el = document.getElementById("lock-toggle");
    if (!el) return;
    var locked = !!state.settings.locked;
    SD.dom.clear(el);
    el.appendChild(SD.dom.svg(locked ? "lock" : "unlock", 20));
    el.classList.toggle("active", !locked);
    el.title = SD.i18n.t(locked ? "lock.unlock" : "lock.lock");
  }

  var LANG_OPTS = [["", "Auto"], ["en", "English"], ["ru", "Russian"], ["cs", "Czech"], ["fr", "French"], ["de", "German"]];

  // First-run welcome: agreement (accepted by use) + language + country + new-tab toggle. Shown once.
  function showOnboarding(state, draft) {
    draft = draft || { locale: state.settings.locale || "", region: state.settings.region || "", newtab: state.settings.newtabEnabled !== false };
    var t = SD.i18n.t, D = SD.dom, root = document.getElementById("onboarding");
    if (!root) return;
    D.clear(root); root.hidden = false;
    var card = D.el("div", { "class": "onb-card" });

    var close = D.el("button", { "class": "onb-x", title: t("common.close"), text: "✕" });
    card.appendChild(close);
    card.appendChild(D.el("h2", { "class": "onb-title", text: t("onboard.title") }));
    card.appendChild(D.el("p", { "class": "onb-terms", text: t("onboard.terms") }));

    var langSel = document.createElement("select");
    LANG_OPTS.forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; langSel.appendChild(op); });
    langSel.value = draft.locale;
    card.appendChild(D.el("label", { "class": "onb-row" }, [D.el("span", { text: t("onboard.language") }), langSel]));

    var regionCode = draft.region;
    var regionWrap = D.el("span", { "class": "onb-region" });
    function mountRegion() { D.clear(regionWrap); regionWrap.appendChild(SD.regions.pickerButton(regionCode, function (c) { regionCode = c; mountRegion(); })); }
    mountRegion();
    card.appendChild(D.el("label", { "class": "onb-row" }, [D.el("span", { text: t("onboard.country") }), regionWrap]));

    var ntChk = document.createElement("input"); ntChk.type = "checkbox"; ntChk.checked = draft.newtab !== false;
    card.appendChild(D.el("label", { "class": "onb-row onb-check" }, [ntChk, D.el("span", { text: t("onboard.newtab") })]));

    var cont = D.el("button", { "class": "btn primary onb-continue", text: t("onboard.continue") });
    card.appendChild(cont);
    root.appendChild(card);

    langSel.addEventListener("change", function () {
      SD.i18n.init(langSel.value || null).then(function () {
        document.documentElement.lang = SD.i18n.current();
        SD.i18n.applyDom(document);
        showOnboarding(SD.store.get(), { locale: langSel.value, region: regionCode, newtab: ntChk.checked });
      });
    });
    function dismiss() { root.hidden = true; SD.dom.clear(root); }
    close.addEventListener("click", function () {
      SD.store.commit(function (s) {
        s.settings.onboarded = true;
        if (s.settings.newtabEnabled === null) s.settings.newtabEnabled = true;
      });
      dismiss();
      applyNewtabMode(SD.store.get());
    });
    cont.addEventListener("click", function () {
      var nt = ntChk.checked, loc = langSel.value || null, reg = regionCode || null;
      SD.store.commit(function (s) {
        s.settings.locale = loc; s.settings.region = reg; s.settings.newtabEnabled = nt; s.settings.onboarded = true;
      });
      SD.regions.setCurrent(SD.regions.resolve(reg));
      SD.i18n.init(loc).then(function () {
        document.documentElement.lang = SD.i18n.current();
        SD.i18n.applyDom(document);
        SD.render.renderAll(SD.store.get());
        dismiss();
        applyNewtabMode(SD.store.get());
      });
    });
  }

  function applyNewtabMode(state) {
    var prompt = document.getElementById("newtab-prompt");
    var minimal = document.getElementById("minimal");
    if (state.settings.newtabEnabled === null) {
      prompt.hidden = false;
    } else if (state.settings.newtabEnabled === false) {
      document.body.classList.add("is-minimal");
      minimal.hidden = false;
    }
  }

  function wire() {
    var settingsBtn = document.getElementById("settings-btn");
    settingsBtn.appendChild(SD.dom.svg("settings", 20));
    settingsBtn.addEventListener("click", function () { SD.settingsUi.open(); });
    settingsBtn.title = SD.i18n.t("settings.title");
    document.getElementById("lock-toggle").addEventListener("click", function () {
      SD.store.commit(function (s) { s.settings.locked = !s.settings.locked; });
    });
    document.getElementById("tabsmode-toggle").addEventListener("click", function () {
      SD.store.commit(function (x) { x.settings.tabsWrap = !x.settings.tabsWrap; });   // single-line dock ↔ multi-row
    });
    document.getElementById("theme-toggle").addEventListener("click", function () {
      var modes = ["auto", "light", "dark"];
      var cur = SD.store.get().settings.theme.mode || "auto";
      var next = modes[(modes.indexOf(cur) + 1) % modes.length];
      SD.store.commit(function (s) { s.settings.theme.mode = next; });
    });
    // re-apply theme on system scheme change only in auto mode
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
        var s = SD.store.get();
        if (s && (s.settings.theme.mode || "auto") === "auto") SD.safe("theme-auto", function () { applyVisuals(s); });
      });
    }
    document.getElementById("newtab-yes").addEventListener("click", function () {
      SD.store.commit(function (s) { s.settings.newtabEnabled = true; });
      document.getElementById("newtab-prompt").hidden = true;
    });
    document.getElementById("newtab-no").addEventListener("click", function () {
      SD.store.commit(function (s) { s.settings.newtabEnabled = false; });
      document.getElementById("newtab-prompt").hidden = true;
      document.body.classList.add("is-minimal");
      document.getElementById("minimal").hidden = false;
    });
    document.getElementById("reveal").addEventListener("click", function () {
      document.body.classList.remove("is-minimal");
      document.getElementById("minimal").hidden = true;
    });
    SD.sync.watch(updateSyncStatus);
    document.addEventListener("visibilitychange", function () { document.body.classList.toggle("tab-hidden", document.hidden); });
  }

  // re-applies background each minute so auto-image rotation advances
  function startAutoImageTimer() {
    setInterval(function () {
      SD.safe("autoImage.tick", function () {
        var s = SD.store.get();
        if (s && s.settings.background.type === "autoImage" && s.settings.background.autoImage.enabled) {
          SD.backgrounds.apply(s);
        }
      });
    }, 60000);
  }

  // dependency context injected into widgets (DIP at the widget seam)
  function buildContext() {
    SD.ctx = {
      api: SD.api, store: SD.store, i18n: SD.i18n, safe: SD.safe, log: console,
      netWidget: SD.netWidget, schema: SD.schema, reminders: SD.reminders,
      icons: SD.icons, controls: SD.controls, dom: SD.dom, ui: SD.ui
    };
  }

  async function main() {
    var state = await SD.store.init();
    SD.regions.setCurrent(SD.regions.resolve(state.settings.region));
    await SD.i18n.init(state.settings.locale);
    buildContext();
    document.documentElement.lang = SD.i18n.current();
    SD.safe("i18n.applyDom", function () { SD.i18n.applyDom(document); });
    SD.safe("wire", wire);
    SD.safe("footerYear", function () {
      var y = new Date().getFullYear(), el = document.getElementById("footer-year");
      if (el) el.textContent = y > 2026 ? "2026–" + y : "2026";
    });
    SD.safe("keyboard.init", function () { SD.keyboard.init(); });
    SD.store.subscribe(onState);
    SD.store.watchExternal();
    SD.safe("initial render", function () { onState(state); });
    if (!state.settings.onboarded) SD.safe("onboarding", function () { showOnboarding(state); });
    else SD.safe("newtab mode", function () { applyNewtabMode(state); });
    SD.safe("reminders.reconcile", function () { SD.reminders.reconcile(state); });
    SD.safe("scrollTop", setupScrollTop);
    startAutoImageTimer();
  }

  // Fixed bottom-right "back to top" button; appears once the page is scrolled down.
  function setupScrollTop() {
    var btn = document.createElement("button");
    btn.id = "scroll-top"; btn.type = "button"; btn.hidden = true;
    btn.setAttribute("aria-label", SD.i18n.t("common.toTop") || "To top");
    btn.textContent = "↑";
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
      var sc = document.scrollingElement; if (sc && sc.scrollTo) sc.scrollTo({ top: 0, behavior: "smooth" });
    });
    document.body.appendChild(btn);
    var scrollY = function () { return window.scrollY || (document.scrollingElement && document.scrollingElement.scrollTop) || document.body.scrollTop || 0; };
    var onScroll = function () { btn.hidden = scrollY() < 300; };
    // capture:true so it fires regardless of which element is the actual scroller.
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    onScroll();
  }

  document.addEventListener("DOMContentLoaded", main);
})();
