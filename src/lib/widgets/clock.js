// Layer: widget. Clock: analog (iOS SVG), digital, Mechanic split-flap, and Nixie-tube faces
// per city. Local only (Intl), no network. Optional per-clock card background/border so adjacent
// clocks don't merge.
(function () {
  "use strict";
  var ticking = false, poisoning = false, tickTimer = null, visWired = false;

  function parts(tz) {
    var opt = { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" };
    if (tz) opt.timeZone = tz;
    var p = new Intl.DateTimeFormat("en-GB", opt).formatToParts(new Date());
    var o = {};
    p.forEach(function (x) { if (x.type !== "literal") o[x.type] = parseInt(x.value, 10); });
    return { h: o.hour % 24, m: o.minute, s: o.second };
  }

  function svgEl(tag, attrs) {
    var n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function analogNode() {
    var s = svgEl("svg", { viewBox: "0 0 100 100", "class": "an" });
    s.appendChild(svgEl("circle", { cx: 50, cy: 50, r: 48, "class": "an-face" }));
    s.appendChild(svgEl("line", { x1: 50, y1: 50, x2: 50, y2: 26, "class": "an-h hand-h" }));
    s.appendChild(svgEl("line", { x1: 50, y1: 50, x2: 50, y2: 18, "class": "an-m hand-m" }));
    s.appendChild(svgEl("line", { x1: 50, y1: 50, x2: 50, y2: 14, "class": "an-s hand-s" }));
    s.appendChild(svgEl("circle", { cx: 50, cy: 50, r: 3, "class": "an-pin" }));
    return s;
  }
  // iOS-18-style analog face: minute ticks (hour ticks bolder) + numerals 1–12 + slim hands.
  function analogNumNode() {
    var s = svgEl("svg", { viewBox: "0 0 100 100", "class": "an an-ios" });
    s.appendChild(svgEl("circle", { cx: 50, cy: 50, r: 48, "class": "an-face" }));
    var i, a, x1, y1, x2, y2;
    for (i = 0; i < 60; i++) {
      a = i * 6 * Math.PI / 180;
      var hour = i % 5 === 0, r1 = 47, r2 = hour ? 41 : 44.5;
      x1 = 50 + r1 * Math.sin(a); y1 = 50 - r1 * Math.cos(a); x2 = 50 + r2 * Math.sin(a); y2 = 50 - r2 * Math.cos(a);
      s.appendChild(svgEl("line", { x1: x1.toFixed(2), y1: y1.toFixed(2), x2: x2.toFixed(2), y2: y2.toFixed(2), "class": "an-tick" + (hour ? " an-tick-h" : "") }));
    }
    for (i = 1; i <= 12; i++) {
      a = i * 30 * Math.PI / 180;
      var nx = 50 + 33 * Math.sin(a), ny = 50 - 33 * Math.cos(a);
      var tx = svgEl("text", { x: nx.toFixed(2), y: ny.toFixed(2), "class": "an-num" });
      tx.textContent = String(i);
      s.appendChild(tx);
    }
    s.appendChild(svgEl("line", { x1: 50, y1: 50, x2: 50, y2: 29, "class": "an-h hand-h" }));
    s.appendChild(svgEl("line", { x1: 50, y1: 50, x2: 50, y2: 20, "class": "an-m hand-m" }));
    s.appendChild(svgEl("line", { x1: 50, y1: 56, x2: 50, y2: 16, "class": "an-s hand-s" }));
    s.appendChild(svgEl("circle", { cx: 50, cy: 50, r: 2.6, "class": "an-pin" }));
    return s;
  }
  function flipHalf(kind) { var h = document.createElement("div"); h.className = "fh " + kind; var d = document.createElement("div"); d.className = "d"; h.appendChild(d); return h; }
  function flipNode(showSeconds, mech) {
    var wrap = document.createElement("div"); wrap.className = "flip-clock";
    if (mech && mech !== "auto") wrap.setAttribute("data-mech", mech);   // overrides the page theme
    function unit(cls) { var u = document.createElement("div"); u.className = "flip-unit " + cls; u.appendChild(flipHalf("top")); u.appendChild(flipHalf("bot")); return u; }
    function sep() { var s = document.createElement("span"); s.className = "flip-sep"; s.textContent = ":"; return s; }
    wrap.appendChild(unit("fu-h")); wrap.appendChild(sep()); wrap.appendChild(unit("fu-m"));
    if (showSeconds) { wrap.appendChild(sep()); wrap.appendChild(unit("fu-s")); }
    return wrap;
  }

  function mount(el, ctx) {
    var w = ctx.cfg(), D = ctx.dom;
    poisoning = false;   // a rebuild clears any stuck anti-poison state
    D.clear(el);
    var grid = D.el("div", { "class": "clock-grid" });
    (w.cities || []).forEach(function (c) {
      var cs = c.style || w.style;   // per-clock style override, else the widget default
      var fs = Math.max(1, Math.min(5, c.mechFlipSpeed || w.mechFlipSpeed || 5));   // 5 = fastest (current), 1 = 5× slower
      var fc = "clock-face" + (w.cardBg ? " has-bg" : "") + (w.cardBorder ? " has-border" : "");
      var face = D.el("div", { "class": fc, "data-tz": c.timeZone || "", "data-sec": w.showSeconds ? "1" : "0", "data-24": w.format24 ? "1" : "0", "data-style": cs, "data-flipms": String(130 * (6 - fs)) });
      if (cs === "analog-ios") face.appendChild(analogNode());
      else if (cs === "analog-num") face.appendChild(analogNumNode());
      else if (cs === "htc-flip") face.appendChild(flipNode(w.showSeconds, c.mechTheme || w.mechTheme));
      else if (cs === "nixie") face.appendChild(D.el("div", { "class": "nixie", "data-sweep": w.nixieSweep === false ? "0" : "1" }));
      else face.appendChild(D.el("div", { "class": "dig", "data-style": c.digitalStyle || w.digitalStyle || "plain" }));
      var label = D.el("div", { "class": "clock-label", "data-lstyle": w.cityLabelStyle || "normal", text: c.label || "" });
      if (w.cityLabelSize) label.style.fontSize = w.cityLabelSize + "px";
      face.appendChild(label);
      grid.appendChild(face);
    });
    el.appendChild(grid);
    ensureTicking();
    // Fill the just-created faces directly (the widget isn't in the document yet, so a global query
    // would miss them) — this gives nixie/digital their real width/height immediately, no late reflow.
    grid.querySelectorAll(".clock-face").forEach(updateFace);
  }

  function nixieString(face) {
    var t = parts(face.getAttribute("data-tz"));
    var h24 = face.getAttribute("data-24") === "1", secs = face.getAttribute("data-sec") === "1";
    var nh = h24 ? t.h : (t.h % 12 || 12);   // nixie shows digits/colon only — no AM/PM
    return pad(nh) + ":" + pad(t.m) + (secs ? ":" + pad(t.s) : "");
  }
  function updateFace(face) {
    var style = face.getAttribute("data-style");
    var t = parts(face.getAttribute("data-tz"));
    var h24 = face.getAttribute("data-24") === "1", secs = face.getAttribute("data-sec") === "1";
    if (style === "analog-ios" || style === "analog-num") {
      var hH = face.querySelector(".hand-h"), hM = face.querySelector(".hand-m"), hS = face.querySelector(".hand-s");
      if (hH) hH.style.transform = "rotate(" + ((t.h % 12) * 30 + t.m * 0.5) + "deg)";
      if (hM) hM.style.transform = "rotate(" + (t.m * 6 + t.s * 0.1) + "deg)";
      if (hS) { hS.style.display = secs ? "" : "none"; hS.style.transform = "rotate(" + (t.s * 6) + "deg)"; }
    } else if (style === "htc-flip") {
      var h = t.h; if (!h24) h = h % 12 || 12;
      flipUnit(face.querySelector(".fu-h"), pad(h));
      flipUnit(face.querySelector(".fu-m"), pad(t.m));
      if (secs) flipUnit(face.querySelector(".fu-s"), pad(t.s));
    } else if (style === "nixie") {
      var nx = face.querySelector(".nixie"), str = nixieString(face);
      if (poisoning) {
        // HH:MM tubes are mid sweep; the seconds keep ticking LIVE (animated melt) so the clock runs.
        if (secs && nx.childNodes.length === str.length) for (var k = str.length - 2; k < str.length; k++) { if (str[k] !== ":") setNixieDigit(nx.childNodes[k], str[k], true); }
      } else setNixie(nx, str);
    } else {
      var dig = face.querySelector(".dig");
      if (dig) dig.textContent = format(t, h24, secs);
    }
  }

  function updateAll() { document.querySelectorAll(".clock-face").forEach(updateFace); }

  function format(t, h24, secs) {
    var h = t.h, ap = "";
    if (!h24) { ap = h >= 12 ? " PM" : " AM"; h = h % 12 || 12; }
    return pad(h) + ":" + pad(t.m) + (secs ? ":" + pad(t.s) : "") + ap;
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function flipFlap(kind, digit) { var h = document.createElement("div"); h.className = "fh " + kind + " flip-flap"; var d = document.createElement("div"); d.className = "d"; d.textContent = digit; h.appendChild(d); return h; }
  // Real split-flap: the top half of the OLD digit falls forward/down on the centre hinge, then a
  // new flap carrying the NEW digit's bottom half drops into place. Top static shows the new digit
  // immediately (revealed behind the falling flap); bottom static updates when the drop lands.
  function flipUnit(el, val) {
    if (!el) return;
    var topD = el.querySelector(".fh.top > .d"), botD = el.querySelector(".fh.bot > .d");
    if (!topD || !botD) return;
    var old = topD.textContent;
    if (old === val) return;
    if (!old || !el.animate) { topD.textContent = val; botD.textContent = val; return; }   // first paint / no WAAPI
    topD.textContent = val;
    var face = el.closest(".clock-face"), ms = (face && +face.getAttribute("data-flipms")) || 130;
    var up = flipFlap("top", old); el.appendChild(up);
    up.animate([{ transform: "rotateX(0deg)" }, { transform: "rotateX(-90deg)" }], { duration: ms, easing: "ease-in" }).onfinish = function () {
      up.remove();
      var dn = flipFlap("bot", val); el.appendChild(dn);
      dn.animate([{ transform: "rotateX(90deg)" }, { transform: "rotateX(0deg)" }], { duration: ms, easing: "ease-out" }).onfinish = function () { botD.textContent = val; if (dn.parentNode) dn.remove(); };
    };
  }

  // Nixie numerals: my own vector glyphs drawn from a photo of physical nixie tubes (historical
  // cathode shapes; "1" is a bare vertical bar, "2" has a flat base). Even height + baseline.
  var NXG = {
    "0": { vb: "31 61 20 29", d: "M39.96035,62.00874c10.69922,-0.42964 11.18687,16.24702 7.14727,22.78916c-1.31133,2.12358 -2.80913,3.12671 -5.19038,3.67983c-5.32881,0.58066 -8.64961,-3.89502 -9.44385,-8.68184c-1.05718,-6.37104 -0.38936,-16.23999 7.48696,-17.78716z M39.50376,63.01597c4.09087,-0.6019 6.82881,2.13062 7.92349,5.79521c1.65469,5.53916 1.68237,16.44155 -5.13574,18.63442c-1.43247,0.15337 -3.11514,0.19307 -4.38618,-0.51841c-2.0707,-1.18228 -3.496,-3.62798 -4.05762,-5.88809c-1.36523,-5.49492 -1.26284,-16.18784 5.65605,-18.02314z" },
    "1": { vb: "58 60 4 30", d: "M59.83037,61.84233c0.31802,0.09053 0.36958,0.12495 0.66006,0.28916c0.15264,0.61553 0.08862,6.20142 0.08848,7.28013l-0.00396,18.99609c-0.329,0.08555 -0.3728,0.06416 -0.71748,0.01802c-0.25034,-0.33589 -0.39888,-24.72524 -0.0271,-26.5834z" },
    "2": { vb: "69 61 18 29", d: "M78.27261,62.1728c4.24512,-0.04087 7.45605,2.36147 7.41152,6.88989c-0.05801,5.91724 -7.38237,8.31255 -10.91074,11.91284c-2.03848,2.07979 -2.68608,3.38027 -2.7271,6.38159c1.90781,0.00029 12.53643,-0.15205 13.60693,0.41499l-0.16436,0.20859c-2.05708,0.7894 -9.65757,0.36504 -12.35654,0.35464l-2.17324,-0.01201c-0.77607,-10.12939 10.0106,-10.03989 13.29873,-17.325c1.25039,-5.22568 -1.69966,-8.50313 -7.05,-7.80981c-4.25259,0.55093 -4.49561,5.12476 -5.67817,5.78086l-0.26001,-0.0772c-0.38394,-1.32334 0.92563,-3.43857 1.78477,-4.43892c1.43188,-1.66743 3.11763,-2.14028 5.21821,-2.28047z" },
    "3": { vb: "95 61 19 29", d: "M98.12783,62.16152c3.75439,-0.07617 10.05381,-0.1415 13.64912,0.21519c-2.60918,3.42275 -6.24375,7.11914 -8.59028,10.49678c0.33135,0.07793 0.79541,0.16934 1.13159,0.2124c4.70112,0.60308 8.45566,3.50054 7.69482,8.75962c-0.26982,1.96392 -1.32466,3.73447 -2.92324,4.90708c-4.25127,3.12905 -9.33823,1.67417 -12.33325,-2.43105c-0.24038,-0.41411 -0.4207,-0.86719 -0.21489,-1.32905l0.22485,-0.06343c0.33955,0.09653 0.97368,0.9438 1.19297,1.27251c2.37012,3.55371 7.38384,4.25771 10.75972,1.70845c2.63247,-1.98794 3.1686,-6.71074 0.9356,-9.27979c-2.18818,-2.51777 -5.56831,-2.52891 -8.62954,-2.78467c2.28896,-3.34907 6.16099,-7.05146 8.68447,-10.6166c-3.11001,-0.3394 -8.0521,-0.04175 -11.26582,-0.40635c-0.15557,-0.01758 -0.24287,-0.44062 -0.31611,-0.66108z" },
    "4": { vb: "-1.35 -0.05 17.71 28.09", sw: "1.28", d: "M12,2L12,26M12,2L1,19L14,19" },
    "6": { vb: "-2.16 -0.05 18.32 28.09", sw: "1.28", tf: "rotate(180 7 14)", d: "M0.5,8.5a6.5,6.5 0 1,1 13,0a6.5,6.5 0 1,1 -13,0M13.1,10.7L7,26" },
    "7": { vb: "-0.12 1.12 16.23 25.75", sw: "1.18", d: "M2,3L14,3L8,25" },
    "8": { vb: "224 60 19 30", d: "M232.44434,61.87441c0.94336,-0.06431 2.39209,-0.03618 3.30176,0.19937c1.60547,0.39976 2.98535,1.42427 3.83203,2.84604c1.94678,3.32314 0.39844,7.26284 -2.86377,9.12437c0.58447,0.31099 1.32715,0.69316 1.875,1.04546c1.64795,1.05059 2.80371,2.71978 3.20801,4.63184c0.3501,1.79941 -0.02637,3.66431 -1.04443,5.18818c-1.41064,2.12285 -3.56543,2.91914 -5.93408,3.38364c-3.42041,0.26426 -6.98145,-0.82544 -8.62061,-4.12207c-0.84229,-1.68442 -0.9668,-3.63838 -0.3457,-5.41611c0.9082,-2.60742 2.57959,-3.57349 4.85449,-4.69731c-0.41309,-0.23115 -1.09863,-0.61465 -1.43408,-0.90659c-4.12793,-3.57949 -2.40674,-10.58877 3.17139,-11.27681z M232.40479,74.74819c1.94238,-0.12305 3.33105,-0.16392 5.18701,0.81167c3.11719,1.63755 4.18066,5.5481 2.46533,8.59087c-0.95361,1.69014 -2.78467,2.66309 -4.65674,3.14414c-2.39502,0.06387 -4.0708,0.22998 -6.24756,-1.22593c-2.81543,-1.85215 -3.56543,-5.94214 -1.52637,-8.64082c1.27441,-1.68706 2.76123,-2.37656 4.77832,-2.67993z M232.1792,62.75698c2.98828,-0.8502 6.09668,0.89253 6.93164,3.88506c0.8335,2.99253 -0.92578,6.09243 -3.92285,6.91055c-2.97363,0.81196 -6.04541,-0.93135 -6.87305,-3.90117c-0.82764,-2.96982 0.89941,-6.05054 3.86426,-6.89443z" },
    "9": { vb: "-2.16 -0.05 18.32 28.09", sw: "1.28", d: "M0.5,8.5a6.5,6.5 0 1,1 13,0a6.5,6.5 0 1,1 -13,0M13.1,10.7L7,26" }
  };
  NXG["5"] = { vb: "146 60 19 29", d: "M152.09473,61.97212c2.08594,0.00322 9.29883,-0.29912 10.78857,0.41426l-0.04834,0.14575c-2.74365,0.59517 -6.97266,0.05859 -9.91553,0.48149c-0.6709,2.63921 -1.42529,7.15679 -1.69922,9.8439c1.8252,-0.6063 3.4292,-1.08662 5.37305,-0.92959c4.5498,0.36738 7.08545,4.49136 6.70898,8.746c-0.17578,2.2084 -1.23486,4.25273 -2.93701,5.67114c-2.53564,2.08286 -4.57764,1.79414 -7.67578,1.48359c-1.67432,-0.62783 -5.53711,-3.14912 -4.95703,-5.1646c1.23779,0.08745 4.14404,7.00737 10.70068,3.78867c1.6377,-0.796 2.88721,-2.21543 3.46875,-3.94028c2.17676,-6.47593 -3.65479,-12.0665 -9.99316,-8.82466c-0.67236,0.34365 -1.30225,0.75938 -1.98633,1.11548c0.37207,-3.36021 1.46338,-9.548 2.17236,-12.83115z" };
  var NXG_ARCHIVE = { "5": { vb: NXG["2"].vb, d: NXG["2"].d, tf: "rotate(180 78 75.5)" } };
  void NXG_ARCHIVE;
  var NX_STACK = ["3", "8", "9", "4", "0", "5", "7", "2", "6", "1"];   // cathode depth order, far → near
  function glyphSvg(ch, cls) {
    var g = NXG[ch] || NXG["8"];
    var sv = svgEl("svg", { viewBox: g.vb, "class": cls || "nx-svg", preserveAspectRatio: "xMidYMid meet" });
    var pa = g.sw
      ? { d: g.d, fill: "none", stroke: "currentColor", "stroke-width": g.sw, "stroke-linejoin": "miter", "stroke-miterlimit": "6", "stroke-linecap": "round" }
      : { d: g.d, fill: "currentColor", "fill-rule": "evenodd", stroke: "currentColor", "stroke-width": "0.45", "stroke-linejoin": "round", "stroke-linecap": "round" };
    if (g.tf) pa.transform = g.tf;
    sv.appendChild(svgEl("path", pa));
    return sv;
  }
  function nixieDigit(ch) {
    var s = document.createElement("span");
    if (ch === ":") {   // colon = two small round lamps stacked, vertically centred (no tube/mesh/gloss)
      s.className = "nx-colon";
      var dot1 = document.createElement("span"); dot1.className = "nx-dot";
      var dot2 = document.createElement("span"); dot2.className = "nx-dot";
      s.appendChild(dot1); s.appendChild(dot2);
      return s;
    }
    s.className = "nx"; s.setAttribute("data-v", ch);
    // Real nixie cathode depth order (far → near): 3,8,9,4,0,5,7,2,6,1. Unlit back cathodes sit a bit
    // smaller the deeper they are (perspective); the lit digit stays full size.
    NX_STACK.forEach(function (k, idx) {
      var gh = glyphSvg(k, "nx-svg nx-ghost");
      var sc = 0.8 + (idx / (NX_STACK.length - 1)) * 0.16;
      gh.style.transformOrigin = "center"; gh.style.transform = "scale(" + sc.toFixed(3) + ")";
      s.appendChild(gh);
    });
    var g = document.createElement("span"); g.className = "nx-g"; g.appendChild(glyphSvg(ch)); s.appendChild(g);
    return s;
  }
  // New digit lights up while the previous one fades out behind it (true crossfade). Used for both
  // normal ticks and the anti-poison sweep, so the sweep has the same smooth lamp transition.
  function crossfade(sp, ch, fadeIn, fadeOut) {
    var old = sp.querySelector(".nx-g:last-child");
    var fresh = document.createElement("span"); fresh.className = "nx-g"; fresh.appendChild(glyphSvg(ch));
    sp.appendChild(fresh);
    if (sp.animate) {
      fresh.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fadeIn, easing: "ease-in-out", fill: "forwards" });
      if (old) old.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.08)" }], { duration: fadeOut, easing: "ease-in-out", fill: "forwards" }).onfinish = function () { if (old.parentNode) old.remove(); };
    } else if (old) { old.remove(); }
  }
  function setNixieDigit(sp, ch, animate) {
    if (sp.getAttribute("data-v") === ch) return;
    sp.setAttribute("data-v", ch);
    if (animate) crossfade(sp, ch, 430, 430);
    else { var g = sp.querySelector(".nx-g:last-child"); if (g) g.replaceChildren(glyphSvg(ch)); }
  }
  function setNixie(nx, str) {
    if (!nx) return;
    if (nx.childNodes.length !== str.length) {
      nx.replaceChildren();
      for (var i = 0; i < str.length; i++) nx.appendChild(nixieDigit(str[i]));
      return;
    }
    for (var j = 0; j < str.length; j++) { if (str[j] !== ":") setNixieDigit(nx.childNodes[j], str[j], true); }
  }
  // One tube cycles 0→9 `sweeps` times, then settles on getReal() — the LIVE digit at the moment the
  // animation finishes (so it ends on the correct current value, not the one captured at the start).
  function sweepTube(sp, sweeps, getReal, done) {
    var n = 0, total = sweeps * 10;
    var iv = setInterval(function () {
      crossfade(sp, NX_STACK[n % 10], 70, 75);   // cycle in the real cathode-stack order, not 0-9
      if (++n >= total) { clearInterval(iv); var real = getReal(); sp.setAttribute("data-v", real); crossfade(sp, real, 80, 100); done(); }
    }, 65);
  }
  // Anti-cathode-poisoning: every digit tube does 3 full 0→9 sweeps, joining in a staggered left→right
  // cascade. Each tube settles on its LIVE digit when its own sweep ends (seconds included).
  function antiPoison() {
    var faces = document.querySelectorAll('.clock-face[data-style="nixie"] .nixie[data-sweep="1"]');
    if (!faces.length) return;
    var jobs = [];
    faces.forEach(function (nx) {
      var face = nx.closest(".clock-face");
      var tubes = nx.querySelectorAll(".nx:not(.nx-colon)");
      for (var i = 0; i < tubes.length; i++) jobs.push({ sp: tubes[i], face: face, i: i });
    });
    if (!jobs.length) return;
    poisoning = true;
    var pending = jobs.length;
    jobs.forEach(function (job) {
      setTimeout(function () { sweepTube(job.sp, 3, function () { return nixieString(job.face).replace(/:/g, "")[job.i] || "0"; }, function () { if (--pending === 0) { poisoning = false; updateAll(); } }); }, job.i * 600);
    });
  }
  function hasNixieSweep() { return !!document.querySelector('.clock-face[data-style="nixie"] .nixie[data-sweep="1"]'); }

  function tick() {
    if (!document.querySelector(".clock-face")) { if (tickTimer) clearInterval(tickTimer); tickTimer = null; ticking = false; poisoning = false; return; }   // no clocks left → stop the global tick
    if (document.hidden) return;
    updateAll();   // advance to the current time first (incl. nixie, since poisoning is still false) so the
    if (!poisoning && hasNixieSweep()) {   // anti-poison sweep captures and settles on the NEW digits, not the old ones
      var s = new Date().getSeconds();
      if (s === 0 || s === 30) antiPoison();
    }
  }

  function ensureTicking() {
    if (ticking) return;
    ticking = true;
    if (!visWired) { visWired = true; document.addEventListener("visibilitychange", function () { if (!document.hidden) SD.safe("clock.show", updateAll); }); }   // catch up after the tab was hidden
    tickTimer = setInterval(function () { SD.safe("clock.tick", tick); }, 1000);
  }

  function renderSettings(el, ctx) {
    var c = ctx.controls, t = ctx.i18n.t;
    ctx.dom.clear(el);
    var w = ctx.cfg();
    function redraw() { renderSettings(el, ctx); }

    el.appendChild(c.row(t("clock.style"), c.sel([
      ["analog-ios", t("clock.analog")], ["analog-num", t("clock.analogNum")], ["digital", t("clock.digital")], ["htc-flip", t("clock.mechanic")], ["nixie", t("clock.nixie")]
    ], w.style, function (v) { ctx.commitCfg(function (cfg) { cfg.style = v; }); redraw(); })));
    if (w.style === "digital") {
      el.appendChild(c.row(t("clock.digitalStyle"), c.sel([["plain", "Plain"], ["mono", "Mono"], ["bold", "Bold"], ["thin", "Thin"]], w.digitalStyle || "plain", function (v) { ctx.commitCfg(function (cfg) { cfg.digitalStyle = v; }); })));
    }
    if (w.style === "htc-flip") {
      el.appendChild(c.row(t("clock.mechTheme"), c.sel([["auto", t("theme.auto")], ["dark", t("clock.dark")], ["light", t("clock.light")]], w.mechTheme || "auto", function (v) { ctx.commitCfg(function (cfg) { cfg.mechTheme = v; }); redraw(); })));
      el.appendChild(c.row(t("clock.flipSpeed"), c.sel([["5", "5×"], ["4", "4×"], ["3", "3×"], ["2", "2×"], ["1", "1×"]], String(w.mechFlipSpeed || 5), function (v) { ctx.commitCfg(function (cfg) { cfg.mechFlipSpeed = parseInt(v, 10) || 5; }); })));
    }
    var usesNixie = w.style === "nixie" || (w.cities || []).some(function (cc) { return cc.style === "nixie"; });
    if (usesNixie) {
      el.appendChild(c.row(t("clock.nixieAnim"), c.check(w.nixieSweep !== false, function (v) { ctx.commitCfg(function (cfg) { cfg.nixieSweep = v; }); })));
    }
    el.appendChild(c.row(t("clock.seconds"), c.check(w.showSeconds, function (v) { ctx.commitCfg(function (cfg) { cfg.showSeconds = v; }); redraw(); })));
    el.appendChild(c.row(t("clock.format24"), c.check(w.format24, function (v) { ctx.commitCfg(function (cfg) { cfg.format24 = v; }); })));
    el.appendChild(c.row(t("clock.cardBg"), c.check(!!w.cardBg, function (v) { ctx.commitCfg(function (cfg) { cfg.cardBg = v; }); })));
    el.appendChild(c.row(t("clock.cardBorder"), c.check(!!w.cardBorder, function (v) { ctx.commitCfg(function (cfg) { cfg.cardBorder = v; }); })));
    el.appendChild(c.row(t("clock.cityLabelSize"), c.num(w.cityLabelSize || 13, 9, 36, 1, function (v) { ctx.commitCfg(function (cfg) { cfg.cityLabelSize = v; }); })));
    el.appendChild(c.row(t("clock.cityLabelStyle"), c.sel([["normal", t("clock.lblNormal")], ["bold", t("clock.lblBold")], ["muted", t("clock.lblMuted")], ["caps", t("clock.lblCaps")]], w.cityLabelStyle || "normal", function (v) { ctx.commitCfg(function (cfg) { cfg.cityLabelStyle = v; }); })));

    ensureTzDatalist();
    var cities = document.createElement("div"); cities.className = "cities";
    var list = w.cities || [];
    list.forEach(function (city, idx) {
      var rowEl = document.createElement("div"); rowEl.className = "city-row";
      var label = c.text(city.label, function (v) { ctx.commitCfg(function (cfg) { var x = cityById(cfg, city.id); if (x) x.label = v; }); });
      label.placeholder = t("clock.cityLabel");
      var tz = c.text(city.timeZone, function (v) { ctx.commitCfg(function (cfg) { var x = cityById(cfg, city.id); if (x) x.timeZone = v; }); });
      tz.placeholder = "Europe/Moscow"; tz.setAttribute("list", "sd-tz-list");
      var styleSel = c.sel([   // per-clock style; empty = use the widget default
        ["", t("clock.styleDefault")], ["analog-ios", t("clock.analog")], ["analog-num", t("clock.analogNum")], ["digital", t("clock.digital")], ["htc-flip", t("clock.mechanic")], ["nixie", t("clock.nixie")]
      ], city.style || "", function (v) { ctx.commitCfg(function (cfg) { var x = cityById(cfg, city.id); if (x) x.style = v; }); redraw(); });
      var mechSel = null, speedSel = null;
      if ((city.style || w.style) === "htc-flip") {
        mechSel = c.sel([["", t("clock.styleDefault")], ["auto", t("theme.auto")], ["dark", t("clock.dark")], ["light", t("clock.light")]],
          city.mechTheme || "", function (v) { ctx.commitCfg(function (cfg) { var x = cityById(cfg, city.id); if (x) x.mechTheme = v; }); redraw(); });
        speedSel = c.sel([["", t("clock.styleDefault")], ["5", "5×"], ["4", "4×"], ["3", "3×"], ["2", "2×"], ["1", "1×"]],
          city.mechFlipSpeed ? String(city.mechFlipSpeed) : "", function (v) { ctx.commitCfg(function (cfg) { var x = cityById(cfg, city.id); if (x) x.mechFlipSpeed = v ? parseInt(v, 10) : undefined; }); });
      }
      var up = c.btn("ghost", "▲"); up.disabled = idx === 0;
      up.addEventListener("click", function () { moveCity(ctx, idx, -1); redraw(); });
      var down = c.btn("ghost", "▼"); down.disabled = idx === list.length - 1;
      down.addEventListener("click", function () { moveCity(ctx, idx, 1); redraw(); });
      var del = c.btn("ghost", "×");
      del.addEventListener("click", function () { ctx.commitCfg(function (cfg) { cfg.cities = cfg.cities.filter(function (q) { return q.id !== city.id; }); }); redraw(); });
      var ctrls = document.createElement("div"); ctrls.className = "city-ctrls";
      ctrls.appendChild(up); ctrls.appendChild(down); ctrls.appendChild(del);
      rowEl.appendChild(label); rowEl.appendChild(tz); rowEl.appendChild(styleSel);
      if (mechSel) rowEl.appendChild(mechSel);
      if (speedSel) rowEl.appendChild(speedSel);
      rowEl.appendChild(ctrls);
      cities.appendChild(rowEl);
    });
    var add = c.btn("ghost", t("clock.addCity"));
    add.addEventListener("click", function () { ctx.commitCfg(function (cfg) { cfg.cities.push({ id: ctx.schema.uid(), label: "City", timeZone: "" }); }); redraw(); });
    cities.appendChild(add);
    el.appendChild(cities);
  }
  function cityById(cfg, id) { return (cfg.cities || []).filter(function (q) { return q.id === id; })[0]; }
  function moveCity(ctx, idx, dir) {
    ctx.commitCfg(function (cfg) {
      var arr = cfg.cities, j = idx + dir;
      if (j < 0 || j >= arr.length) return;
      var tmp = arr[idx]; arr[idx] = arr[j]; arr[j] = tmp;
    });
  }
  function ensureTzDatalist() {
    if (document.getElementById("sd-tz-list")) return;
    var dl = document.createElement("datalist"); dl.id = "sd-tz-list";
    var zones = [];
    try { if (typeof Intl !== "undefined" && Intl.supportedValuesOf) zones = Intl.supportedValuesOf("timeZone"); } catch (e) { zones = []; }
    if (!zones.length) zones = ["Europe/Moscow", "Europe/London", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "Asia/Shanghai", "Asia/Dubai", "Australia/Sydney", "UTC"];
    zones.forEach(function (z) { var o = document.createElement("option"); o.value = z; dl.appendChild(o); });
    document.body.appendChild(dl);
  }

  function defaultConfig() {
    return { style: "htc-flip", digitalStyle: "mono", mechTheme: "auto", mechFlipSpeed: 5, nixieSweep: true, showSeconds: true, format24: true, cardBg: false, cardBorder: false, cities: [{ id: SD.schema.uid(), label: "City", timeZone: "" }], cityLabelSize: 13, cityLabelStyle: "normal" };
  }

  SD.registry.register({ id: "clock", kind: "local", titleKey: "widget.clock", order: 10, skeleton: ".clock-face", mount: mount, renderSettings: renderSettings, defaultConfig: defaultConfig });
})();
