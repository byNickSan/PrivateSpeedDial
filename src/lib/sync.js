// Sync availability + online/offline status.
(function () {
  "use strict";
  SD.sync = (function () {
    // Safari implements storage.sync but does not actually sync (behaves like local).
    function isSafari() {
      var ua = navigator.userAgent;
      return /Safari/.test(ua) && !/Chrom(e|ium)/.test(ua) && !/Edg/.test(ua) && !/Firefox/.test(ua);
    }

    function available() {
      return SD.has("storage.sync") && !isSafari();
    }

    function online() { return navigator.onLine !== false; }

    function watch(cb) {
      window.addEventListener("online", function () { cb(true); });
      window.addEventListener("offline", function () { cb(false); });
    }

    return { isSafari: isSafari, available: available, online: online, watch: watch };
  })();
})();
