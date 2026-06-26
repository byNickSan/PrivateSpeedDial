// Reminder scheduling helpers (page side): create/cancel alarms for tasks and calendar events.
// The background worker handles firing (notifications); Safari has no notifications -> UI fallback.
(function () {
  "use strict";
  SD.reminders = (function () {
    // Alarm name "<kind>:<id>" — must match background.js titleFor/reconcile.
    function nameFor(kind, id) { return kind + ":" + id; }

    // No-op if the time is past or alarms are unavailable.
    function schedule(kind, id, whenTs) {
      if (!SD.has("alarms") || !whenTs || whenTs <= Date.now()) return;
      SD.api.alarms.create(nameFor(kind, id), { when: whenTs });
    }

    function cancel(kind, id) {
      if (SD.has("alarms")) SD.api.alarms.clear(nameFor(kind, id));
    }

    // Items across every widget instance of a given type.
    function itemsOf(state, type, key) {
      return (state.widgetInstances || []).filter(function (w) { return w.type === type; })
        .reduce(function (acc, w) { return acc.concat((w.config && w.config[key]) || []); }, []);
    }

    // Re-arm alarms for all future reminders; call after edits / import.
    function reconcile(state) {
      if (!SD.has("alarms")) return;
      itemsOf(state, "tasks", "items").forEach(function (t) {
        if (t.remindAt && !t.done) schedule("task", t.id, t.remindAt);
      });
      itemsOf(state, "calendar", "events").forEach(function (e) {
        if (e.remindAt) schedule("cal", e.id, e.remindAt);
      });
    }

    return { nameFor: nameFor, schedule: schedule, cancel: cancel, reconcile: reconcile, itemsOf: itemsOf };
  })();
})();
