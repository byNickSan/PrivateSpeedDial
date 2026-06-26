// In-app localization with runtime override (chrome.i18n cannot switch locale at runtime).
(function () {
  "use strict";
  SD.i18n = (function () {
    var SUPPORTED = ["en", "ru", "cs", "fr", "de"];
    var dict = {};
    var enDict = {};        // English fallback for keys missing in the active locale
    var current = "en";
    var tag = "en";   // full BCP-47 (may carry region, e.g. en-GB) for region-sensitive consumers (news)

    var ALIAS = { uk: "ru" };   // Ukrainian has no dictionary -> show Russian

    // Best supported locale for a BCP-47 tag ("fr-CA" -> "fr").
    function bestMatch(t) {
      if (!t) return "en";
      var base = String(t).toLowerCase().split("-")[0];
      if (ALIAS[base]) base = ALIAS[base];
      return SUPPORTED.indexOf(base) >= 0 ? base : "en";
    }

    // Explicit override, else the browser UI language. Keeps the full tag (region) in `tag`.
    function resolve(override) {
      if (override) { tag = override; return bestMatch(override); }
      var ui = (SD.api.i18n && SD.api.i18n.getUILanguage && SD.api.i18n.getUILanguage()) || navigator.language || "en";
      tag = ui;
      return bestMatch(ui);
    }

    async function load(locale) {
      var url = SD.api.runtime.getURL("src/i18n/" + locale + ".json");
      var res = await fetch(url);
      return res.json();
    }

    // Loads active dict + English, so missing keys fall back to English.
    async function init(override) {
      current = resolve(override);
      try {
        dict = await load(current);
      } catch (e) {
        current = "en";
        dict = await load("en");
      }
      enDict = current === "en" ? dict : await load("en").catch(function () { return {}; });
      return current;
    }

    // Active locale -> English fallback -> the key itself. Optional $NAME$ substitutions.
    function t(key, subs) {
      var s = dict[key];
      if (s == null) s = enDict[key];
      if (s == null) return key;
      if (subs) {
        Object.keys(subs).forEach(function (k) {
          s = s.split("$" + k + "$").join(subs[k]);
        });
      }
      return s;
    }

    function applyDom(root) {
      (root || document).querySelectorAll("[data-i18n]").forEach(function (el) {
        el.textContent = t(el.getAttribute("data-i18n"));
      });
      (root || document).querySelectorAll("[data-i18n-ph]").forEach(function (el) {
        el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph")));
      });
      (root || document).querySelectorAll("[data-i18n-title]").forEach(function (el) {
        el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
      });
    }

    return {
      SUPPORTED: SUPPORTED,
      init: init,
      t: t,
      applyDom: applyDom,
      current: function () { return current; },
      tag: function () { return tag; }
    };
  })();
})();
