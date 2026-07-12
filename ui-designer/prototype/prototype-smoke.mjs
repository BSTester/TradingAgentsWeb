import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');

for (const id of ['auth', 'analysis', 'workflow', 'report', 'history', 'schedules', 'profile', 'ai-settings', 'admin-default']) {
  assert.match(html, new RegExp(`data-screen="${id}"`), `missing ${id} prototype screen`);
}

assert.match(html, /WORKFLOW DESK/, 'missing the workflow-desk product direction');
assert.match(html, /aria-live="polite"/, 'missing assistive feedback region');
assert.match(html, /prefers-reduced-motion/, 'missing reduced-motion treatment');
assert.match(html, /function showScreen\(/, 'missing screen-switcher interaction');
assert.match(html, /URLSearchParams/, 'missing deep-linkable prototype screen state');
assert.match(html, /Market Analyst/, 'missing TradingAgents market-analysis workflow stage');
assert.match(html, /Bull Researcher/, 'missing TradingAgents investment debate stage');
assert.match(html, /Risk Judge/, 'missing TradingAgents risk-judgement stage');

const analysisStart = html.indexOf('data-screen="analysis"');
const workflowStart = html.indexOf('data-screen="workflow"');
const analysisScreen = html.slice(analysisStart, workflowStart);
assert.match(analysisScreen, /选择分析模型/, 'analysis start must expose model selection');
assert.doesNotMatch(analysisScreen, /本浏览器密钥|系统默认 Provider|API KEY/, 'analysis start must not expose model configuration provenance');

console.log('Prototype smoke checks passed.');
