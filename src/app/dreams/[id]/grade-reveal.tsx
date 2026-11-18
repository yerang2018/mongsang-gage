"use client";

import { useId, useState } from "react";

// 먹빛 봉투의 인장을 열면 등급이 드러나고(2초), 결과가 펼쳐져요.
// 사용자 요청: 반짝이·금색 달 대신 먹보라 봉투와 옅은 보라 인장으로 절제된 동양적 분위기.
// 다시 볼 때(sealed=false)는 바로 결과를 보여 줌
export default function GradeReveal({
  sealed,
  gradeName,
  score,
  rare,
  children,
}: {
  sealed: boolean;
  gradeName: string;
  score: number;
  rare: boolean; // 길몽(S) 이상이면 반짝이 더
  children: React.ReactNode;
}) {
  const [phase, setPhase] = useState<"sealed" | "stamping" | "opened" | "shown">(sealed ? "sealed" : "shown");

  if (phase === "sealed") {
    return (
      <button
        type="button"
        onClick={() => {
          setPhase("stamping");
          setTimeout(() => setPhase("opened"), 2000);
        }}
        className="mt-6 flex w-full flex-col items-center rounded-xl border border-moon/15 bg-night px-6 py-12 active:scale-[0.99]"
      >
        <span className="mb-5 text-xs tracking-[0.3em] text-moon/70">꿈 해몽</span>
        <MoonEnvelope />
        <span className="mt-5 font-title text-xl font-bold">꿈 해몽 봉투가 도착했어요</span>
        <span className="mt-2 text-sm text-white/60">봉투를 열어보세요</span>
        <span className="mt-6 rounded-md bg-moon px-6 py-2.5 font-cute text-night">봉투 열기</span>
      </button>
    );
  }

  if (phase === "stamping") {
    return (
      <div className="relative mt-6 flex flex-col items-center rounded-xl border border-moon/15 bg-night px-6 py-16" role="status" aria-live="polite">
        <p className="text-xs tracking-[0.2em] text-white/60">오늘 꿈의 등급</p>
        <span className="kk-fade-up mt-6 border px-7 py-5 font-title text-4xl" style={{ borderColor: rare ? "var(--color-moon)" : "#d6cfdf", color: "var(--color-moon)" }}>
          {gradeName}
        </span>
        <p className="kk-fade-up mt-5 text-sm text-moon">{score}점</p>
      </div>
    );
  }

  return <div className={phase === "opened" ? "kk-fade-up" : undefined}>{children}</div>;
}

// 먹보라 접지와 옅은 보라 인장. 선물 화면에서도 같은 봉투를 사용해요.
export function MoonEnvelope() {
  const id = useId();
  return (
    <svg viewBox="0 0 260 180" className="w-64 max-w-full" role="img" aria-label="꿈 인장으로 봉한 먹보라 봉투">
      <defs>
        <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 1h6M2 0v6" stroke="#eee7f6" strokeOpacity=".035" strokeWidth=".5" />
        </pattern>
      </defs>
      <rect x="19" y="32" width="222" height="132" rx="2" fill="#403154" opacity=".06" />
      <rect x="15" y="26" width="230" height="132" rx="2" fill="#403154" stroke="#79688e" strokeWidth=".8" />
      <rect x="15" y="26" width="230" height="132" rx="2" fill={`url(#${id})`} />
      <path d="m16 156 102-75h24l102 75" fill="#49385f" stroke="#bba8d0" strokeOpacity=".25" strokeWidth=".8" />
      <path d="m16 27 114 77L244 27" fill="#55416d" stroke="#c3b0da" strokeOpacity=".45" strokeWidth=".8" />
      <path d="m17 29 113 77 113-77" fill="none" stroke="#2d213c" strokeOpacity=".4" strokeWidth="1" />
      <path d="M15 40h230M15 145h230" stroke="#cbbddc" strokeOpacity=".12" strokeWidth=".6" />
      <rect x="112" y="83" width="36" height="39" rx="1" fill="#ede7f5" transform="rotate(-3 130 102)" />
      <rect x="116" y="87" width="28" height="31" rx="1" fill="none" stroke="#403154" strokeOpacity=".65" strokeWidth=".7" transform="rotate(-3 130 102)" />
      <text x="130" y="109" textAnchor="middle" fontFamily="serif" fontSize="24" fill="#403154" transform="rotate(-3 130 102)">夢</text>
      <path d="m113 86 2 7m31 22-2 5m-18-35 7 1" stroke="#403154" strokeWidth="1.2" />
    </svg>
  );
}
