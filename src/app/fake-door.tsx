"use client";

import { useState } from "react";
import { track } from "@/lib/track-client";

// 가짜 문: 아직 안 만든 기능의 버튼. 누르면 "곧 열려요" 창이 뜨고 /api/track → events에 기록(type 'fake_door')
// → 몇 명이 원하는지 세어 보고 만들지 정함. 집계: scripts/fake-door-stats.ts
export default function FakeDoor({
  door,
  label,
  feature,
  className,
}: {
  door: string; // 기록에 남는 이름 (예: "bead_ad")
  label: React.ReactNode;
  feature: string; // 창에 보일 기능 이름 (예: "말로 녹음하기")
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  function knock() {
    setOpen(true);
    track("fake_door", { door });
  }

  return (
    <>
      <button type="button" onClick={knock} className={className}>
        {label}
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="곧 열려요"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 p-5 backdrop-blur-sm"
        >
          <div onClick={(e) => e.stopPropagation()} className="kk-fade-up w-full max-w-sm rounded-3xl bg-night p-6 text-center shadow-2xl">
            <p className="kk-float text-4xl">🌙</p>
            <p className="mt-3 font-cute text-2xl text-moon">곧 열려요!</p>
            <p className="mt-2 text-sm leading-relaxed break-keep text-white/70">
              <b className="text-white">{feature}</b> 기능을 준비하고 있어요.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 min-h-12 w-full rounded-2xl bg-moon font-cute text-lg text-night active:scale-[0.98]"
            >
              기다릴게요
            </button>
          </div>
        </div>
      )}
    </>
  );
}
