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
      r.setProperty("--text-muted", "color-mix(in srgb, " + c.text + " 72%, transparent)");
      r.setProperty("--content-max", (state.settings.contentMax || 1600) + "px");
      r.setProperty("--tile-h", state.settings.tile.height + "px");
      r.setProperty("--grid-cols", state.settings.grid.columns || 6);
      // Density (CSS :root[data-density]) provides the base tile/gap/radius. Manual layout settings are an
      // ADVANCED override: apply them only when they differ from the schema default, else fall back to density.
      var def = defSettings();
      ov(r, "--tile-radius", state.settings.tile.radius, def.tile.radius, "px");
      ov(r, "--tile-gap", state.settings.grid.gap, def.grid.gap, "px");
      if (state.settings.tile.width !== def.tile.width) {
        r.setProperty("--tile-target", state.settings.tile.width + "px");
        r.setProperty("--tile-cap", state.settings.tile.width + "px");   // fixed-size tile (old behavior)
      } else { r.removeProperty("--tile-target"); r.removeProperty("--tile-cap"); }
    }
    var _def = null;
    function defSettings() { return _def || (_def = SD.schema.defaults().settings); }
    // setProperty when value != default, else removeProperty (fall back to density token)
    function ov(r, name, val, def, unit) {
      if (val != null && val !== def) r.setProperty(name, val + (unit || "")); else r.removeProperty(name);
    }

    return { apply: apply, find: find, active: active };
  })();
})();
