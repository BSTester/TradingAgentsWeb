'use client';

import React, { useEffect, useRef } from 'react';

export interface CaptchaImageProps {
  width?: number;
  height?: number;
  className?: string;
  onIdChange?: (id: string) => void; // 后端下发的 captcha_id 回传给父组件（不泄露 code）
}

function randomColor(min = 0, max = 255) {
  const r = min + Math.floor(Math.random() * (max - min));
  const g = min + Math.floor(Math.random() * (max - min));
  const b = min + Math.floor(Math.random() * (max - min));
  return `rgb(${r},${g},${b})`;
}

function randomChar() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆字符
  return chars[Math.floor(Math.random() * chars.length)];
}

export function CaptchaImage({
  width = 140,
  height = 48,
  className,
  onIdChange,
}: CaptchaImageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const codeRef = useRef<string>('');
  const initRef = useRef<boolean>(false);
  const deriveCodeFromSeed = async (seed: string, length = 5) => {
    // 与后端完全一致：SHA256(seed) -> 映射到字符集
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(seed);
      const digestBuf = await window.crypto.subtle.digest('SHA-256', data);
      const digest = new Uint8Array(digestBuf);
      const idxs: number[] = [];
      for (let i = 0; i < length; i++) {
        const b = digest.length ? (digest[i % digest.length] ?? 0) : 0;
        idxs.push(b % chars.length);
      }
      return idxs.map(i => chars.charAt(i)).join('');
    }
    // 退化策略（无 SubtleCrypto 时）：用 TextEncoder 字节循环映射
    const encoder = new TextEncoder();
    const bytes = encoder.encode(seed);
    const idxs: number[] = [];
    for (let i = 0; i < length; i++) {
      const b = bytes.length ? (bytes[i % bytes.length] ?? 0) : 0;
      idxs.push(b % chars.length);
    }
    return idxs.map(i => chars.charAt(i)).join('');
  };

  const draw = (newCode: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 背景
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = randomColor(200, 255);
    ctx.fillRect(0, 0, width, height);

    // 干扰线
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = randomColor(80, 200);
      ctx.beginPath();
      ctx.moveTo(Math.random() * width, Math.random() * height);
      ctx.lineTo(Math.random() * width, Math.random() * height);
      ctx.stroke();
    }

    // 干扰点
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = randomColor(100, 255);
      ctx.beginPath();
      ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 绘制字符
    ctx.font = 'bold 28px sans-serif';
    ctx.textBaseline = 'middle';
    const charSpace = width / (newCode.length + 1);

    for (let i = 0; i < newCode.length; i++) {
      const ch = newCode.charAt(i);
      const rotate = (Math.random() - 0.5) * 0.5; // -0.25 ~ 0.25 弧度
      const x = charSpace * (i + 1);
      const y = height / 2 + (Math.random() - 0.5) * 8;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotate);
      ctx.fillStyle = randomColor(50, 160);
      ctx.fillText(ch, -8, 8);
      ctx.restore();
    }
  };

  const regenerate = async () => {
    // 后端拉取挑战：收到 seed，派生 code（不外泄），仅回传 captcha_id
    try {
      const { authAPI } = await import('@/lib/apiClient');
      const { captcha_id, seed } = await authAPI.getCaptcha();
      const code = await deriveCodeFromSeed(seed, 5);
      codeRef.current = code;
      onIdChange?.(captcha_id);
      draw(code);
    } catch {
      // 后端不可用时，降级为本地随机模式（不影响正常使用）
      const newCode = Array.from({ length: 5 }, () => randomChar()).join('');
      codeRef.current = newCode;
      draw(newCode);
    }
  };

  // 仅首次挂载拉取一次；开发模式下避免 Strict Mode 双挂载引起的重复请求
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    // 开发模式的全局路径级时间戳防抖，抑制 Strict Mode 的即时二次初始化
    const isDev = process.env.NODE_ENV === 'development';
    if (typeof window !== 'undefined' && isDev) {
      const path = window.location?.pathname || 'unknown';
      const key = '__captchaInitTs__';
      const now = Date.now();
      const w = window as any;
      w[key] = w[key] || {};
      const last = w[key][path] || 0;
      if (now - last < 3000) {
        // 在3秒窗口内的第二次“首次初始化”，跳过以避免重复请求
        return;
      }
      w[key][path] = now;
    }
    void regenerate();

  }, []);

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="rounded cursor-pointer bg-dark-tertiary hover:opacity-90 transition-opacity max-w-full"
          style={{ display: 'block', height: `${height}px`, width: `${width}px`, maxWidth: '100%' }}
          onClick={() => { void regenerate(); }}
          aria-label="点击刷新验证码"
          title="点击刷新验证码"
        />
      </div>
    </div>
  );
}

export default CaptchaImage;
