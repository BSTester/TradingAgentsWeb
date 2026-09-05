import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// WS-133 redesign: `/admin/users` was rebuilt to use its own loading/empty/error
// treatment (not the legacy RouteDataState), so it is excluded from this
// Workflow Desk-era coverage list. The remaining legacy data routes are guarded here.
const routeFiles = [
  'src/app/scheduled-tasks/page.tsx',
  'src/app/profile/ai-settings/page.tsx',
  'src/app/admin/llm-config/page.tsx',
  'src/components/admin/system-default-provider/SystemDefaultForm.tsx',
  'src/components/analysis/AnalysisHistory.tsx',
  'src/components/analysis/AnalysisProgress.tsx',
  'src/components/analysis/AnalysisResults.tsx',
];

describe('data routes use the shared four-state boundary', () => {
  it.each(routeFiles)('%s integrates RouteDataState', (routeFile) => {
    const source = readFileSync(resolve(process.cwd(), routeFile), 'utf8');

    expect(source).toContain("RouteDataState");
  });
});
