# Signal Field asset manifest

All interface artwork in this handoff is code-native. The prototype deliberately uses no raster imagery, external icon kit, or product logo file, so it stays safe to preview without third-party asset requests.

| Asset / source | Repo-relative path | Absolute checkout path | Usage | Notes |
| --- | --- | --- | --- | --- |
| Design tokens | `ui-designer/design/tokens.css` | `/home/penn/multica_workspaces/d89c1fdd-7ff0-426d-ae76-a7d2f32ce6a1/b8cc3603/workdir/TradingAgentsWeb/ui-designer/design/tokens.css` | Shared semantic colors, spacing, radii, motion | Copy these tokens into the frontend theme layer; do not hard-code equivalents in components. |
| High-fidelity interactive prototype | `ui-designer/prototype/index.html` | `/home/penn/multica_workspaces/d89c1fdd-7ff0-426d-ae76-a7d2f32ce6a1/b8cc3603/workdir/TradingAgentsWeb/ui-designer/prototype/index.html` | Product shell and key WS-12 flows/states | Inline SVG uses a consistent 1.75px outline family. SVG charts are decorative with text summaries next to them. |
| Prototype smoke check | `ui-designer/prototype/prototype-smoke.mjs` | `/home/penn/multica_workspaces/d89c1fdd-7ff0-426d-ae76-a7d2f32ce6a1/b8cc3603/workdir/TradingAgentsWeb/ui-designer/prototype/prototype-smoke.mjs` | Structural regression check for the handoff prototype | Run with `node ui-designer/prototype/prototype-smoke.mjs`. |
| UI specification | `ui-designer/ui-spec.md` | `/home/penn/multica_workspaces/d89c1fdd-7ff0-426d-ae76-a7d2f32ce6a1/b8cc3603/workdir/TradingAgentsWeb/ui-designer/ui-spec.md` | Engineering/design source of truth | Defines runtime UI behavior; it does not change API contracts. |

No image-generation asset was added: this information-dense terminal UI is better expressed by semantic HTML, CSS, inline SVG and real application data than by a bitmap mockup.
