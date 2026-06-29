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

    // Fire a test notification now (verifies OS notifications are enabled for the browser). Uses the
    // extension notifications API (works in pages too); Safari/no-API → in-page toast fallback.
    // Best-effort permission check. NOTE: the OS-level toggle (does macOS/Windows allow the BROWSER app to
    // post notifications) is NOT exposed to extensions — only the in-browser level is. Chrome:
    // notifications.getPermissionLevel ("granted"/"denied"). Others: web Notification.permission as a proxy.
    function permLevel(cb) {
      try {
        if (SD.api.notifications && SD.api.notifications.getPermissionLevel) {
          var r = SD.api.notifications.getPermissionLevel(function (lvl) { cb(lvl); });
          if (r && typeof r.then === "function") r.then(cb, function () { cb("unknown"); });
          return;
        }
      } catch (e) { /* fall through */ }
      if (typeof Notification !== "undefined" && Notification.permission) { cb(Notification.permission); return; }
      cb("unknown");
    }

    // Fires a test notification. Calls onDone(true) only when it was created without error and not denied —
    // the caller uses that to permanently hide the hint (test passed → don't nag).
    function test(onDone) {
      var fin = function (v) { if (typeof onDone === "function") { onDone(v); onDone = null; } };
      var hasN = !!(SD.has("notifications") && SD.api.notifications && SD.api.notifications.create);
      console.info("[reminders] test clicked — notifications API available:", hasN);
      if (SD.ui && SD.ui.toast) SD.ui.toast(SD.i18n.t("notify.testBody"));   // always: click is never silent
      if (!hasN) { console.warn("[reminders] no notifications API (Safari/page) — toast only"); fin(false); return; }
      permLevel(function (lvl) {
        console.info("[reminders] in-browser notification permission:", lvl, "(OS-level browser toggle is not queryable)");
        if (lvl === "denied") { if (SD.ui && SD.ui.toast) SD.ui.toast(SD.i18n.t("notify.blocked")); fin(false); return; }
        try {
          var opts = { type: "basic", iconUrl: SD.api.runtime.getURL("assets/icons/icon-128.png"), title: SD.i18n.t("notify.testTitle"), message: SD.i18n.t("notify.testBody") };
          var done = function (id) { var e = SD.api.runtime && SD.api.runtime.lastError; console.info("[reminders] notification create result:", id, e ? ("lastError: " + e.message) : "ok"); fin(!e && !!id); };
          var r = SD.api.notifications.create("sd-test-" + Date.now(), opts, done);
          if (r && typeof r.then === "function") r.then(function (id) { fin(!!id); }, function (err) { console.warn("[reminders] notification failed:", err); fin(false); });
        } catch (e) { console.warn("[reminders] notifications.create threw:", e); fin(false); }
      });
    }

    // One-time dismissible hint shown in Tasks/Calendar widgets explaining OS notifications + a Test button.
    // Returns a DOM node, or null when already dismissed (cfg.notifyHintDismissed).
    function hintNode(ctx) {
      if (!ctx || !ctx.cfg || ctx.cfg().notifyHintDismissed) return null;
      var D = SD.dom, t = ctx.i18n.t;
      var box = D.el("div", { "class": "notify-hint" }, [D.el("span", { "class": "notify-hint-txt", text: t("notify.hint") })]);
      var testBtn = D.el("button", { "class": "btn ghost notify-test", text: t("notify.test") });
      testBtn.addEventListener("click", function () {
        test(function (ok) { if (ok) ctx.commitCfg(function (c) { c.notifyHintDismissed = true; }); });   // test passed → hide hint for good
      });
      var x = D.el("button", { "class": "notify-hint-x", text: "×", title: t("common.close"), "aria-label": t("common.close") });
      x.addEventListener("click", function () { ctx.commitCfg(function (c) { c.notifyHintDismissed = true; }); });
      box.appendChild(testBtn); box.appendChild(x);
      return box;
    }

    return { nameFor: nameFor, schedule: schedule, cancel: cancel, reconcile: reconcile, itemsOf: itemsOf, test: test, hintNode: hintNode };
  })();
})();
