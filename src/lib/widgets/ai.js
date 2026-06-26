// Layer: widget. AI assistant (local): a search-bar that opens a free AI chat with the query
// prefilled. Pure navigation — no API keys, no network from the extension. Remembers the last
// used provider. Submit with Enter or the chat icon in the input.
(function () {
  "use strict";
  // Order: DuckDuckGo first, then DeepSeek and Gemini, then the rest.
  var SERVICES = [
    ["DuckDuckGo", function (q) { return "https://duckduckgo.com/?ia=chat&q=" + q; }],
    ["DeepSeek", function () { return "https://chat.deepseek.com/"; }],
    ["Gemini", function () { return "https://gemini.google.com/app"; }],
    ["ChatGPT", function (q) { return "https://chatgpt.com/?q=" + q; }],
    ["Claude", function (q) { return "https://claude.ai/new?q=" + q; }],
    ["Perplexity", function (q) { return "https://www.perplexity.ai/search?q=" + q; }],
    ["HuggingChat", function (q) { return "https://huggingface.co/chat/?q=" + q; }]
  ];
  function urlFor(name, q) {
    var s = SERVICES.filter(function (x) { return x[0] === name; })[0];
    return s ? s[1](encodeURIComponent(q || "")) : "";
  }

  function mount(el, ctx) {
    var D = ctx.dom, t = ctx.i18n.t, cfg = ctx.cfg();
    D.clear(el);
    var bar = D.el("div", { "class": "ai-bar" });
    var sel = document.createElement("select");
    sel.className = "ai-provider";
    SERVICES.forEach(function (s) {
      var op = document.createElement("option");
      op.value = s[0]; op.textContent = s[0]; sel.appendChild(op);
    });
    sel.value = cfg.def || SERVICES[0][0];
    var wrap = D.el("div", { "class": "ai-input-wrap" });
    var input = document.createElement("input");
    input.type = "text"; input.className = "ai-input"; input.placeholder = t("ai.placeholder");
    var send = D.el("button", { "class": "ai-send", title: t("ai.go") });
    send.appendChild(D.svg("chat", 18));
    function run() {
      var url = urlFor(sel.value, input.value);
      if (!url) return;
      ctx.commitCfg(function (x) { x.def = sel.value; });
      window.location.assign(url);
    }
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") run(); });
    send.addEventListener("click", run);
    wrap.appendChild(input); wrap.appendChild(send);
    bar.appendChild(sel); bar.appendChild(wrap);
    el.appendChild(bar);
  }

  function defaultConfig() { return { def: "DuckDuckGo" }; }

  SD.registry.register({
    id: "ai", kind: "local", titleKey: "widget.ai", order: 25,
    mount: mount, defaultConfig: defaultConfig
  });
})();
