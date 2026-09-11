'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

const EXAMPLES = [
  '宁德时代海外扩张对未来 12 个月利润的影响',
  '拆解小米汽车业务对整体估值的拉动',
  '0700',
  '招商银行 600036',
];

export function SearchBar({ size = 'lg' }: { size?: 'lg' | 'md' }) {
  const router = useRouter();
  const [value, setValue] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    router.push(`/research?q=${encodeURIComponent(q)}`);
  };

  const height = size === 'lg' ? 'h-14' : 'h-11';
  const textSize = size === 'lg' ? 'text-base' : 'text-sm';

  return (
    <div className="w-full">
      <form onSubmit={submit} className="relative">
        <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="输入股票代码、公司名称，或一句研究指令，如「宁德时代海外扩张对未来 12 个月利润的影响」"
          className={`w-full rounded-xl border border-dark-border bg-dark-input ${height} ${textSize} pl-11 pr-28 text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40`}
          autoFocus={size === 'lg'}
        />
        <button
          type="submit"
          className="btn-primary absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 text-xs"
        >
          开始研究
        </button>
      </form>
      {size === 'lg' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-tertiary">快捷示例：</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setValue(ex)}
              className="rounded-full border border-dark-border bg-dark-secondary px-3 py-1 text-xs text-text-secondary transition-colors hover:border-dark-hover hover:text-text-primary"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

