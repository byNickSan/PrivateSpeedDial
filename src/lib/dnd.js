// Drag-and-drop for dials: reorder within a group with a live insertion indicator, and drop a dial ONTO a
// folder to move it inside (the folder lights up). Mirrors the widget DnD's "show where it will land" feel.
(function () {
  "use strict";
  SD.dnd = (function () {
    var dragId = null, srcEl = null;
    function byOrder(a, b) { return a.order - b.order; }
    function clearMarks(grid) { grid.querySelectorAll(".drop-before, .drop-after, .folder-drop").forEach(function (x) { x.classList.remove("drop-before", "drop-after", "folder-drop"); }); }

    function attach(grid, state) {
      if (state.settings.lockDials || state.settings.locked) return;
      grid.querySelectorAll(".dial").forEach(function (el) {
        el.setAttribute("draggable", "true");
        el.addEventListener("dragstart", function (e) { dragId = el.getAttribute("data-id"); srcEl = el; e.dataTransfer.effectAllowed = "move"; setTimeout(function () { el.classList.add("dragging"); }, 0); });
        el.addEventListener("dragend", function () { clearMarks(grid); el.classList.remove("dragging"); dragId = null; srcEl = null; });
        el.addEventListener("dragover", function (e) {
          if (!dragId || el === srcEl) return;
          e.preventDefault(); clearMarks(grid);
          if (el.classList.contains("folder")) { el.classList.add("folder-drop"); return; }   // will drop INTO the folder
          var r = el.getBoundingClientRect();
          el.classList.add((e.clientX - r.left) > r.width / 2 ? "drop-after" : "drop-before");   // insertion side
        });
        el.addEventListener("dragleave", function () { el.classList.remove("drop-before", "drop-after", "folder-drop"); });
        el.addEventListener("drop", function (e) {
          e.preventDefault();
          var targetId = el.getAttribute("data-id"), isFolder = el.classList.contains("folder");
          var r = el.getBoundingClientRect(), after = (e.clientX - r.left) > r.width / 2;
          clearMarks(grid);
          if (!dragId || dragId === targetId) { dragId = null; return; }
          if (isFolder) moveIntoFolder(state, dragId, targetId);
          else reorder(state, dragId, targetId, after);
          dragId = null;
        });
      });
    }

    // Move `from` next to `to` (same parent/group as `to`), before or after it. Also pulls a dial OUT of a
    // folder when dropped onto a top-level dial.
    function reorder(state, fromId, toId, after) {
      SD.store.commit(function (s) {
        var from = s.dials.filter(function (d) { return d.id === fromId; })[0];
        var to = s.dials.filter(function (d) { return d.id === toId; })[0];
        if (!from || !to || fromId === toId) return;
        var parent = to.parentId || null;
        from.parentId = parent; from.groupId = to.groupId;
        var sibs = s.dials.filter(function (d) { return (d.parentId || null) === parent && d.groupId === to.groupId && d.id !== fromId; }).sort(byOrder);
        var idx = sibs.findIndex(function (d) { return d.id === toId; }); if (idx < 0) idx = sibs.length - 1;
        sibs.splice(after ? idx + 1 : idx, 0, from);
        sibs.forEach(function (d, i) { d.order = i; });
      });
    }

    function moveIntoFolder(state, fromId, folderId) {
      if (fromId === folderId) return;
      SD.store.commit(function (s) {
        var from = s.dials.filter(function (d) { return d.id === fromId; })[0];
        var folder = s.dials.filter(function (d) { return d.id === folderId; })[0];
        if (!from || !folder || folder.type !== "folder" || from.type === "folder") return;   // no nested folders
        from.parentId = folderId; from.groupId = folder.groupId;
        var kids = s.dials.filter(function (d) { return d.parentId === folderId && d.id !== fromId; }).sort(byOrder);
        kids.push(from); kids.forEach(function (d, i) { d.order = i; });
      });
    }

    return { attach: attach, reorder: reorder, moveIntoFolder: moveIntoFolder };
  })();
})();
