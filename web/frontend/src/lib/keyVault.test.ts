import { beforeEach, describe, expect, it } from 'vitest';
import { keyVault, localKeyId, providerKeyOf } from '@/lib/keyVault';

const USER_A = 1;
const USER_B = 2;

beforeEach(() => {
  window.localStorage.clear();
});

describe('localKeyId', () => {
  it('组合 userId + providerKey', () => {
    expect(localKeyId(USER_A, 'openai')).toBe('taw:llmkey:v1:1:openai');
  });
});

describe('providerKeyOf', () => {
  it('优先使用 provider_name', () => {
    expect(providerKeyOf({ provider_name: 'openai' })).toBe('openai');
  });
  it('无 provider_name 时回退 id', () => {
    expect(providerKeyOf({ id: 42 })).toBe('42');
  });
});

describe('keyVault save / get / has', () => {
  it('保存后可读取，且明文只存于 localStorage', () => {
    keyVault.save(USER_A, 'openai', 'sk-secret');
    expect(keyVault.has(USER_A, 'openai')).toBe(true);
    expect(keyVault.get(USER_A, 'openai')).toBe('sk-secret');
    const raw = window.localStorage.getItem(localKeyId(USER_A, 'openai'))!;
    expect(raw).toContain('sk-secret');
    expect(raw).toContain('"savedAt"');
  });

  it('has 在不存在时返回 false', () => {
    expect(keyVault.has(USER_A, 'openai')).toBe(false);
    expect(keyVault.get(USER_A, 'openai')).toBeNull();
  });

  it('按 userId 隔离，多账户不串用', () => {
    keyVault.save(USER_A, 'openai', 'key-A');
    keyVault.save(USER_B, 'openai', 'key-B');
    expect(keyVault.get(USER_A, 'openai')).toBe('key-A');
    expect(keyVault.get(USER_B, 'openai')).toBe('key-B');
  });

  it('不同 provider 维度隔离', () => {
    keyVault.save(USER_A, 'openai', 'key-openai');
    keyVault.save(USER_A, 'anthropic', 'key-anthropic');
    expect(keyVault.get(USER_A, 'openai')).toBe('key-openai');
    expect(keyVault.get(USER_A, 'anthropic')).toBe('key-anthropic');
  });
});

describe('keyVault replace / clear', () => {
  it('replace 覆盖完整 KEY', () => {
    keyVault.save(USER_A, 'openai', 'old');
    keyVault.replace(USER_A, 'openai', 'new');
    expect(keyVault.get(USER_A, 'openai')).toBe('new');
  });

  it('clear 删除本浏览器 KEY', () => {
    keyVault.save(USER_A, 'openai', 'sk-secret');
    keyVault.clear(USER_A, 'openai');
    expect(keyVault.has(USER_A, 'openai')).toBe(false);
  });

  it('list 返回当前用户已存 KEY 的 providerKey', () => {
    keyVault.save(USER_A, 'openai', 'a');
    keyVault.save(USER_A, 'anthropic', 'b');
    keyVault.save(USER_B, 'openai', 'c');
    expect(keyVault.list(USER_A).sort()).toEqual(['anthropic', 'openai']);
    expect(keyVault.list(USER_B)).toEqual(['openai']);
  });
});

describe('keyVault 损坏数据容错', () => {
  it('损坏的 JSON 返回 null 不抛错', () => {
    window.localStorage.setItem(localKeyId(USER_A, 'openai'), '{not-json');
    expect(keyVault.get(USER_A, 'openai')).toBeNull();
  });
});
