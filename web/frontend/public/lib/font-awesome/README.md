# Font Awesome 6.4.0 (self-hosted)

Vendored to eliminate the render-blocking external CDN stylesheet that previously
blocked first paint (see `frontend/issues/WS-86`).

- **Source:** Font Awesome Free 6.4.0 (`https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/`)
- **License:** Font Awesome Free License (SIL OFL 1.1 for icons, MIT for CSS, CC BY 4.0 for the `fa-v4compatibility` shim). See https://fontawesome.com/license/free
- **Contents:**
  - `css/all.min.css` — the full stylesheet (ttf `src` entries stripped; woff2-only for a lean, modern-only payload)
  - `webfonts/fa-solid-900.woff2`, `fa-regular-400.woff2`, `fa-brands-400.woff2`, `fa-v4compatibility.woff2`

Only `fa-solid-900.woff2` is fetched on the first screen (the app uses `fas`
icons everywhere); `fa-brands-400` / `fa-regular-400` / `fa-v4compatibility`
load on demand from the same origin.

Loaded non-blockingly from `src/app/layout.tsx` (print → all media swap), so it
never blocks first paint.
