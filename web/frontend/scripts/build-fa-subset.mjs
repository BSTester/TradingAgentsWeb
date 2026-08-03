// @ts-nocheck
/**
 * Font Awesome subset generator — see frontend/issues/WS-86 + WS-97.
 *
 * Why this exists: `all.min.css` ships the full Font Awesome 6.4.0 stylesheet
 * (~99 kB, ~2000 selectors). It is loaded non-blockingly (media=print + onload
 * swap in layout.tsx), so it is parsed and applied *after* FCP. Applying ~2000
 * selectors to the document triggers one large style-recalculation long task in
 * the FCP→TTI window, which is exactly what TBT measures — that is the homepage
 * TBT regression WS-97 fixes.
 *
 * The app only uses ~100 icons + the `fa-spin` animation. This script rewrites
 * the full stylesheet to keep:
 *   - every @font-face (so the solid/regular/brands woff2 files still resolve),
 *   - every base / utility / animation rule (keeps `.fa`, `.fas`, `.fa-spin`
 *     and the reduced-motion @media block — zero risk of dropping a needed rule),
 *   - only the per-icon `.fa-NAME:before{content:"…"}` glyph rules whose name is
 *     actually referenced in `src/`.
 *
 * It extracts the kept glyph rules verbatim from `all.min.css`, so every icon
 * that renders today renders identically afterward — including v4 aliases such
 * as `fa-cog` / `fa-times` / `fa-sliders-h`, which live in multi-selector rules
 * (`.fa-cog:before,.fa-gear:before{content:"\f013"}`). A rule is kept when *any*
 * of its selectors is used.
 *
 * Safety: if a `fa-` token used in `src/` has no matching `:before` rule in the
 * full stylesheet, the script exits non-zero so it can never silently drop an
 * icon. The vitest guard `font-awesome-subset.test.ts` re-checks the same
 * invariant in CI so future icon additions can't break it.
 *
 * Usage:  node scripts/build-fa-subset.mjs
 * (also wired as `npm run build:fa-subset`)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const fullCssPath = path.join(frontendRoot, 'public/lib/font-awesome/css/all.min.css');
const outPath = path.join(frontendRoot, 'public/lib/font-awesome/css/icons.subset.css');
const srcRoot = path.join(frontendRoot, 'src');

// Non-glyph classes that share the `fa-` prefix but are not icon names. These are
// kept implicitly (their rules are not glyph rules, so "keep all non-glyph rules"
// preserves them); we just must not treat them as missing icons.
const MODIFIERS = new Set([
  // animation / transform / sizing / layout utilities + style-family prefixes
  'spin', 'pulse', 'beat', 'fade', 'bounce', 'flip', 'beat-fade', 'spin-reverse',
  'spin-pulse', 'fw', 'fixed-width', 'border', 'pull-left', 'pull-right',
  'pull', 'm', 'b', 'rotate-90', 'rotate-180', 'rotate-270', 'rotate-by',
  'flip-horizontal', 'flip-vertical', 'flip-both',
  'xs', 'sm', 'lg', 'xl', '2xs', '2x', '3x', '4x', '5x', '6x', '7x', '8x', '9x', '10x',
  'stack', 'stack-1x', 'stack-2x', 'inverse', 'li', 'ul', 'sr-only',
  'solid', 'regular', 'brands', 'light', 'thin', 'duotone', 'sharp',
]);

function walkSrc(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSrc(p, out);
    else if (/\.[cm]?[tj]sx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

// 1. Collect the icon names actually referenced in src/. The positive lookbehind
//    requires the `fa-` token to be preceded by a className separator (whitespace,
//    quote, backtick, or `=`), so prose like `build:fa-subset` in comments /
//    script names can't masquerade as an icon and break the build.
const ICON_TOKEN = /(?<=[\s"'`=])fa-([a-z0-9-]+)/g;
const used = new Set();
for (const file of walkSrc(srcRoot)) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(ICON_TOKEN)) {
    const name = m[1];
    if (!MODIFIERS.has(name)) used.add(name);
  }
}

// 2. Split the stylesheet into top-level rules, brace-aware (all.min.css has one
//    @media reduced-motion block with nested braces — naive split-on-} corrupts it).
const css = fs.readFileSync(fullCssPath, 'utf8');
const rules = [];
{
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        rules.push(css.slice(start, i + 1));
        start = i + 1;
      }
    }
  }
  if (start < css.length) {
    const tail = css.slice(start).trim();
    if (tail) rules.push(tail);
  }
}

// 3. Keep all non-glyph rules; keep a glyph rule only if any of its selectors
//    names a used icon.
const GLYPH_RULE = /\.fa-[a-z0-9-]+:before\{content:/;
const SELECTOR_NAME = /\.fa-([a-z0-9-]+):before/g;
const out = [];
let keptGlyphs = 0;
for (const rule of rules) {
  if (GLYPH_RULE.test(rule)) {
    const names = new Set();
    SELECTOR_NAME.lastIndex = 0;
    for (const m of rule.matchAll(SELECTOR_NAME)) names.add(m[1]);
    if ([...names].some((n) => used.has(n))) {
      out.push(rule);
      keptGlyphs++;
    }
  } else {
    out.push(rule); // @font-face, base, utility, animation, @media, comment
  }
}

// 4. Coverage check: every used icon must exist as a :before selector in the
//    FULL stylesheet (single- or multi-selector). Exit non-zero if not.
const missing = [];
for (const name of used) {
  if (!new RegExp(`\\.fa-${name}:before`).test(css)) missing.push(name);
}
if (missing.length) {
  console.error('FA subset: icons used in src but absent from all.min.css:');
  console.error('  ' + missing.sort().join(', '));
  console.error('Either fix the class name or extend MODIFIERS if it is a utility.');
  process.exit(1);
}

fs.writeFileSync(outPath, out.join('\n'));

const fullBytes = Buffer.byteLength(css);
const subBytes = fs.statSync(outPath).size;
console.log(
  `FA subset: used=${used.size} kept-glyph-rules=${keptGlyphs} ` +
    `size ${fullBytes}→${subBytes} B (${((1 - subBytes / fullBytes) * 100).toFixed(0)}% smaller)`,
);
console.log(`  wrote ${path.relative(frontendRoot, outPath)}`);
