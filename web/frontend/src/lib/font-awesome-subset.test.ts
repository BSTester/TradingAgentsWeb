import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Guard for the Font Awesome subset (WS-97). `layout.tsx` loads
 * `public/lib/font-awesome/css/icons.subset.css` instead of the full
 * `all.min.css` so that the post-FCP style recalculation no longer shows up as a
 * long task in TBT. This test makes sure the subset can never silently drop an
 * icon the UI actually uses: every `fa-<name>` referenced in `src/` must have a
 * matching `:before` rule in the subset. If you add a new icon, run
 * `npm run build:fa-subset` to regenerate it (the build fails loudly if an icon
 * is unresolvable). The scanning logic here is intentionally independent of the
 * generator's so a bug in one can't mask the other.
 */
const FRONTEND_ROOT = process.cwd();
const SRC_ROOT = path.join(FRONTEND_ROOT, 'src');
const SUBSET_CSS = path.join(
  FRONTEND_ROOT,
  'public/lib/font-awesome/css/icons.subset.css',
);
const FULL_CSS = path.join(
  FRONTEND_ROOT,
  'public/lib/font-awesome/css/all.min.css',
);

// Same modifier/utility exclusion as the generator — these share the `fa-`
// prefix but are not icon names (their rules live in the non-glyph section,
// which the subset keeps wholesale).
const MODIFIERS = new Set([
  'spin', 'pulse', 'beat', 'fade', 'bounce', 'flip', 'beat-fade', 'spin-reverse',
  'spin-pulse', 'fw', 'fixed-width', 'border', 'pull-left', 'pull-right', 'pull',
  'm', 'b', 'rotate-90', 'rotate-180', 'rotate-270', 'rotate-by',
  'flip-horizontal', 'flip-vertical', 'flip-both',
  'xs', 'sm', 'lg', 'xl', '2xs', '2x', '3x', '4x', '5x', '6x', '7x', '8x', '9x', '10x',
  'stack', 'stack-1x', 'stack-2x', 'inverse', 'li', 'ul', 'sr-only',
  'solid', 'regular', 'brands', 'light', 'thin', 'duotone', 'sharp',
]);

function collectUsedIconNames(): Set<string> {
  const names = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.[cm]?[tj]sx?$/.test(entry.name)) {
        const text = fs.readFileSync(p, 'utf8');
        // Mirror the generator's scanner: require a className separator before
        // `fa-` so prose (e.g. `build:fa-subset`) isn't read as an icon.
        const re = /(?<=[\s"'`=])fa-([a-z0-9-]+)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
          const name = m[1];
          if (name && !MODIFIERS.has(name)) names.add(name);
        }
      }
    }
  };
  walk(SRC_ROOT);
  return names;
}

describe('Font Awesome subset (WS-97)', () => {
  it('ships the subset file referenced by layout.tsx', () => {
    expect(fs.existsSync(SUBSET_CSS)).toBe(true);
  });

  it('is substantially smaller than the full stylesheet', () => {
    const subset = fs.statSync(SUBSET_CSS).size;
    const full = fs.statSync(FULL_CSS).size;
    // The full sheet is ~99 kB; the subset should be well under half. This guards
    // against accidentally re-pointing the build at the full sheet.
    expect(subset).toBeLessThan(full * 0.6);
  });

  it('contains a :before rule for every icon used in src/', () => {
    const subset = fs.readFileSync(SUBSET_CSS, 'utf8');
    const used = collectUsedIconNames();
    expect(used.size).toBeGreaterThan(0);
    const missing = [...used].filter((name) => !new RegExp(`\\.fa-${name}:before`).test(subset));
    expect(missing).toEqual([]);
  });
});
