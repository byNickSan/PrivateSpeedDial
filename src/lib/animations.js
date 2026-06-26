// Maps animation settings to CSS custom properties; respects prefers-reduced-motion.
(function () {
  "use strict";
  SD.animations = (function () {
    function apply(state) {
      var a = state.settings.animation;
      var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var r = document.documentElement.style;
      // Keep the subtle, user-configured hover even under reduce-motion; gate only the larger group/background motion.
      r.setProperty("--anim-speed", (reduce ? 120 : a.speedMs) + "ms");
      document.body.setAttribute("data-hover", a.hover || "scale");
      document.body.setAttribute("data-group-anim", reduce ? "none" : a.groupSwitch);
    }

    return { apply: apply };
  })();
})();
