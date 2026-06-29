// Layer: widget. Tasks & reminders: local task list; reminders fire via alarms -> notifications (Safari: UI).
(function () {
  "use strict";

  function mount(el, ctx) {
    var t = ctx.i18n.t;
    el.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "tasks";

    var hint = ctx.reminders.hintNode(ctx); if (hint) wrap.appendChild(hint);

    var add = document.createElement("div");
    add.className = "task-add";
    var input = document.createElement("input");
    input.type = "text"; input.setAttribute("placeholder", t("tasks.placeholder"));
    var remindAt = null;
    var when = ctx.controls.dateTimeChip(null, function (v) { remindAt = v; });
    when.title = t("tasks.remindAt");
    var btn = document.createElement("button");
    btn.textContent = "+";
    btn.addEventListener("click", function () {
      var title = input.value.trim();
      if (!title) return;
      var id = ctx.schema.uid();
      ctx.commitCfg(function (c) {
        (c.items = c.items || []).push({ id: id, title: title, done: false, remindAt: remindAt, alarmName: ctx.reminders.nameFor("task", id), order: c.items.length });
      });
      if (remindAt) ctx.reminders.schedule("task", id, remindAt);
      input.value = "";
    });
    add.appendChild(input); add.appendChild(when); add.appendChild(btn);
    wrap.appendChild(add);

    var list = document.createElement("div");
    list.className = "task-list";
    (ctx.cfg().items || []).slice().sort(byOrder).forEach(function (task) { list.appendChild(row(task, ctx)); });
    wrap.appendChild(list);
    el.appendChild(wrap);
  }

  function byOrder(a, b) { return (a.order || 0) - (b.order || 0); }

  function row(task, ctx) {
    var el = document.createElement("div");
    el.className = "task" + (task.done ? " done" : "") + (overdue(task) ? " overdue" : "");
    var cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = !!task.done;
    cb.addEventListener("change", function () {
      ctx.commitCfg(function (c) { var x = find(c, task.id); if (x) x.done = cb.checked; });
      if (cb.checked) ctx.reminders.cancel("task", task.id);
      else if (task.remindAt) ctx.reminders.schedule("task", task.id, task.remindAt);
    });
    var span = document.createElement("span");
    span.className = "task-title"; span.textContent = task.title; span.title = task.title;
    var meta = ctx.controls.dateTimeChip(task.remindAt || null, function (v) {
      ctx.commitCfg(function (c) { var x = find(c, task.id); if (x) x.remindAt = v; });
      ctx.reminders.cancel("task", task.id);
      if (v) ctx.reminders.schedule("task", task.id, v);
    });
    meta.className = "task-when dt-chip";
    var del = document.createElement("button");
    del.className = "task-del"; del.textContent = "×";
    del.addEventListener("click", function () {
      ctx.reminders.cancel("task", task.id);
      ctx.commitCfg(function (c) { c.items = (c.items || []).filter(function (x) { return x.id !== task.id; }); });
    });
    el.appendChild(cb); el.appendChild(span); el.appendChild(meta); el.appendChild(del);
    return el;
  }

  function overdue(t) { return t.remindAt && !t.done && t.remindAt <= Date.now(); }
  function find(c, id) { return (c.items || []).filter(function (x) { return x.id === id; })[0]; }

  // cancel pending reminders before the instance is removed
  function onDelete(inst, ctx) { (inst.config.items || []).forEach(function (it) { ctx.reminders.cancel("task", it.id); }); }

  function defaultConfig() { return { items: [], notifyHintDismissed: false }; }

  SD.registry.register({ id: "tasks", kind: "local", titleKey: "widget.tasks", order: 30, mount: mount, onDelete: onDelete, defaultConfig: defaultConfig });
})();
