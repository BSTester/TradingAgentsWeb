'use client';

import React, { useEffect, useRef, useState } from 'react';

// 滚动进入视口时渐入（+ 位移）的包裹组件，用于首页介绍卡片的动效。
export function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as any}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

// 悬浮抬升 + 高亮边框的卡片。
export function TiltCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-dark-border bg-gradient-to-br from-dark-secondary to-dark-tertiary p-5 shadow-card-dark transition-all duration-300 hover:-translate-y-1.5 hover:border-accent-primary/50 hover:shadow-glow-blue ${className}`}
    >
      {children}
    </div>
  );
}
