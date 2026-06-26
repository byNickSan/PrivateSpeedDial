// Background renderer: animated CSS gradients (aurora/flame/tide/custom), solid, image, auto image.
(function () {
  "use strict";
  SD.backgrounds = (function () {
    function gradientCss(g) {
      switch (g.preset) {
        case "theme":
          // Built from scheme vars so it adapts to light/dark.
          return "linear-gradient(" + (g.angle || 160) + "deg, var(--bg), var(--surface))";
        case "flame":
          return "linear-gradient(0deg, #7f1d1d, #b91c1c 35%, #f97316 70%, #fde047)";
        case "tide":
          return "linear-gradient(110deg, #0c4a6e, #0e7490 30%, #0891b2 55%, #22d3ee 80%, #67e8f9)";
        case "aurora":
          return "linear-gradient(135deg, #1e3a8a, #6d28d9 40%, #9333ea 60%, #0ea5e9)";
        default:
          return "linear-gradient(" + (g.angle || 135) + "deg, " + (g.stops || ["#1e293b", "#0ea5e9"]).join(", ") + ")";
      }
    }

    // Keyless direct-image-URL providers (no JSON fetch) so they work behind the CSP.
    var AUTO_PROVIDERS = {
      picsum: {
        origin: "https://picsum.photos",
        url: function (ai) { return "https://picsum.photos/seed/" + bucket(ai) + "/1920/1080"; }
      },
      loremflickr: {
        // `lock` keeps one image stable per bucket.
        origin: "https://loremflickr.com",
        url: function (ai) {
          var q = (ai.query || "nature").trim().replace(/\s+/g, ",");
          return "https://loremflickr.com/1920/1080/" + encodeURIComponent(q) + "?lock=" + bucketNum(ai);
        }
      },
      picsumGrayscale: {
        origin: "https://picsum.photos",
        url: function (ai) { return "https://picsum.photos/seed/" + bucket(ai) + "/1920/1080?grayscale"; }
      }
    };

    function autoImageOrigin(ai) {
      if (ai.provider === "custom" && ai.custom && ai.custom.endpoint) {
        try { return new URL(ai.custom.endpoint).origin; } catch (e) { return ""; }
      }
      var p = AUTO_PROVIDERS[ai.provider];
      return p ? p.origin : "https://picsum.photos";
    }

    function autoImageUrl(ai) {
      if (ai.cache && ai.cache.url && ai.cache.bucket === bucket(ai)) return ai.cache.url;
      if (ai.provider === "custom" && ai.custom && ai.custom.endpoint) return ai.custom.endpoint;
      var p = AUTO_PROVIDERS[ai.provider] || AUTO_PROVIDERS.picsum;
      return p.url(ai);
    }

    // Time bucket: image rotates only every intervalMin minutes.
    function bucketNum(ai) {
      var ms = Math.max(1, ai.intervalMin || 30) * 60000;
      return Math.floor(Date.now() / ms);
    }
    function bucket(ai) { return "b" + bucketNum(ai); }

    function apply(state) {
      var bg = state.settings.background;
      var el = document.getElementById("bg");
      if (!el) return;
      el.className = "";
      el.style.backgroundImage = "";
      el.style.backgroundColor = "";
      el.style.backgroundSize = "";

      if (bg.type === "color") {
        // Empty color = transparent, so the scheme background shows through.
        el.style.backgroundColor = bg.color || "transparent";
      } else if (bg.type === "image" && bg.image && bg.image.dataUrl) {
        el.style.backgroundImage = "url(" + JSON.stringify(bg.image.dataUrl) + ")";
        el.classList.add("bg-cover");
      } else if (bg.type === "autoImage" && bg.autoImage && bg.autoImage.enabled) {
        var url = autoImageUrl(bg.autoImage);
        if (url) { el.style.backgroundImage = "url(" + JSON.stringify(url) + ")"; el.classList.add("bg-cover"); }
      } else {
        var g = bg.gradient;
        el.style.backgroundImage = gradientCss(g);
        el.classList.add("bg-gradient");
        if (g.animated) el.classList.add("bg-animated");
        else el.style.backgroundSize = "cover";
        el.style.setProperty("--bg-anim-speed", (g.animSpeedMs || 14000) + "ms");
      }
      document.documentElement.style.setProperty("--bg-blur", (bg.blur || 0) + "px");
      document.documentElement.style.setProperty("--bg-dim", (bg.dim || 0) / 100);
    }

    return { apply: apply, gradientCss: gradientCss, autoImageUrl: autoImageUrl, autoImageOrigin: autoImageOrigin, AUTO_PROVIDERS: AUTO_PROVIDERS };
  })();
})();
