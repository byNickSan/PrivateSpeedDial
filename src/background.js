// Background worker (Chrome/Safari service worker, Firefox event page).
// Event-page-safe: listeners at top level, state read from storage on demand, alarms re-armed on startup.
(function () {
  "use strict";
  var api = globalThis.browser || globalThis.chrome;
  var LOCAL_KEY = "sd_state";

  async function getState() {
    var got = await api.storage.local.get(LOCAL_KEY);
    return got[LOCAL_KEY] || null;
  }

  // Items across widget instances (v2), falling back to legacy top-level arrays.
  function collect(state, type, key, legacy) {
    var out = (state.widgetInstances || []).filter(function (w) { return w.type === type; })
      .reduce(function (acc, w) { return acc.concat((w.config && w.config[key]) || []); }, []);
    return out.length ? out : (state[legacy] || []);
  }

  // CONTRACT: alarm names use the "<kind>:<id>" format, identical to lib/reminders.js (nameFor).
  // These two files must stay in sync or reminders break.
  function titleFor(state, name) {
    var parts = name.split(":"), kind = parts[0], id = parts[1];
    var list = kind === "task" ? collect(state, "tasks", "items", "tasks") : kind === "cal" ? collect(state, "calendar", "events", "calendar") : [];
    var item = (list || []).filter(function (x) { return x.id === id; })[0];
    return item ? item.title : null;
  }

  // Notify when supported; Safari has no notifications -> badge fallback.
  async function fire(name) {
    try {
      var state = await getState();
      if (!state) return;
      var title = titleFor(state, name);
      if (!title) return;
      if (api.notifications && api.notifications.create) {
        api.notifications.create(name, {
          type: "basic",
          iconUrl: api.runtime.getURL("assets/icons/icon-128.png"),
          title: title,
          message: title
        });
        return;
      }
      if (api.action && api.action.setBadgeText) api.action.setBadgeText({ text: "!" });
    } catch (e) {
      console.warn("[speed-dial] fire:", e);
      if (api.action && api.action.setBadgeText) api.action.setBadgeText({ text: "!" });
    }
  }

  // Re-arm alarms for all future reminders (recovers after worker restart).
  async function reconcile() {
    try {
      if (!api.alarms) return;
      var state = await getState();
      if (!state) return;
      collect(state, "tasks", "items", "tasks").forEach(function (t) {
        if (t.remindAt && !t.done && t.remindAt > Date.now()) api.alarms.create("task:" + t.id, { when: t.remindAt });
      });
      collect(state, "calendar", "events", "calendar").forEach(function (e) {
        if (e.remindAt && e.remindAt > Date.now()) api.alarms.create("cal:" + e.id, { when: e.remindAt });
      });
    } catch (e) {
      console.warn("[speed-dial] reconcile:", e);
    }
  }

  if (api.alarms) api.alarms.onAlarm.addListener(function (alarm) { fire(alarm.name); });
  if (api.runtime.onStartup) api.runtime.onStartup.addListener(reconcile);
  if (api.runtime.onInstalled) api.runtime.onInstalled.addListener(reconcile);
  if (api.notifications && api.notifications.onClicked) {
    api.notifications.onClicked.addListener(function (id) { api.notifications.clear(id); });
  }
})();
