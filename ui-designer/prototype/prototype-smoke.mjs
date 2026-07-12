import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');

for (const id of ['analysis', 'profile', 'provider-editor', 'admin', 'guardrails']) {
  assert.match(html, new RegExp(`data-screen="${id}"`), `missing ${id} prototype screen`);
}

assert.match(html, /Signal Field/, 'missing the Signal Field product direction');
assert.match(html, /aria-live="polite"/, 'missing assistive feedback region');
assert.match(html, /prefers-reduced-motion/, 'missing reduced-motion treatment');
assert.match(html, /function showScreen\(/, 'missing screen-switcher interaction');
assert.match(html, /URLSearchParams/, 'missing deep-linkable prototype screen state');

console.log('Prototype smoke checks passed.');
