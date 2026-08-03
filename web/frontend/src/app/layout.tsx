import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'TradingAgents · Workflow Desk',
  description: '基于 TradingAgents 多智能体研究图的现代化分析工作台',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0a0d12" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TradingAgents" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Noto+Sans+SC:wght@400;500;600;700&display=swap"
        />
        {/* Font Awesome 6.4.0 — self-hosted under /lib/font-awesome.
            Previously a render-blocking external <link> to cdnjs.cloudflare.com
            that delayed first paint by 0.6–16s (flaky cross-origin fetch, see
            issues/WS-86). Now loaded non-blockingly: the inline script appends a
            <link media="print"> (never blocks rendering) and swaps to media="all"
            on load. createElement + onload is set synchronously, so the swap can't
            be missed by framework hydration timing. <noscript> applies it eagerly.
            ---
            WS-97: we load the SUBSET (`icons.subset.css`), not the full
            `all.min.css`. The non-blocking load applies the stylesheet after FCP,
            and the full ~99 kB / ~2000-selector sheet forced one large
            style-recalculation long task in the FCP→TTI window (= the homepage TBT
            regression). The subset keeps only the ~90 icons actually used plus the
            base/animation rules (~20 kB, ~200 selectors), so applying it after FCP
            is no longer a long task, while FCP/LCP stay improved. Regenerate with
            `npm run build:fa-subset`; the `font-awesome-subset` test guards that
            every icon referenced in src/ is present in the subset. */}
        <link rel="preload" href="/lib/font-awesome/css/icons.subset.css" as="style" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              '!function(){var l=document.createElement("link");l.rel="stylesheet";l.href="/lib/font-awesome/css/icons.subset.css";l.media="print";l.onload=function(){this.media="all"};document.head.appendChild(l);}();',
          }}
        />
        <noscript>
          <link rel="stylesheet" href="/lib/font-awesome/css/icons.subset.css" />
        </noscript>
      </head>
      <body className="antialiased font-sans">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}