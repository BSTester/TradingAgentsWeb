# Font Awesome 6.4.0 (self-hosted)

Vendored to eliminate the render-blocking external CDN stylesheet that previously
blocked first paint (see `frontend/issues/WS-86`).

- **Source:** Font Awesome Free 6.4.0 (`https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/`)
- **License:** Font Awesome Free License (SIL OFL 1.1 for icons, MIT for CSS, CC BY 4.0 for the `fa-v4compatibility` shim). See https://fontawesome.com/license/free
- **Contents:**
  - `css/all.min.css` — the full stylesheet (ttf `src` entries stripped; woff2-only for a lean, modern-only payload). Kept as the source of truth the subset is derived from; NOT loaded by the app.
  - `css/icons.subset.css` — the **subset actually loaded by the app** (~20 kB, only the icons used in `src/` + base/animation rules). See WS-97 below.
  - `webfonts/fa-solid-900.woff2`, `fa-regular-400.woff2`, `fa-brands-400.woff2`, `fa-v4compatibility.woff2`

Only `fa-solid-900.woff2` is fetched on the first screen (the app uses `fas`
icons everywhere); `fa-brands-400` / `fa-regular-400` / `fa-v4compatibility`
load on demand from the same origin.

Loaded non-blockingly from `src/app/layout.tsx` (print → all media swap), so it
never blocks first paint.

## WS-97 — why we load a subset, not `all.min.css`

The non-blocking load applies the stylesheet *after* FCP. Applying the full
~99 kB / ~2000-selector `all.min.css` after FCP forces one large style-
recalculation long task inside the FCP→TTI window — which is exactly what TBT
measures (the homepage TBT regression WS-97 fixes). `icons.subset.css` keeps
only the ~90 icons referenced in `src/` plus the base / `.fa-spin` / reduced-
motion rules (~20 kB, ~200 selectors), so applying it after FCP is no longer a
long task, while the FCP/LCP gains from non-blocking are preserved.

- **Regenerate** when icons change: `npm run build:fa-subset`
  (the generator exits non-zero if a `fa-` name used in `src/` is unresolvable).
- **Guarded** by `src/lib/font-awesome-subset.test.ts`, which fails if any icon
  used in `src/` is missing from the subset.
