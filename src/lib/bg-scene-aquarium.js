// Reef-aquarium scene (plugin for SD.bgEngine): a colourful planted reef — full-width sandy bottom, randomly
// generated corals (branching / brain / plate) + starfish, swaying seaweed & anemones, seahorses, fish of
// several species (clownfish, blue & yellow tangs, angelfish, anthias) with markings clipped to their bodies,
// rising bubbles, and soft light shafts. Reef baked once (rebuilt on resize); life is live. reduced-motion → still.
(function () {
  "use strict";
  var L = SD.bgLife, rnd = L.rnd;
  var ctx, W = 0, H = 0, clock = 0, sandY = 0;
  var reef = null, reefFront = null, fish = [], bubbles = [], anems = [], rays = [], weeds = [], horses = [], crabs = [], tracks = [], grains = [], big = [], whales = [], motes = [], stars = [], shells = [], obstacles = [], jellies = [], schools = [], sub = null, ridgePh = 0, nextEvent = 22, nextWhale = 6, nextSub = 18, nextSchool = 8;
  var CORAL = ["#9b5fe0", "#b06ad8", "#ff7fb0", "#ff5a8a", "#ff8a3d", "#e0432f", "#3fae5a", "#7ad06a", "#ffd166", "#3aa0e0", "#16c0c0"];
  var WEED = ["#1b7a4b", "#2e9e63", "#15633c", "#3bb273", "#2a8f55"];
  var SPECIES = ["clown", "blue", "yellow", "angel", "anthias", "clown", "anthias"];

  function moundGrad(g, top, base, col) { var gr = g.createLinearGradient(0, top, 0, base); gr.addColorStop(0, lighten(col)); gr.addColorStop(0.5, col); gr.addColorStop(1, shade(col)); return gr; }
  function coralBranch(g, x, y, h, col) {
    g.lineCap = "round";
    function br(x0, y0, len, ang, wdt) {
      if (len < 7) return;
      var x1 = x0 + Math.cos(ang) * len, y1 = y0 - Math.sin(ang) * len;
      g.strokeStyle = wdt > h * 0.06 ? shade(col) : col; g.lineWidth = wdt;   // thick base darker
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.fillStyle = lighten(col); g.beginPath(); g.arc(x1, y1, wdt * 0.55, 0, 6.28); g.fill();   // bright polyp tip
      br(x1, y1, len * 0.74, ang + rnd(0.25, 0.6), wdt * 0.72); br(x1, y1, len * 0.74, ang - rnd(0.25, 0.6), wdt * 0.72);
      if (rnd(0, 1) < 0.4) br(x1, y1, len * 0.6, ang + rnd(-0.2, 0.2), wdt * 0.6);
    }
    br(x, y, h * 0.5, 1.57 + rnd(-0.2, 0.2), Math.max(5, h * 0.1));
  }
  function coralBrain(g, x, y, r, col) {
    g.save();
    g.beginPath(); g.ellipse(x, y, r, r * 0.92, 0, Math.PI, 0); g.lineTo(x - r, y); g.closePath();   // seated dome (no floating block)
    g.fillStyle = moundGrad(g, y - r * 0.92, y, col); g.fill(); g.clip();   // ridges stay INSIDE the dome
    g.strokeStyle = shade(col); g.lineWidth = Math.max(1.4, r * 0.06); g.lineCap = "round";
    for (var i = 0; i < 6; i++) { var ry = y - r * (0.08 + i * 0.14); g.beginPath(); for (var px = -1; px <= 1.001; px += 0.12) { var X = x + px * r, Y = ry + Math.sin(px * 9 + i) * r * 0.05; if (px <= -1 + 0.001) g.moveTo(X, Y); else g.lineTo(X, Y); } g.stroke(); }
    g.restore();
  }
  function coralLeather(g, x, y, r, col) {   // clean lobed soft-coral mound, seated at y
    g.fillStyle = moundGrad(g, y - r * 1.15, y, col);
    g.beginPath(); g.moveTo(x - r, y); g.bezierCurveTo(x - r * 1.05, y - r * 0.85, x - r * 0.45, y - r * 1.25, x, y - r * 1.05); g.bezierCurveTo(x + r * 0.45, y - r * 1.25, x + r * 1.05, y - r * 0.85, x + r, y); g.closePath(); g.fill();
    g.strokeStyle = shade(col); g.lineWidth = Math.max(1, r * 0.05); g.lineCap = "round";
    for (var i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x + i * r * 0.42, y); g.quadraticCurveTo(x + i * r * 0.52, y - r * 0.6, x + i * r * 0.3, y - r * 0.98); g.stroke(); }
    g.fillStyle = lighten(col); for (var d = 0; d < r * 0.4; d++) { g.beginPath(); g.arc(x + rnd(-r * 0.7, r * 0.7), y - rnd(r * 0.1, r * 0.95), 1.3, 0, 6.28); g.fill(); }
  }
  function coralFinger(g, x, y, r, col) {   // cluster of rounded finger lobes
    for (var i = -2; i <= 2; i++) { var fx = x + i * r * 0.52 + rnd(-4, 4), fh = rnd(r * 1.4, r * 2.4), fw = r * 0.4; g.fillStyle = moundGrad(g, y - fh, y, col); g.beginPath(); g.moveTo(fx - fw, y); g.lineTo(fx - fw, y - fh + fw); g.arc(fx, y - fh + fw, fw, Math.PI, 0); g.lineTo(fx + fw, y); g.closePath(); g.fill(); g.fillStyle = lighten(col); g.beginPath(); g.arc(fx, y - fh + fw, fw * 0.42, 0, 6.28); g.fill(); }
  }
  function coralFan(g, x, y, r, col) {   // sea fan: lattice of curved ribs
    g.strokeStyle = col; g.lineCap = "round";
    g.lineWidth = Math.max(1.4, r * 0.05); for (var a = -0.9; a <= 0.9; a += 0.18) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + a * r * 1.2, y - r * 0.7, x + a * r * 1.5, y - r * 1.5); g.stroke(); }
    g.lineWidth = Math.max(1, r * 0.03); for (var t = 0.35; t <= 1; t += 0.22) { g.beginPath(); for (var aa = -0.9; aa <= 0.9; aa += 0.18) { var pxx = x + aa * r * 1.5 * t, pyy = y - r * 1.5 * t - Math.abs(aa) * r * 0.18; if (aa <= -0.9 + 0.001) g.moveTo(pxx, pyy); else g.lineTo(pxx, pyy); } g.stroke(); }
  }
  function coralPlate(g, x, y, w, col) {
    g.fillStyle = shade(col); g.fillRect(x - 3, y - w * 0.3, 6, w * 0.3);
    var gr = g.createLinearGradient(0, y - w * 0.5, 0, y - w * 0.18); gr.addColorStop(0, lighten(col)); gr.addColorStop(1, col);
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y - w * 0.32, w * 0.58, w * 0.2, 0, 0, 6.28); g.fill();
    g.strokeStyle = shade(col); g.lineWidth = 1; g.beginPath(); g.ellipse(x, y - w * 0.32, w * 0.58, w * 0.2, 0, 0, 6.28); g.stroke();
  }
  function rgbOf(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function shade(h) { return "rgb(" + rgbOf(h).map(function (v) { return Math.round(v * 0.5); }).join(",") + ")"; }
  function lighten(h) { return "rgb(" + rgbOf(h).map(function (v) { return Math.min(255, Math.round(v + (255 - v) * 0.5)); }).join(",") + ")"; }
  function starfish(g, x, y, r, col) {
    var dark = shade(col), lite = lighten(col);
    g.save(); g.translate(x, y); g.rotate(rnd(0, 6.28));
    // soft contact shadow (radial fade — not a hard ring)
    var sh = g.createRadialGradient(0, r * 0.18, 0, 0, r * 0.18, r); sh.addColorStop(0, "rgba(0,0,0,0.16)"); sh.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = sh; g.beginPath(); g.ellipse(0, r * 0.18, r, r * 0.6, 0, 0, 6.28); g.fill();
    // five puffy arms, each shaded along its length (base bright → tip dark) for volume
    for (var k = 0; k < 5; k++) {
      g.save(); g.rotate(k * Math.PI * 2 / 5);
      var aw = r * 0.46, ag = g.createLinearGradient(0, 0, 0, -r); ag.addColorStop(0, lite); ag.addColorStop(0.45, col); ag.addColorStop(1, dark);
      g.fillStyle = ag; g.beginPath(); g.moveTo(-aw * 0.55, r * 0.1); g.quadraticCurveTo(-aw, -r * 0.5, 0, -r); g.quadraticCurveTo(aw, -r * 0.5, aw * 0.55, r * 0.1); g.closePath(); g.fill();
      g.strokeStyle = "rgba(255,255,255,0.32)"; g.lineWidth = r * 0.05; g.lineCap = "round"; g.beginPath(); g.moveTo(0, -r * 0.15); g.lineTo(0, -r * 0.82); g.stroke();   // ridge highlight
      g.fillStyle = "rgba(0,0,0,0.16)"; for (var d = 1; d <= 4; d++) { g.beginPath(); g.arc(0, -r * 0.18 * d, r * 0.045, 0, 6.28); g.fill(); }   // tube-foot dots
      g.restore();
    }
    // raised central disc
    var cg = g.createRadialGradient(-r * 0.12, -r * 0.12, 0, 0, 0, r * 0.5); cg.addColorStop(0, lite); cg.addColorStop(0.65, col); cg.addColorStop(1, dark);
    g.fillStyle = cg; g.beginPath(); g.arc(0, 0, r * 0.5, 0, 6.28); g.fill();
    g.fillStyle = "rgba(255,255,255,0.28)"; for (var b = 0; b < 8; b++) { g.beginPath(); g.arc(rnd(-r * 0.3, r * 0.3), rnd(-r * 0.3, r * 0.3), r * 0.045, 0, 6.28); g.fill(); }   // bumpy texture
    g.restore();
  }

  function shell(g, x, y, r, col, rot) {   // scallop on the sand, scattered at a random angle
    g.save(); g.translate(x, y); g.rotate(rot);
    var hy = r * 0.5;   // hinge at the fan's base
    var grd = g.createLinearGradient(0, hy - r, 0, hy); grd.addColorStop(0, lighten(col)); grd.addColorStop(1, col);
    g.fillStyle = grd; g.beginPath(); g.moveTo(0, hy); g.arc(0, hy, r, Math.PI * 1.16, Math.PI * 1.84); g.closePath(); g.fill();
    g.strokeStyle = shade(col); g.lineJoin = "round"; g.lineWidth = Math.max(1, r * 0.06); g.stroke();   // clear outline
    for (var a = Math.PI * 1.2; a <= Math.PI * 1.81; a += (Math.PI * 0.6) / 5) { g.beginPath(); g.moveTo(0, hy); g.lineTo(Math.cos(a) * r, hy + Math.sin(a) * r); g.stroke(); }   // ribs
    g.fillStyle = shade(col); g.beginPath(); g.moveTo(-r * 0.2, hy); g.lineTo(r * 0.2, hy); g.lineTo(0, hy + r * 0.18); g.closePath(); g.fill();   // umbo beak (clear hinge, not a stray dot)
    g.restore();
  }
  function ridgeY(x) { return Math.min(sandY - 12, sandY - (22 + 32 * Math.sin(x * 0.006 + ridgePh) + 20 * Math.sin(x * 0.014 + ridgePh * 1.7) + 10 * Math.sin(x * 0.03 + ridgePh))); }
  function buildReef() {
    reef = document.createElement("canvas"); reef.width = W; reef.height = H; var g = reef.getContext("2d");
    reefFront = document.createElement("canvas"); reefFront.width = W; reefFront.height = H; var gf = reefFront.getContext("2d");
    // sand — solid full-width fill, then a bumpy crest on top (no right-edge gap)
    var sg = g.createLinearGradient(0, sandY - 20, 0, H); sg.addColorStop(0, "#d9c89a"); sg.addColorStop(1, "#b8a472");
    g.fillStyle = sg; g.fillRect(0, sandY - 2, W, H - sandY + 2);
    g.beginPath(); g.moveTo(0, sandY); for (var sx = 0; sx <= W; sx += 36) g.lineTo(sx, sandY - 10 + Math.sin(sx * 0.02) * 9 + rnd(-3, 3)); g.lineTo(W, sandY + 4); g.lineTo(0, sandY + 4); g.closePath(); g.fill();
    for (var sp = 0; sp < W * 0.5; sp++) { g.fillStyle = "rgba(120,100,60," + rnd(0.05, 0.18).toFixed(2) + ")"; g.fillRect(rnd(0, W), rnd(sandY, H), 2, 2); }
    // reef-rock hill — a rocky mound that the tall corals stand on; capped at hillBase so the foreground SAND stays visible
    ridgePh = rnd(0, 6.28);
    var hillBase = sandY + 18;
    var rkg = g.createLinearGradient(0, sandY - 90, 0, hillBase); rkg.addColorStop(0, "#5a4e58"); rkg.addColorStop(0.5, "#473c44"); rkg.addColorStop(1, "#3a3038");   // rock, not water
    g.fillStyle = rkg; g.beginPath(); g.moveTo(0, hillBase); g.lineTo(0, ridgeY(0)); for (var rxx = 0; rxx <= W; rxx += 14) g.lineTo(rxx, ridgeY(rxx)); g.lineTo(W, hillBase); g.closePath(); g.fill();
    for (var rk = 0; rk < W * 0.05; rk++) { var bx = rnd(0, W), by = rnd(ridgeY(bx) + 6, hillBase); g.fillStyle = "rgba(0,0,0,0.12)"; g.beginPath(); g.arc(bx, by, rnd(3, 9), 0, 6.28); g.fill(); }   // rock texture
    g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, hillBase - 3, W, 4);   // contact shadow where the hill meets the sand
    function place(tg, yBase, szMin, szMax, step, far, onRidge) {
      for (var x = rnd(0, step); x < W; x += rnd(step * 0.5, step)) {
        var y = (onRidge ? ridgeY(x) + rnd(-2, 8) : yBase + rnd(0, 12)), col = far ? ["#2c4a68", "#34506e", "#3a4a64", "#2e5a72"][Math.floor(rnd(0, 4))] : CORAL[Math.floor(rnd(0, CORAL.length))], sz = rnd(szMin, szMax), t = Math.floor(rnd(0, far ? 4 : 6));
        if (far) tg.globalAlpha = 0.5;
        if (t === 0) coralBranch(tg, x, y, sz * 1.7, col);
        else if (t === 1) coralBrain(tg, x, y, sz * 0.7, col);
        else if (t === 2) coralPlate(tg, x, y, sz, col);
        else if (t === 3) coralLeather(tg, x, y, sz * 0.6, col);
        else if (t === 4) coralFinger(tg, x, y, sz * 0.5, col);
        else coralFan(tg, x, y, sz * 0.6, col);
        tg.globalAlpha = 1;
      }
    }
    // BACK layer (behind the seaweed): all seated near the seabed (no floating); height comes from tall corals
    place(g, 0, 26, 54, 50, true, true);     // distant muted reef on the hill crest
    place(g, 0, 44, 96, 84, false, true);    // back corals standing on the rock hill
    place(g, sandY + 16, 34, 84, 68);        // mid corals on the sand in front of the hill
    // FRONT layer (drawn over the back so it occludes it): rubble band + a LOW near coral row
    for (var fb = -10; fb < W + 30; fb += rnd(16, 32)) coralLeather(gf, fb, sandY + rnd(44, 66), rnd(24, 46), CORAL[Math.floor(rnd(0, CORAL.length))]);
    place(gf, sandY + 32, 30, 80, 52);
    // small framing reefs at both edges
    [30, W - 30].forEach(function (ex) {
      for (var ec = 0; ec < 6; ec++) {
        var x = ex + rnd(-22, 22), y = sandY + rnd(18, 64), col = CORAL[Math.floor(rnd(0, CORAL.length))], sz = rnd(34, 80), t = Math.floor(rnd(0, 6));
        if (t === 0) coralBranch(gf, x, y, sz * 1.7, col); else if (t === 1) coralBrain(gf, x, y, sz * 0.7, col); else if (t === 2) coralPlate(gf, x, y, sz, col); else if (t === 3) coralLeather(gf, x, y, sz * 0.6, col); else if (t === 4) coralFinger(gf, x, y, sz * 0.5, col); else coralFan(gf, x, y, sz * 0.6, col);
      }
    });
    // starfish + shells on the open foreground sand — spaced so nothing overlaps or piles up in one spot
    var SC = ["#e0432f", "#ff5a3c", "#ff7a1a", "#d6336c", "#c0263a"], SHC = ["#f0e0c0", "#ffd9c0", "#e8c0d0", "#f5d8a0", "#d8e4f0", "#ffc9a0", "#e6d2f0", "#cfe6d8"];
    stars = []; shells = []; var placed = [];
    function freeSpot(r) { for (var tr = 0; tr < 16; tr++) { var x = rnd(36, W - 36), y = rnd(sandY + (H - sandY) * 0.46, H - 14), ok = true; for (var i = 0; i < placed.length; i++) { var p = placed[i]; if (Math.hypot(p.x - x, p.y - y) < (p.r + r) * 1.25) { ok = false; break; } } if (ok) { placed.push({ x: x, y: y, r: r }); return { x: x, y: y }; } } return null; }
    for (var s1 = 0; s1 < Math.max(2, Math.round(W / 560)); s1++) { var rr = rnd(42, 62), spA = freeSpot(rr); if (spA) { starfish(gf, spA.x, spA.y, rr, SC[Math.floor(rnd(0, SC.length))]); stars.push({ x: spA.x, y: spA.y, r: rr }); } }
    for (var s2 = 0; s2 < Math.max(3, Math.round(W / 320)); s2++) { var rr2 = rnd(18, 32), sp2 = freeSpot(rr2); if (sp2) { starfish(gf, sp2.x, sp2.y, rr2, SC[Math.floor(rnd(0, SC.length))]); stars.push({ x: sp2.x, y: sp2.y, r: rr2 }); } }
    for (var s3 = 0; s3 < Math.max(4, Math.round(W / 200)); s3++) { var rr3 = rnd(8, 20), sp3 = freeSpot(rr3); if (sp3) { shell(gf, sp3.x, sp3.y, rr3, SHC[Math.floor(rnd(0, SHC.length))], rnd(0, 6.28)); shells.push({ x: sp3.x, y: sp3.y, r: rr3 }); } }
    obstacles = stars.concat(shells);
  }

  function spawn() {
    sandY = H * 0.78;
    fish = []; bubbles = []; anems = []; rays = []; weeds = []; horses = []; big = []; nextEvent = rnd(16, 34);
    var nf = Math.max(7, Math.min(16, Math.round(W / 120)));
    for (var i = 0; i < nf; i++) fish.push(newFish());
    for (var b = 0; b < 30; b++) bubbles.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(1.5, 4), v: rnd(12, 32) });
    var na = Math.max(4, Math.round(W / 170));
    for (var a = 0; a < na; a++) anems.push({ x: rnd(30, W - 30), y: sandY + rnd(6, 24), r: rnd(16, 30), col: CORAL[Math.floor(rnd(0, CORAL.length))], n: Math.floor(rnd(9, 16)), ph: rnd(0, 6.28) });
    var nw = Math.max(10, Math.round(W / 80));
    for (var w = 0; w < nw; w++) weeds.push({ x: rnd(8, W - 8), baseY: sandY + rnd(30, 55), h: rnd(H * 0.12, H * 0.32), wd: rnd(4, 10), ph: rnd(0, 6.28), col: WEED[Math.floor(rnd(0, WEED.length))] });
    [26, W - 26].forEach(function (ex) { for (var ew = 0; ew < 3; ew++) weeds.push({ x: ex + rnd(-18, 18), baseY: sandY + rnd(30, 55), h: rnd(H * 0.14, H * 0.3), wd: rnd(4, 9), ph: rnd(0, 6.28), col: WEED[Math.floor(rnd(0, WEED.length))] }); });   // seaweed at the edge reefs (roots hidden behind the front row)
    for (var hh = 0; hh < Math.max(2, Math.round(W / 420)); hh++) horses.push({ x: rnd(40, W - 40), y: rnd(sandY - H * 0.12, sandY - 22), s: rnd(16, 24), ph: rnd(0, 6.28), dir: Math.random() < 0.5 ? 1 : -1, v: rnd(3, 7), col: ["#d11f2f", "#e0392b", "#ff4d3d", "#c0263a"][Math.floor(rnd(0, 4))] });
    crabs = []; tracks = []; for (var cc = 0; cc < Math.max(2, Math.round(W / 320)); cc++) crabs.push({ x: rnd(30, W - 30), y: rnd(sandY + (H - sandY) * 0.45, H - 10), s: rnd(6, 13), dir: Math.random() < 0.5 ? 1 : -1, v: rnd(8, 15), ph: rnd(0, 6.28), jump: -1, js: 0, je: 0, jh: 0, stum: 0, land: 0, snap: 0, snapCd: rnd(1, 4), mk: 0, cd: rnd(0.4, 2), col: ["#e0432f", "#d6336c", "#ff6a3d", "#c0263a", "#e0892f"][Math.floor(rnd(0, 5))] });
    jellies = []; for (var jj = 0; jj < Math.max(1, Math.round(W / 560)); jj++) jellies.push(newJelly(true));
    sub = null; nextSub = rnd(8, 22); schools = []; nextSchool = rnd(3, 10);
    grains = []; for (var gn = 0; gn < Math.round(W * 0.09); gn++) grains.push({ x: rnd(0, W), y: rnd(sandY + 4, H - 1), r: rnd(0.6, 1.7), ph: rnd(0, 6.28) });
    for (var r = 0; r < 5; r++) rays.push({ x: rnd(-W * 0.2, W), w: rnd(40, 120), ph: rnd(0, 6.28), a: rnd(0.04, 0.1) });
    whales = []; nextWhale = rnd(2, 7); whales.push(newWhale(true));
    motes = []; for (var m = 0; m < Math.round(W * 0.06); m++) motes.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(0.5, 1.8), vy: rnd(2, 7), vx: rnd(-4, 4), ph: rnd(0, 6.28), a: rnd(0.05, 0.16) });
    buildReef();
  }
  function newFish(atEdge) {
    var sp = SPECIES[Math.floor(rnd(0, SPECIES.length))], dir = Math.random() < 0.5 ? 1 : -1;
    return { x: atEdge ? (dir > 0 ? -40 : W + 40) : rnd(0, W), y: rnd(H * 0.12, sandY - 10), s: rnd(13, 30), v: rnd(14, 34), dir: dir, ph: rnd(0, 6.28), blink: 0, nextBlink: rnd(2, 7), sp: sp, col: CORAL[Math.floor(rnd(0, CORAL.length))], ws: rnd(0.3, 0.85), wa: rnd(16, 46) };
  }

  /* ---------- fish (markings clipped to the body) ---------- */
  function drawFish(f) {
    var s = f.s, tall = f.sp === "angel" ? 0.78 : f.sp === "yellow" ? 0.7 : 0.55, sway = Math.sin(f.ph * 3);
    ctx.save(); ctx.translate(f.x, f.y + Math.sin(f.ph) * 3); ctx.scale(f.dir, 1);
    var body = f.sp === "clown" ? "#ff7a1a" : f.sp === "blue" ? "#2b6bd6" : f.sp === "yellow" ? "#ffd21f" : f.sp === "angel" ? f.col : "#ff6f91";
    ctx.fillStyle = f.sp === "blue" || f.sp === "yellow" ? "#ffd21f" : body; ctx.globalAlpha = 0.95;   // tail
    ctx.beginPath(); ctx.moveTo(-s * 0.8, 0); ctx.lineTo(-s * 1.5, -s * 0.5 + sway * s * 0.4); ctx.lineTo(-s * 1.2, 0); ctx.lineTo(-s * 1.5, s * 0.5 + sway * s * 0.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(s * 0.3, -s * 0.5); ctx.quadraticCurveTo(-s * 0.2, -s * 0.95, -s * 0.6, -s * 0.45); ctx.closePath(); ctx.fill();   // dorsal fin
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, s, s * tall, 0, 0, 6.28); ctx.fill();      // body
    // markings — clipped to the body so they never spill outside
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, s, s * tall, 0, 0, 6.28); ctx.clip();
    if (f.sp === "clown") { ctx.fillStyle = "#fff"; [-0.1, s * 0.5].forEach(function (bx) { ctx.beginPath(); ctx.ellipse(bx, 0, s * 0.16, s * tall, 0, 0, 6.28); ctx.fill(); }); }
    else if (f.sp === "angel") { ctx.fillStyle = "rgba(255,255,255,0.85)"; for (var st = -2; st <= 2; st++) ctx.fillRect(st * s * 0.32 - 2, -s * tall, 4, s * tall * 2); }
    else if (f.sp === "blue") { ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(-s * 0.1, 0, s * 0.7, s * 0.32, 0, 0, 6.28); ctx.fill(); }
    ctx.restore();
    if (f.sp === "clown") { ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, s, s * tall, 0, 0, 6.28); ctx.stroke(); }
    ctx.globalAlpha = 1;   // eye
    if (f.blink > 0) { ctx.strokeStyle = "#10293b"; ctx.lineWidth = Math.max(1.4, s * 0.07); ctx.beginPath(); ctx.moveTo(s * 0.42, -s * 0.1); ctx.lineTo(s * 0.6, -s * 0.1); ctx.stroke(); }
    else { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(s * 0.52, -s * 0.12, s * 0.15, 0, 6.28); ctx.fill(); ctx.fillStyle = "#10293b"; ctx.beginPath(); ctx.arc(s * 0.56, -s * 0.12, s * 0.07, 0, 6.28); ctx.fill(); }
    ctx.restore();
  }

  function current() { return Math.sin(clock * 0.25) + 0.3 * Math.sin(clock * 0.7); }   // slow water current, −1..1-ish
  function drawWeed(p) {
    var cur = current() * 10;
    for (var b = -1; b <= 1; b++) {
      var x = p.x + b * p.wd * 1.3, h = p.h * (1 - Math.abs(b) * 0.18), sway = Math.sin(clock * 0.9 + p.ph + b) * 12 + cur;
      ctx.strokeStyle = p.col; ctx.globalAlpha = 0.65; ctx.lineWidth = p.wd; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x, p.baseY); ctx.quadraticCurveTo(x + sway * 0.5, p.baseY - h * 0.5, x + sway, p.baseY - h); ctx.stroke();   // rooted in the sand at p.baseY
    }
    ctx.globalAlpha = 1;
  }
  function drawAnem(a) {
    for (var i = 0; i < a.n; i++) {
      var ang = -1.57 + (i / (a.n - 1) - 0.5) * 2.2, sw = Math.sin(clock * 1.4 + a.ph + i) * 0.25;
      var x2 = a.x + Math.cos(ang + sw) * a.r, y2 = a.y - Math.sin(ang + sw) * a.r;
      ctx.strokeStyle = a.col; ctx.lineWidth = a.r * 0.16; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(a.x + Math.cos(ang) * a.r * 0.6, a.y - Math.sin(ang) * a.r * 0.6, x2, y2); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.arc(x2, y2, a.r * 0.1, 0, 6.28); ctx.fill();
    }
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(a.x, a.y, a.r * 0.4, a.r * 0.2, 0, 0, 6.28); ctx.fill();
  }
  function drawHorse(h) {
    var bob = Math.sin(clock * 1.1 + h.ph) * 5, lean = Math.sin(clock * 1.5 + h.ph) * 0.1, s = h.s;
    ctx.save(); ctx.translate(h.x, h.y + bob); ctx.scale(h.dir, 1); ctx.rotate(lean);
    // dorsal fin (translucent), behind the body
    ctx.fillStyle = "rgba(255,150,120,0.45)";
    ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 1.05); ctx.quadraticCurveTo(-s * 1.05, -s * 0.4, -s * 0.35, s * 0.25); ctx.quadraticCurveTo(-s * 0.15, -s * 0.4, -s * 0.4, -s * 1.05); ctx.closePath(); ctx.fill();
    // body: tapered S-curve (thick neck → thin curled tail)
    ctx.strokeStyle = h.col; ctx.lineCap = "round";
    ctx.lineWidth = s * 0.6; ctx.beginPath(); ctx.moveTo(s * 0.05, -s * 1.5); ctx.quadraticCurveTo(s * 0.95, -s * 0.35, s * 0.02, s * 0.5); ctx.stroke();
    ctx.lineWidth = s * 0.4; ctx.beginPath(); ctx.moveTo(s * 0.02, s * 0.5); ctx.quadraticCurveTo(-s * 0.82, s * 1.05, s * 0.28, s * 1.45); ctx.quadraticCurveTo(-s * 0.18, s * 1.05, -s * 0.02, s * 0.6); ctx.stroke();
    // head + snout + coronet
    ctx.fillStyle = h.col; ctx.beginPath(); ctx.arc(s * 0.05, -s * 1.6, s * 0.42, 0, 6.28); ctx.fill();
    ctx.lineWidth = s * 0.24; ctx.beginPath(); ctx.moveTo(s * 0.25, -s * 1.64); ctx.lineTo(s * 0.95, -s * 1.76); ctx.stroke();
    ctx.lineWidth = s * 0.12; ctx.beginPath(); ctx.moveTo(-s * 0.18, -s * 1.86); ctx.lineTo(-s * 0.26, -s * 2.12); ctx.moveTo(s * 0.02, -s * 1.92); ctx.lineTo(s * 0.05, -s * 2.18); ctx.stroke();
    // belly highlight
    ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = s * 0.14; ctx.beginPath(); ctx.moveTo(s * 0.4, -s * 1.15); ctx.quadraticCurveTo(s * 0.62, -s * 0.4, s * 0.12, s * 0.42); ctx.stroke();
    // eye
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(s * 0.12, -s * 1.6, s * 0.13, 0, 6.28); ctx.fill();
    ctx.fillStyle = "#10293b"; ctx.beginPath(); ctx.arc(s * 0.16, -s * 1.6, s * 0.07, 0, 6.28); ctx.fill();
    ctx.restore();
  }

  function newWhale(any) { var dir = Math.random() < 0.5 ? 1 : -1; return { x: any ? rnd(0, W) : (dir > 0 ? -W * 0.6 : W * 1.6), y: rnd(H * 0.42, H * 0.62), s: rnd(H * 0.16, H * 0.28), dir: dir, v: rnd(4, 8), ph: rnd(0, 6.28), spr: null }; }
  function drawCrab(cr, yOff, tilt) {
    var s = cr.s, walk = clock * 4.5 + cr.ph;   // slow cadence → no twitch
    ctx.save(); ctx.translate(cr.x, cr.y + yOff); ctx.rotate(tilt); ctx.scale(cr.dir, 1);
    ctx.strokeStyle = shade(cr.col); ctx.lineWidth = Math.max(1, s * 0.1); ctx.lineCap = "round";
    for (var i = 0; i < 4; i++) {
      var lx = -s * 0.6 + i * s * 0.4, lift = Math.sin(walk + i) * s * 0.12;
      ctx.beginPath(); ctx.moveTo(lx, s * 0.15); ctx.lineTo(lx - s * 0.45, s * 0.4 + lift); ctx.lineTo(lx - s * 0.62, s * 0.62 - lift * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(lx + s * 0.15, s * 0.15); ctx.lineTo(lx + s * 0.5, s * 0.4 - lift); ctx.lineTo(lx + s * 0.66, s * 0.62 + lift * 0.5); ctx.stroke();
    }
    ctx.lineWidth = s * 0.14;
    ctx.beginPath(); ctx.moveTo(-s * 0.72, -s * 0.05); ctx.lineTo(-s * 1.0, -s * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.72, -s * 0.05); ctx.lineTo(s * 1.0, -s * 0.3); ctx.stroke();
    var op = cr.snap > 0 ? 0.5 + 0.5 * Math.sin(cr.snap * 42) : 0;   // claw click: jaws separate then snap shut
    ctx.fillStyle = cr.col;
    [[-1, 0.5], [1, -0.5]].forEach(function (q) { ctx.save(); ctx.translate(q[0] * s * 1.04, -s * 0.34); ctx.rotate(q[1]); ctx.beginPath(); ctx.ellipse(0, -s * 0.05 - op * s * 0.1, s * 0.2, s * 0.1, 0, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, s * 0.05 + op * s * 0.1, s * 0.2, s * 0.1, 0, 0, 6.28); ctx.fill(); ctx.restore(); });
    var cg = ctx.createRadialGradient(-s * 0.12, -s * 0.15, s * 0.1, 0, 0, s); cg.addColorStop(0, lighten(cr.col)); cg.addColorStop(1, cr.col);
    ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.5, 0, 0, 6.28); ctx.fill();
    ctx.strokeStyle = cr.col; ctx.lineWidth = s * 0.09; ctx.beginPath(); ctx.moveTo(-s * 0.22, -s * 0.42); ctx.lineTo(-s * 0.26, -s * 0.64); ctx.moveTo(s * 0.22, -s * 0.42); ctx.lineTo(s * 0.26, -s * 0.64); ctx.stroke();
    ctx.fillStyle = "#10293b"; ctx.beginPath(); ctx.arc(-s * 0.26, -s * 0.66, s * 0.08, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.arc(s * 0.26, -s * 0.66, s * 0.08, 0, 6.28); ctx.fill();
    ctx.restore();
  }
  function nearestObstacleAhead(cr) {
    var best = null, bd = 1e9;
    for (var i = 0; i < obstacles.length; i++) { var st = obstacles[i]; if (Math.abs(st.y - cr.y) > 70) continue; var dx = (st.x - cr.x) * cr.dir; if (dx > 0 && dx < st.r * 0.6 + cr.s * 3 && dx < bd) { bd = dx; best = st; } }
    return best;
  }
  function stepCrab(cr, dt) {
    if (cr.jump >= 0) {   // floaty underwater hop: quick rise, slow sink, soft landing
      cr.jump += dt / cr.jd;
      if (cr.jump >= 1) { cr.x = cr.je; cr.jump = -1; cr.land = 1.2; cr.cd = rnd(1.2, 2.6); drawCrab(cr, 0, 0); }
      else { var p = cr.jump, hf = p < 0.35 ? Math.sin(p / 0.35 * Math.PI / 2) : Math.cos((p - 0.35) / 0.65 * Math.PI / 2); cr.x = cr.js + (cr.je - cr.js) * p + cr.jw * hf; drawCrab(cr, -cr.jh * hf, Math.sin(p * 3.14) * 0.06 * cr.dir); }
      return;
    }
    if (cr.land > 0) { cr.land -= dt; drawCrab(cr, 0, Math.sin((1.2 - cr.land) * 6.5) * 0.16 * (cr.land / 1.2) * cr.dir); return; }   // settle: slow buoyant rock (no trembling)
    if (cr.stum > 0) { cr.stum -= dt; cr.x += cr.v * cr.dir * dt * 0.25; drawCrab(cr, Math.abs(Math.sin(cr.stum * 22)) * cr.s * 0.16, Math.sin(cr.stum * 18) * 0.22 * cr.dir); if (cr.stum <= 0) cr.cd = rnd(0.4, 1); return; }
    if (cr.snap > 0) cr.snap -= dt; else { cr.snapCd -= dt; if (cr.snapCd <= 0) { cr.snap = rnd(0.18, 0.34); cr.snapCd = rnd(1.5, 4.5); } }   // occasional, not constant, claw click
    cr.mk -= dt; if (cr.mk <= 0) { tracks.push({ x: cr.x - cr.dir * cr.s * 0.5, y: cr.y + cr.s * 0.46, r: cr.s * 0.22, t: 0, max: rnd(1.2, 2) }); cr.mk = rnd(0.12, 0.22); }   // brief footprint trail in the sand
    cr.x += cr.v * cr.dir * dt; if (cr.x < 24) cr.dir = 1; else if (cr.x > W - 24) cr.dir = -1;
    cr.cd -= dt;
    if (cr.cd <= 0) { var st = nearestObstacleAhead(cr); if (st) { if (Math.random() < 0.72) { cr.jump = 0; cr.js = cr.x; cr.je = st.x + cr.dir * (st.r * 0.55 + cr.s * rnd(2, 3.4)); cr.jh = st.r * 0.5 + cr.s * rnd(1.6, 2.6); cr.jd = rnd(1.5, 2.2); cr.jw = rnd(-cr.s * 1.8, cr.s * 1.8); } else cr.stum = 0.5; cr.cd = 1.2; } else cr.cd = rnd(0.3, 0.8); }
    drawCrab(cr, 0, 0);
  }

  /* ---------- jellyfish (pulsing, jet up) ---------- */
  function newJelly(any) { return { x: rnd(W * 0.08, W * 0.92), y: any ? rnd(H * 0.22, H * 0.7) : H + 30, s: rnd(16, 30), ph: rnd(0, 6.28), col: ["#ff8fc8", "#b79cff", "#9cc8ff", "#ffb3e0"][Math.floor(rnd(0, 4))] }; }
  function drawJelly(jel, dt, moving) {
    var pulse = 0.5 + 0.5 * Math.sin(clock * 2 + jel.ph), w = jel.s * (1 + 0.12 * pulse), h = jel.s * (0.92 - 0.16 * pulse);
    if (moving) { jel.y -= (5 + 16 * (1 - pulse)) * dt; jel.x += current() * 4 * dt; if (jel.y < -jel.s * 2.5) { jel.y = H + jel.s; jel.x = rnd(W * 0.08, W * 0.92); } }
    ctx.save(); ctx.translate(jel.x, jel.y);
    ctx.strokeStyle = jel.col; ctx.globalAlpha = 0.4; ctx.lineWidth = Math.max(1, jel.s * 0.06); ctx.lineCap = "round";
    for (var t = -3; t <= 3; t++) { var tx = t * w * 0.2; ctx.beginPath(); ctx.moveTo(tx, h * 0.4); ctx.quadraticCurveTo(tx + Math.sin(clock * 3 + t + jel.ph) * w * 0.22, h * 1.3, tx + Math.sin(clock * 2 + t) * w * 0.32, h * 2.2); ctx.stroke(); }
    ctx.globalAlpha = 0.5; var bg = ctx.createRadialGradient(0, -h * 0.25, h * 0.1, 0, 0, w); bg.addColorStop(0, lighten(jel.col)); bg.addColorStop(1, jel.col);
    ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, Math.PI, 0); ctx.lineTo(w, h * 0.35); ctx.quadraticCurveTo(0, h * 0.7, -w, h * 0.35); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1; ctx.restore();
  }

  /* ---------- distant fish schools drifting through the deep (same layer as whales/sub) ---------- */
  function newSchool(any) {
    var dir = Math.random() < 0.5 ? 1 : -1, n = Math.floor(rnd(10, 22)), sz = rnd(3.5, 6), m = [];
    for (var i = 0; i < n; i++) m.push({ ox: rnd(-1, 1) * sz * 9, oy: rnd(-1, 1) * sz * 5, ph: rnd(0, 6.28) });
    return { x: any ? rnd(0, W) : (dir > 0 ? -90 : W + 90), y: rnd(H * 0.3, H * 0.6), dir: dir, v: rnd(16, 30), s: sz, m: m };
  }
  function drawSchool(sc, dt) {
    sc.x += sc.v * sc.dir * dt; var s = sc.s;
    ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = "#0e4a6a";   // muted deep silhouette
    for (var i = 0; i < sc.m.length; i++) {
      var mm = sc.m[i], fx = sc.x + mm.ox + Math.sin(clock * 1.2 + mm.ph) * s * 1.4, fy = sc.y + mm.oy + Math.sin(clock * 2 + mm.ph) * s * 1.1;
      ctx.save(); ctx.translate(fx, fy); ctx.scale(sc.dir, 1);
      ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.5, 0, 0, 6.28); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-s * 0.8, 0); ctx.lineTo(-s * 1.7, -s * 0.6); ctx.lineTo(-s * 1.7, s * 0.6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.restore();
  }

  /* ---------- little submarine drifting in the deep, above the whale ---------- */
  function newSub() { var dir = Math.random() < 0.5 ? 1 : -1; return { x: dir > 0 ? -120 : W + 120, y: rnd(H * 0.22, H * 0.36), s: rnd(26, 40), dir: dir, v: rnd(10, 18), ph: rnd(0, 6.28), yo: 0, beam: 0, beamT: 0, beamCd: rnd(0.5, 2) }; }
  function drawSub(sb) {
    var s = sb.s; ctx.save(); ctx.translate(sb.x, sb.y + (sb.yo || 0)); ctx.scale(sb.dir, 1);
    // head-light: soft, rounded "cartoon flashlight" cone; aim eased toward a random target (see paint)
    var sweep = sb.beam || 0;
    ctx.save(); ctx.translate(s * 0.5, 0); ctx.rotate(sweep);
    var lg = ctx.createLinearGradient(0, 0, s * 2.4, 0); lg.addColorStop(0, "rgba(255,226,150,0.26)"); lg.addColorStop(1, "rgba(255,226,150,0)");
    ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(0, -s * 0.12); ctx.lineTo(s * 1.9, -s * 0.95); ctx.quadraticCurveTo(s * 2.4, 0, s * 1.9, s * 0.95); ctx.lineTo(0, s * 0.12); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(26,58,84,0.62)";
    ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.38, 0, 0, 6.28); ctx.fill();   // hull
    ctx.fillRect(-s * 0.18, -s * 0.66, s * 0.36, s * 0.34); ctx.beginPath(); ctx.arc(0, -s * 0.66, s * 0.18, Math.PI, 0); ctx.fill();   // conning tower
    ctx.fillRect(s * 0.02, -s * 0.96, s * 0.06, s * 0.34);   // periscope
    ctx.beginPath(); ctx.ellipse(-s * 1.06, 0, s * 0.08, s * 0.24, 0, 0, 6.28); ctx.fill();   // tail prop hub
    ctx.fillStyle = "rgba(255,210,120,0.7)"; ctx.beginPath(); ctx.arc(s * 0.45, 0, s * 0.13, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.arc(s * 0.05, 0, s * 0.1, 0, 6.28); ctx.fill();   // portholes
    ctx.restore();
  }

  // Whale baked once as a SOLID silhouette → blitted translucent, so fins blend into the body (no overlap seams).
  function whaleSprite(s) {
    var c = document.createElement("canvas"); c.width = Math.ceil(s * 3.9); c.height = Math.ceil(s * 1.85);
    var g = c.getContext("2d"); g.translate(s * 2.2, s * 0.97); g.fillStyle = "#173a55";
    // body — rounded head (+x) → tail stock (−x)
    g.beginPath(); g.moveTo(s * 1.5, 0); g.bezierCurveTo(s * 1.18, -s * 0.36, s * 0.2, -s * 0.42, -s * 0.55, -s * 0.26); g.quadraticCurveTo(-s * 0.95, -s * 0.14, -s * 1.05, 0); g.quadraticCurveTo(-s * 0.95, s * 0.14, -s * 0.55, s * 0.26); g.bezierCurveTo(s * 0.2, s * 0.42, s * 1.18, s * 0.36, s * 1.5, 0); g.closePath(); g.fill();
    // tail = ONE solid butterfly fluke (apex inside body, wide notched back edge) — broad & attached
    g.beginPath(); g.moveTo(-s * 0.65, 0); g.lineTo(-s * 1.95, -s * 0.58); g.quadraticCurveTo(-s * 1.45, -s * 0.12, -s * 1.4, 0); g.quadraticCurveTo(-s * 1.45, s * 0.12, -s * 1.95, s * 0.58); g.closePath(); g.fill();
    // dorsal fin + pectoral flipper (bases sunk INTO the body → merge, no detached fin)
    g.beginPath(); g.moveTo(-s * 0.18, -s * 0.24); g.quadraticCurveTo(-s * 0.38, -s * 0.6, -s * 0.5, -s * 0.2); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(s * 0.4, s * 0.18); g.quadraticCurveTo(s * 0.02, s * 0.72, -s * 0.5, s * 0.64); g.quadraticCurveTo(-s * 0.02, s * 0.3, s * 0.4, s * 0.18); g.closePath(); g.fill();
    return c;
  }
  function drawWhale(wh) {
    if (!wh.spr) wh.spr = whaleSprite(wh.s);
    var s = wh.s; ctx.save(); ctx.translate(wh.x, wh.y + Math.sin(clock * 0.35 + wh.ph) * 10); ctx.scale(wh.dir, 1);
    ctx.globalAlpha = 0.4; ctx.drawImage(wh.spr, -s * 2.2, -s * 0.97); ctx.globalAlpha = 1;
    ctx.restore();
  }
  function ripple() {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    var tg = ctx.createLinearGradient(0, 0, 0, H * 0.2); tg.addColorStop(0, "rgba(170,225,255,0.2)"); tg.addColorStop(1, "rgba(170,225,255,0)"); ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H * 0.2);
    for (var i = 0; i < 5; i++) {
      var y = H * 0.015 + i * H * 0.026; ctx.strokeStyle = "rgba(195,238,255," + (0.09 - i * 0.013).toFixed(3) + ")"; ctx.lineWidth = 5 - i;
      ctx.beginPath(); for (var x = 0; x <= W; x += 12) { var yy = y + Math.sin(x * 0.018 + clock * 1.5 + i) * 6 + Math.sin(x * 0.05 - clock + i) * 3; if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); } ctx.stroke();
    }
    ctx.restore();
  }

  function water() {
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#0a5a8a"); g.addColorStop(0.5, "#0d6f9e"); g.addColorStop(1, "#07415f");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < rays.length; i++) { var r = rays[i], a = r.a * (0.6 + 0.4 * Math.sin(clock * 0.5 + r.ph)); ctx.fillStyle = "rgba(180,230,255," + a.toFixed(3) + ")"; ctx.beginPath(); ctx.moveTo(r.x, 0); ctx.lineTo(r.x + r.w, 0); ctx.lineTo(r.x + r.w * 2.2 + 60, H); ctx.lineTo(r.x + r.w * 1.2 + 40, H); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }

  function paint(dt) {
    clock += dt;
    water();
    // deep background: a rare little submarine (above the whale), then the whale + drifting fish schools
    nextSub -= dt; if (nextSub <= 0 && !sub) { sub = newSub(); nextSub = rnd(40, 90); }
    if (sub) {
      sub.x += sub.v * sub.dir * dt;
      sub.yo = Math.sin(clock * 0.8 + sub.ph) * sub.s * 0.6 + Math.sin(clock * 1.9 + sub.ph) * sub.s * 0.18;
      sub.beamCd -= dt; if (sub.beamCd <= 0) { sub.beamT = rnd(-0.2, 0.2); sub.beamCd = rnd(0.8, 2.8); }   // pick a new random aim + hold time
      sub.beam += (sub.beamT - sub.beam) * Math.min(1, dt * 1.6);                                          // ease toward it
      drawSub(sub);
      if ((sub.dir > 0 && sub.x > W + 170) || (sub.dir < 0 && sub.x < -170)) sub = null;
    }
    nextWhale -= dt;
    if (nextWhale <= 0 && whales.length < 1) { whales.push(newWhale(false)); nextWhale = rnd(20, 45); }
    for (var wi = whales.length - 1; wi >= 0; wi--) { var wh = whales[wi]; wh.x += wh.v * wh.dir * dt; drawWhale(wh); if ((wh.dir > 0 && wh.x > W + wh.s * 2) || (wh.dir < 0 && wh.x < -wh.s * 2)) whales.splice(wi, 1); }
    nextSchool -= dt; if (nextSchool <= 0 && schools.length < 2) { schools.push(newSchool(false)); nextSchool = rnd(9, 22); }
    for (var schi = schools.length - 1; schi >= 0; schi--) { var sch = schools[schi]; drawSchool(sch, dt); if ((sch.dir > 0 && sch.x > W + sch.s * 24) || (sch.dir < 0 && sch.x < -sch.s * 24)) schools.splice(schi, 1); }
    if (reef) ctx.drawImage(reef, 0, 0);
    for (var w = 0; w < weeds.length; w++) drawWeed(weeds[w]);   // seaweed sits between the back and front reef
    if (reefFront) ctx.drawImage(reefFront, 0, 0);               // front corals hide the weed roots
    for (var a = 0; a < anems.length; a++) drawAnem(anems[a]);
    // sand drifting along the floor in the current
    var cv = current() * 26;
    ctx.fillStyle = "rgba(196,176,128,0.5)";
    for (var gi = 0; gi < grains.length; gi++) { var gr = grains[gi]; gr.x += (cv + Math.sin(clock * 2 + gr.ph) * 7) * dt; if (gr.x > W + 3) gr.x = -3; else if (gr.x < -3) gr.x = W + 3; ctx.fillRect(gr.x, gr.y, gr.r, gr.r); }
    for (var tki = tracks.length - 1; tki >= 0; tki--) { var tk = tracks[tki]; tk.t += dt; var taa = (1 - tk.t / tk.max) * 0.2; if (taa <= 0) { tracks.splice(tki, 1); continue; } ctx.fillStyle = "rgba(95,74,40," + taa.toFixed(3) + ")"; ctx.beginPath(); ctx.ellipse(tk.x, tk.y, tk.r, tk.r * 0.5, 0, 0, 6.28); ctx.fill(); }   // fading crab footprints
    for (var ci = 0; ci < crabs.length; ci++) stepCrab(crabs[ci], dt);   // walk; hop over starfish; sometimes stumble
    ctx.fillStyle = "rgba(255,255,255,.16)";
    bubbles.forEach(function (b) { b.y -= b.v * dt; b.x += current() * 7 * dt + Math.sin(clock * 3 + b.y * 0.05) * 6 * dt; if (b.y < -6) { b.y = H + 6; b.x = rnd(0, W); } ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.28); ctx.fill(); });
    for (var hi = 0; hi < horses.length; hi++) { var hs = horses[hi]; hs.x += hs.v * hs.dir * dt; if (hs.x < 20) hs.dir = 1; else if (hs.x > W - 20) hs.dir = -1; drawHorse(hs); }
    for (var ji = 0; ji < jellies.length; ji++) drawJelly(jellies[ji], dt, true);   // pulsing jellyfish in the water column
    fish.forEach(function (f) {
      f.x += f.v * f.dir * dt; f.ph += dt * 2; f.nextBlink -= dt; if (f.nextBlink <= 0) { f.blink = 0.16; f.nextBlink = rnd(2.5, 8); } if (f.blink > 0) f.blink -= dt;
      f.y += Math.sin(clock * f.ws + f.ph) * f.wa * dt;   // wander vertically (curvy path)
      if (f.y < H * 0.08) f.y = H * 0.08; else if (f.y > sandY - f.s - 8) f.y = sandY - f.s - 8;   // never dive into the sand or breach the surface
      if (f.dir > 0 && f.x > W + f.s * 1.6) { f.x = -f.s * 1.6; f.y = rnd(H * 0.12, sandY - 10); }
      else if (f.dir < 0 && f.x < -f.s * 1.6) { f.x = W + f.s * 1.6; f.y = rnd(H * 0.12, sandY - 10); }
      drawFish(f);
    });
    nextEvent -= dt;
    if (nextEvent <= 0 && big.length === 0) { var bf = newFish(true); bf.s = rnd(46, 80); bf.v = rnd(40, 66); big.push(bf); nextEvent = rnd(24, 55); }
    for (var bi = big.length - 1; bi >= 0; bi--) { var gf = big[bi]; gf.x += gf.v * gf.dir * dt; gf.ph += dt * 2; drawFish(gf); if ((gf.dir > 0 && gf.x > W + gf.s * 1.8) || (gf.dir < 0 && gf.x < -gf.s * 1.8)) big.splice(bi, 1); }
    // marine snow (suspended particles) → water volume / depth
    for (var mi = 0; mi < motes.length; mi++) { var mt = motes[mi]; mt.y += mt.vy * dt; mt.x += (mt.vx + Math.sin(clock + mt.ph) * 4) * dt; if (mt.y > H + 4) { mt.y = -4; mt.x = rnd(0, W); } ctx.fillStyle = "rgba(220,240,255," + mt.a + ")"; ctx.beginPath(); ctx.arc(mt.x, mt.y, mt.r, 0, 6.28); ctx.fill(); }
    // depth vignette: darken the edges so the scene recedes
    var vg = ctx.createRadialGradient(W / 2, H * 0.4, H * 0.22, W / 2, H * 0.5, H * 0.95); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(2,18,34,0.42)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    ripple();   // shimmering water surface up top
  }

  SD.bgEngine.register({
    id: "aquarium",
    env: true,
    start: function (c, w, h) { ctx = c; W = w; H = h; if (!fish.length) spawn(); },
    resize: function (c, w, h) { ctx = c; W = w; H = h; spawn(); },
    frame: function (c, now, dt) { ctx = c; paint(dt); },
    rest: function (c) { ctx = c; paint(0); }
  });
})();
