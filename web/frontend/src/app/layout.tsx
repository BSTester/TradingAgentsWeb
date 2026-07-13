import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'TradingAgentsWeb - 多智能体大语言模型金融交易框架',
  description: '基于多智能体LLM的金融交易分析系统',
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
        <meta name="theme-color" content="#0a0e1a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TradingAgents" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
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
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}