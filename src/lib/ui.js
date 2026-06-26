// Lightweight UI helpers: modal host, toast, and the privacy-consent dialog.
(function () {
  "use strict";
  SD.ui = (function () {
    // Returns a close function.
    function openModal(node) {
      var root = document.getElementById("modal-root");
      var overlay = document.createElement("div");
      overlay.className = "modal open";
      var box = document.createElement("div");
      box.className = "modal-box";
      box.appendChild(node);
      overlay.appendChild(box);
      overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
      root.appendChild(overlay);
      function onKey(e) { if (e.key === "Escape") { e.preventDefault(); close(); } }
      document.addEventListener("keydown", onKey);
      function close() { overlay.remove(); document.removeEventListener("keydown", onKey); }
      return close;
    }

    function toast(msg) {
      var t = document.createElement("div");
      t.className = "toast";
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(function () { t.classList.add("show"); }, 10);
      setTimeout(function () { t.classList.remove("show"); setTimeout(function () { t.remove(); }, 300); }, 3200);
    }

    // Privacy notice for a network feature; resolves true on confirm.
    function privacyConsent(domain, dataText) {
      return new Promise(function (resolve) {
        var node = document.createElement("div");
        node.className = "consent";
        var body = SD.i18n.t("privacy.body", { DOMAIN: domain || "?", DATA: dataText || "?" });
        var cancel = SD.dom.el("button", { class: "btn ghost", text: SD.i18n.t("privacy.cancel") });
        var ok = SD.dom.el("button", { class: "btn primary", text: SD.i18n.t("privacy.understand") });
        node.appendChild(SD.dom.el("h3", { text: SD.i18n.t("privacy.title") }));
        node.appendChild(SD.dom.el("p", { class: "consent-body", text: body }));
        node.appendChild(SD.dom.el("div", { class: "row end" }, [cancel, ok]));
        var close = openModal(node);
        cancel.addEventListener("click", function () { close(); resolve(false); });
        ok.addEventListener("click", function () { close(); resolve(true); });
      });
    }

    return { openModal: openModal, toast: toast, privacyConsent: privacyConsent };
  })();
})();
