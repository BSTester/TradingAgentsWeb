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
            be missed by framework hydration timing. <noscript> applies it eagerly. */}
        <link rel="preload" href="/lib/font-awesome/css/all.min.css" as="style" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              '!function(){var l=document.createElement("link");l.rel="stylesheet";l.href="/lib/font-awesome/css/all.min.css";l.media="print";l.onload=function(){this.media="all"};document.head.appendChild(l);}();',
          }}
        />
        <noscript>
          <link rel="stylesheet" href="/lib/font-awesome/css/all.min.css" />
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