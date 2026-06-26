// Toolbar popup: a compact settings panel (reuses the settings UI), not the full new-tab page.
(function () {
  "use strict";
  async function main() {
    var state = await SD.store.init();
    await SD.i18n.init(state.settings.locale);
    SD.ctx = {
      api: SD.api, store: SD.store, i18n: SD.i18n, safe: SD.safe, log: console,
      netWidget: SD.netWidget, schema: SD.schema, reminders: SD.reminders,
      icons: SD.icons, controls: SD.controls, dom: SD.dom
    };
    document.documentElement.lang = SD.i18n.current();
    SD.fonts.apply(state);
    SD.themes.apply(state);
    SD.i18n.applyDom(document);
    document.body.insertBefore(SD.settingsUi.buildPanel(), document.getElementById("modal-root"));
    // Re-apply theme if settings change while the popup is open.
    SD.store.subscribe(function (s) { SD.safe("popup-theme", function () { SD.themes.apply(s); }); });
  }
  document.addEventListener("DOMContentLoaded", main);
})();
