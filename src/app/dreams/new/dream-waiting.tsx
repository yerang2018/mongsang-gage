"use client";

import { useEffect, useState } from "react";

// 해몽 기다리는 화면: 진행 단계 + 꿈 상징 사전.
// 받는 중인 해몽 내용(제목·상징 풀이)은 진행 단계를 움직이는 데만 쓰고 화면엔 안 보여 줌 (봉투 열기 전 스포 방지, 2026-10-29 사용자 요청)
export type LiveReading = {
  title?: string;
  symbols?: string[];
  readings: { symbol: string; meaning: string }[];
  scoring: boolean;
  retrying: boolean;
};

const FACTS = [
  ["🐷 돼지", "재물의 대표 상징. 집 안으로 들어오면 복이 들어오고, 나가면 새어 나간대요."],
  ["🐉 용", "가장 귀한 꿈. 하늘로 오르는 용은 큰 성공, 품에 안기면 귀한 인연이래요."],
  ["💧 맑은 물", "일이 술술 풀린다는 뜻. 흙탕물이면 잠깐의 근심이에요."],
  ["🔥 큰불", "불이 활활 크게 번질수록 재물과 기운이 크게 일어난대요."],
  ["👴 조상", "웃으며 나타나면 도움을 주러 온 것, 무언가를 건네면 복을 받는 꿈이에요."],
  ["🦷 이빨 빠짐", "걱정스러워 보여도 '액땜'으로 풀어요. 아프지 않았다면 더 가벼운 꿈이래요."],
  ["🪂 떨어지는 꿈", "키가 크거나 마음이 성장하는 중이라는 풀이도 있어요."],
  ["🌸 꽃", "활짝 핀 꽃은 좋은 소식과 인연. 꽃을 받으면 사랑받을 일이 생긴대요."],
  ["💩 똥", "더러워 보여도 손꼽히는 재물 꿈! 많을수록, 몸에 묻을수록 좋대요."],
  ["🐍 뱀", "큰 뱀은 재물이나 태몽으로 풀어요. 물리면 오히려 좋은 기운이 붙는대요."],
  ["🏃 쫓기는 꿈", "마음속 부담을 털어내는 꿈. 끝까지 도망쳤다면 위기를 잘 넘긴다는 뜻이에요."],
  ["👑 임금", "임금을 만나면 윗사람의 인정, 큰 기회가 찾아온다는 길몽이에요."],
] as const;

export default function DreamWaiting({ live }: { live: LiveReading }) {
  const [fact, setFact] = useState(0);
  const [progress, setProgress] = useState(5);

  useEffect(() => {
    const t = setInterval(() => setFact((f) => (f + 1) % FACTS.length), 3500);
    return () => clearInterval(t);
  }, []);

  // 진행 막대: 소식이 올 때마다 점프하고, 그 사이엔 천천히 차오름 (95%에서 멈춤)
  const floor = live.scoring ? 85 : live.readings.length > 0 ? 55 + live.readings.length * 8 : live.symbols ? 45 : live.title ? 35 : 5;
  useEffect(() => {
    const t = setInterval(() => setProgress((p) => Math.min(95, Math.max(p, floor) + 0.6)), 400);
    return () => clearInterval(t);
  }, [floor]);

  const steps = [
    { label: "꿈 이야기를 읽는 중", done: !!live.title },
    { label: "꿈 속 상징을 찾는 중", done: !!live.symbols },
    { label: "상징을 하나씩 풀이하는 중", done: live.scoring },
    { label: "길몽 점수를 매기는 중", done: false },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <div className="mt-6">
      <div className="flex flex-col items-center">
        <div className="flex h-28 items-center justify-center" aria-hidden="true">
          <span className="text-4xl text-moon/80">✧</span>
        </div>
        <p className="mt-4 font-title text-lg text-moon">
          꿈에 남은 징조를 읽는 중
        </p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-moon transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <ul className="mt-4 space-y-1.5 text-sm">
        {steps.map((s, i) => (
          <li key={s.label} className={s.done ? "text-white/80" : i === current ? "text-moon" : "text-white/30"}>
            {s.done ? "✓" : i === current ? "✧" : "·"} {s.label}
            {i === current && <span className="kk-dots" />}
          </li>
        ))}
      </ul>

      {live.scoring && <p className="kk-fade-up mt-4 text-center text-sm text-white/60">거의 다 됐어요! 결과는 봉투에 넣어 드릴게요</p>}

      <section key={fact} className="kk-fade-up mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs text-white/60">꿈 상징 사전</p>
        <p className="mt-2 font-title text-lg text-moon">{FACTS[fact][0]}</p>
        <p className="mt-1 text-sm leading-relaxed text-white/80">{FACTS[fact][1]}</p>
      </section>
    </div>
  );
}
