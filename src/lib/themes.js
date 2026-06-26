// Applies the active color scheme and font to CSS custom properties on :root.
(function () {
  "use strict";
  SD.themes = (function () {
    // Scheme by id, falling back to the first.
    function find(state, id) {
      return state.schemes.filter(function (s) { return s.id === id; })[0] || state.schemes[0];
    }

    function darkPreferred() {
      return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }

    function firstByDark(state, wantDark) {
      return state.schemes.filter(function (s) { return !!s.dark === wantDark; })[0];
    }

    // Scheme for the current mode; "auto" follows the browser preference.
    function active(state) {
      var th = state.settings.theme, mode = th.mode || "auto";
      if (mode === "custom") return find(state, th.activeSchemeId);
      if (mode === "light") return firstByDark(state, false) || find(state, th.activeSchemeId);
      if (mode === "dark") return firstByDark(state, true) || find(state, th.activeSchemeId);
      return (darkPreferred() ? firstByDark(state, true) : firstByDark(state, false)) || find(state, th.activeSchemeId);
    }

    function apply(state) {
      var sc = active(state);
      var r = document.documentElement.style;
      var c = sc.colors;
      r.setProperty("--bg", c.bg);
      r.setProperty("--surface", c.surface);
      r.setProperty("--text", c.text);
      r.setProperty("--accent", c.accent);
      r.setProperty("--border", c.border);
      r.setProperty("--font-family", state.settings.font.family);
      r.setProperty("--clock-font", state.settings.font.clock || state.settings.font.family);
      r.setProperty("--notes-font", state.settings.font.notes || state.settings.font.family);
      r.setProperty("--font-size", state.settings.font.size + "px");
      if (state.settings.font.labelColor) r.setProperty("--label-color", state.settings.font.labelColor);
      else r.removeProperty("--label-color");
      r.setProperty("--tile-radius", state.settings.tile.radius + "px");
      r.setProperty("--tile-w", state.settings.tile.width + "px");
      r.setProperty("--tile-h", state.settings.tile.height + "px");
      r.setProperty("--grid-cols", state.settings.grid.columns);
      r.setProperty("--grid-gap", state.settings.grid.gap + "px");
    }

    return { apply: apply, find: find, active: active };
  })();
})();
