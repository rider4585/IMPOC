<!-- bmad:context -->
<!-- Verified 2026-08-19. No VCS in this repo yet (not a git repository) — re-verify against the initial commit SHA once one exists. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## Frontend (IMPOC SPA)

React 19 + Vite SPA. One working feature so far: a Code 128 scanner (`src/components/BarcodeScanner.jsx`) on `@zxing/browser`, carried over from the MVP that seeded this project.

## Where things are

- Scanner: `src/components/BarcodeScanner.jsx`; API calls in `src/services/barcodeApi.js`

## Conventions that differ from defaults

- `vite.config.js` sets `basicSsl()` and `host: true` deliberately — `getUserMedia` requires HTTPS, so the camera scanner cannot work over plain `http://` on a LAN address. Keep both, and expect the self-signed-cert warning.
- Treat the scanner's UI as scaffolding to replace and its ZXing decode logic as the asset to preserve.

## Known pitfalls

- `BarcodeScanner.jsx` imports `@zxing/library`, which is not in `package.json` — it resolves only as a transitive dep of `@zxing/browser`. Declare it before a bump breaks the build.

<!-- /bmad:context -->
