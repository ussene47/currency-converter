# Contributing

Notes for working on the code. `README.md` describes the features for users.

## Commands

```bash
npm install          # dev dependencies only (Vitest)
npm test             # run unit tests once
npm run test:watch   # watch mode
npm start            # serve the repo root at http://localhost:5173
# or: python3 -m http.server 5173
```

The app must be served over HTTP (ES modules and the service worker don't work from `file://`). There is no build step: the repo root is the site.

## Hard constraints

- Vanilla HTML/CSS/JS with ES modules. No framework, **no build step**. GitHub Actions (`.github/workflows/deploy.yml`) runs the tests, copies `index.html manifest.json sw.js css js assets` into `_site/` and deploys it to GitHub Pages. A new top-level folder the site needs must be added to that copy step.
- The only runtime dependency is Chart.js 4.4.1 from cdnjs, loaded lazily by `js/chart.js` when the chart card scrolls into view. Vitest is dev-only and must never be needed to run the app.
- No API keys. Both data sources are free and keyless.
- Commit in small, logical steps.

## Architecture

| File | Role |
|---|---|
| `js/app.js` | Entry point. Holds `state`, binds events, renders, syncs the URL (`?from=&to=&amount=`), loads the chart. |
| `js/api.js` | **The only module that touches the network.** `getLatestRates()` and `getHistory()`. Swap providers here. |
| `js/storage.js` | Safe localStorage (keys prefixed `cc:`), falls back to memory when storage throws. `saveCached`/`loadCached` add a timestamp + TTL. |
| `js/utils.js` | Pure functions: `parseAmount`, `convert`, `pairRate`, `roundMoney`, `formatNumber`, `seriesStats`, `sampleDates`. No DOM. |
| `js/i18n.js` | Every UI string in `pt` (pt-MZ) and `en`. Static markup uses `data-i18n` / `data-i18n-attr="attr:key,attr:key"`. |
| `js/currencies.js` | Currency → region map (first region gives the flag), localised names via `Intl.DisplayNames`, locale → currency, search. |
| `js/ui.js` | `CurrencyPicker` (one shared `<dialog>`, ARIA combobox + listbox with `aria-activedescendant`), `toast()`, `renderCurrencyButton()`. |
| `js/chart.js` | Lazy Chart.js loader and line chart drawing; reads colours from CSS tokens so themes stay in sync. |
| `sw.js` | App shell: stale-while-revalidate. Navigation and latest rates: network-first. cdnjs, jsDelivr, pages.dev: cache-first. |

### Data sources

- Latest: `https://open.er-api.com/v6/latest/USD`. Rates are always fetched with base USD and cross-rates are computed (`amount / rates[from] * rates[to]`), so one request covers every pair. Cached 1 hour under `cc:rates:USD`. Response must have `result: "success"`; HTTP 429 → `ApiError('rate-limit')`. The provider requires visible attribution ("Rates by Exchange Rate API" link), which is in the converter card footer — keep it.
- History: `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@{YYYY-MM-DD}/v1/currencies/{base}.min.json`, fallback `https://{YYYY-MM-DD}.currency-api.pages.dev/v1/currencies/{base}.min.json`. Codes are **lowercase**; the shape is `{ date, [base]: { [code]: rate } }`. Ranges are sampled to at most 16 dates (8 for 7D), fetched 4 at a time, and each point is cached permanently under `cc:hist:FROM-TO`.

### Behaviour worth knowing

- `parseAmount(text, locale)` accepts both `1,500.50` and `1.500,50`. A single separator followed by exactly three digits is ambiguous; the UI locale decides (`1,500` is 1500 in `en`, 1.5 in `pt-MZ`). Negative amounts are rejected.
- `formatNumber` shows 2 decimals, or 4 significant digits (max 8 decimals) for values below 1. pt-MZ doesn't group 4-digit numbers (`6390,50`) — that's CLDR, not a bug.
- Initial pair: URL params → last pair saved → USD to the locale's currency (MZN when the locale has none or is USD).
- The status banner is `position: fixed` on purpose so it never causes layout shift. Keep it that way (Lighthouse CLS).
- History is recorded 1.5 s after typing stops, or immediately on Enter.
- Shortcuts are handled in `onShortcut` in `app.js`: `S` swaps (not while typing in a field), `/` opens the "To" picker (works from the amount field, since `/` is never part of an amount; in multi mode it opens "Add currency"), `Esc` is native `<dialog>` behaviour.

## Rules for changes

- Never hardcode UI text outside `js/i18n.js`; add every new key to both `pt` and `en`.
- New network calls go in `js/api.js` only.
- Keep money math and parsing pure in `js/utils.js` and cover changes with tests in `tests/`.
- When changing any shipped file, bump `VERSION` in `sw.js` and add new shell files to `SHELL_FILES`.
- Users never see raw errors: map failures to `ApiError` kinds and to i18n messages.

## Before merging

- `npm test` passes.
- Load the page in a browser and check there are no console errors.
- Lighthouse 90+ on Performance, Accessibility, Best Practices and SEO (last local run: 98 / 100 / 96 / 100 mobile).
- Combobox ARIA pattern intact, focus visible, WCAG AA contrast in light and dark, `prefers-reduced-motion` respected.
- No horizontal scroll at 320 px.
