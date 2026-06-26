// Layer: widget. Open/closed widget registry: widgets self-register; panels iterate generically.
// Adding a widget = one file + one <script> tag, zero edits to core (render/settings).
(function () {
  "use strict";
  SD.registry = (function () {
    var items = [];

    /**
     * @typedef {Object} WidgetModule
     * @property {string} id                 unique id, also the key in state.widgets
     * @property {'local'|'net'} kind
     * @property {string} titleKey           i18n key for the card/section title
     * @property {number} order              sort order in panel and settings
     * @property {(el:HTMLElement, ctx:Object)=>void} [mount]          local: render into el
     * @property {(el:HTMLElement, res:Object, ctx:Object)=>void} [render]  net: render result into el
     * @property {(el:HTMLElement, ctx:Object)=>void} [renderSettings]  optional own settings block
     * net-only: providers[], origin(cfg), privacyDataKey, ttlMin, buildUrl(cfg), parse(json,cfg)
     */

    function register(mod) { items.push(mod); }

    // sorted by order, read at render time (not load time)
    function all() { return items.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }

    function byId(id) { return items.filter(function (m) { return m.id === id; })[0] || null; }

    return { register: register, all: all, byId: byId };
  })();
})();
