"use client";

import { useEffect } from "react";
import { track } from "@/lib/track-client";

// 페이지를 처음 열 때 한 번 "방문"을 알림 → 서버가 첫 방문·공유 링크 방문·계정 연결을 기록 (/api/track)
// 공유 링크의 ?via= 는 기록한 뒤 주소에서 지움 (새로고침·다시 공유로 또 세지 않게)
const PAGES: [RegExp, string][] = [
  [/^\/$/, "home"],
  [/^\/market/, "market"],
  [/^\/sale\//, "sale"],
  [/^\/requests\/new/, "request_new"],
  [/^\/requests\//, "request"],
  [/^\/example/, "example"],
  [/^\/g\//, "gift"],
  [/^\/beads/, "beads"],
  [/^\/onboarding/, "onboarding"],
  [/^\/dreams\//, "dream"],
  [/^\/trades\//, "trade"],
];

export default function Tracker() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const via = url.searchParams.get("via");
    const id = /^\/(?:sale|requests)\/([0-9a-f-]{36})$/i.exec(url.pathname)?.[1];
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
