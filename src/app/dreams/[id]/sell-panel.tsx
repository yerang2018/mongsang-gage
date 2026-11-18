"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Countdown from "@/app/countdown";
import PledgeCheck from "@/app/pledge-check";
import ShareButtons from "@/app/share-buttons";

// [이 꿈 팔기] 버튼: 판매 서약 체크 → 누르면 판매 등록 → 화면 새로고침하면 공유 패널로 바뀜
export function SellButton({ dreamId, price }: { dreamId: string; price: number }) {
  const router = useRouter();
  const [selling, setSelling] = useState(false);
  const [pledged, setPledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sell() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/dreams/${dreamId}/sell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pledge: pledged }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "오류가 났어요.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 났어요.");
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="mb-3 text-sm text-white/70">책정된 꿈값 : <strong className="text-moon">{price.toLocaleString()}구슬</strong></p>
      <button type="button" aria-expanded={selling} onClick={() => setSelling(!selling)} className="min-h-12 w-full rounded-xl bg-moon font-cute text-night">장터에 등록하기</button>
      {selling && <div className="mt-4">
      <PledgeCheck checked={pledged} onChange={setPledged} />
      <button
        type="button"
        onClick={sell}
        disabled={loading || !pledged}
        className="mt-3 w-full rounded-2xl bg-moon py-4 font-cute text-lg text-night active:scale-[0.98] disabled:opacity-40"
      >
        {loading ? "장터에 올리는 중…" : "이 꿈 장터에 올리기"}
      </button>
      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <p className="mt-2 text-center text-sm text-white/70">장터엔 제목·등급·해몽 한 줄만 공개돼요</p>
      </div>}
    </div>
  );
}

// 판매 중: 친구에게 보낼 링크 공유·복사 (ShareButtons가 공유 기록까지 남김)
export function SharePanel({ dreamId, title, expiresAt }: { dreamId: string; title: string; expiresAt?: string | null }) {
  const path = `/sale/${dreamId}`;
  return (
    <div className="rounded-2xl border border-moon/40 bg-moon/10 p-5">
      <p className="font-cute text-lg text-moon">장터에 올렸어요</p>
      <p className="mt-1 text-sm break-keep text-white/70">링크를 보내면 친구가 이 꿈을 살 수 있어요.</p>
      {expiresAt && <Countdown until={expiresAt} className="mt-2 block text-xs text-white/60" />}
      <div className="mt-4">
        <ShareButtons compact target="sale" id={dreamId} path={path} title="몽상가게 · 꿈 팔아요" text={`🌙 내 꿈 "${title}" 사 갈 사람? 몽상가게에 올렸어!`} label="공유하기" />
      </div>
    </div>
  );
}
