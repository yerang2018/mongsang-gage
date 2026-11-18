"use client";

import { useRouter } from "next/navigation";

// 꿈 등급 고르기(색 없이 항상 같은 모양): 누르면 목록이 열리고 하나를 고르면 그 등급만 보여 줘요 (휴대폰에선 기본 선택 창이 떠요)
export default function GradeSelect({ value, options }: { value: string; options: { value: string; label: string; href: string }[] }) {
  const router = useRouter();
  return (
    <label className="relative inline-flex min-h-11 items-center">
      <span className="sr-only">꿈 등급 고르기</span>
      <select
        value={value}
        onChange={(e) => {
          const next = options.find((option) => option.value === e.target.value);
          if (next) router.push(next.href);
        }}
        className="appearance-none rounded-full border border-white/15 bg-transparent py-1.5 pl-3 pr-7 text-xs text-white/70 focus:outline-moon"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-white text-black">{option.label}</option>
        ))}
      </select>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className="pointer-events-none absolute right-3 text-white/60">
        <path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}
