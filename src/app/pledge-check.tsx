"use client";

import { SALE_PLEDGE } from "@/lib/report";

// 판매 서약 체크 (판매 등록·꿈 내밀기). 체크해야 버튼이 눌림, 서버도 한 번 더 확인
export default function PledgeCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-white/5 p-3 text-sm break-keep text-white/80">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--color-moon)]" />
      <span>{SALE_PLEDGE}</span>
    </label>
  );
}
