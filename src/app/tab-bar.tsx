"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 아래 탭 (중고 거래 앱처럼): MY(내 꿈 서랍, 첫 화면) · 장터. 2026-11-04 사용자: "1페이지는 my, 2페이지는 장터"
// MY(/)와 장터(/market)에만 붙임. 다른 화면은 지금처럼 위쪽 ← 링크로 돌아옴
const TABS = [
  { href: "/", label: "MY", icon: <PersonIcon /> },
  { href: "/market", label: "장터", icon: <ShopIcon /> },
] as const;

export default function TabBar() {
  const path = usePathname();
  return (
    <nav
      aria-label="아래 메뉴"
      className="kk-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto grid max-w-md grid-cols-2">
        {TABS.map((t) => {
          const on = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${on ? "font-bold text-moon" : "text-white/60"}`}
            >
              {t.icon}
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function PersonIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.2-4 4.4-6 8-6s6.8 2 8 6" />
    </svg>
  );
}

function ShopIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9l1.5-5h13L20 9" />
      <path d="M4 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 2 3s2-1.3 2-3c0 1.7 1.3 3 3 3s3-1.3 3-3" />
      <path d="M5 12v8h14v-8" />
      <path d="M10 20v-4h4v4" />
    </svg>
  );
}
