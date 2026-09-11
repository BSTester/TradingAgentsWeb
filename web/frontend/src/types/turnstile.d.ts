/**
 * Cloudflare Turnstile 全局声明（唯一来源）。
 *
 * 说明：此前 `app/auth/page.tsx` 与 `components/auth/Turnstile.tsx` 各自
 * `declare global` 了 `Window.turnstile`，两处形状不一致（后者额外需要
 * `remove`，且 `reset` 可省略参数），TypeScript 会报 TS2717
 * （后续属性声明必须具有相同类型）。统一在此声明，两处内联声明已移除。
 */

export {};

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}
