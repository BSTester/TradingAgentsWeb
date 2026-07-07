/**
 * Local KEY Vault — 用户 API KEY 仅存于当前浏览器 localStorage
 *
 * 设计依据：web/frontend/api-contract.md §2（WS-20 rework）
 *  - 命名空间：taw:llmkey:v1
 *  - 完整 key：taw:llmkey:v1:<userId>:<providerKey>
 *  - 按 用户 + provider 维度隔离；多账户共用浏览器不会串用
 *  - 明文 KEY 永不明文出现在 react-query/redux 等跨页面状态
 *  - 仅 localStorage，不写 sessionStorage / IndexedDB / Cookie（见 §2.4 安全约束）
 */

export const LOCAL_KEY_NS = 'taw:llmkey:v1';

export interface LocalLLMKeyRecord {
  key: string; // 明文 API KEY（用户已确认存前端）
  savedAt: string; // ISO8601
  provider: string; // 与 providerKey 对应的 provider 标识
}

/** 组合完整 localStorage key */
export function localKeyId(userId: string | number, providerKey: string): string {
  return `${LOCAL_KEY_NS}:${userId}:${providerKey}`;
}

/** SSR / 无 localStorage 环境安全兜底 */
function safeLocalStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const test = '__taw_kv_test__';
    window.localStorage.setItem(test, '1');
    window.localStorage.removeItem(test);
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * 计算 providerKey：
 *  - 系统 provider 用 provider_name（如 openai）
 *  - 用户自定义 provider 用其 id（保证唯一）
 * 与 api-contract.md §2.1 推荐一致。
 */
export function providerKeyOf(p: { provider_name?: string; id?: string | number }): string {
  return String(p.provider_name || p.id || '').trim();
}

export const keyVault = {
  /** 读取明文 KEY；不存在 / 损坏 / 不可用时返回 null */
  get(userId: string | number, providerKey: string): string | null {
    const ls = safeLocalStorage();
    if (ls == null || providerKey == null) return null;
    try {
      const raw = ls.getItem(localKeyId(userId, providerKey));
      if (!raw) return null;
      const rec = JSON.parse(raw) as LocalLLMKeyRecord;
      return rec && typeof rec.key === 'string' ? rec.key : null;
    } catch {
      return null;
    }
  },

  /** 是否存在本地 KEY（绝不返回明文） */
  has(userId: string | number, providerKey: string): boolean {
    return this.get(userId, providerKey) !== null;
  },

  /** 保存 KEY 到当前浏览器（新增） */
  save(userId: string | number, providerKey: string, key: string): void {
    const ls = safeLocalStorage();
    if (ls == null || !providerKey) return;
    const rec: LocalLLMKeyRecord = {
      key,
      savedAt: new Date().toISOString(),
      provider: String(providerKey),
    };
    ls.setItem(localKeyId(userId, providerKey), JSON.stringify(rec));
  },

  /** 替换 KEY（覆盖已有，需重输完整 KEY） */
  replace(userId: string | number, providerKey: string, key: string): void {
    this.save(userId, providerKey, key);
  },

  /** 清除当前浏览器的本地 KEY */
  clear(userId: string | number, providerKey: string): void {
    const ls = safeLocalStorage();
    if (ls == null || !providerKey) return;
    ls.removeItem(localKeyId(userId, providerKey));
  },

  /** 列出某用户在当前浏览器已保存 KEY 的 providerKey 列表 */
  list(userId: string | number): string[] {
    const ls = safeLocalStorage();
    if (ls == null) return [];
    const prefix = `${LOCAL_KEY_NS}:${userId}:`;
    const result: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k && k.startsWith(prefix)) {
        result.push(k.slice(prefix.length));
      }
    }
    return result;
  },
};

export default keyVault;
