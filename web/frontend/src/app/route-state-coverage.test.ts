import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const routeFiles = [
  'src/app/scheduled-tasks/page.tsx',
  'src/app/profile/ai-settings/page.tsx',
  'src/app/admin/llm-config/page.tsx',
];

describe('data routes use the shared four-state boundary', () => {
  it.each(routeFiles)('%s integrates RouteDataState', (routeFile) => {
    const source = readFileSync(resolve(process.cwd(), routeFile), 'utf8');

    expect(source).toContain("RouteDataState");
  });
});
