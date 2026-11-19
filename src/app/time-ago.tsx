"use client";

import { useEffect, useState } from "react";
import { formatAgo } from "@/lib/time";

const FRESH_MS = 60 * 60 * 1000; // 1시간 안에 나온 건 "갓 나옴"

// 지금 시각(30초마다 갱신). 서버·브라우저 시계 차이로 화면이 어긋나지 않게 처음엔 null
function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

// "12분 전". 1시간 안이면 freshClassName으로 눈에 띄게
export default function TimeAgo({ at, className, freshClassName }: { at: string; className?: string; freshClassName?: string }) {
  const now = useNow();
  if (now === null) return <span className={className}>&nbsp;</span>;
  const ago = now - new Date(at).getTime();
  return <span className={ago < FRESH_MS && freshClassName ? freshClassName : className}>{formatAgo(ago)}</span>;
}
