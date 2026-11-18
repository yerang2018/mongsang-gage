"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PledgeCheck from "@/app/pledge-check";
import { gradeByCode, priceLabel } from "@/lib/grades";

export type MyDream = { id: string; title: string | null; grade: string; luck_tags: string[]; created_at: string };

// 내 꿈 내밀기: 아직 안 팔린 내 꿈 중 하나를 고름. 구하는 운과 맞는 꿈을 위로
export default function OfferPicker({ requestId, luckTag, dreams }: { requestId: string; luckTag: string; dreams: MyDream[] }) {
  const router = useRouter();
  const sorted = [...dreams].sort((a, b) => Number(b.luck_tags.includes(luckTag)) - Number(a.luck_tags.includes(luckTag)));
  const [picked, setPicked] = useState<string | null>(sorted[0]?.id ?? null);
  const [pledged, setPledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (dreams.length === 0) {
    return (
      <div className="rounded-2xl bg-white/10 p-5 text-center text-sm text-white/70">
        <p className="break-keep">내밀 수 있는 꿈이 없어요. 꿈을 기록하면 여기서 고를 수 있어요.</p>
        <Link
          href="/dreams/new"
          className="mt-4 inline-flex min-h-11 items-center rounded-full bg-moon px-5 font-cute text-night active:scale-[0.98]"
        >
          어젯밤 꿈 올리기
        </Link>
      </div>
    );
  }

  async function offer() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/requests/${requestId}/offer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dreamId: picked, pledge: pledged }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(body.error ?? "꿈을 내밀지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <p className="font-cute text-lg">내 꿈 내밀기</p>
      <p className="mt-1 text-xs text-white/60">아직 안 팔린 내 꿈이 보여요. 골라 주면 꿈값을 받아요</p>
      <ul className="mt-3 space-y-2">
        {sorted.map((d) => {
          const g = gradeByCode(d.grade);
          const match = d.luck_tags.includes(luckTag);
          return (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => setPicked(d.id)}
                aria-pressed={picked === d.id}
                className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm ${picked === d.id ? "bg-moon/20 ring-2 ring-moon" : "bg-white/10"}`}
              >
                <span className="min-w-0">
                  <span className="font-cute text-moon">{g?.name}</span> <span className="truncate">{d.title ?? "제목 없는 꿈"}</span>
                  {match && <span className="ml-1.5 rounded-full bg-moon px-2 py-0.5 font-cute text-xs text-night">#{luckTag}</span>}
                </span>
                <span className="shrink-0 text-xs text-white/60">{g ? priceLabel(g) : ""}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4">
        <PledgeCheck checked={pledged} onChange={setPledged} />
      </div>
      <button
        type="button"
        onClick={offer}
        disabled={!picked || busy || !pledged}
        className="mt-4 block w-full rounded-2xl bg-moon py-4 text-center font-cute text-lg text-night active:scale-[0.98] disabled:opacity-40"
      >
        {busy ? "내미는 중…" : "이 꿈 내밀기"}
      </button>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
