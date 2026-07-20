import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('analysis launch privacy boundary', () => {
  it('does not render provider, endpoint, or key-status guidance beside the model selector', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/analysis/AnalysisConfigForm.tsx'),
      'utf8',
    );

    expect(source).not.toContain('该模型尚未在“我的模型”填写可用密钥');
    expect(source).not.toContain('请前往“我的模型”完成配置后再发起分析');
  });
});
