# Private Speed Dial

Lightweight, private new-tab speed dial for Firefox, Chrome, Edge and Safari. Vanilla JS, no build, no telemetry. Network requests happen only for features you turn on.

## Features

- Tab groups, drag-and-drop dials (lockable), configurable grid, tile size, rounded corners, fonts, color schemes.
- Backgrounds: animated gradients (aurora / flame / tide), solid color, image, or opt-in auto-image.
- Icons: site favicon, upload any format (auto-downscaled), reusable library, or letter tiles.
- Widgets: clocks (analog/digital, multiple cities), notes, tasks, calendar — local. Weather, currency, stocks, gold — off by default, opt-in.
- UI languages: en, ru, cs, fr, de (auto-detect + manual switch).
- Optional sync via the browser account; full export/import.

## Install

📖 **Full step-by-step guide for every browser (incl. installing the unsigned, not-yet-reviewed build): [docs/INSTALL.md](docs/INSTALL.md).**

[![Add to Firefox](https://img.shields.io/badge/Firefox-Add_to_Firefox-FF7139?logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/firefox/addon/private-speed-dial/)
[![Chrome](https://img.shields.io/badge/Chrome-Download-4285F4?logo=googlechrome&logoColor=white)](../../releases/latest/download/chrome.zip)
[![Edge](https://img.shields.io/badge/Edge-Download-0078D7?logo=microsoftedge&logoColor=white)](../../releases/latest/download/edge.zip)
[![Safari](https://img.shields.io/badge/Safari-Download-000000?logo=safari&logoColor=white)](../../releases/latest/download/safari.zip)

- **Firefox** (desktop & Android): click the badge to install from Mozilla Add-ons — signed and auto-updating. Before the first review clears, load it temporarily via `about:debugging` → Load Temporary Add-on → `manifest.json`.
- **Chrome / Edge**: download the zip, open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**, **Load unpacked** → the unzipped folder. (Chrome and Edge block one-click installs of files outside their own stores, so unpacked is the only sideload path.)
- **Safari 15.4+** (macOS/iOS, Xcode): download `safari.zip`, run `xcrun safari-web-extension-converter <unzipped>`, build and enable.

All release assets are on the [Releases page](../../releases).

## Privacy

Data is stored locally; no backend, no telemetry. Network is used only for widgets / auto-image / auto-favicon that you enable — each asks first and connects straight to the chosen source. API keys stay local. Sync (off by default) uses the browser's own account and never syncs images or keys. On Safari there is no sync or notifications; those degrade gracefully.

## Build

No build needed to run it. Dev tooling:

```
npm run lint      # web-ext lint
npm run lint:js   # eslint
npm run build     # web-ext build
```

## Releases

Version lives in `manifest.json` (SemVer) and is bumped by hand. A release is cut only on a `vX.Y.Z` tag: CI builds the four zips and auto-submits the Firefox (AMO) listing. Other browsers: install from the Release assets.

## Contributing

Vanilla JS, no runtime deps, MV3. Keep network opt-in. New UI strings go in every locale under `src/i18n`. Run `npm run lint` and `npm run lint:js` before a PR.

## Security

Report vulnerabilities privately via the repository's Security tab.

## License

GPL-3.0-or-later (see `LICENSE`).
