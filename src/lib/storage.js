// Storage layer: local state is source of truth; optional chunked mirror into storage.sync.
(function () {
  "use strict";
  SD.storage = (function () {
    var LOCAL_KEY = "sd_state";
    var SYNC_META = "sd_sync_meta";
    var SYNC_CHUNK = "sd_sync_";
    var CHUNK_SIZE = 7000;      // < 8192 per-item sync limit, leaving margin
    var SYNC_TOTAL_LIMIT = 100000;

    async function loadLocal() {
      var got = await SD.api.storage.local.get(LOCAL_KEY);
      return SD.schema.migrate(got[LOCAL_KEY]);
    }

    async function saveLocal(state) {
      var o = {};
      o[LOCAL_KEY] = state;
      await SD.api.storage.local.set(o);
    }

    // Sync-safe subset: drops large blobs (images, caches) and secrets (API keys).
    function syncable(state) {
      var s = JSON.parse(JSON.stringify(state));
      if (s.settings && s.settings.background) {
        s.settings.background.image = { dataUrl: "" };
        if (s.settings.background.autoImage) {
          s.settings.background.autoImage.cache = null;
          s.settings.background.autoImage.apiKey = "";
        }
      }
      s.iconLibrary = [];           // icons live local-only (too large for sync)
      s.fontLibrary = [];           // uploaded fonts live local-only (too large for sync)
      (s.widgetInstances || []).forEach(function (inst) {
        if ("cache" in inst) inst.cache = null;                 // net caches don't sync
        if ("panel" in inst) delete inst.panel;                 // widget zone is per-device layout
        if (inst.config && "apiKey" in inst.config) inst.config.apiKey = "";   // never sync secrets
      });
      return s;
    }

    async function pushSync(state) {
      var json = JSON.stringify(syncable(state));
      if (json.length > SYNC_TOTAL_LIMIT) {
        var err = new Error("quota");
        err.code = "quota";
        throw err;
      }
      var chunks = [];
      for (var i = 0; i < json.length; i += CHUNK_SIZE) chunks.push(json.slice(i, i + CHUNK_SIZE));
      var payload = {};
      payload[SYNC_META] = { count: chunks.length, updatedAt: state.updatedAt || 0 };
      chunks.forEach(function (c, idx) { payload[SYNC_CHUNK + idx] = c; });
      await SD.api.storage.sync.set(payload);
      // Drop leftover chunks from a previous larger write.
      var all = await SD.api.storage.sync.get(null);
      var stale = Object.keys(all).filter(function (k) {
        return k.indexOf(SYNC_CHUNK) === 0 && parseInt(k.slice(SYNC_CHUNK.length), 10) >= chunks.length;
      });
      if (stale.length) await SD.api.storage.sync.remove(stale);
    }

    // Reassembles the sync subset; null when nothing is stored.
    async function pullSync() {
      var meta = (await SD.api.storage.sync.get(SYNC_META))[SYNC_META];
      if (!meta || !meta.count) return null;
      var keys = [];
      for (var i = 0; i < meta.count; i++) keys.push(SYNC_CHUNK + i);
      var parts = await SD.api.storage.sync.get(keys);
      var json = "";
      for (var j = 0; j < meta.count; j++) json += parts[SYNC_CHUNK + j] || "";
      try { return { data: JSON.parse(json), updatedAt: meta.updatedAt || 0 }; }
      catch (e) { return null; }
    }

    // Local-state changes from other contexts (e.g. background worker).
    function onChanged(cb) {
      SD.api.storage.onChanged.addListener(function (changes, area) {
        if (area === "local" && changes[LOCAL_KEY]) cb(changes[LOCAL_KEY].newValue);
      });
    }

    return { loadLocal: loadLocal, saveLocal: saveLocal, pushSync: pushSync, pullSync: pullSync, syncable: syncable, onChanged: onChanged };
  })();
})();
