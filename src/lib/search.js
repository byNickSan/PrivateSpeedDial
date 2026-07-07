// Layer: view. Search bar. Default DuckDuckGo; private + global engines; region engines shown only on matching browser language.
(function () {
  "use strict";
  SD.search = (function () {
    // Engines. Those with `locale` appear only when the browser UI language matches that locale.
    var ENGINES = [
      { id: "duckduckgo", name: "DuckDuckGo", url: "https://duckduckgo.com/?q=", priv: true },
      { id: "startpage", name: "Startpage", url: "https://www.startpage.com/sp/search?query=", priv: true },
      { id: "brave", name: "Brave", url: "https://search.brave.com/search?q=", priv: true },
      { id: "google", name: "Google", url: "https://www.google.com/search?q=" },
      { id: "yandex", name: "Yandex", url: "https://yandex.ru/search/?text=", locale: "ru" },
      { id: "seznam", name: "Seznam", url: "https://search.seznam.cz/?q=", locale: "cs" },
      { id: "qwant", name: "Qwant", url: "https://www.qwant.com/?q=", locale: "fr", priv: true },
      { id: "ecosia", name: "Ecosia", url: "https://www.ecosia.org/search?q=", locale: "de" }
    ];

    function browserLang() {
      var l = (SD.api.i18n && SD.api.i18n.getUILanguage && SD.api.i18n.getUILanguage()) || navigator.language || "";
      return String(l).slice(0, 2).toLowerCase();
    }

    function allowed(e) { return !e.locale || e.locale === browserLang(); }

    function available() { return ENGINES.filter(allowed); }

    function byId(id) { return ENGINES.filter(function (e) { return e.id === id; })[0]; }

    function iconUrl(e) { try { return new URL(e.url).origin + "/favicon.ico"; } catch (err) { return ""; } }

    // falls back to DuckDuckGo if the configured engine is missing or not allowed here
    function engineFor(state) {
      var e = byId(state.settings.search.engine);
      return (e && allowed(e)) ? e : byId("duckduckgo");
    }

    // closes the engine menu on outside click; bound once so re-renders don't leak listeners
    function bindOutsideClose() {
      if (SD._searchDocBound) return;
      SD._searchDocBound = true;
      document.addEventListener("click", function (ev) {
        var wrap = document.querySelector(".search-wrap");
        var menu = document.querySelector(".search-menu");
        if (menu && wrap && !wrap.contains(ev.target)) menu.hidden = true;
      });
    }

    // Start typing anywhere (a printable key, not in a field/modal) → focus the search box so the keystroke
    // lands there. Digits are left for group switching (keyboard.js). Bound once.
    function bindTypeToFocus() {
      if (SD._searchTypeBound) return;
      SD._searchTypeBound = true;
      document.addEventListener("keydown", function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || /^[0-9]$/.test(e.key)) return;
        var t = e.target, tag = (t && t.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" || (t && t.isContentEditable)) return;
        if (document.querySelector(".modal.open")) return;
        var input = document.querySelector(".search-input");
        if (input && document.activeElement !== input) input.focus();   // the key then lands in the input
      });
    }

    function render(el, ctx) {
      var s = ctx.store.get();
      SD.dom.clear(el);
      if (!s.settings.search.enabled) return;
      var eng = engineFor(s);

      var wrap = document.createElement("div");
      wrap.className = "search-wrap";

      var form = document.createElement("form");
      form.className = "search-bar";

      var pick = document.createElement("button");
      pick.type = "button";
      pick.className = "search-engine-btn";
      pick.title = ctx.i18n.t("search.engine");
      // falls back to a letter dot if the favicon fails to load
      var icon = document.createElement("img");
      icon.className = "se-icon";
      icon.src = iconUrl(eng);
      icon.alt = "";
      icon.addEventListener("error", function () {
        icon.replaceWith(SD.dom.el("span", { class: "se-dot", text: eng.name.charAt(0) }));
      });
      pick.appendChild(icon);
      pick.appendChild(SD.dom.el("span", { class: "se-name", text: eng.name }));
      pick.appendChild(SD.dom.el("span", { class: "se-caret", text: "▾" }));

      var menu = document.createElement("div");
      menu.className = "search-menu";
      menu.hidden = true;
      available().forEach(function (e) {
        var item = document.createElement("button");
        item.type = "button";
        item.className = "search-menu-item" + (e.id === eng.id ? " sel" : "");
        item.appendChild(document.createTextNode(e.name));
        if (e.priv) {
          var sh = document.createElement("img");
          sh.className = "se-private";
          sh.src = SD.api.runtime.getURL("assets/icons/icon-32.png");
          sh.alt = ""; sh.title = ctx.i18n.t("search.private");
          item.appendChild(sh);
        }
        item.addEventListener("click", function () {
          ctx.store.commit(function (x) { x.settings.search.engine = e.id; });
        });
        menu.appendChild(item);
      });
      var openMenu = function (focusFirst) {
        menu.hidden = false;
        if (focusFirst) { var f = menu.querySelector(".search-menu-item.sel") || menu.querySelector(".search-menu-item"); if (f) f.focus(); }
      };
      pick.addEventListener("click", function () { if (menu.hidden) openMenu(false); else menu.hidden = true; });
      pick.addEventListener("keydown", function (e) { if (e.key === "ArrowDown") { e.preventDefault(); openMenu(true); } });
      // Arrow-key navigation within the engine menu; Escape closes and returns focus to the picker.
      menu.addEventListener("keydown", function (e) {
        var items = Array.prototype.slice.call(menu.querySelectorAll(".search-menu-item"));
        var i = items.indexOf(document.activeElement);
        if (e.key === "ArrowDown") { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
        else if (e.key === "Escape") { e.preventDefault(); menu.hidden = true; pick.focus(); }
      });

      var input = document.createElement("input");
      input.type = "search";
      input.className = "search-input";
      input.setAttribute("aria-label", ctx.i18n.t("search.placeholder"));
      input.setAttribute("placeholder", ctx.i18n.t("search.placeholder"));
      // Esc drops focus from the search box so arrow-key dial navigation can resume.
      input.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); input.blur(); } });

      // Magnifier submit button — search with the mouse.
      var go = document.createElement("button");
      go.type = "submit";
      go.className = "search-go";
      go.title = ctx.i18n.t("search.go");
      go.setAttribute("aria-label", ctx.i18n.t("search.go"));
      go.appendChild(SD.dom.svg("search", 18));

      form.appendChild(pick);
      form.appendChild(input);
      form.appendChild(go);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var q = input.value.trim();
        if (q) window.location.href = eng.url + encodeURIComponent(q);
      });

      wrap.appendChild(form);
      wrap.appendChild(menu);
      el.appendChild(wrap);
      bindOutsideClose();
      bindTypeToFocus();
    }

    return { ENGINES: ENGINES, available: available, browserLang: browserLang, engineFor: engineFor, byId: byId, render: render };
  })();
})();
