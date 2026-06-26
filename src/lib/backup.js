// Export/import of the entire extension state as a single JSON file.
(function () {
  "use strict";
  SD.backup = (function () {
    // deep-copies state; strips secrets/images per opts before export
    function build(state, opts) {
      opts = opts || {};
      var s = JSON.parse(JSON.stringify(state));
      if (!opts.includeSecrets) {
        (s.widgetInstances || []).forEach(function (inst) {
          if (inst.config && "apiKey" in inst.config) inst.config.apiKey = "";
        });
        if (s.settings && s.settings.background && s.settings.background.autoImage) {
          s.settings.background.autoImage.apiKey = "";
        }
      }
      if (!opts.includeImages) {
        if (s.settings && s.settings.background) s.settings.background.image = { dataUrl: "" };
        s.iconLibrary = [];
      }
      return s;
    }

    function exportFile(state, opts) {
      var blob = new Blob([JSON.stringify(build(state, opts), null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "speed-dial-backup.json";
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    function importFile(file) {
      return new Promise(function (resolve, reject) {
        var r = new FileReader();
        r.onerror = reject;
        r.onload = function () {
          try { resolve(JSON.parse(r.result)); } catch (e) { reject(e); }
        };
        r.readAsText(file);
      });
    }

    return { build: build, exportFile: exportFile, importFile: importFile };
  })();
})();
