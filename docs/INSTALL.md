# Installing Private Speed Dial

Private Speed Dial is a new‑tab speed dial built with plain HTML/CSS/JS (Manifest V3,
no build step). This guide covers installing it on every major browser.

Release packages live on the [Releases page](../../releases) — `firefox.zip`,
`chrome.zip`, `edge.zip`, `safari.zip`. The Firefox build uses an event‑page background
(`background.scripts`); the Chromium/Safari builds use a service worker
(`background.service_worker`). The repository `manifest.json` is the Firefox‑native variant.

---

## Firefox (desktop & Android)

> **Status:** the add‑on is submitted to Mozilla Add‑ons but **not yet reviewed/approved**,
> so the one‑click signed install is not available yet. Until it clears review, install the
> **unsigned** build with one of the methods below. (Once approved, just open the listing
> <https://addons.mozilla.org/firefox/addon/private-speed-dial/> → **Add to Firefox**.)

### A. Temporary load — any Firefox (desktop), no signing needed
Best for trying it now. Removed when Firefox restarts.
1. Download `firefox.zip` from the [Releases page](../../releases) (or clone the repo).
2. Go to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add‑on…**.
4. Select the `firefox.zip` (or the unzipped `manifest.json`).
5. Open a new tab — the speed dial appears.

### B. Permanent unsigned install — Developer Edition / Nightly / ESR only
Regular (release/stable) Firefox **refuses** unsigned add‑ons permanently. Use
[Firefox Developer Edition](https://www.mozilla.org/firefox/developer/), Nightly, or ESR:
1. Open `about:config`, accept the warning.
2. Set **`xpinstall.signatures.required`** to **`false`**.
3. Open `about:addons` → gear ⚙ → **Install Add‑on From File…**.
4. Select `firefox.zip` (rename to `.xpi` if the picker filters by extension).
5. Confirm the install.

### C. Firefox for Android
Sideloading an unsigned add‑on isn't possible on regular Firefox for Android. Options:
- **Temporary via USB (recommended for testing):** enable USB debugging on the phone,
  connect it, open `about:debugging` on desktop Firefox, select the device, and
  **Load Temporary Add‑on**.
- **Firefox Nightly + custom add‑on collection:** publish the add‑on to an AMO collection
  and point Nightly at it (Settings → Advanced → Custom Add‑on collection). This still
  requires the add‑on to be on AMO.
- Once the AMO listing is approved, install it normally from the listing (it covers mobile).

---

## Google Chrome

Chrome blocks one‑click installs from outside the Chrome Web Store, so use an unpacked load:
1. Download `chrome.zip` from the Releases page and unzip it.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top‑right toggle).
4. Click **Load unpacked** and select the unzipped folder.
5. Open a new tab — the speed dial appears.

To update later, download the newer zip, unzip over the folder, and click the **reload**
icon on the extension card.

---

## Microsoft Edge

Same unpacked flow as Chrome:
1. Download `edge.zip` from the Releases page and unzip it.
2. Open `edge://extensions`.
3. Enable **Developer mode** (left sidebar).
4. Click **Load unpacked** and select the unzipped folder.
5. Open a new tab.

(Edge can also load `chrome.zip` — both use the service‑worker manifest.)

---

## Brave / Opera / Vivaldi (other Chromium browsers)

Use the Chrome instructions with that browser's extensions page:
- Brave: `brave://extensions`
- Opera: `opera://extensions`
- Vivaldi: `vivaldi://extensions`

Enable Developer mode → **Load unpacked** → select the unzipped `chrome.zip` folder.

---

## Safari (macOS / iOS, Safari 15.4+)

Safari requires converting the web extension into an Xcode project (Xcode needed):
1. Download `safari.zip` and unzip it.
2. Run the converter:
   ```
   xcrun safari-web-extension-converter <unzipped-folder>
   ```
3. Build and run the generated project in Xcode.
4. In Safari → **Settings → Extensions**, enable **Private Speed Dial**.
   On macOS you may need to enable **Develop → Allow Unsigned Extensions** first.

Note: on Safari, sync and notifications are unavailable and degrade gracefully
(use export/import for backups).

---

## Verifying / building from source

No build is required — the uploaded files are the source.

```
npm run lint      # web-ext lint (Firefox)
npm run lint:js   # eslint
npm run build     # web-ext build (produces a Firefox zip)
```

For Chromium/Safari, swap the background key to a service worker before zipping:
```
node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync('manifest.json'));m.background={service_worker:'src/background.js'};fs.writeFileSync('manifest.json',JSON.stringify(m,null,2))"
```
(CI does this automatically when producing the per‑browser release zips.)

---

## Privacy

Data is stored locally; no backend, no telemetry. Network is used only for features you
enable (weather, precipitation map, currency/stocks/gold, news feed, auto‑image, bookmarks
panel) — each asks first. See the listing's privacy policy for details.
