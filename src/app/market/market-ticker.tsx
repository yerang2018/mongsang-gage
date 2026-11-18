"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TimeAgo from "@/app/time-ago";

export type Buzz = { key: string; at: string; text: string; href: string };

// 장터 맨 위 "방금 소식" 한 줄: 내놓은 꿈·팔린 꿈을 3.5초마다 하나씩 돌려 보여 줌 (벼룩시장 웅성웅성)
export default function MarketTicker({ items, compact = false }: { items: Buzz[]; compact?: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const timer = setInterval(() => setI((n) => (n + 1) % items.length), 3500);
    return () => clearInterval(timer);
  }, [items.length]);
  if (items.length === 0) return null;
  const b = items[i % items.length];
  return (
    <Link
      href={b.href}
      aria-live="polite"
      className={`flex min-h-11 items-center gap-2 overflow-hidden ${compact ? "text-xs" : "mt-3 rounded-full bg-white/10 px-4 text-sm"} active:scale-[0.99]`}
    >
      <span className="kk-twinkle h-2 w-2 shrink-0 rounded-full bg-moon" aria-hidden />
      <span key={b.key} className="kk-fade-up flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className="truncate">{b.text}</span>
        <TimeAgo at={b.at} className="shrink-0 text-xs text-white/60" />
      </span>
    </Link>
  );
}
