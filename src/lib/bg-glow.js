// Glow / reflection / glint helpers (§L): bake ONE soft radial glow sprite, reuse it via additive drawImage
// with cached tinted copies — "looks rich, costs little" (no createRadialGradient per frame). No canvas
// ownership, no rAF; city/oldtown/future scenes call these for headlights, taxi/neon glow, window streaks,
// and puddle / wet-neon reflections. Contract: docs/BACKGROUNDS-ARCH.md §5.
(function () {
  "use strict";
  SD.bgGlow = (function () {
    var base = null, tintCache = {};

    // radial white(1)→transparent, baked once into a 64×64 offscreen canvas
    function sprite() {
      if (base) return base;
      var s = 64, c = document.createElement("canvas"); c.width = s; c.height = s;
      var g = c.getContext("2d");
      var rg = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      rg.addColorStop(0, "rgba(255,255,255,1)");
      rg.addColorStop(0.5, "rgba(255,255,255,0.55)");
      rg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = rg; g.fillRect(0, 0, s, s);
      base = c; return base;
    }

    // a colored copy of the glow (cached per hex) — for warm headlights, red tails, neon signs, taxi amber
    function tinted(hex) {
      if (tintCache[hex]) return tintCache[hex];
      var src = sprite(), s = src.width, c = document.createElement("canvas"); c.width = s; c.height = s;
      var g = c.getContext("2d");
      g.drawImage(src, 0, 0);
      g.globalCompositeOperation = "source-in";   // keep the glow's alpha, repaint it the tint color
      g.fillStyle = hex; g.fillRect(0, 0, s, s);
      tintCache[hex] = c; return c;
    }

    // additive soft light centered at (x,y), radius r; tintSprite optional (default = white glow)
    function draw(ctx, x, y, r, alpha, tintSprite) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      ctx.drawImage(tintSprite || sprite(), x - r, y - r, r * 2, r * 2);
      ctx.restore();
    }

    // vertical mirrored alpha copy below the waterline at (x,y): puddle / wet-neon reflection.
    // wobble = px horizontal sway (pass sin(now)*amp). Spans screen y..y+h downward, flipped.
    function reflection(ctx, srcSprite, x, y, w, h, alpha, wobble) {
      ctx.save();
      ctx.globalAlpha = alpha == null ? 0.22 : alpha;
      ctx.translate(x + (wobble || 0), y);
      ctx.scale(1, -1);
      ctx.drawImage(srcSprite, -w / 2, -h, w, h);
      ctx.restore();
    }

    // diagonal (~45°) light streak sweeping across a glass facade rect; phase 0..1 drives position
    function streak(ctx, x, y, w, h, phase) {
      var span = w + h, p = ((phase % 1) + 1) % 1, c = p * span * 1.4 - h;
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.globalCompositeOperation = "lighter";
      var g = ctx.createLinearGradient(x + c, y, x + c + h, y + h);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,0.10)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      ctx.restore();
    }

    return { sprite: sprite, tinted: tinted, draw: draw, reflection: reflection, streak: streak };
  })();
})();
