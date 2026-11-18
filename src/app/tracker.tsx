"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/track-client";

// 페이지를 처음 열 때 한 번 "방문"을 알림 → 서버가 첫 방문·공유 링크 방문·계정 연결을 기록 (/api/track)
// 공유 링크의 ?via= 는 기록한 뒤 주소에서 지움 (새로고침·다시 공유로 또 세지 않게)
const PAGES: [RegExp, string][] = [
  [/^\/$/, "home"],
  [/^\/market/, "market"],
  [/^\/sale\//, "sale"],
  [/^\/example/, "example"],
  [/^\/g\//, "gift"],
  [/^\/beads/, "beads"],
  [/^\/onboarding/, "onboarding"],
  [/^\/dreams\//, "dream"],
  [/^\/trades\//, "trade"],
];

export default function Tracker() {
  const pathname = usePathname();
  // 화면을 옮길 때마다 어떤 화면(꿈이면 꿈 id)을 봤는지 한 줄씩 기록 (관리자 "활동" 탭에서 사람별 여정에 씀)
  useEffect(() => {
    const page = PAGES.find(([re]) => re.test(pathname))?.[1] ?? "other";
    const id = /^\/(?:sale|dreams|trades)\/([0-9a-f-]{36})/i.exec(pathname)?.[1];
    track("page_view", { target: page, id });
  }, [pathname]);
  useEffect(() => {
    const url = new URL(window.location.href);
    const via = url.searchParams.get("via");
    const id = /^\/(?:sale)\/([0-9a-f-]{36})$/i.exec(url.pathname)?.[1];
    const page = PAGES.find(([re]) => re.test(url.pathname))?.[1] ?? "other";
    track("visit", { target: page, id, via: via === "share" || via === "copy" ? via : undefined });
    if (via) {
      url.searchParams.delete("via");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    // 레이아웃은 화면을 옮겨도 그대로라, 처음 연 페이지에서 한 번만 실행됨
  }, []);
  return null;
}
