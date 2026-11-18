"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatRemaining } from "@/lib/time";

// 선물이 열릴 때까지 남은 시간. 시각이 되면 화면을 새로 불러와 선물이 열림 (판단은 서버가 함)
export default function OpenCountdown({ until }: { until: string }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  const left = now === null ? null : Date.parse(until) - now;
  useEffect(() => {
    if (left !== null && left <= 0) router.refresh();
  }, [left, router]);
  if (left === null) return <span>&nbsp;</span>;
  return <span>{left > 0 ? `${formatRemaining(left)} 남았어요` : "곧 열려요…"}</span>;
}
