// Drag-and-drop reordering of dials within the active group.
(function () {
  "use strict";
  SD.dnd = (function () {
    var dragId = null;

    function attach(grid, state) {
      if (state.settings.lockDials || state.settings.locked) return;
      grid.querySelectorAll(".dial").forEach(function (el) {
        el.setAttribute("draggable", "true");
        el.addEventListener("dragstart", function (e) {
          dragId = el.getAttribute("data-id");
          e.dataTransfer.effectAllowed = "move";
        });
        el.addEventListener("dragover", function (e) { e.preventDefault(); el.classList.add("drop-target"); });
        el.addEventListener("dragleave", function () { el.classList.remove("drop-target"); });
        el.addEventListener("drop", function (e) {
          e.preventDefault();
          el.classList.remove("drop-target");
          var targetId = el.getAttribute("data-id");
          if (!dragId || dragId === targetId) return;
          reorder(state, dragId, targetId);
          dragId = null;
        });
      });
    }

    function reorder(state, fromId, toId) {
      SD.store.commit(function (s) {
        var gid = s.settings.activeGroupId;
        var group = s.dials.filter(function (d) { return d.groupId === gid && !d.parentId; }).sort(function (a, b) { return a.order - b.order; });
        var from = group.filter(function (d) { return d.id === fromId; })[0];
        var toIdx = group.findIndex(function (d) { return d.id === toId; });
        if (!from || toIdx < 0) return;
        group = group.filter(function (d) { return d.id !== fromId; });
        group.splice(toIdx, 0, from);
        group.forEach(function (d, i) { d.order = i; });
      });
    }

    return { attach: attach, reorder: reorder };
  })();
})();
