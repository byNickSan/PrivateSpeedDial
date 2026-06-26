// Layer: platform. Cross-browser WebExtension API shim + small resilience helpers.
// chrome.* returns promises in MV3 Chrome; browser.* is native in Firefox/Safari — a thin alias suffices.
(function () {
  "use strict";
  window.SD = window.SD || {};
  SD.api = globalThis.browser || globalThis.chrome;

  SD.has = function (path) {
    return path.split(".").reduce(function (o, k) {
      return o && o[k];
    }, SD.api) != null;
  };

  // Diagnostic log: a ring buffer of recent errors/warnings to surface problems during testing.
  // In the new-tab console: SD.diag.dump() prints the table, SD.diag.clear() empties it.
  SD.diag = (function () {
    var buf = [], MAX = 200;
    function str(a) { if (a instanceof Error) return a.message + (a.stack ? " | " + a.stack.split("\n")[1] : ""); if (a && typeof a === "object") { try { return JSON.stringify(a); } catch (e) { return String(a); } } return String(a); }
    function record(level, parts) {
      var msg = (parts || []).map(str).join(" ");
      buf.push({ t: Date.now(), level: level, msg: msg });
      if (buf.length > MAX) buf.shift();
      if (level === "error" || level === "reject") console.error("[diag] " + msg);
    }
    return {
      record: record,
      list: function () { return buf.slice(); },
      clear: function () { buf.length = 0; },
      dump: function () { try { console.table(buf.map(function (e) { return { time: new Date(e.t).toLocaleTimeString(), level: e.level, msg: e.msg.slice(0, 240) }; })); } catch (x) { console.log(buf); } return buf.length; }
    };
  })();
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("error", function (e) { SD.diag.record("error", [e.message, (e.filename || "") + ":" + (e.lineno || 0)]); });
    window.addEventListener("unhandledrejection", function (e) { SD.diag.record("reject", [e.reason]); });
  }

  // Error boundary: on throw, log and return fallback (keeps the page alive).
  SD.safe = function (label, fn, fallback) {
    try {
      return fn();
    } catch (e) {
      console.warn("[speed-dial] " + label + ":", e);
      SD.diag.record("warn", [label, e]);
      return fallback;
    }
  };

  // Async error boundary; resolves to fallback on rejection.
  SD.safeAsync = async function (label, fn, fallback) {
    try {
      return await fn();
    } catch (e) {
      console.warn("[speed-dial] " + label + ":", e);
      SD.diag.record("warn", [label, e]);
      return fallback;
    }
  };
})();
