import Link from "next/link";
import { SUNEUNG_OPEN_AT } from "@/lib/gift";

// 홈 맨 위 한 줄 배너: 수능만이 아니라 중요한 날 앞둔 모든 사람에게 (2026-11-04 사용자 결정). 수능 D-day는 작게, 수능이 지나면 사라짐
// 2026-11-04 "혼잡한 부분만 줄여줘": 상자·버튼 두 개 → 누르면 장터로 가는 얇은 띠 하나 ([내 꿈 올리기]는 아래 큰 버튼과 겹쳐서 뺌)
export default function OccasionBanner() {
  const dday = suneungDday();
  return (
    <Link href="/market" className="mt-4 flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-moon/10 px-4 py-2.5 active:scale-[0.98]">
      <span className="min-w-0">
        <span className="block text-sm font-bold break-keep text-moon">중요한 날 앞둔 사람에게 좋은 꿈 한 장 🌙</span>
        <span className="block text-xs text-white/60">
          면접, 시험, 발표{dday !== null && `, 수능 ${dday === 0 ? "D-DAY" : `D-${dday}`}`}
        </span>
      </span>
      <span className="shrink-0 text-moon" aria-hidden>
        ›
      </span>
    </Link>
  );
}

// 오늘(한국 날짜)부터 수능 날까지 남은 날. 지났으면 null
function suneungDday(): number | null {
  const kstDay = (ms: number) => Math.floor((ms + 9 * 3600_000) / 86400_000);
  const left = kstDay(Date.parse(SUNEUNG_OPEN_AT)) - kstDay(Date.now());
  return left >= 0 ? left : null;
}
