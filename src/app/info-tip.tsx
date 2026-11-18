"use client";

import { useEffect, useRef, useState } from "react";

// 글자 옆 작은 ⓘ: 컴퓨터는 마우스를 올리면, 휴대폰은 누르면 설명 말풍선이 열림.
// 말풍선은 가장 가까운 relative 부모의 왼쪽 아래에 붙음 (부모에 relative를 줄 것)
export default function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const hovering = useRef(false); // 마우스가 올라가 있으면 눌러도 닫지 않음 (올리자마자 열린 걸 클릭이 다시 닫지 않게)

  // 말풍선 밖을 누르면 닫기
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <span
      ref={box}
      className="inline-flex"
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        hovering.current = false;
        setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          hovering.current = true;
          setOpen(true);
        }}
        onClick={() => setOpen((o) => hovering.current || !o)}
        className={`-my-3 inline-flex h-11 w-8 items-center justify-center transition-colors hover:text-moon ${open ? "text-moon" : "text-white/60"}`}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="4.9" r="0.95" fill="currentColor" />
          <path d="M8 7.2v4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <span
          role="tooltip"
          className="kk-fade-up absolute left-0 top-full z-40 mt-1 block w-[min(18rem,calc(100vw-2.5rem))] rounded-2xl bg-night p-4 text-left font-sans text-xs leading-relaxed break-keep text-white/80 shadow-2xl ring-1 ring-moon/30"
        >
          {children}
        </span>
      )}
    </span>
  );
}
