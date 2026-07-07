// Micro-life toolkit (§I + §H): the shared substrate for inhabited scenes (oldtown / future-city / lake).
// Characters are vector-drawn ONCE into small offscreen sprites (2–3 pose frames) then blitted; rarity tiers
// drive exponential spawn gaps; an anti-déjà-vu ring lowers the weight of recently shown vignettes so repeats
// feel rare. No canvas ownership — scenes supply the draw fns and behaviors. Contract: docs/BACKGROUNDS-ARCH.md §6.
(function () {
  "use strict";
  SD.bgLife = (function () {
    // §H mean wait per tier (ms): common 20–60s · uncommon 2–5m · rare 10–30m · epic 1–4h
    var TIER_MS = { common: 40000, uncommon: 210000, rare: 1200000, epic: 9000000 };
    // base selection weight per tier (which vignette fires when a slot is due)
    var TIER_W = { common: 8, uncommon: 4, rare: 1.5, epic: 0.3 };

    function rnd(a, b) { return a + Math.random() * (b - a); }
    function expGap(meanMs) { return meanMs * (-Math.log(1 - Math.random())); }   // exponential, no mechanical rhythm

    /* ---------- character sprite cache ---------- */
    var sprites = {};
    // drawFns: array of (ctx, w, h) -> void, one per pose frame. Baked once, keyed; later calls return the cache.
    function makeSprite(key, w, h, drawFns) {
      if (sprites[key]) return sprites[key];
      var frames = drawFns.map(function (fn) {
        var c = document.createElement("canvas"); c.width = Math.ceil(w); c.height = Math.ceil(h);
        fn(c.getContext("2d"), w, h); return c;
      });
      return (sprites[key] = { key: key, w: w, h: h, frames: frames });
    }
    // walk-cycle frame: alternate poses every msPer (120–180ms); pass 0 frame when reduced-motion (static).
    function walkFrame(spr, now, msPer) {
      if (spr.frames.length < 2) return spr.frames[0];
      return spr.frames[Math.floor(now / (msPer || 150)) % spr.frames.length];
    }

    /* ---------- anti-déjà-vu ring (§H) ---------- */
    function ring(n) {
      var buf = [], cap = n || 16;
      return {
        push: function (id) { buf.push(id); if (buf.length > cap) buf.shift(); },
        recent: function (id) { var c = 0; for (var i = 0; i < buf.length; i++) if (buf[i] === id) c++; return c; },
        buf: buf
      };
    }

    // catalog: [{ id, tier, weight? }]. Picks one by tier-weight × item.weight, damped by recent appearances.
    function pickVignette(catalog, r) {
      var ws = [], tot = 0, i;
      for (i = 0; i < catalog.length; i++) {
        var v = catalog[i];
        var w = (v.weight || 1) * (TIER_W[v.tier] || 1) / (1 + (r ? r.recent(v.id) : 0) * 2);
        ws.push(w); tot += w;
      }
      if (tot <= 0) return null;
      var x = Math.random() * tot;
      for (i = 0; i < catalog.length; i++) { x -= ws[i]; if (x <= 0) { if (r) r.push(catalog[i].id); return catalog[i]; } }
      return catalog[catalog.length - 1];
    }

    /* ---------- slot scheduler (one planner per slot, §0.3/§H) ---------- */
    function slot(kind) { return { kind: kind, free: true, nextAt: 0, actor: null }; }
    function due(s, now) { return s.free && now >= s.nextAt; }
    function arm(s, now, tier) { s.nextAt = now + expGap(TIER_MS[tier] || TIER_MS.common); }

    /* ---------- actor (FSM enter→act→exit; scene drives transitions/paths) ---------- */
    function actor(o) {
      return {
        x: o.x, y: o.y, dir: o.dir || 1, v: o.v || 30, ph: rnd(0, 6.28),
        state: "enter", t: 0, ttl: o.ttl || 0, spr: o.spr, variant: o.variant, data: o.data || {}
      };
    }
    function step(a, dt) { a.x += a.v * a.dir * dt; a.ph += dt; a.t += dt; return a; }
    function offscreen(a, W, pad) { pad = pad == null ? 80 : pad; return a.dir > 0 ? a.x > W + pad : a.x < -pad; }

    return {
      TIER_MS: TIER_MS, TIER_W: TIER_W, rnd: rnd, expGap: expGap,
      makeSprite: makeSprite, walkFrame: walkFrame,
      ring: ring, pickVignette: pickVignette,
      slot: slot, due: due, arm: arm,
      actor: actor, step: step, offscreen: offscreen
    };
  })();
})();
