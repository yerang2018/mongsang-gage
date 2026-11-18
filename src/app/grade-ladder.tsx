import Link from "next/link";
import { GRADES, priceLabel } from "@/lib/grades";

// 등급 사다리: 6단계 중 이 꿈이 어디쯤인지 + 등급별 희귀도·꿈값 (결과 화면)
// 2026-11-04 혼잡함 줄이기: 접어 두고 누르면 펼침 (판매 카드에선 뺌)


export default function GradeLadder({ current }: { current: string }) {
  return (
    <details className="mt-4 rounded-2xl bg-white/5 px-4">
      <summary className="flex min-h-12 cursor-pointer items-center font-title text-base font-bold">몽상가게 등급표 보기</summary>
      <ol className="space-y-1">
        {GRADES.map((g) => {
          const here = g.code === current;
          return (
            <li
              key={g.code}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${here ? "border border-moon/60 bg-moon/15" : "text-white/60"}`}
            >
              <span className={`w-14 shrink-0 font-cute ${here ? "text-lg text-moon" : ""}`}>{g.name}</span>
              {here ? (
                <span className="w-10 shrink-0 rounded-full bg-moon px-1.5 py-0.5 text-center text-[11px] font-bold text-night">이 꿈</span>
              ) : (
                <span className="w-10 shrink-0 text-xs text-white/60">{g.code}</span>
              )}
              <span className="min-w-0 flex-1 truncate text-xs">{g.minScore}점부터</span>
              <span className="shrink-0 text-xs text-white/60">{priceLabel(g)}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-1 flex justify-end">
        <Link href="/grades" className="inline-flex min-h-11 shrink-0 items-center text-xs text-white/70 underline underline-offset-4">
          자세히
        </Link>
      </div>
    </details>
  );
}
