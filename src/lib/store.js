// Layer: domain. Central state store: holds state in memory, persists to local, mirrors to sync, notifies views.
(function () {
  "use strict";
  SD.store = (function () {
    var state = null;
    var subs = [];
    var saveTimer = null;

    // If sync is enabled and remote is newer, merge the synced subset.
    async function init() {
      state = await SD.storage.loadLocal();
      if (state.syncEnabled && SD.sync && SD.sync.available()) {
        await SD.safeAsync("sync.pull", async function () {
          var remote = await SD.storage.pullSync();
          if (remote && remote.updatedAt > (state.updatedAt || 0)) {
            // widget zone is per-device: keep local panels across the merge (remote drops them)
            var prevPanels = {};
            (state.widgetInstances || []).forEach(function (i) { if (i.panel) prevPanels[i.instId] = i.panel; });
            state = SD.schema.merge(state, remote.data);
            (state.widgetInstances || []).forEach(function (i) { if (prevPanels[i.instId]) i.panel = prevPanels[i.instId]; });
            await SD.storage.saveLocal(state);
          }
        });
      }
      return state;
    }

    function get() { return state; }

    // A throwing subscriber must not break the others.
    function notify() {
      subs.forEach(function (cb) { SD.safe("subscriber", function () { cb(state); }); });
    }

    function subscribe(cb) { subs.push(cb); return function () { subs = subs.filter(function (f) { return f !== cb; }); }; }

    // Debounced local save + optional sync push.
    function persist() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        SD.safeAsync("persist", async function () {
          await SD.storage.saveLocal(state);
          if (state.syncEnabled && SD.sync && SD.sync.available()) {
            try { await SD.storage.pushSync(state); }
            catch (e) { if (SD.ui && e.code === "quota") SD.ui.toast(SD.i18n.t("sync.quotaExceeded")); }
          }
        });
      }, 250);
    }

    // Detach heavy blobs (background image, icon library) before clone — speed.
    function snapshot() {
      var img = state.settings.background.image;
      var lib = state.iconLibrary;
      state.settings.background.image = null;
      state.iconLibrary = null;
      var snap = structuredClone(state);
      state.settings.background.image = img;
      state.iconLibrary = lib;
      snap.__heavy = { img: img, lib: lib };
      return snap;
    }

    function rollback(snap) {
      var heavy = snap.__heavy;
      delete snap.__heavy;
      snap.settings.background.image = heavy.img;
      snap.iconLibrary = heavy.lib;
      state = snap;
    }

    // On throw, restore the pre-mutation snapshot (no partial state).
    function commit(mutator) {
      var snap = snapshot();
      try {
        mutator(state);
      } catch (e) {
        rollback(snap);
        console.warn("[speed-dial] commit rollback:", e);
        notify();
        return;
      }
      state.updatedAt = Date.now();
      persist();
      notify();
    }

    // Import: validate untrusted input before accepting.
    async function replace(next) {
      if (SD.schema.validate && !SD.schema.validate(next)) {
        throw new Error("invalid backup");
      }
      state = SD.schema.migrate(next);
      state.updatedAt = Date.now();
      await SD.storage.saveLocal(state);
      notify();
    }

    // Refresh on background/other-tab local writes.
    function watchExternal() {
      SD.storage.onChanged(function (newValue) {
        if (newValue) { state = SD.schema.migrate(newValue); notify(); }
      });
    }

    return { init: init, get: get, commit: commit, replace: replace, subscribe: subscribe, watchExternal: watchExternal };
  })();
})();
