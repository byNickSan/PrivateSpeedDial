// Layer: widget. News feed (local, consent-gated): RSS/Atom reader rendered as a card grid.
// Works with any source (incl. YouTube channel/playlist feeds): a host grant for the source
// origin is requested per-source (bypasses CORS). Each card shows a static preview thumbnail
// (never an embedded player — keeps memory low) with a play badge for video items; when there's
// no usable preview it falls back to a source plate (source name in the source's colour). A
// small site favicon is shown in the corner. Pagination appends; the pool is the union of feeds.
(function () {
  "use strict";
  var TTL = 5 * 60000;
  var pillScroll = null;   // active window-scroll handler for the floating "load new" pill (one at a time)
  var io = null;        // shared lazy-load observer; disconnected before each re-render (no leak)
  // Persisted feed cache (localStorage): a fresh new-tab shows news instantly, then refreshes in the
  // background. url -> { ts, items }. Items accumulate over a 2-day window (deduped); older ones expire.
  var MERGE_WINDOW = 2 * 86400000;
  var CKEY = "sd-feedcache-v1";
  function loadCache() { try { return JSON.parse(localStorage.getItem(CKEY)) || {}; } catch (e) { return {}; } }
  function saveCache() {
    try {
      var out = {}, now = Date.now();
      Object.keys(cache).forEach(function (u) { var c = cache[u]; if (c && c.items && c.items.length && (now - c.ts) < MERGE_WINDOW) out[u] = { ts: c.ts, items: c.items.slice(0, 120) }; });
      localStorage.setItem(CKEY, JSON.stringify(out));
    } catch (e) { /* quota/full → skip persistence */ }
  }
  function clearCache() { cache = {}; try { localStorage.removeItem(CKEY); } catch (e) { /* ignore */ } }
  var cache = loadCache();
  // Merge a fresh fetch into the cached items: dedup by link/title (fresh wins), drop items older than
  // the 2-day window, newest-first, capped.
  function mergeItems(prev, fresh) {
    var now = Date.now(), seen = {}, out = [];
    fresh.concat(prev).forEach(function (it) {
      var key = it.link || it.title; if (!key || seen[key]) return; seen[key] = 1;
      if (it.date && (now - it.date) > MERGE_WINDOW) return;
      out.push(it);
    });
    out.sort(function (a, b) { return (b.date || 0) - (a.date || 0); });
    return out.slice(0, 120);
  }

  // Suggested native RSS feeds per news country (verified). Falls back to none → Google News covers it.
  var SUGGEST_BY_REGION = {
    RU: [["Lenta", "https://lenta.ru/rss"], ["РИА Новости", "https://ria.ru/export/rss2/archive/index.xml"], ["ТАСС", "https://tass.ru/rss/v2.xml"], ["Rambler", "https://news.rambler.ru/rss/world/"], ["Mail.ru", "https://news.mail.ru/rss/"], ["RBC", "https://rssexport.rbc.ru/rbcnews/news/30/full.rss"], ["RBC Бизнес", "https://rssexport.rbc.ru/rbcnews/news/20/full.rss"], ["Коммерсантъ", "https://www.kommersant.ru/RSS/news.xml"], ["DTF", "https://dtf.ru/rss"], ["VC.ru", "https://vc.ru/rss/all"], ["Habr", "https://habr.com/ru/rss/all/"], ["iXBT", "https://www.ixbt.com/export/news.rss"], ["N+1", "https://nplus1.ru/rss"]],
    US: [["NYT", "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"], ["NYT Business", "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml"], ["NYT Tech", "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml"], ["Yahoo", "https://www.yahoo.com/news/rss"], ["The Verge", "https://www.theverge.com/rss/index.xml"], ["TechCrunch", "https://techcrunch.com/feed/"], ["Ars Technica", "https://feeds.arstechnica.com/arstechnica/index"]],
    GB: [["BBC", "https://feeds.bbci.co.uk/news/rss.xml"], ["BBC Business", "https://feeds.bbci.co.uk/news/business/rss.xml"], ["BBC Tech", "https://feeds.bbci.co.uk/news/technology/rss.xml"]],
    CZ: [["iROZHLAS", "https://www.irozhlas.cz/rss/irozhlas"], ["Novinky", "https://www.novinky.cz/rss"], ["E15 byznys", "https://www.e15.cz/rss"]],
    FR: [["Le Monde", "https://www.lemonde.fr/rss/une.xml"], ["France Info", "https://www.francetvinfo.fr/titres.rss"], ["Les Echos", "https://www.lesechos.fr/rss/rss_une.xml"]],
    DE: [["Tagesschau", "https://www.tagesschau.de/index~rss2.xml"], ["heise", "https://www.heise.de/rss/heise.rdf"], ["Handelsblatt", "https://www.handelsblatt.com/contentexport/feed/schlagzeilen"]],
    JP: [["Yahoo!ニュース", "https://news.yahoo.co.jp/rss/topics/top-picks.xml"], ["ITmedia", "https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml"]],
    IT: [["la Repubblica", "https://www.repubblica.it/rss/homepage/rss2.0.xml"], ["ANSA", "https://www.ansa.it/sito/ansait_rss.xml"]],
    ES: [["El País", "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada"]],
    IN: [["Times of India", "https://timesofindia.indiatimes.com/rssfeedstopstories.cms"]],
    BR: [["G1", "https://g1.globo.com/rss/g1/"]],
    KR: [["연합뉴스", "https://www.yna.co.kr/rss/news.xml"]],
    AU: [["ABC News", "https://www.abc.net.au/news/feed/2942460/rss.xml"]],
    NZ: [["RNZ", "https://www.rnz.co.nz/rss/national.xml"]],
    PH: [["Rappler", "https://www.rappler.com/feed/"]],
    NL: [["NOS", "https://feeds.nos.nl/nosnieuwsalgemeen"]],
    BE: [["VRT NWS", "https://www.vrt.be/vrtnws/nl.rss.articles.xml"]],
    PL: [["RMF24", "https://www.rmf24.pl/feed"]],
    NO: [["NRK", "https://www.nrk.no/toppsaker.rss"]],
    DK: [["DR", "https://www.dr.dk/nyheder/service/feeds/allenyheder"]],
    FI: [["Yle", "https://feeds.yle.fi/uutiset/v1/majorHeadlines/YLE_UUTISET.rss"]],
    RO: [["HotNews", "https://hotnews.ro/feed"]],
    HU: [["Telex", "https://telex.hu/rss"]],
    IL: [["Times of Israel", "https://www.timesofisrael.com/feed/"]],
    SG: [["CNA", "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml"]],
    AR: [["La Nación", "https://www.lanacion.com.ar/arc/outboundfeeds/rss/"]],
    ZA: [["News24", "https://feeds.capi24.com/v1/Search/articles/news24/TopStories/rss"]],
    UA: [["Українська правда", "https://www.pravda.com.ua/rss/"]],
    CH: [["NZZ", "https://www.nzz.ch/recent.rss"]],
    AT: [["ORF", "https://rss.orf.at/news.xml"], ["Der Standard", "https://www.derstandard.at/rss"]],
    PT: [["Público", "https://feeds.feedburner.com/PublicoRSS"]],
    IE: [["RTÉ", "https://www.rte.ie/feeds/rss/?index=/news/"]]
  };

  function googleNewsUrl() {
    var q = (SD.regions && SD.regions.gn && SD.regions.gn(SD.regions.current())) || "hl=en-US&gl=US&ceid=US:en";
    return "https://news.google.com/rss?" + q;
  }

  // Map a YouTube channel/playlist page URL to its Atom feed (verified endpoint).
  function normalizeFeedUrl(url) {
    var m;
    if ((m = url.match(/youtube\.com\/channel\/([\w-]+)/i))) return "https://www.youtube.com/feeds/videos.xml?channel_id=" + m[1];
    if ((m = url.match(/youtube\.com\/playlist\?list=([\w-]+)/i))) return "https://www.youtube.com/feeds/videos.xml?playlist_id=" + m[1];
    return url;   // @handles / /user/ need an API to resolve → left as-is (fails gracefully to a plate)
  }

  function originOf(url) { try { return new URL(url).origin; } catch (e) { return ""; } }
  // One broad host grant (requested from a click) lets every chosen source be read — both the
  // background fetch and the page bypass CORS for granted hosts. Per-origin grants proved
  // unreliable for arbitrary feeds, so we grant once and reuse it.
  async function ensureBroad() {
    if (!SD.has("permissions.request")) return true;
    try {
      if (SD.has("permissions.contains") && await SD.api.permissions.contains({ origins: ["https://*/*"] })) return true;
      return await SD.api.permissions.request({ origins: ["https://*/*"] });
    } catch (e) { return true; }
  }
  function hasBroad() {
    if (!SD.has("permissions.contains")) return Promise.resolve(true);
    return SD.api.permissions.contains({ origins: ["https://*/*"] }).catch(function () { return true; });
  }

  // Decode with the feed's real charset (many RU feeds are windows-1251, not UTF-8). Charset comes
  // from the Content-Type header, else the XML declaration, else UTF-8.
  function decodeBuffer(buf, contentType) {
    var cs = "";
    var m = (contentType || "").match(/charset=["']?([\w-]+)/i);
    if (m) cs = m[1];
    if (!cs) { var head = new TextDecoder("utf-8").decode(buf.slice(0, 2048)); var x = head.match(/encoding=["']([\w-]+)["']/i); if (x) cs = x[1]; }
    cs = (cs || "utf-8").toLowerCase();
    var alias = { utf8: "utf-8", "cp1251": "windows-1251", "1251": "windows-1251", "cp1252": "windows-1252", "1252": "windows-1252", "koi8r": "koi8-r" };
    if (alias[cs]) cs = alias[cs];
    try { return new TextDecoder(cs).decode(buf); } catch (e) { return new TextDecoder("utf-8").decode(buf); }
  }
  // Returns { text, finalUrl } — follows redirects and reports the final URL so a homepage can be
  // resolved to its real feed. Host permission (https://*/*) lets this read any source CORS-free.
  function fetchText(url) {
    return fetch(url, { credentials: "omit", redirect: "follow" }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      var ct = r.headers.get("content-type") || "";
      return r.arrayBuffer().then(function (buf) { return { text: decodeBuffer(buf, ct), finalUrl: r.url || url }; });
    });
  }
  // Decode HTML entities left in feed text (CDATA / double-encoded titles show raw &amp; &#39; &quot;).
  // Uses an inert DOMParser document (no script execution, no resource loads) — never innerHTML.
  function decodeEntities(s) {
    if (!s || s.indexOf("&") < 0) return s;
    try { return new DOMParser().parseFromString("<!doctype html><title>" + s + "</title>", "text/html").title || s; }
    catch (e) { return s; }
  }
  function txt(node, sel) { var e = node.querySelector(sel); return e ? decodeEntities(e.textContent.trim()) : ""; }
  function tagText(node, tag) { var e = node.getElementsByTagName(tag); return e.length ? e[0].textContent.trim() : ""; }

  // Universal preview fallback: read Open Graph/Twitter image from the article page (standard across the web).
  // Lazy (per visible card), concurrency-limited. Resolved cover URLs are persisted (localStorage) so the
  // image is known instantly on the next open (the bytes stay in the browser HTTP cache); entries auto-expire.
  var OGKEY = "sd-ogcache-v1", OG_MAXAGE = 86400000;
  function loadOg() {
    try {
      var o = JSON.parse(localStorage.getItem(OGKEY)) || {}, now = Date.now(), out = {};
      Object.keys(o).forEach(function (u) { if (o[u] && (now - o[u].ts) < OG_MAXAGE) out[u] = o[u]; });
      return out;
    } catch (e) { return {}; }
  }
  function saveOg() {
    try {
      var keys = Object.keys(ogCache);
      if (keys.length > 800) keys.slice(0, keys.length - 800).forEach(function (k) { delete ogCache[k]; });
      localStorage.setItem(OGKEY, JSON.stringify(ogCache));
    } catch (e) { /* quota → skip */ }
  }
  var ogCache = loadOg(), ogQueue = [], ogActive = 0, OG_MAX = 4;
  function extractOg(html) {
    var head = html.slice(0, 80000);
    var tags = head.match(/<meta[^>]+>/gi) || [];
    var twitter = "";
    for (var i = 0; i < tags.length; i++) {
      var tag = tags[i];
      if (!/(?:property|name)\s*=\s*["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["']/i.test(tag)) continue;
      var c = tag.match(/content\s*=\s*["']([^"']+)["']/i); if (!c) continue;
      if (/og:image/i.test(tag)) return c[1];
      if (!twitter) twitter = c[1];
    }
    if (twitter) return twitter;
    var ls = head.match(/<link[^>]+rel\s*=\s*["']image_src["'][^>]*>/i);   // older standard some RU sites use
    if (ls) { var lc = ls[0].match(/href\s*=\s*["']([^"']+)["']/i); if (lc) return lc[1]; }
    return "";
  }
  function resolveOg(pageUrl) {
    if (!pageUrl) return Promise.resolve("");
    if (pageUrl in ogCache) return Promise.resolve(ogCache[pageUrl].i);
    return new Promise(function (res) { ogQueue.push({ u: pageUrl, res: res }); pumpOg(); });
  }
  function pumpOg() {
    while (ogActive < OG_MAX && ogQueue.length) {
      var job = ogQueue.shift(); ogActive++;
      fetchText(job.u).then(function (r) {
        var img = extractOg(r.text);
        if (img) { try { img = new URL(img, r.finalUrl).href; } catch (e) { img = ""; } }
        if (img && !/^https:\/\//i.test(img)) img = "";   // https page can't show http image (mixed content)
        return img;
      }).catch(function () { return ""; }).then(function (img) {
        ogCache[job.u] = { i: img || "", ts: Date.now() }; saveOg(); job.res(ogCache[job.u].i); ogActive--; pumpOg();
      });
    }
  }

  function mediaImage(node) {
    var els = node.getElementsByTagName("media:content");
    for (var i = 0; i < els.length; i++) {
      var ty = els[i].getAttribute("type") || "", med = els[i].getAttribute("medium") || "";
      if (/^image\//.test(ty) || med === "image") return els[i].getAttribute("url") || "";
    }
    return "";
  }
  function hasVideo(node) {
    var els = node.getElementsByTagName("media:content");
    for (var i = 0; i < els.length; i++) { var ty = els[i].getAttribute("type") || "", med = els[i].getAttribute("medium") || ""; if (/^video\//.test(ty) || med === "video") return true; }
    return node.getElementsByTagName("yt:videoId").length > 0;
  }
  // osnova (DTF/vc.ru) CDN → a light preview frame (smaller transform = faster card thumbnail).
  function osnovaPoster(url) { var m = url && url.match(/^(https:\/\/leonardo\.osnova\.io\/[0-9a-f-]+\/)/i); return m ? m[1] + "-/preview/360x/" : ""; }
  // Pick the SMALLEST media:thumbnail (lightest to load) when a feed offers several sizes.
  function mediaThumb(node) {
    var els = node.getElementsByTagName("media:thumbnail"), best = "", bw = Infinity;
    for (var i = 0; i < els.length; i++) {
      var url = els[i].getAttribute("url"); if (!url) continue;
      var w = parseInt(els[i].getAttribute("width") || "0", 10) || 0;
      if (!best) best = url;
      if (w && w < bw) { bw = w; best = url; }
    }
    return best;
  }

  // → { url: <preview image or "">, isVideo: bool }. Never an embedded player; preview image only.
  function imageOf(node) {
    var isVideo = hasVideo(node), u = mediaThumb(node) || mediaImage(node);
    var enc = node.getElementsByTagName("enclosure");
    if (enc.length) {
      var et = enc[0].getAttribute("type") || "", eu = enc[0].getAttribute("url") || "";
      if (/^image\//.test(et)) { if (!u) u = eu; }
      else if (/^video\//.test(et)) { isVideo = true; if (!u) u = osnovaPoster(eu); }
    }
    if (!u && isVideo) {
      var vid = node.getElementsByTagName("yt:videoId")[0];
      if (vid && vid.textContent) u = "https://i.ytimg.com/vi/" + vid.textContent.trim() + "/hqdefault.jpg";   // YouTube
      if (!u) { var mc = node.getElementsByTagName("media:content"); for (var k = 0; k < mc.length && !u; k++) { var p = osnovaPoster(mc[k].getAttribute("url") || ""); if (p) u = p; } }   // osnova (DTF/vc.ru) video
    }
    if (!u) { var d = tagText(node, "content:encoded") || txt(node, "description"); var im = d && d.match(/<img[^>]+src=["']([^"']+)["']/i); if (im) u = im[1]; }
    if (u && /^https:\/\/leonardo\.osnova\.io\/[0-9a-f-]+\/$/i.test(u)) u = u + "-/preview/640x/";   // osnova (vc.ru/dtf): bare CDN url → sized thumbnail (fast)
    return { url: /^https:\/\//i.test(u) ? u : "", isVideo: isVideo };
  }

  function cleanXml(s) { s = s.replace(/^\uFEFF/, ""); var i = s.indexOf("<"); return i > 0 ? s.slice(i) : s; }
  // RSS <link>url</link>, Atom <link href>, or a guid that is itself a URL.
  function itemLink(it) {
    var links = it.getElementsByTagName("link");
    for (var i = 0; i < links.length; i++) {
      var rel = links[i].getAttribute("rel");
      if (rel && rel !== "alternate") continue;
      var href = links[i].getAttribute("href"); if (href) return href;
      var tc = (links[i].textContent || "").trim(); if (tc) return tc;
    }
    var g = it.getElementsByTagName("guid")[0]; if (g && /^https?:\/\//i.test((g.textContent || "").trim())) return g.textContent.trim();
    return "";
  }
  function itemDate(it) { return Date.parse(txt(it, "pubDate") || tagText(it, "dc:date") || txt(it, "updated") || txt(it, "published") || txt(it, "date")) || 0; }
  // Item <source> is the real publisher ONLY in Google News aggregated feeds; in normal feeds it is
  // often a photo credit / unrelated attribution (e.g. RBC), so there we always use the feed's name.
  function buildItems(doc, name, srcOrigin, isGN) {
    var out = [], items = doc.querySelectorAll("item");
    var nodes = items.length ? items : doc.querySelectorAll("entry");
    nodes.forEach(function (it) {
      out.push({ title: txt(it, "title"), link: itemLink(it), date: itemDate(it), source: (isGN && txt(it, "source")) || name, srcOrigin: srcOrigin, image: imageOf(it) });
    });
    return out;
  }
  // Parse RSS / Atom / RDF; on malformed XML fall back to the lenient HTML parser. Returns [] when the
  // payload is a web page rather than a feed, so the caller can auto-discover the real feed URL.
  function parseFeed(text, name, feedUrl) {
    text = cleanXml(text);
    var srcOrigin = originOf(feedUrl);
    var isGN = /news\.google\./i.test(feedUrl || "");
    var doc = new DOMParser().parseFromString(text, "application/xml");
    var broken = !!doc.querySelector("parsererror");
    if (broken || (!doc.querySelector("item") && !doc.querySelector("entry"))) {
      var html = new DOMParser().parseFromString(text, "text/html");
      if (html.querySelector("item") || html.querySelector("entry")) doc = html;
      else return [];
    }
    return buildItems(doc, name, srcOrigin, isGN);
  }

  // Find a feed link in a plain web page (<link rel=alternate type=…rss/atom…>).
  function discoverFeed(text, baseUrl) {
    try {
      var doc = new DOMParser().parseFromString(text, "text/html");
      var l = doc.querySelector('link[type="application/rss+xml"], link[type="application/atom+xml"], link[rel~="alternate"][type*="xml"]');
      var href = l && l.getAttribute("href");
      if (href) return new URL(href, baseUrl).href;
    } catch (e) { /* not html */ }
    return "";
  }

  function loadFeed(url, name) {
    url = normalizeFeedUrl(url);
    var c = cache[url];
    if (c && c.items.length && (Date.now() - c.ts) < TTL) return Promise.resolve(c.items);
    return fetchText(url).then(function (r) {
      var items = parseFeed(r.text, name, r.finalUrl);
      if (items.length) return items;
      var disc = discoverFeed(r.text, r.finalUrl);
      if (disc && disc !== url && disc !== r.finalUrl) return fetchText(disc).then(function (r2) { return parseFeed(r2.text, name, r2.finalUrl); });
      return items;
    }).then(function (items) {
      if (items.length) { cache[url] = { ts: Date.now(), items: mergeItems((cache[url] && cache[url].items) || [], items) }; saveCache(); }
      return (cache[url] && cache[url].items) || items;
    }).catch(function () { return []; });
  }

  function sources(cfg) {
    var list = [];
    if (cfg.googleNews !== false) list.push({ url: googleNewsUrl(), name: "Google News" });
    (cfg.feeds || []).forEach(function (f) { if (f && f.url && f.enabled !== false) list.push({ url: f.url, name: f.name || f.url }); });
    return list;
  }
  function matchesKeywords(it, kw) {
    if (!kw.length) return true;
    var hay = (it.title || "").toLowerCase();
    for (var i = 0; i < kw.length; i++) if (hay.indexOf(kw[i]) >= 0) return true;
    return false;
  }

  var DEFAULT_PLATE = "#334155";   // one common plate colour for all sources (user-configurable)
  var favCache = {}, favFail = {};   // favFail: origins whose favicon 404'd — skip them (no retry loop)
  function faviconUrl(origin) { if (!origin) return ""; if (!favCache[origin]) favCache[origin] = SD.icons.faviconUrl(origin); return favCache[origin]; }
  function localeTag() { try { return (SD.api.i18n && SD.api.i18n.getUILanguage && SD.api.i18n.getUILanguage()) || (SD.i18n.current && SD.i18n.current()) || "en"; } catch (e) { return "en"; } }
  function fmtDate(ms) { try { return new Date(ms).toLocaleString(localeTag(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }

  function plateNode(D, it, color) {
    var p = D.el("div", { "class": "feed-plate" }, D.el("span", { "class": "feed-plate-txt", text: it.source || "—" }));
    p.style.background = color || DEFAULT_PLATE;
    return p;
  }

  function card(it, cfg, ctx) {
    var D = ctx.dom;
    var a = D.el("a", { "class": "feed-card", href: it.link || "#", title: it.title, target: "_blank", rel: "noopener" });
    var hasMedia = cfg.showImages !== false;
    if (hasMedia) {
      var media = D.el("div", { "class": "feed-media" });
      var setImg = function (url) {
        media.classList.add("feed-media-loading");
        var im = document.createElement("img");
        im.className = "feed-img"; im.alt = ""; im.loading = "lazy"; im.decoding = "async"; im.setAttribute("fetchpriority", "low"); im.referrerPolicy = "no-referrer"; im.src = url;
        im.addEventListener("load", function () { media.classList.remove("feed-media-loading", "is-plate"); var pl = media.querySelector(".feed-plate"); if (pl) pl.remove(); });
        im.addEventListener("error", function () { media.classList.remove("feed-media-loading"); im.remove(); showPlate(); });
        media.insertBefore(im, media.firstChild);
      };
      var ogTried = false;
      var lazyOg = function () {
        if (ogTried || !it.link) return; ogTried = true;
        var go = function () { resolveOg(it.link).then(function (img) { if (img) setImg(img); }); };
        if (typeof IntersectionObserver === "function") {
          var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); go(); } });
          io.observe(media);
        } else { go(); }
      };
      var showPlate = function () {
        if (!media.querySelector(".feed-plate")) { media.classList.add("is-plate"); media.appendChild(plateNode(D, it, cfg.plateColor)); }
        lazyOg();   // universal fallback: pull og:image off the article page when RSS has no preview
      };
      if (it.image && it.image.url) setImg(it.image.url);
      else showPlate();
      if (it.image && it.image.isVideo) media.appendChild(D.el("span", { "class": "feed-badge", text: "▶" }));
      a.appendChild(media);
    }
    a.appendChild(D.el("div", { "class": "feed-card-title", text: it.title || "—" }));
    var srcRow = D.el("div", { "class": "feed-card-src" });
    srcRow.appendChild(D.el("span", { "class": "feed-src-name", text: it.source || "" }));
    if (it.srcOrigin && !favFail[it.srcOrigin]) {
      var chip = D.el("span", { "class": "feed-fav-chip" });
      var fav = document.createElement("img"); fav.alt = ""; fav.loading = "lazy"; fav.src = faviconUrl(it.srcOrigin);
      fav.addEventListener("error", function () { favFail[it.srcOrigin] = 1; chip.remove(); });   // 404 once → don't retry this origin
      chip.appendChild(fav); srcRow.appendChild(chip);
    }
    if (it.date) srcRow.appendChild(D.el("span", { "class": "feed-date", text: fmtDate(it.date) }));
    a.appendChild(srcRow);
    a.addEventListener("click", function (e) {
      e.preventDefault();
      ctx.commitCfg(function (x) { x.read = x.read || []; if (x.read.indexOf(it.link) < 0) x.read.push(it.link); if (x.read.length > 800) x.read = x.read.slice(-800); });
      if (it.link) window.open(it.link, "_blank", "noopener");
    });
    return a;
  }

  function fmtClock(ts) { try { return new Date(ts).toLocaleTimeString((SD.i18n.current && SD.i18n.current()) || undefined, { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }

  function renderItems(wrap, cfg, ctx, refresh) {
    var D = ctx.dom, t = ctx.i18n.t;
    var srcs = sources(cfg);
    if (io) { io.disconnect(); io = null; }
    D.clear(wrap);
    if (!srcs.length) { wrap.appendChild(D.el("div", { "class": "bm-empty", text: t("feed.empty") })); return; }
    var kw = (cfg.keywords || "").toLowerCase().split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    var readSet = {}; (cfg.read || []).forEach(function (l) { readSet[l] = 1; });
    function cset(s) { return cache[normalizeFeedUrl(s.url)] || null; }
    function maxTs() { return srcs.reduce(function (m, s) { var c = cset(s); return c && c.ts > m ? c.ts : m; }, 0); }
    function resultsFromCache() { return srcs.map(function (s) { var c = cset(s); return { name: s.name, items: (c && c.items) || [] }; }); }

    function paintResults(results, tsMax, final) {
      var seen = {}, anyEmpty = false, byDate = function (a, b) { return (b.date || 0) - (a.date || 0); };
      var bySrc = results.map(function (r) {
        if (!r.items.length) anyEmpty = true;
        var arr = [];
        r.items.forEach(function (it) {
          var key = it.link || it.title;
          if (!key || seen[key]) return;
          seen[key] = 1;
          if (!matchesKeywords(it, kw) || (cfg.hideRead && readSet[it.link])) return;
          arr.push(it);
        });
        arr.sort(byDate);
        return { name: r.name, items: arr };
      });
      var allItems = bySrc.reduce(function (a, s) { return a.concat(s.items); }, []).sort(byDate);
      D.clear(wrap);
      if (io) { io.disconnect(); io = null; }
      if (tsMax) wrap.appendChild(D.el("div", { "class": "feed-updated", text: t("widget.updated") + " " + fmtClock(tsMax) }));
      if (final && anyEmpty) {   // empty source after a real fetch → usually the missing all-sites host grant
        hasBroad().then(function (ok) {
          if (ok || !wrap.isConnected) return;
          var g = SD.controls.btn("primary", t("feed.grantAll")); g.className = "btn primary feed-grant";
          g.addEventListener("click", function () { SD.api.permissions.request({ origins: ["https://*/*"] }).then(function (granted) { if (granted) { clearCache(); refresh(); } }); });
          wrap.insertBefore(g, wrap.firstChild);
        });
      }
      if (!allItems.length) {
        wrap.appendChild(D.el("div", { "class": "w-err", text: t("status.error") }));
        var retry = SD.controls.btn("ghost", t("feed.refresh"));
        retry.addEventListener("click", function () { srcs.forEach(function (s) { delete cache[normalizeFeedUrl(s.url)]; }); saveCache(); refresh(); });
        wrap.appendChild(retry);
        return;
      }
      var per = cfg.perPage || 9, grid = null, more = null;
      var withItems = bySrc.filter(function (s) { return s.items.length; });
      function paint(items) {
        if (grid) grid.remove(); if (more) more.remove(); if (io) { io.disconnect(); io = null; }
        var n = 0;
        grid = D.el("div", { "class": "feed-grid" });
        grid.style.setProperty("--feed-cols", cfg.columns || 3);
        grid.style.setProperty("--feed-font", (cfg.fontSize || 15) + "px");
        wrap.appendChild(grid);
        more = SD.controls.btn("ghost", t("feed.more")); more.className = "btn ghost feed-more";
        function renderMore() { var next = Math.min(n + per, items.length); for (; n < next; n++) grid.appendChild(card(items[n], cfg, ctx)); more.style.display = n >= items.length ? "none" : ""; }
        more.addEventListener("click", renderMore);
        wrap.appendChild(more);
        renderMore();
        if (cfg.autoload && typeof IntersectionObserver === "function") {
          io = new IntersectionObserver(function (entries) { if (entries[0].isIntersecting && more.style.display !== "none") renderMore(); });
          io.observe(more);
        }
      }
      if (withItems.length > 1) {
        var bar = D.el("div", { "class": "feed-filters" });
        function chip(label, items) {
          var b = D.el("button", { "class": "feed-filter-chip", text: label });
          b.addEventListener("click", function () { bar.querySelectorAll(".feed-filter-chip").forEach(function (x) { x.classList.remove("on"); }); b.classList.add("on"); paint(items); });
          return b;
        }
        var allChip = chip(t("feed.all"), allItems); allChip.classList.add("on"); bar.appendChild(allChip);
        withItems.forEach(function (s) { bar.appendChild(chip(s.name, s.items)); });
        wrap.appendChild(bar);
      }
      paint(allItems);
    }

    function allKeys() { var k = {}; srcs.forEach(function (s) { var c = cset(s); (c && c.items || []).forEach(function (it) { var key = it.link || it.title; if (key) k[key] = 1; }); }); return k; }

    // Instant paint from the persisted cache (stale allowed) — never blocks on the network.
    var haveCache = resultsFromCache().some(function (r) { return r.items.length; });
    var everyCached = srcs.every(function (s) { var c = cset(s); return c && c.items.length; });
    var shownKeys = allKeys();
    if (haveCache) paintResults(resultsFromCache(), maxTs(), false);
    else wrap.appendChild(D.el("div", { "class": "skeleton w-skel w-skel-feed", "aria-hidden": "true" }));

    // Background refresh of stale/missing sources. If any source was still loading its first batch, just
    // paint it. Only when every source was already cached do we offer a "load new" pill for fresh items.
    var stale = srcs.filter(function (s) { var c = cset(s); return !c || !c.items.length || (Date.now() - c.ts) >= TTL; });
    if (stale.length) {
      Promise.all(stale.map(function (s) { return loadFeed(s.url, s.name).then(function (items) { return items.length; }, function () { return 0; }); })).then(function () {
        if (!wrap.isConnected) return;
        if (!everyCached) { paintResults(resultsFromCache(), maxTs(), true); return; }
        var fresh = allKeys(), n = Object.keys(fresh).filter(function (k) { return !shownKeys[k]; }).length;
        if (!n) return;   // no genuinely new items → no pill
        var old = wrap.querySelector(".feed-loadnew"); if (old) old.remove();
        var pill = D.el("button", { "class": "feed-loadnew", text: t("feed.loadNew", { N: String(n) }) });
        // Float the pill to the top of the screen once the feed start is scrolled out of view; clicking it
        // loads the new items and scrolls back to the start of the news block.
        if (pillScroll) { window.removeEventListener("scroll", pillScroll); pillScroll = null; }
        var onScroll = function () {
          if (!pill.isConnected) { window.removeEventListener("scroll", onScroll); if (pillScroll === onScroll) pillScroll = null; return; }
          pill.classList.toggle("floating", wrap.getBoundingClientRect().top < 0);
        };
        pillScroll = onScroll;
        window.addEventListener("scroll", onScroll, { passive: true });
        pill.addEventListener("click", function () {
          window.removeEventListener("scroll", onScroll); if (pillScroll === onScroll) pillScroll = null;
          shownKeys = allKeys(); paintResults(resultsFromCache(), maxTs(), true);
          var y = window.scrollY + wrap.getBoundingClientRect().top - 12;
          window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
        });
        wrap.insertBefore(pill, wrap.firstChild);
        onScroll();
      });
    }
  }

  function mount(el, ctx) {
    var D = ctx.dom, t = ctx.i18n.t, cfg = ctx.cfg();
    function refresh() { mount(el, ctx); }
    D.clear(el);
    var bar = D.el("div", { "class": "bm-bar bm-bar-click", title: t("bookmarks.collapse") });
    bar.appendChild(D.el("span", { "class": "bm-collapse", text: cfg.collapsed ? "▸" : "▾" }));
    bar.appendChild(D.el("span", { "class": "bm-bar-label", text: t("widget.feed") }));
    bar.addEventListener("click", function () { ctx.commitCfg(function (x) { x.collapsed = !x.collapsed; }); });
    el.appendChild(bar);
    if (cfg.collapsed) return;

    var wrap = D.el("div", { "class": "feed-body" });
    el.appendChild(wrap);
    if (cfg.consented) { renderItems(wrap, cfg, ctx, refresh); return; }
    var btn = SD.controls.btn("primary", t("feed.enable"));
    btn.classList.add("bm-enable");
    btn.addEventListener("click", function () {
      SD.ui.privacyConsent("news.google.com / RSS", t("privacy.dataNews")).then(function (okc) {
        if (!okc) return;
        ensureBroad().then(function () { ctx.commitCfg(function (x) { x.consented = true; }); refresh(); });
      });
    });
    wrap.appendChild(btn);
  }

  function renderSettings(el, ctx) {
    var c = ctx.controls, t = ctx.i18n.t, cfg = ctx.cfg(), D = ctx.dom;
    el.appendChild(c.row(t("feed.images"), c.check(cfg.showImages !== false, function (v) { ctx.commitCfg(function (x) { x.showImages = v; }); })));
    el.appendChild(c.row(t("feed.fontSize"), c.num(cfg.fontSize || 15, 11, 22, 1, function (v) { ctx.commitCfg(function (x) { x.fontSize = v; }); })));
    el.appendChild(c.row(t("feed.plateColor"), c.color(cfg.plateColor || DEFAULT_PLATE, function (v) { ctx.commitCfg(function (x) { x.plateColor = v; }); })));
    el.appendChild(c.row(t("feed.columns"), c.num(cfg.columns || 3, 1, 6, 1, function (v) { ctx.commitCfg(function (x) { x.columns = v; }); })));
    el.appendChild(c.row(t("feed.perPage"), c.num(cfg.perPage || 9, 3, 40, 1, function (v) { ctx.commitCfg(function (x) { x.perPage = v; }); })));
    el.appendChild(c.row(t("feed.hideRead"), c.check(!!cfg.hideRead, function (v) { ctx.commitCfg(function (x) { x.hideRead = v; }); })));
    el.appendChild(c.row(t("feed.autoload"), c.check(!!cfg.autoload, function (v) { ctx.commitCfg(function (x) { x.autoload = v; }); })));
    el.appendChild(c.row(t("feed.keywords"), c.text(cfg.keywords || "", function (v) { ctx.commitCfg(function (x) { x.keywords = v; }); })));
    // Sources live in their own box that re-renders on add/remove/toggle (the settings panel itself
    // can't be cleared — it holds the modal chrome). Adding ensures the broad grant first.
    var srcBox = D.el("div", { "class": "feed-src-box" });
    el.appendChild(srcBox);
    function exists(url) { return (ctx.cfg().feeds || []).some(function (f) { return f.url === url; }); }
    function addFeed(url, name) {
      url = normalizeFeedUrl(url);
      if (exists(url)) return;   // no duplicates
      ensureBroad().then(function () { ctx.commitCfg(function (x) { (x.feeds = x.feeds || []).push({ url: url, name: name, enabled: true }); }); renderSources(); });
    }
    // Uniform source row: checkbox on the LEFT, name, optional trash — same for Google News and feeds.
    function srcRow(name, checked, onToggle, onRemove) {
      var row = D.el("div", { "class": "feed-src-row" });
      var lbl = D.el("label", { "class": "feed-src-toggle" });   // <label>: a click on the name toggles the checkbox
      lbl.appendChild(c.check(checked, onToggle));
      lbl.appendChild(D.el("span", { "class": "feed-src-name2", text: name }));
      row.appendChild(lbl);
      if (onRemove) { var rm = D.iconBtn("trash", "", "bm-fact"); rm.title = t("common.delete"); rm.addEventListener("click", onRemove); row.appendChild(rm); }
      return row;
    }
    function renderSources() {
      var w = ctx.cfg();
      D.clear(srcBox);
      srcBox.appendChild(D.el("div", { "class": "note", text: t("feed.sources") }));
      srcBox.appendChild(srcRow("Google News", w.googleNews !== false, function (v) {
        if (v) ensureBroad().then(function () { ctx.commitCfg(function (x) { x.googleNews = true; }); });
        else ctx.commitCfg(function (x) { x.googleNews = false; });
      }));
      (w.feeds || []).forEach(function (f) {
        var url = f.url;
        srcBox.appendChild(srcRow(f.name || f.url, f.enabled !== false, function (v) {
          var apply = function () { ctx.commitCfg(function (x) { var t2 = (x.feeds || []).filter(function (q) { return q.url === url; })[0]; if (t2) t2.enabled = v; }); };
          if (v) ensureBroad().then(apply); else apply();
        }, function () { ctx.commitCfg(function (x) { x.feeds = (x.feeds || []).filter(function (q) { return q.url !== url; }); }); renderSources(); }));
      });
      var input = c.text("", function () {});
      input.placeholder = "https://… (RSS / YouTube)";
      var add = c.btn("primary", t("feed.add"));
      add.addEventListener("click", function () {
        var u = (input.value || "").trim();
        if (!/^https:\/\//i.test(u)) return;
        input.value = "";
        addFeed(u, originOf(u).replace(/^https:\/\/(www\.)?/, "") || u);
      });
      srcBox.appendChild(c.row(t("feed.feedUrl"), c.pair(input, add)));
      var sgList = (SUGGEST_BY_REGION[SD.regions.current()] || []).filter(function (s) { return !exists(normalizeFeedUrl(s[1])); });
      if (sgList.length) {
        var sug = D.el("div", { "class": "feed-suggest" });
        sug.appendChild(D.el("div", { "class": "note", text: t("feed.suggested") }));
        sgList.forEach(function (s) {
          var b = c.btn("ghost", "+ " + s[0]);
          b.addEventListener("click", function () { addFeed(s[1], s[0]); });
          sug.appendChild(b);
        });
        srcBox.appendChild(sug);
      }
    }
    renderSources();
  }

  function defaultConfig() { return { collapsed: false, googleNews: true, feeds: [], columns: 3, perPage: 9, showImages: true, imgHeight: 150, fontSize: 15, plateColor: DEFAULT_PLATE, autoload: true, keywords: "", hideRead: false, read: [], consented: false }; }

  SD.registry.register({
    id: "feed", kind: "local", titleKey: "widget.feed", order: 90, settingsModal: true,
    mount: mount, renderSettings: renderSettings, defaultConfig: defaultConfig
  });
})();
