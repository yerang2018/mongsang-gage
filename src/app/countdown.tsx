"use client";

import { useEffect, useState } from "react";
import { formatRemaining } from "@/lib/time";

// 판매 마감까지 남은 시간 (30초마다 갱신). 서버·브라우저 시계 차이로 화면이 어긋나지 않게 처음엔 비워 둠
// compact: 목록 줄처럼 좁은 곳에 "마감 3시간 남음"
export default function Countdown({ until, className, compact }: { until: string; className?: string; compact?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, []);
  if (now === null) return <span className={className}>&nbsp;</span>;
  const left = new Date(until).getTime() - now;
  return <span className={className}>{left > 0 ? `마감${compact ? "" : "까지"} ${formatRemaining(left)} 남음` : compact ? "마감됨" : "판매 시간이 끝났어요"}</span>;
}
