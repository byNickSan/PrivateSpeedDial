// Background scene engine: owns the single #bg-fx canvas and the rAF lifecycle for ALL animated scenes.
// Scenes register { id, fps?, start?, resize?, frame, rest, stop? } and only draw; the engine handles DPR
// clamp (<=2), ResizeObserver (debounced 150ms), visibility pause (cancel rAF when hidden), reduced-motion
// (one static `rest` frame, no loop), plus shared helpers: exponential scheduler (§0.3), offscreen layer
// cache (§0.4), auto-pan parallax (§0.5). Generalizes the budget pattern from the old aquarium module.
// Contract: docs/BACKGROUNDS-ARCH.md §2–§3.
(function () {
  "use strict";
  SD.bgEngine = (function () {
    var cv, ctx, W = 0, H = 0, dpr = 1, raf = 0, running = false, last = 0;
    var scenes = {}, current = null, bound = false, ro = null, roTimer = 0;

    function ensure() {
      if (cv) return;
      cv = document.createElement("canvas");
      cv.id = "bg-fx";
      document.body.appendChild(cv);
      if (bound) return;
      document.addEventListener("visibilitychange", onVisibility);
      if (window.ResizeObserver) { ro = new ResizeObserver(onResize); ro.observe(document.documentElement); }
      else window.addEventListener("resize", onResize);
      bound = true;
    }

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + "px"; cv.style.height = H + "px";
      ctx = cv.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function onResize() {
      if (!current) return;
      clearTimeout(roTimer);
      roTimer = setTimeout(function () {
        if (!current) return;
        resize();
        if (current.resize) SD.safe("bg:resize", function () { current.resize(ctx, W, H, env()); });
        if (!running) paintRest();   // refresh the reduced-motion frame after a resize
      }, 150);
    }

    function curCfg() {
      var s = SD.store && SD.store.get();
      return (s && s.settings.background && s.settings.background.env) || null;
    }
    function env() { return SD.bgEnv ? SD.bgEnv.resolve(curCfg()) : null; }   // null until bg-env (T2) ships
    function reduced() { return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); }

    function frame() {
      raf = 0;
      if (!running || document.hidden) return;
      var now = (window.performance && performance.now()) || 0;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
      var e = env();
      SD.safe("bg:frame", function () { current.frame(ctx, now, dt, e); });
      if (current.env && SD.bgEnv) SD.safe("bg:env", function () { SD.bgEnv.overlay(ctx, W, H, now, dt, e, bp(W)); });
      raf = requestAnimationFrame(frame);
    }

    function paintRest() {
      if (!current || !ctx) return;
      var e = env();
      ctx.clearRect(0, 0, W, H);
      SD.safe("bg:rest", function () { current.rest(ctx, e); });
      if (current.env && SD.bgEnv) SD.safe("bg:env", function () { SD.bgEnv.overlayRest(ctx, W, H, e); });
    }

    function loop() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); }

    function onVisibility() {
      if (!current) return;
      if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
      else if (running && !raf && !reduced()) { last = 0; raf = requestAnimationFrame(frame); }
    }

    function register(scene) { if (scene && scene.id) scenes[scene.id] = scene; }
    function has(id) { return !!scenes[id]; }
    function usesEnv(id) { return !!(scenes[id] && scenes[id].env); }   // scene opts into the §B env layer

    function select(id) {
      var sc = scenes[id];
      if (!sc) return stop();
      if (current === sc && cv && cv.style.display !== "none") return;   // already active — don't re-init (avoid flicker)
      ensure(); cv.style.display = "";
      if (current && current !== sc && current.stop) SD.safe("bg:stop", function () { current.stop(); });
      current = sc;
      running = false; if (raf) { cancelAnimationFrame(raf); raf = 0; }
      resize();
      var init = sc.start || sc.resize;
      if (init) SD.safe("bg:start", function () { init.call(sc, ctx, W, H, env()); });
      if (reduced()) paintRest(); else loop();
    }

    function stop() {
      running = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (current && current.stop) SD.safe("bg:stop", function () { current.stop(); });
      current = null;
      if (cv) cv.style.display = "none";
    }

    // §0.3 exponential event scheduler: mean wait = ev.meanGapMs
    function scheduleNext(ev, now) { ev.nextAt = now + ev.meanGapMs * (-Math.log(1 - Math.random())); }
    // §0.4 offscreen layer cache — plain <canvas> (NOT OffscreenCanvas: Safari/cross-browser)
    function makeCache(w, h, drawFn) {
      var c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
      if (drawFn) drawFn(c.getContext("2d"), w, h);
      return c;
    }
    // §0.5 auto-pan parallax driver (px offset; multiply by a layer's parallaxFactor)
    function camX(now) { return 18 * Math.sin(2 * Math.PI * now / 40000); }
    // width breakpoint S/M/L
    function bp(w) { var x = w || W; return x <= 900 ? "S" : x <= 1440 ? "M" : "L"; }

    return {
      register: register, has: has, usesEnv: usesEnv, select: select, stop: stop,
      scheduleNext: scheduleNext, makeCache: makeCache, camX: camX, bp: bp, reduced: reduced
    };
  })();
})();
