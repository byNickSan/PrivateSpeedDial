// Layer: widget. Calendar: month grid with events; events can carry reminders (alarms -> notifications).
(function () {
  "use strict";
  // Per-instance view/selection state (keyed by instId) so multiple calendars don't move together.
  var viewState = {};

  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function vs(ctx) {
    var id = ctx.inst.instId;
    return viewState[id] || (viewState[id] = { view: new Date(), selected: ymd(new Date()) });
  }

  function mount(el, ctx) {
    var D = ctx.dom, t = ctx.i18n.t, cfg = ctx.cfg(), st = vs(ctx);
    var y = st.view.getFullYear(), m = st.view.getMonth();
    var first = new Date(y, m, 1);
    var startDow = (first.getDay() + 6) % 7;
    var days = new Date(y, m + 1, 0).getDate();
    var today = ymd(new Date());
    var byDay = {};
    (cfg.events || []).forEach(function (e) { (byDay[e.date] = byDay[e.date] || []).push(e); });

    D.clear(el);

    var hint = ctx.reminders.hintNode(ctx); if (hint) el.appendChild(hint);

    var prev = D.el("button", { "class": "cal-prev", text: "‹" });
    var next = D.el("button", { "class": "cal-next", text: "›" });
    prev.addEventListener("click", function () { st.view = new Date(y, m - 1, 1); mount(el, ctx); });
    next.addEventListener("click", function () { st.view = new Date(y, m + 1, 1); mount(el, ctx); });
    el.appendChild(D.el("div", { "class": "cal-head" }, [prev, D.el("span", { text: first.toLocaleDateString(undefined, { month: "long", year: "numeric" }) }), next]));

    var dow = D.el("div", { "class": "cal-dow" });
    ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].forEach(function (x) { dow.appendChild(D.el("span", { text: x })); });
    el.appendChild(dow);

    var grid = D.el("div", { "class": "cal-grid" });
    for (var i = 0; i < startDow; i++) grid.appendChild(D.el("div", { "class": "cal-cell empty" }));
    for (var d = 1; d <= days; d++) {
      (function (dd) {
        var key = y + "-" + pad(m + 1) + "-" + pad(dd);
        var cls = "cal-cell" + (byDay[key] ? " has-ev" : "") + (key === today ? " today" : "") + (key === st.selected ? " selected" : "");
        var cell = D.el("div", { "class": cls, text: String(dd) });
        cell.addEventListener("click", function () { st.selected = key; mount(el, ctx); });
        grid.appendChild(cell);
      })(d);
    }
    el.appendChild(grid);

    var events = D.el("div", { "class": "cal-events" });
    (byDay[st.selected] || []).forEach(function (ev) {
      var del = D.el("button", { "class": "cal-ev-del", text: "×" });
      del.addEventListener("click", function () {
        ctx.reminders.cancel("cal", ev.id);
        ctx.commitCfg(function (c) { c.events = (c.events || []).filter(function (x) { return x.id !== ev.id; }); });
      });
      events.appendChild(D.el("div", { "class": "cal-ev" }, [
        D.el("b", { text: ev.title }),
        ev.time ? D.el("span", { text: " " + ev.time }) : null,
        ev.remindAt ? D.el("span", { "class": "cal-bell", text: "🔔" }) : null,
        del
      ]));
    });
    el.appendChild(events);

    var titleInput = D.el("input", { type: "text", "class": "cal-title", placeholder: t("calendar.eventTitle") });
    var timeInput = D.el("input", { type: "time", "class": "cal-time" });
    var remindCb = D.el("input", { type: "checkbox", "class": "cal-remind-cb" });
    var addBtn = D.el("button", { "class": "cal-add-btn", text: t("common.add") });
    addBtn.addEventListener("click", function () {
      var ttl = titleInput.value.trim();
      if (!ttl) return;
      var tm = timeInput.value;
      var remindAt = remindCb.checked ? new Date(st.selected + "T" + (tm || "09:00")).getTime() : null;
      var id = ctx.schema.uid();
      ctx.commitCfg(function (c) {
        (c.events = c.events || []).push({ id: id, title: ttl, date: st.selected, time: tm, remindAt: remindAt, alarmName: ctx.reminders.nameFor("cal", id), note: "" });
      });
      if (remindAt) ctx.reminders.schedule("cal", id, remindAt);
    });
    el.appendChild(D.el("div", { "class": "cal-add" }, [titleInput, timeInput, D.el("label", { "class": "cal-remind" }, [remindCb, t("calendar.remind")]), addBtn]));
  }

  // cancel pending reminders before the instance is removed
  function onDelete(inst, ctx) { (inst.config.events || []).forEach(function (ev) { ctx.reminders.cancel("cal", ev.id); }); }

  function defaultConfig() { return { events: [], notifyHintDismissed: false }; }

  SD.registry.register({ id: "calendar", kind: "local", titleKey: "widget.calendar", order: 40, mount: mount, onDelete: onDelete, defaultConfig: defaultConfig });
})();
