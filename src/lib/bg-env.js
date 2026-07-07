// Environment layer (§B): time-of-day palette + tint, seasonal accent, and weather particles (rain/snow/fog)
// drawn on the SAME #bg-fx canvas. Reused by all "city"/living scenes. A scene opts in with `env: true`; the
// engine then calls overlay()/overlayRest() after the scene draws. Pure-ish: resolve(cfg) -> env descriptor;
// overlay() owns a single particle pool sized to the canvas. Contract: docs/BACKGROUNDS-ARCH.md §4.
(function () {
  "use strict";
  SD.bgEnv = (function () {
    var SKY = {
      day: ["#4a78c9", "#87b6e8", "#cfe5ff"],
      sunset: ["#2a2350", "#7a3b6e", "#ff7a4d", "#ffd27a"],
      night: ["#05060f", "#0a0e24", "#1b1140"]
    };
    var TINT = { day: null, sunset: "rgba(255,140,60,0.10)", night: "rgba(10,12,40,0.22)", dawn: "rgba(255,180,120,0.08)" };
    // cheap seasonal mood wash applied over any env scene (city scenes also bake snow/foliage separately)
    var SEASON_TINT = { spring: "rgba(120,210,140,0.06)", summer: "rgba(255,210,120,0.06)", autumn: "rgba(255,181,90,0.09)", winter: "rgba(200,222,240,0.10)" };

    function autoTime(h) {   // §B1 auto mapping
      if (h >= 20 || h < 5) return "night";
      if (h < 8) return "dawn";       // dawn = day palette + warm tint
      if (h < 17) return "day";
      return "sunset";
    }
    function autoSeason(m) { return m <= 1 || m === 11 ? "winter" : m <= 4 ? "spring" : m <= 7 ? "summer" : "autumn"; }

    // random-weather state (§B4): every ~4–8 min softly re-pick, weights by season
    var rwNext = 0, rwCur = "clear";
    function seasonWeights(season) {
      if (season === "winter") return [["clear", 4], ["snow", 4], ["fog", 2]];
      if (season === "autumn") return [["clear", 4], ["rain", 3], ["fog", 3]];
      if (season === "spring") return [["clear", 5], ["rain", 3], ["fog", 2]];
      return [["clear", 7], ["rain", 2], ["fog", 1]];   // summer
    }
    function pick(weights) {
      var tot = 0, i; for (i = 0; i < weights.length; i++) tot += weights[i][1];
      var r = Math.random() * tot;
      for (i = 0; i < weights.length; i++) { r -= weights[i][1]; if (r <= 0) return weights[i][0]; }
      return weights[0][0];
    }
    function randomWeather(season, now) {
      if (now >= rwNext) { rwCur = pick(seasonWeights(season)); rwNext = now + (240000 + Math.random() * 240000); }
      return rwCur;
    }

    function resolve(cfg) {
      cfg = cfg || {};
      var now = (window.performance && performance.now()) || 0;
      var d = new Date();
      var time = cfg.time && cfg.time !== "auto" ? cfg.time : autoTime(d.getHours());
      var season = cfg.season && cfg.season !== "auto" ? cfg.season : autoSeason(d.getMonth());
      var palKey = time === "dawn" ? "day" : time;
      var weather = cfg.randomWeather ? randomWeather(season, now) : (cfg.weather || "clear");
      return {
        time: time, season: season, weather: weather,
        skyStops: SKY[palKey].slice(),
        tint: TINT[time] || null,
        seasonTint: SEASON_TINT[season] || null,
        accent: season === "autumn" ? "#ffb55a" : null,
        desat: season === "winter" ? 0.12 : 0
      };
    }

    /* ---------- weather particles ---------- */
    var pool = [], pW = 0, pH = 0, pKind = "", pBp = "";
    var RAIN_N = { S: 40, M: 70, L: 100 }, SNOW_N = { S: 30, M: 50, L: 70 };
    function rnd(a, b) { return a + Math.random() * (b - a); }

    function rebuild(kind, W, H, bp) {
      pool = []; pKind = kind; pW = W; pH = H; pBp = bp;
      if (kind === "rain") {
        var rn = RAIN_N[bp] || 70;
        for (var i = 0; i < rn; i++) pool.push({ x: Math.random() * W, y: Math.random() * H, len: rnd(8, 16), v: rnd(640, 900) });
      } else if (kind === "snow") {
        var sn = SNOW_N[bp] || 50;
        for (var j = 0; j < sn; j++) pool.push({ x: Math.random() * W, y: Math.random() * H, r: rnd(1, 3), v: rnd(40, 90), amp: rnd(10, 20), hz: rnd(0.2, 0.5), ph: rnd(0, 6.28) });
      }
    }
    function ensure(kind, W, H, bp) { if (kind !== pKind || W !== pW || H !== pH || bp !== pBp) rebuild(kind, W, H, bp); }

    function fog(ctx, W, H) {   // static gradient overlay, no particles, no blur
      var g = ctx.createLinearGradient(0, H, 0, H * 0.45);
      g.addColorStop(0, "rgba(200,205,215,0.35)"); g.addColorStop(1, "rgba(200,205,215,0)");
      ctx.fillStyle = g; ctx.fillRect(0, H * 0.45, W, H * 0.55);
    }

    function overlay(ctx, W, H, now, dt, env, bp) {
      if (!env) return;
      if (env.tint) { ctx.fillStyle = env.tint; ctx.fillRect(0, 0, W, H); }
      if (env.seasonTint) { ctx.fillStyle = env.seasonTint; ctx.fillRect(0, 0, W, H); }
      var w = env.weather;
      if (w === "rain") {
        ensure("rain", W, H, bp);
        var dx = 0.21;   // ~12° from vertical (78° fall): horizontal offset per vertical unit
        ctx.strokeStyle = "rgba(180,200,230,0.35)"; ctx.lineWidth = 1; ctx.beginPath();
        for (var i = 0; i < pool.length; i++) {
          var p = pool[i]; p.y += p.v * dt;
          if (p.y > H + p.len) { p.y = -p.len; p.x = Math.random() * W; }
          ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.len * dx, p.y - p.len);
        }
        ctx.stroke();
      } else if (w === "snow") {
        ensure("snow", W, H, bp);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        for (var j = 0; j < pool.length; j++) {
          var s = pool[j]; s.y += s.v * dt;
          var x = s.x + Math.sin(now / 1000 * s.hz + s.ph) * s.amp;
          if (s.y > H + s.r) { s.y = -s.r; s.x = Math.random() * W; }
          ctx.beginPath(); ctx.arc(x, s.y, s.r, 0, 6.2832); ctx.fill();
        }
      } else if (w === "fog") {
        fog(ctx, W, H);
      }
    }

    function overlayRest(ctx, W, H, env) {   // reduced-motion: tint + static precip tint, no motion
      if (!env) return;
      if (env.tint) { ctx.fillStyle = env.tint; ctx.fillRect(0, 0, W, H); }
      if (env.seasonTint) { ctx.fillStyle = env.seasonTint; ctx.fillRect(0, 0, W, H); }
      if (env.weather === "rain") { ctx.fillStyle = "rgba(150,170,200,0.10)"; ctx.fillRect(0, 0, W, H); }
      else if (env.weather === "snow") { ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(0, 0, W, H); }
      else if (env.weather === "fog") { fog(ctx, W, H); }
    }

    return { resolve: resolve, overlay: overlay, overlayRest: overlayRest };
  })();
})();
