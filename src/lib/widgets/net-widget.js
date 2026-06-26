// Shared wrapper for network widgets: consent gate -> host permission -> fetch -> local cache.
(function () {
  "use strict";
  SD.netWidget = (function () {
    // One broad host grant (https://*/*) covers every provider AND any user-entered custom endpoint,
    // so nothing has to be pre-listed in the manifest and no source hits CORS. Must run in a gesture.
    async function ensureHostPermission(origin) {
      if (!origin) return false;
      if (!SD.has("permissions.request")) return true; // older engines: connect-src https: already allows CORS-enabled hosts
      try {
        if (await SD.api.permissions.contains({ origins: ["https://*/*"] })) return true;
        return await SD.api.permissions.request({ origins: ["https://*/*"] });
      } catch (e) {
        return true;
      }
    }

    // Consent (type-scoped, once) + host permission for a config's origin. Must run in a user gesture.
    async function ensureForConfig(mod, cfg) {
      var origin = mod.origin ? mod.origin(cfg) : "";
      if (!origin) return true;
      var st = SD.store.get();
      var key = "w-" + mod.id;
      if (!st.consents || !st.consents[key]) {
        var ok = await SD.ui.privacyConsent(origin, SD.i18n.t(mod.privacyDataKey || "privacy.dataGeneric"));
        if (!ok) return false;
        SD.store.commit(function (s) { (s.consents = s.consents || {})[key] = true; });
      }
      return ensureHostPermission(origin);
    }

    // Fetches JSON from a URL (cross-origin reads rely on host permission / CORS).
    async function fetchJson(url) {
      var res = await fetch(url, { credentials: "omit" });
      if (!res.ok) throw new Error("http " + res.status);
      return res.json();
    }

    // Network fetch + parse; persists the result into the instance cache. Returns {data, ts}.
    async function refresh(inst, mod) {
      var cfg = inst.config, json, data;
      if (typeof mod.fetchData === "function") {
        // Provider does its own (possibly multi-step) fetch and returns the normalized shape directly.
        data = await mod.fetchData(cfg);
      } else if (typeof mod.buildUrls === "function") {
        var urls = mod.buildUrls(cfg) || [];
        if (mod.tolerant) {
          // Some URLs may legitimately 404 (e.g. weekend archive days) — keep the rest.
          var settled = await Promise.allSettled(urls.map(fetchJson));
          json = settled.map(function (s) { return s.status === "fulfilled" ? s.value : null; });
        } else {
          json = await Promise.all(urls.map(fetchJson));
        }
        data = mod.parse(json, cfg);
      } else {
        json = await fetchJson(mod.buildUrl(cfg));
        data = mod.parse(json, cfg);
      }
      var ts = Date.now(), id = inst.instId;
      SD.store.commit(function (s) {
        var x = s.widgetInstances.filter(function (w) { return w.instId === id; })[0];
        if (x) x.cache = { ts: ts, data: data };
      });
      return { data: data, ts: ts };
    }

    // Stale-while-revalidate: cached data returns immediately (never blocks on the network); past TTL a
    // background refresh runs and calls onUpdate(res) when it lands. First load (no cache) blocks once.
    async function load(state, inst, mod, onUpdate) {
      var ttl = (mod.ttlMin || 15) * 60000;
      var cache = inst.cache;
      if (cache && cache.data) {
        var stale = (Date.now() - cache.ts) >= ttl;
        if (stale && typeof onUpdate === "function") {
          refresh(inst, mod).then(function (r) { onUpdate({ data: r.data, ts: r.ts }); }).catch(function () { });
        }
        return { data: cache.data, ts: cache.ts, stale: stale };
      }
      try { return await refresh(inst, mod); }
      catch (e) { return { error: e.message }; }
    }

    return { ensureHostPermission: ensureHostPermission, ensureForConfig: ensureForConfig, fetchJson: fetchJson, load: load };
  })();
})();
