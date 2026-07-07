import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LocalKeyField } from '@/components/profile/LocalKeyField';

let mockUser: any = { id: 1, username: 'tester', role: 'user' };
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const PROVIDER_KEY = 'openai';

beforeEach(() => {
  window.localStorage.clear();
  mockUser = { id: 1, username: 'tester', role: 'user' };
});

describe('LocalKeyField 主交互', () => {
  it('初始空态：提示当前浏览器未保存，可输入并保存', () => {
    render(<LocalKeyField providerKey={PROVIDER_KEY} providerLabel="OpenAI" />);

    expect(screen.getByText('当前浏览器未保存')).toBeInTheDocument();

    const input = screen.getByLabelText('OpenAI API 密钥') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sk-secret-123' } });

    // 勾选保存到当前浏览器（默认已勾选），点击保存
    fireEvent.click(screen.getByText('保存 KEY'));

    expect(window.localStorage.getItem('taw:llmkey:v1:1:openai')).toContain('sk-secret-123');
    expect(screen.getByText('已保存本浏览器')).toBeInTheDocument();
  });

  it('保存成功后不回显明文，并显示已保存徽标', () => {
    render(<LocalKeyField providerKey={PROVIDER_KEY} providerLabel="OpenAI" />);
    const input = screen.getByLabelText('OpenAI API 密钥') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sk-secret-123' } });
    fireEvent.click(screen.getByText('保存 KEY'));

    // 保存后明文输入框被卸载（不回显明文）
    expect(screen.queryByLabelText('OpenAI API 密钥')).toBeNull();
    expect(screen.getByText('已保存本浏览器')).toBeInTheDocument();
  });

  it('已保存态：可清除 KEY（经确认对话框）', () => {
    window.localStorage.setItem(
      'taw:llmkey:v1:1:openai',
      JSON.stringify({ key: 'sk-old', savedAt: new Date().toISOString(), provider: 'openai' })
    );

    render(<LocalKeyField providerKey={PROVIDER_KEY} providerLabel="OpenAI" />);
    expect(screen.getByText('已保存本浏览器')).toBeInTheDocument();

    fireEvent.click(screen.getByText('清除 KEY'));
    // 确认对话框出现
    expect(screen.getByText('清除本地密钥')).toBeInTheDocument();
    // 点击确认清除按钮（精确文本「清除」唯一匹配按钮）
    fireEvent.click(screen.getByText('清除'));

    expect(window.localStorage.getItem('taw:llmkey:v1:1:openai')).toBeNull();
    expect(screen.getByText('当前浏览器未保存')).toBeInTheDocument();
  });

  it('已保存态：替换 KEY 需重输完整 KEY', () => {
    window.localStorage.setItem(
      'taw:llmkey:v1:1:openai',
      JSON.stringify({ key: 'sk-old', savedAt: new Date().toISOString(), provider: 'openai' })
    );

    render(<LocalKeyField providerKey={PROVIDER_KEY} providerLabel="OpenAI" />);
    fireEvent.click(screen.getByText('替换 KEY'));

    const input = screen.getByLabelText('OpenAI API 密钥') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sk-new' } });
    fireEvent.click(screen.getByText('确认替换'));

    expect(window.localStorage.getItem('taw:llmkey:v1:1:openai')).toContain('sk-new');
    // 替换后明文输入框被卸载（不保留明文）
    expect(screen.queryByLabelText('OpenAI API 密钥')).toBeNull();
  });

  it('测试连接回调被调用并返回成败', async () => {
    const onTest = vi.fn().mockResolvedValue({ valid: true, message: 'ok' });
    render(<LocalKeyField providerKey={PROVIDER_KEY} providerLabel="OpenAI" providerId="p1" onTest={onTest} />);

    const input = screen.getByLabelText('OpenAI API 密钥') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sk-test' } });
    fireEvent.click(screen.getByText('测试连接'));

    // onTest 应被调用，传入刚输入的 KEY
    expect(onTest).toHaveBeenCalledWith('sk-test');
    // 等待异步结果
    await act(async () => {
      await Promise.resolve();
    });
    expect(await screen.findByText('连接成功')).toBeInTheDocument();
  });

  it('换浏览器/无痕场景：未保存时提示 KEY 仅存当前浏览器，保存需重填', () => {
    // 不写入 localStorage，模拟换浏览器
    render(<LocalKeyField providerKey={PROVIDER_KEY} providerLabel="OpenAI" />);
    expect(screen.getByText(/仅保存到当前浏览器/)).toBeInTheDocument();
    expect(screen.getByText(/换浏览器、清除站点数据或无痕模式下需重新填写/)).toBeInTheDocument();
  });
});
