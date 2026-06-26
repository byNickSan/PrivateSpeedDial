// Country/region table: drives the Google News edition (gl/hl/ceid) and the UI language base.
// Flags are bundled SVGs (src/assets/flags/<code>.svg). UI base must be one of i18n SUPPORTED, else "en".
(function () {
  "use strict";
  // [code, name, uiBase, gnQuery]
  var DATA = [
    ["GB", "United Kingdom", "en", "hl=en-GB&gl=GB&ceid=GB:en"],
    ["IE", "Ireland", "en", "hl=en-IE&gl=IE&ceid=IE:en"],
    ["FR", "France", "fr", "hl=fr&gl=FR&ceid=FR:fr"],
    ["DE", "Germany", "de", "hl=de&gl=DE&ceid=DE:de"],
    ["AT", "Austria", "de", "hl=de&gl=AT&ceid=AT:de"],
    ["CH", "Switzerland", "de", "hl=de&gl=CH&ceid=CH:de"],
    ["ES", "Spain", "en", "hl=es&gl=ES&ceid=ES:es"],
    ["IT", "Italy", "en", "hl=it&gl=IT&ceid=IT:it"],
    ["PT", "Portugal", "en", "hl=pt-PT&gl=PT&ceid=PT:pt-150"],
    ["NL", "Netherlands", "en", "hl=nl&gl=NL&ceid=NL:nl"],
    ["BE", "Belgium", "fr", "hl=fr&gl=BE&ceid=BE:fr"],
    ["PL", "Poland", "en", "hl=pl&gl=PL&ceid=PL:pl"],
    ["CZ", "Czechia", "cs", "hl=cs&gl=CZ&ceid=CZ:cs"],
    ["SK", "Slovakia", "cs", "hl=sk&gl=SK&ceid=SK:sk"],
    ["HU", "Hungary", "en", "hl=hu&gl=HU&ceid=HU:hu"],
    ["RO", "Romania", "en", "hl=ro&gl=RO&ceid=RO:ro"],
    ["BG", "Bulgaria", "en", "hl=bg&gl=BG&ceid=BG:bg"],
    ["GR", "Greece", "en", "hl=el&gl=GR&ceid=GR:el"],
    ["SE", "Sweden", "en", "hl=sv&gl=SE&ceid=SE:sv"],
    ["NO", "Norway", "en", "hl=no&gl=NO&ceid=NO:no"],
    ["DK", "Denmark", "en", "hl=da&gl=DK&ceid=DK:da"],
    ["FI", "Finland", "en", "hl=fi-FI&gl=FI&ceid=FI:fi"],
    ["IS", "Iceland", "en", "hl=is&gl=IS&ceid=IS:is"],
    ["UA", "Ukraine", "ru", "hl=uk&gl=UA&ceid=UA:uk"],
    ["RU", "Russia", "ru", "hl=ru&gl=RU&ceid=RU:ru"],
    ["BY", "Belarus", "ru", "hl=ru&gl=BY&ceid=BY:ru"],
    ["RS", "Serbia", "en", "hl=sr&gl=RS&ceid=RS:sr"],
    ["HR", "Croatia", "en", "hl=hr&gl=HR&ceid=HR:hr"],
    ["SI", "Slovenia", "en", "hl=sl&gl=SI&ceid=SI:sl"],
    ["LT", "Lithuania", "en", "hl=lt&gl=LT&ceid=LT:lt"],
    ["LV", "Latvia", "en", "hl=lv&gl=LV&ceid=LV:lv"],
    ["EE", "Estonia", "en", "hl=et-EE&gl=EE&ceid=EE:et"],
    ["LU", "Luxembourg", "fr", "hl=fr&gl=LU&ceid=LU:fr"],
    ["US", "United States", "en", "hl=en-US&gl=US&ceid=US:en"],
    ["CA", "Canada", "en", "hl=en-CA&gl=CA&ceid=CA:en"],
    ["AU", "Australia", "en", "hl=en-AU&gl=AU&ceid=AU:en"],
    ["NZ", "New Zealand", "en", "hl=en-NZ&gl=NZ&ceid=NZ:en"],
    ["PH", "Philippines", "en", "hl=en-PH&gl=PH&ceid=PH:en"],
    ["IN", "India", "en", "hl=en-IN&gl=IN&ceid=IN:en"],
    ["JP", "Japan", "en", "hl=ja&gl=JP&ceid=JP:ja"],
    ["BR", "Brazil", "en", "hl=pt-BR&gl=BR&ceid=BR:pt-419"],
    ["MX", "Mexico", "en", "hl=es-419&gl=MX&ceid=MX:es-419"],
    ["AR", "Argentina", "en", "hl=es-419&gl=AR&ceid=AR:es-419"],
    ["ZA", "South Africa", "en", "hl=en-ZA&gl=ZA&ceid=ZA:en"],
    ["SG", "Singapore", "en", "hl=en-SG&gl=SG&ceid=SG:en"],
    ["HK", "Hong Kong", "en", "hl=zh-HK&gl=HK&ceid=HK:zh-Hant"],
    ["KR", "South Korea", "en", "hl=ko&gl=KR&ceid=KR:ko"],
    ["TR", "Turkey", "en", "hl=tr&gl=TR&ceid=TR:tr"],
    ["IL", "Israel", "en", "hl=he&gl=IL&ceid=IL:he"],
    ["AE", "United Arab Emirates", "en", "hl=ar&gl=AE&ceid=AE:ar"],
    ["SA", "Saudi Arabia", "en", "hl=ar&gl=SA&ceid=SA:ar"],
    ["EG", "Egypt", "en", "hl=ar&gl=EG&ceid=EG:ar"]
  ];
  var BYCODE = {};
  var LIST = DATA.map(function (r) { var o = { code: r[0], name: r[1], ui: r[2], gn: r[3] }; BYCODE[r[0]] = o; return o; })
    .sort(function (a, b) { return a.name < b.name ? -1 : 1; });
  // language -> default country when the browser tag carries no usable region
  var LANG_DEFAULT = { en: "US", ru: "RU", cs: "CZ", fr: "FR", de: "DE" };

  function byCode(code) { return BYCODE[(code || "").toUpperCase()] || null; }

  // Auto-detect from the browser UI language / navigator.language.
  function detect() {
    var tag = "";
    try { tag = (SD.api.i18n && SD.api.i18n.getUILanguage && SD.api.i18n.getUILanguage()) || navigator.language || ""; } catch (e) { tag = navigator.language || ""; }
    var parts = String(tag).split("-");
    var base = (parts[0] || "en").toLowerCase();
    var region = (parts[1] || "").toUpperCase();
    if (region && BYCODE[region]) return region;
    if (LANG_DEFAULT[base]) return LANG_DEFAULT[base];
    return "US";
  }

  function resolve(stored) { return (stored && BYCODE[stored.toUpperCase()]) ? stored.toUpperCase() : detect(); }
  function flagUrl(code) { try { return SD.api.runtime.getURL("src/assets/flags/" + (code || "").toLowerCase() + ".svg"); } catch (e) { return ""; } }

  function flagImg(code) { var i = document.createElement("img"); i.className = "lang-flag"; i.alt = ""; i.loading = "lazy"; i.src = flagUrl(code); return i; }

  // Reusable flag dropdown: a button that opens a searchable modal; onPick(code) gets "" for Auto.
  function pickerButton(code, onPick) {
    var eff = resolve(code), r = byCode(eff), auto = !code;
    var b = document.createElement("button"); b.className = "lang-btn";
    b.appendChild(flagImg(eff));
    var nm = document.createElement("span"); nm.className = "lang-btn-name"; nm.textContent = (auto ? "Auto · " : "") + (r ? r.name : eff); b.appendChild(nm);
    var car = document.createElement("span"); car.className = "lang-caret"; car.textContent = "▾"; b.appendChild(car);
    b.addEventListener("click", function () {
      var menu = document.createElement("div"); menu.className = "lang-menu";
      var filter = document.createElement("input"); filter.type = "text"; filter.className = "lang-filter";
      filter.placeholder = (SD.i18n && SD.i18n.t) ? SD.i18n.t("search.placeholder") : "Search";
      var listWrap = document.createElement("div"); listWrap.className = "lang-list";
      menu.appendChild(filter); menu.appendChild(listWrap);
      var close = SD.ui.openModal(menu);
      function rowFor(c, name, isAuto) {
        var row = document.createElement("button"); row.className = "lang-row";
        row.appendChild(flagImg(isAuto ? detect() : c));
        var n = document.createElement("span"); n.textContent = name; row.appendChild(n);
        row.addEventListener("click", function () { close(); onPick(isAuto ? "" : c); });
        return row;
      }
      function draw(q) {
        listWrap.textContent = ""; q = (q || "").toLowerCase().trim();
        var det = byCode(detect());
        if (!q || "auto".indexOf(q) >= 0) listWrap.appendChild(rowFor("", "Auto · " + (det ? det.name : ""), true));
        LIST.forEach(function (x) { if (!q || x.name.toLowerCase().indexOf(q) >= 0 || x.code.toLowerCase().indexOf(q) >= 0) listWrap.appendChild(rowFor(x.code, x.name)); });
      }
      filter.addEventListener("input", function () { draw(filter.value); });
      draw(""); setTimeout(function () { filter.focus(); }, 30);
    });
    return b;
  }

  var currentCode = "US";
  SD.regions = {
    flagImg: flagImg,
    pickerButton: pickerButton,
    LIST: LIST,
    byCode: byCode,
    detect: detect,
    resolve: resolve,
    flagUrl: flagUrl,
    setCurrent: function (code) { currentCode = byCode(code) ? code.toUpperCase() : detect(); },
    current: function () { return currentCode; },
    ui: function (code) { var r = byCode(code); return r ? r.ui : "en"; },
    gn: function (code) { var r = byCode(code) || byCode(currentCode); return r ? r.gn : "hl=en-US&gl=US&ceid=US:en"; }
  };
})();
