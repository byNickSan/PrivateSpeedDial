// Layer: service. User-uploaded fonts: registers @font-face rules from the font library.
(function () {
  "use strict";
  SD.fonts = (function () {
    function styleEl() {
      var s = document.getElementById("sd-fonts");
      if (!s) { s = document.createElement("style"); s.id = "sd-fonts"; document.head.appendChild(s); }
      return s;
    }

    function apply(state) {
      var css = (state.fontLibrary || []).map(function (f) {
        return '@font-face{font-family:"' + String(f.name).replace(/["\\]/g, "") + '";src:url(' + f.dataUrl + ');font-display:swap;}';
      }).join("\n");
      styleEl().textContent = css;
    }

    function importFont(file) {
      return new Promise(function (resolve, reject) {
        var r = new FileReader();
        r.onerror = reject;
        r.onload = function () { resolve({ id: SD.schema.uid(), name: file.name.replace(/\.[^.]+$/, ""), dataUrl: r.result }); };
        r.readAsDataURL(file);
      });
    }

    function blobToDataUrl(blob) {
      return new Promise(function (res, rej) { var r = new FileReader(); r.onerror = rej; r.onload = function () { res(r.result); }; r.readAsDataURL(blob); });
    }
    // Downloads a Google Font (with explicit consent + per-device host grant), caches it locally
    // in the font library so it works offline afterwards. Resolves true on success.
    function downloadWebFont(family) {
      return SD.ui.privacyConsent("fonts.gstatic.com", SD.i18n.t("privacy.dataFont")).then(function (ok) {
        if (!ok) return false;
        var req = SD.has("permissions.request")
          ? SD.api.permissions.request({ origins: ["https://fonts.googleapis.com/*", "https://fonts.gstatic.com/*"] }).catch(function () { return true; })
          : Promise.resolve(true);
        return req.then(function () {
          return fetch("https://fonts.googleapis.com/css2?family=" + encodeURIComponent(family) + "&display=swap").then(function (r) { return r.text(); });
        }).then(function (css) {
          var m = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/);
          if (!m) throw new Error("no woff2");
          return fetch(m[1]).then(function (r) { return r.blob(); });
        }).then(blobToDataUrl).then(function (dataUrl) {
          SD.store.commit(function (s) { (s.fontLibrary = s.fontLibrary || []).push({ id: SD.schema.uid(), name: family, dataUrl: dataUrl }); });
          apply(SD.store.get());
          return true;
        }).catch(function () { if (SD.ui) SD.ui.toast(SD.i18n.t("status.error")); return false; });
      });
    }

    return { apply: apply, importFont: importFont, downloadWebFont: downloadWebFont };
  })();
})();
