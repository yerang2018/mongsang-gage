"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BEAD_PACKS } from "@/lib/beads";

// 충전 금액 고르기 → 주문 만들기 (주문번호·송금 안내는 새로고침된 화면의 "입금 대기" 칸에 나옴)
export default function ChargeForm() {
  const router = useRouter();
  const [packId, setPackId] = useState<string>(BEAD_PACKS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pack = BEAD_PACKS.find((p) => p.id === packId)!;

  async function order() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/bead-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packId }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "충전 주문을 만들지 못했어요. 다시 시도해 주세요.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="충전 금액">
        {BEAD_PACKS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={packId === p.id}
            onClick={() => setPackId(p.id)}
            className={`min-h-24 rounded-xl border p-3 text-center ${packId === p.id ? "border-moon bg-moon/5 text-moon" : "border-white/10 bg-transparent"}`}
          >
            <span className="block font-cute text-xl">{p.beads.toLocaleString()}<span className="ml-0.5 text-sm">개</span></span>
            <span className={`mt-1 block text-sm ${packId === p.id ? "text-moon/80" : "text-white/60"}`}>{p.won.toLocaleString()}원</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={order}
        disabled={busy}
        className="mt-4 block w-full rounded-xl bg-moon py-4 text-center font-cute text-base text-night active:scale-[0.98] disabled:opacity-40"
      >
        {busy ? "주문 만드는 중…" : `${pack.won.toLocaleString()}원 충전하기`}
      </button>
      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
