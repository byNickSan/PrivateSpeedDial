// Icon handling: favicon resolution, any-format import with downscale, icon library, letter tiles.
(function () {
  "use strict";
  SD.icons = (function () {
    var MAX_DIM = 256;          // raster icons downscaled to this max edge
    var WEBP_QUALITY = 0.85;

    // Same-origin favicon URL (no third-party service).
    function faviconUrl(url) {
      try { return new URL(url).origin + "/favicon.ico"; } catch (e) { return ""; }
    }

    // Candidates largest-first (apple-touch-icon ~180px) down to favicon.ico, then a third-party favicon
    // service as a last resort (covers sites whose icon lives only in HTML, e.g. youtube/zheleza).
    function faviconCandidates(url) {
      try {
        var o = new URL(url).origin;
        return [
          o + "/apple-touch-icon.png",
          o + "/apple-touch-icon-precomposed.png",
          o + "/favicon.svg",
          o + "/favicon.ico",
          serviceIconUrl(url)
        ].filter(Boolean);
      } catch (e) { return []; }
    }
    // Third-party favicon service (DuckDuckGo) — used only as a fallback; sends the dial's host to DDG.
    function serviceIconUrl(url) {
      try { return "https://icons.duckduckgo.com/ip3/" + new URL(url).host + ".ico"; } catch (e) { return ""; }
    }

    function libraryIcon(state, refId) {
      return (state.iconLibrary || []).filter(function (i) { return i.id === refId; })[0] || null;
    }

    function letterDataUrl(title, accent) {
      var size = 96, c = document.createElement("canvas");
      c.width = c.height = size;
      var x = c.getContext("2d");
      x.fillStyle = accent || "#38bdf8";
      roundRect(x, 0, 0, size, size, 20); x.fill();
      x.fillStyle = "#ffffff";
      x.font = "600 48px system-ui, sans-serif";
      x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText(((title || "?").trim()[0] || "?").toUpperCase(), size / 2, size / 2 + 2);
      return c.toDataURL("image/png");
    }

    function roundRect(x, l, t, w, h, r) {
      x.beginPath();
      x.moveTo(l + r, t);
      x.arcTo(l + w, t, l + w, t + h, r);
      x.arcTo(l + w, t + h, l, t + h, r);
      x.arcTo(l, t + h, l, t, r);
      x.arcTo(l, t, l + w, t, r);
      x.closePath();
    }

    // Downscales raster; keeps SVG as-is.
    function importFile(file) {
      return new Promise(function (resolve, reject) {
        var isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
        var reader = new FileReader();
        reader.onerror = reject;
        if (isSvg) {
          reader.onload = function () {
            resolve({ name: file.name, format: "svg", dataUrl: reader.result, w: 0, h: 0, bytes: file.size });
          };
          reader.readAsDataURL(file);
          return;
        }
        reader.onload = function () {
          var img = new Image();
          img.onerror = reject;
          img.onload = function () {
            var scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
            var w = Math.max(1, Math.round(img.width * scale));
            var h = Math.max(1, Math.round(img.height * scale));
            var c = document.createElement("canvas");
            c.width = w; c.height = h;
            c.getContext("2d").drawImage(img, 0, 0, w, h);
            var dataUrl = c.toDataURL("image/webp", WEBP_QUALITY);
            // Fallback to PNG if webp unsupported.
            if (dataUrl.indexOf("image/webp") < 0) dataUrl = c.toDataURL("image/png");
            resolve({ name: file.name, format: "raster", dataUrl: dataUrl, w: w, h: h, bytes: dataUrl.length });
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    // "180x180"/"any" -> a comparable pixel size (svg/any rank highest).
    function sizeScore(sizes) { if (!sizes) return 0; if (/any/i.test(sizes)) return 9999; var m = sizes.match(/(\d+)x(\d+)/i); return m ? parseInt(m[1], 10) : 0; }

    // All icons declared on a page's HTML, best-first (deduped, absolute): web-app-manifest icons >
    // apple-touch-icon > <link rel=icon> (SVG/largest) > og:image. Needs a cross-origin read (host
    // permission); resolves [] on any failure. No third-party service.
    function gatherIcons(pageUrl) {
      var base; try { base = new URL(pageUrl).href; } catch (e) { return Promise.resolve([]); }
      function abs(h, rel) { try { return new URL(h, rel || base).href; } catch (e) { return ""; } }
      function finish(cands) {
        cands.sort(function (a, b) { return b.score - a.score; });
        var seen = {}, out = [];
        cands.forEach(function (c) { var u = abs(c.href); if (u && !seen[u]) { seen[u] = 1; out.push(u); } });
        return out;
      }
      return fetch(pageUrl, { credentials: "omit", redirect: "follow" }).then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.text(); }).then(function (html) {
        var head = html.slice(0, 120000), cands = [], manifestHref = "", m, re = /<link\b[^>]*>/gi;
        while ((m = re.exec(head))) {
          var tag = m[0];
          var rel = ((tag.match(/rel\s*=\s*["']([^"']+)["']/i) || [])[1] || "").toLowerCase();
          var href = (tag.match(/href\s*=\s*["']([^"']+)["']/i) || [])[1]; if (!href) continue;
          var sz = sizeScore((tag.match(/sizes\s*=\s*["']([^"']+)["']/i) || [])[1]);
          var type = (tag.match(/type\s*=\s*["']([^"']+)["']/i) || [])[1] || "";
          if (/apple-touch-icon/.test(rel)) cands.push({ href: href, score: 800 + (sz || 160) });
          else if (/(^|\s)icon(\s|$)/.test(rel) || /shortcut icon/.test(rel)) cands.push({ href: href, score: 400 + (/svg/i.test(type) ? 1100 : (sz || 60)) });
          else if (/manifest/.test(rel)) manifestHref = href;
        }
        var og = head.match(/<meta[^>]+(?:property|name)\s*=\s*["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*>/i);
        if (og) { var oc = og[0].match(/content\s*=\s*["']([^"']+)["']/i); if (oc) cands.push({ href: oc[1], score: 300 }); }
        cands.push({ href: "/favicon.ico", score: 50 });
        if (manifestHref) {
          var murl = abs(manifestHref);
          return fetch(murl, { credentials: "omit" }).then(function (r) { return r.json(); }).then(function (mf) {
            (mf.icons || []).forEach(function (ic) { if (ic.src) cands.push({ href: abs(ic.src, murl), score: 900 + (/svg/i.test(ic.type || "") ? 1100 : (sizeScore(ic.sizes) || 100)) }); });
            return finish(cands);
          }).catch(function () { return finish(cands); });
        }
        return finish(cands);
      }).catch(function () { return []; });
    }
    // Best icon from the page's own HTML (private; needs host permission); falls back to the favicon
    // service so a dial always ends up with a real icon even without a host grant.
    function resolveBestIcon(pageUrl) { return gatherIcons(pageUrl).then(function (list) { return list[0] || serviceIconUrl(pageUrl); }); }

    function blobToDataUrl(blob) {
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
    }
    // Download an icon and return a self-contained data: URL (SVG kept as-is; raster downscaled to 128px
    // webp/png) so the dial renders the icon from storage forever — never re-fetching it from the network.
    // Needs a cross-origin read (host permission); rejects otherwise (caller then caches the bare URL).
    function iconToDataUrl(url) {
      if (/^data:/i.test(url)) return Promise.resolve(url);
      return fetch(url, { credentials: "omit" }).then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        return r.blob();
      }).then(function (blob) {
        if (blob.type === "image/svg+xml" || /\.svg($|\?)/i.test(url)) return blobToDataUrl(blob);
        return new Promise(function (resolve, reject) {
          var obj = URL.createObjectURL(blob), img = new Image();
          img.onload = function () {
            var max = 128, scale = Math.min(1, max / Math.max(img.width || max, img.height || max));
            var w = Math.max(1, Math.round((img.width || max) * scale)), h = Math.max(1, Math.round((img.height || max) * scale));
            var c = document.createElement("canvas"); c.width = w; c.height = h;
            c.getContext("2d").drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(obj);
            var d = c.toDataURL("image/webp", 0.85);
            if (d.indexOf("image/webp") < 0) d = c.toDataURL("image/png");
            resolve(d);
          };
          img.onerror = function () { URL.revokeObjectURL(obj); reject(new Error("decode")); };
          img.src = obj;
        });
      });
    }

    return { faviconUrl: faviconUrl, faviconCandidates: faviconCandidates, serviceIconUrl: serviceIconUrl, resolveBestIcon: resolveBestIcon, iconToDataUrl: iconToDataUrl, gatherIcons: gatherIcons, libraryIcon: libraryIcon, letterDataUrl: letterDataUrl, importFile: importFile };
  })();
})();
