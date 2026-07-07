// Data schema: default state, version and migration entry point.
(function () {
  "use strict";
  SD.schema = (function () {
    var VERSION = 4;

    function uid() {
      return Date.now().toString(36) + Math.floor(performance.now() * 1000 % 1e6).toString(36) +
        (SD._seq = (SD._seq || 0) + 1).toString(36);
    }

    // local city from the IANA time zone ("Europe/Moscow" -> "Moscow")
    function localCity() {
      try {
        var tz = (typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone) || "";
        var p = tz.split("/");
        return (p[p.length - 1] || "Local").replace(/_/g, " ");
      } catch (e) { return "Local"; }
    }

    var BUILTIN_SCHEMES = [
      { id: "nord", name: "Nord", builtin: true, dark: true, colors: { bg: "#2e3440", surface: "#3b4252", text: "#e5e9f0", accent: "#5e81ac", border: "#434c5e" } },
      { id: "midnight", name: "Graphite", builtin: true, dark: true, colors: { bg: "#16181d", surface: "#202329", text: "#e6e8eb", accent: "#60a5fa", border: "#2c2f36" } },
      { id: "paper", name: "Paper", builtin: true, dark: false, colors: { bg: "#eef1f4", surface: "#ffffff", text: "#27313f", accent: "#3a63b5", border: "#dde2e8" } },
      { id: "forest", name: "Forest", builtin: true, dark: true, colors: { bg: "#0d1f18", surface: "#143025", text: "#d1fae5", accent: "#34d399", border: "#1f3d31" } },
      { id: "grape", name: "Grape", builtin: true, dark: true, colors: { bg: "#1a1226", surface: "#2a1d3d", text: "#ede9fe", accent: "#a78bfa", border: "#3b2a52" } },
      { id: "ocean", name: "Ocean", builtin: true, dark: true, colors: { bg: "#0b1f2a", surface: "#10303f", text: "#d6eef7", accent: "#22d3ee", border: "#1c3a4a" } },
      { id: "crimson", name: "Crimson", builtin: true, dark: true, colors: { bg: "#1c1417", surface: "#2a1d22", text: "#f5e6ea", accent: "#fb7185", border: "#3a2830" } },
      { id: "amber", name: "Amber", builtin: true, dark: true, colors: { bg: "#1c1709", surface: "#2a230f", text: "#f7eed8", accent: "#f59e0b", border: "#3c3318" } },
      { id: "sand", name: "Sand", builtin: true, dark: false, colors: { bg: "#f5efe6", surface: "#fffdf8", text: "#3a342b", accent: "#b45309", border: "#e7ddcd" } },
      { id: "rose", name: "Rose", builtin: true, dark: false, colors: { bg: "#fdf2f5", surface: "#ffffff", text: "#3f2a32", accent: "#e11d48", border: "#f3d9e1" } },
      { id: "mint", name: "Mint", builtin: true, dark: false, colors: { bg: "#eef6f1", surface: "#ffffff", text: "#1f2d28", accent: "#0d9488", border: "#d3e8df" } },
      { id: "dracula", name: "Dracula", builtin: true, dark: true, colors: { bg: "#282a36", surface: "#343746", text: "#f8f8f2", accent: "#bd93f9", border: "#44475a" } },
      { id: "tokyo", name: "Tokyo Night", builtin: true, dark: true, colors: { bg: "#1a1b26", surface: "#24283b", text: "#c0caf5", accent: "#7aa2f7", border: "#2f334d" } },
      { id: "gruvbox", name: "Gruvbox", builtin: true, dark: true, colors: { bg: "#282828", surface: "#3c3836", text: "#ebdbb2", accent: "#fabd2f", border: "#504945" } },
      { id: "solarizedDark", name: "Solarized Dark", builtin: true, dark: true, colors: { bg: "#002b36", surface: "#073642", text: "#93a1a1", accent: "#268bd2", border: "#0a4b59" } },
      { id: "mocha", name: "Catppuccin Mocha", builtin: true, dark: true, colors: { bg: "#1e1e2e", surface: "#313244", text: "#cdd6f4", accent: "#89b4fa", border: "#45475a" } },
      { id: "onedark", name: "One Dark", builtin: true, dark: true, colors: { bg: "#282c34", surface: "#21252b", text: "#abb2bf", accent: "#61afef", border: "#3b4048" } },
      { id: "carbon", name: "Carbon", builtin: true, dark: true, colors: { bg: "#0d1117", surface: "#161b22", text: "#c9d1d9", accent: "#58a6ff", border: "#30363d" } },
      { id: "solarizedLight", name: "Solarized Light", builtin: true, dark: false, colors: { bg: "#fdf6e3", surface: "#ffffff", text: "#586e75", accent: "#268bd2", border: "#eee8d5" } }
    ];

    function defaults() {
      var gid = uid();
      return {
        version: VERSION,
        settings: {
          newtabEnabled: null,
          onboarded: false,     // first-run welcome shown once; any dismissal sets true
          activeGroupId: gid,
          grid: { columns: 0, rows: 3, gap: 16 },   // columns 0 = Auto (intrinsic grid); >0 pins a fixed count
          tile: { width: 120, height: 110, radius: 16, autoFavicon: true },
          locale: null,         // UI language: null=auto, else en|ru|cs|fr|de
          region: null,         // news country (SD.regions code): null=auto-detect
          lockDials: false,
          locked: false,        // master UI lock (topbar padlock): off by default; persists once enabled
          widgetColWidth: 300,  // px width of left/right widget columns (desktop only; min 300)
          showDials: true,      // central dials grid; off frees space for wider widget columns
          perfOverlay: false,   // fixed top-left tab-memory readout (Chromium performance.memory; "—" elsewhere)
          density: "comfortable",  // design-system density preset: comfortable | compact (drives --tile-*/icon tokens)
          tabsAlign: "center",     // group tabs alignment: center | left
          tabsWrap: false,         // group tabs on multiple rows; off = single-line dock (fisheye, fits all)
          tabsAutoScroll: true,    // deprecated (kept for back-compat; the strip no longer scrolls — see dock)
          font: { family: "system-ui, sans-serif", size: 13, labelColor: "", clock: "", notes: "" },
          showLabels: true,
          theme: { activeSchemeId: "nord", darkSchemeId: "nord", lightSchemeId: "paper", mode: "auto" },
          background: {
            type: "gradient",
            gradient: { preset: "theme", stops: ["#1e3a8a", "#9333ea", "#0ea5e9"], angle: 160, animated: false, animSpeedMs: 14000 },
            color: "",
            image: { dataUrl: "" },
            autoImage: { enabled: false, provider: "loremflickr", apiKey: "", query: "", intervalMin: 30, cache: null },
            env: { time: "auto", season: "auto", weather: "clear", randomWeather: false },   // §B time/season/weather for canvas scenes
            blur: 0, dim: 0
          },
          animation: { hover: "scale", speedMs: 180, groupSwitch: "fade", keyboardNav: true },
          search: { enabled: true, engine: "duckduckgo" },
          widgetPlacement: "right"
        },
        syncEnabled: false,
        groups: [{ id: gid, name: "Home", order: 0 }],
        dials: [],
        iconLibrary: [],
        fontLibrary: [],
        schemes: BUILTIN_SCHEMES.slice(),
        // kept (empty) for back-compat / rollback; the active path reads instance configs
        notes: [],
        tasks: [],
        calendar: [],
        widgetInstances: [
          { instId: uid(), type: "clock", config: { style: "htc-flip", digitalStyle: "mono", showSeconds: true, format24: true, cities: [{ id: uid(), label: localCity(), timeZone: "" }], cityLabelSize: 13, cityLabelStyle: "normal" } },
          { instId: uid(), type: "notes", config: { items: [], bg: "", fontSize: 14 } },
          { instId: uid(), type: "bookmarks", config: { collapsed: false, nav: "tree", design: "list", accent: "" } },
          { instId: uid(), type: "feed", config: { collapsed: false, googleNews: true, feeds: [], columns: 3, perPage: 9, showImages: true, imgHeight: 150, fontSize: 15, autoload: true, keywords: "", hideRead: false, read: [], consented: false } }
        ],
        consents: {},
        updatedAt: 0
      };
    }

    function newInstance(type) {
      var mod = SD.registry && SD.registry.byId(type);
      var inst = { instId: uid(), type: type, config: mod && mod.defaultConfig ? mod.defaultConfig() : {} };
      if (mod && mod.kind === "net") inst.cache = null;
      return inst;
    }

    // backfills new config keys from defaultConfig; existing values win
    function fillInstanceDefaults(inst) {
      var mod = SD.registry && inst && SD.registry.byId(inst.type);
      if (mod && mod.defaultConfig) inst.config = Object.assign(mod.defaultConfig(), inst.config);
      return inst;
    }

    // v1 (singleton widgets object + top-level notes/tasks/calendar) -> v2 (widgetInstances array).
    function migrateV2(s) {
      if (!s.widgets) return s;   // idempotent: already migrated
      var w = s.widgets, order = (s.settings && s.settings.widgetOrder) || [];
      var TYPES = ["clock", "notes", "tasks", "calendar", "weather", "fx", "stocks", "gold"];
      var NET = { weather: 1, fx: 1, stocks: 1, gold: 1 };
      if (s.notes && !Array.isArray(s.notes)) {   // normalize legacy single-note BEFORE reading
        s.notes = s.notes.text ? [{ id: uid(), text: s.notes.text, updatedAt: s.notes.updatedAt || 0 }] : [];
      }
      var enabled = TYPES.filter(function (t) { return w[t] && w[t].enabled; });
      enabled.sort(function (a, b) {
        var ia = order.indexOf(a), ib = order.indexOf(b);
        if (ia < 0 && ib < 0) return TYPES.indexOf(a) - TYPES.indexOf(b);
        if (ia < 0) return 1; if (ib < 0) return -1; return ia - ib;
      });
      s.widgetInstances = enabled.map(function (t) {
        var cfg = {};
        Object.keys(w[t]).forEach(function (k) { if (k !== "enabled" && k !== "cache") cfg[k] = w[t][k]; });
        if (t === "notes") cfg.items = (s.notes || []).slice();
        if (t === "tasks") cfg.items = (s.tasks || []).slice();
        if (t === "calendar") cfg.events = (s.calendar || []).slice();
        if (t === "weather") { cfg.tempUnit = w[t].units === "imperial" ? "fahrenheit" : "celsius"; cfg.windUnit = w[t].units === "imperial" ? "mph" : "kmh"; delete cfg.units; }
        var inst = { instId: uid(), type: t, config: cfg };
        // Weather's fetched shape changed in 0.2.0; drop its stale cache so it refetches.
        if (NET[t]) inst.cache = t === "weather" ? null : (w[t].cache || null);
        return inst;
      });
      delete s.widgets;
      if (s.settings) delete s.settings.widgetOrder;
      return s;
    }

    // v3: a former editor bug force-saved the default dark tile color (#1e293b) on dials the user never
    // colored, making them black (unreadable) in light themes. Clear it so those dials follow the theme.
    function migrateV3(s) {
      (s.dials || []).forEach(function (d) { if (d.color === "#1e293b") d.color = ""; });
      return s;
    }

    // v4: add background.env (time/season/weather) for canvas scenes; backfill on existing configs.
    function migrateV4(s) {
      var b = s.settings && s.settings.background;
      if (b && !b.env) b.env = { time: "auto", season: "auto", weather: "clear", randomWeather: false };
      return s;
    }

    // migration ladder; each entry: { to: N, up(state) -> state }
    var MIGRATIONS = [{ to: 2, up: migrateV2 }, { to: 3, up: migrateV3 }, { to: 4, up: migrateV4 }];

    function migrate(state) {
      if (!state || typeof state !== "object") return defaults();
      if (!state.version) state.version = 1;   // unversioned = oldest; let the ladder run
      MIGRATIONS.forEach(function (m) {
        if (state.version < m.to) { state = m.up(state); state.version = m.to; }
      });
      // notes: legacy single-note object -> array of notes (defensive; also handled in migrateV2).
      if (state.notes && !Array.isArray(state.notes)) {
        state.notes = state.notes.text ? [{ id: uid(), text: state.notes.text, updatedAt: state.notes.updatedAt || 0 }] : [];
      }
      var merged = merge(defaults(), state);
      if (Array.isArray(merged.widgetInstances)) merged.widgetInstances.forEach(fillInstanceDefaults);
      // Always refresh built-in schemes from code (so palette tweaks + newly added schemes reach existing
      // users), keeping any user-made custom schemes.
      var custom = (merged.schemes || []).filter(function (s) { return !s.builtin; });
      merged.schemes = BUILTIN_SCHEMES.slice().concat(custom);
      return merged;
    }

    // validates untrusted input (imported backup) has the expected top-level shape
    function validate(state) {
      return !!state && typeof state === "object" &&
        state.settings && typeof state.settings === "object" &&
        Array.isArray(state.groups) && Array.isArray(state.dials);
    }

    // recursive fill of defaults with src values; arrays are taken whole from src
    function merge(def, src) {
      if (Array.isArray(def)) return Array.isArray(src) ? src : def;
      if (def && typeof def === "object") {
        var out = {};
        Object.keys(def).forEach(function (k) {
          out[k] = k in src ? merge(def[k], src[k]) : def[k];
        });
        // Keep extra keys from src (e.g. consents map).
        Object.keys(src || {}).forEach(function (k) { if (!(k in out)) out[k] = src[k]; });
        return out;
      }
      return src === undefined ? def : src;
    }

    return { VERSION: VERSION, defaults: defaults, migrate: migrate, validate: validate, uid: uid, merge: merge, MIGRATIONS: MIGRATIONS, newInstance: newInstance, fillInstanceDefaults: fillInstanceDefaults };
  })();
})();
