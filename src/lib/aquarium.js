// Background effect: a canvas aquarium — swaying seaweed, rising bubbles, and fish that wiggle their tails
// and blink. Painted over the water gradient (the "aquarium" preset). Pauses when hidden; honors
// prefers-reduced-motion (static frame).
(function () {
  "use strict";
  SD.aquarium = (function () {
    var cv, ctx, W = 0, H = 0, fish = [], bubbles = [], plants = [], big = [], nextEvent = 20, running = false, last = 0, clock = 0, dpr = 1, bound = false;
    var COLORS = ["#ff8a3d", "#ffd166", "#ef476f", "#06d6a0", "#f4a261", "#48cae4", "#ff70a6", "#e9c46a"];
    var WEED = ["#1b7a4b", "#2e9e63", "#15633c", "#3bb273"];

    function ensure() {
      if (cv) return;
      cv = document.createElement("canvas");
      cv.id = "bg-fx";
      document.body.appendChild(cv);
      if (!bound) { window.addEventListener("resize", function () { if (running) { resize(); spawn(); } }); bound = true; }
    }
    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + "px"; cv.style.height = H + "px";
      ctx = cv.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function spawn() {
      fish = []; bubbles = []; plants = []; big = []; nextEvent = rnd(15, 35);
      var n = Math.max(6, Math.min(14, Math.round(W / 150)));
      for (var i = 0; i < n; i++) {
        fish.push({ x: rnd(0, W), y: rnd(H * 0.1, H * 0.86), s: rnd(15, 32), v: rnd(14, 32), dir: Math.random() < 0.5 ? 1 : -1, ph: rnd(0, 6.28), blink: 0, nextBlink: rnd(2, 7), col: COLORS[i % COLORS.length] });
      }
      for (var j = 0; j < 28; j++) bubbles.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(1.5, 4), v: rnd(12, 32) });
      var pn = Math.max(5, Math.min(16, Math.round(W / 130)));
      for (var k = 0; k < pn; k++) plants.push({ x: rnd(0, W), h: rnd(H * 0.18, H * 0.42), ph: rnd(0, 6.28), w: rnd(4, 9), col: WEED[k % WEED.length] });
    }
    function drawPlants() {
      for (var i = 0; i < plants.length; i++) {
        var p = plants[i];
        for (var b = -1; b <= 1; b++) {   // 3 blades per cluster
          var x = p.x + b * p.w * 1.3, h = p.h * (1 - Math.abs(b) * 0.18);
          var sway = Math.sin(clock * 0.8 + p.ph + b) * 14;
          ctx.strokeStyle = p.col; ctx.globalAlpha = 0.5; ctx.lineWidth = p.w; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(x, H + 4);
          ctx.quadraticCurveTo(x + sway * 0.5, H - h * 0.5, x + sway, H - h);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
    function drawFish(f) {
      var s = f.s, sway = Math.sin(f.ph * 3);   // -1..1 swim oscillation
      ctx.save();
      ctx.translate(f.x, f.y + Math.sin(f.ph) * 3);
      ctx.scale(f.dir, 1);
      ctx.fillStyle = f.col; ctx.globalAlpha = 0.93;
      // forked tail that swishes: two lobes with a concave notch, tips sway up/down (no flat vertical edge)
      ctx.beginPath();
      ctx.moveTo(-s * 0.78, 0);
      ctx.quadraticCurveTo(-s * 1.25, -s * 0.18 + sway * s * 0.18, -s * 1.55, -s * 0.55 + sway * s * 0.4);
      ctx.lineTo(-s * 1.18, sway * s * 0.12);   // fork notch
      ctx.lineTo(-s * 1.55, s * 0.55 + sway * s * 0.4);
      ctx.quadraticCurveTo(-s * 1.25, s * 0.18 + sway * s * 0.18, -s * 0.78, 0);
      ctx.closePath(); ctx.fill();
      // dorsal fin: a low swept ridge along the top of the back (not a bump)
      ctx.beginPath();
      ctx.moveTo(s * 0.35, -s * 0.44);
      ctx.quadraticCurveTo(-s * 0.1, -s * 0.92 + sway * s * 0.06, -s * 0.55, -s * 0.42);
      ctx.closePath(); ctx.fill();
      // small pelvic fin underneath
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(s * 0.05, s * 0.46);
      ctx.quadraticCurveTo(-s * 0.15, s * 0.82 - sway * s * 0.08, -s * 0.38, s * 0.44);
      ctx.closePath(); ctx.fill();
      // body
      ctx.globalAlpha = 0.93;
      ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.56, 0, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
      if (f.blink > 0) {   // blink: eye as a short line
        ctx.strokeStyle = "#10293b"; ctx.lineWidth = Math.max(1.4, f.s * 0.07); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(f.s * 0.42, -f.s * 0.12); ctx.lineTo(f.s * 0.62, -f.s * 0.12); ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.beginPath(); ctx.arc(f.s * 0.5, -f.s * 0.12, f.s * 0.13, 0, 6.2832); ctx.fill();
        ctx.fillStyle = "#10293b"; ctx.beginPath(); ctx.arc(f.s * 0.54, -f.s * 0.12, f.s * 0.06, 0, 6.2832); ctx.fill();
      }
      ctx.restore();
    }
    function paint(dt) {
      clock += dt;
      ctx.clearRect(0, 0, W, H);
      drawPlants();
      ctx.fillStyle = "rgba(255,255,255,.16)";
      bubbles.forEach(function (b) { b.y -= b.v * dt; if (b.y < -6) { b.y = H + 6; b.x = rnd(0, W); } ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832); ctx.fill(); });
      fish.forEach(function (f) {
        f.x += f.v * f.dir * dt; f.ph += dt * 2;
        f.nextBlink -= dt; if (f.nextBlink <= 0) { f.blink = 0.16; f.nextBlink = rnd(2.5, 8); }   // schedule blinks
        if (f.blink > 0) f.blink -= dt;
        if (f.dir > 0 && f.x > W + f.s * 1.6) { f.x = -f.s * 1.6; f.y = rnd(H * 0.1, H * 0.86); }
        else if (f.dir < 0 && f.x < -f.s * 1.6) { f.x = W + f.s * 1.6; f.y = rnd(H * 0.1, H * 0.86); }
        drawFish(f);
      });
      // Random event: occasionally one big fish makes a single pass across the tank (cheap — one entity).
      nextEvent -= dt;
      if (nextEvent <= 0 && big.length === 0) {
        var dir = Math.random() < 0.5 ? 1 : -1, bs = rnd(56, 88);
        big.push({ x: dir > 0 ? -bs * 1.7 : W + bs * 1.7, y: rnd(H * 0.25, H * 0.7), s: bs, v: rnd(46, 74), dir: dir, ph: rnd(0, 6.28), blink: 0, nextBlink: rnd(2, 6), col: COLORS[Math.floor(Math.random() * COLORS.length)] });
        nextEvent = rnd(24, 55);
      }
      for (var bi = big.length - 1; bi >= 0; bi--) {
        var g = big[bi]; g.x += g.v * g.dir * dt; g.ph += dt * 2;
        g.nextBlink -= dt; if (g.nextBlink <= 0) { g.blink = 0.16; g.nextBlink = rnd(2.5, 8); } if (g.blink > 0) g.blink -= dt;
        drawFish(g);
        if ((g.dir > 0 && g.x > W + g.s * 1.8) || (g.dir < 0 && g.x < -g.s * 1.8)) big.splice(bi, 1);
      }
    }
    function frame() {
      if (!running) return;
      var now = (window.performance && performance.now()) || 0;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
      if (!document.hidden) paint(dt);
      requestAnimationFrame(frame);
    }
    function reduced() { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    function start() {
      ensure(); cv.style.display = "";
      if (running) return;
      resize(); if (!fish.length) spawn();
      running = true; last = 0;
      if (reduced()) paint(0); else requestAnimationFrame(frame);
    }
    function stop() { running = false; if (cv) cv.style.display = "none"; }
    return { start: start, stop: stop };
  })();
})();
