"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Viewer = { kind: "guest" } | { kind: "seller" } | { kind: "no_nickname" } | { kind: "member"; balance: number };

export default function BuyForm({ dreamId, priceType, price, viewer, responseId, bar = false }: {
  dreamId: string; priceType: "beads" | "cheer"; price: number; viewer: Viewer; responseId?: string; bar?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  const here = `/sale/${dreamId}`;
  const balance = viewer.kind === "member" ? viewer.balance : null;
  const short = balance !== null && balance < price;
  const button = "inline-flex min-h-12 items-center justify-center rounded-xl bg-moon px-5 font-cute text-night disabled:opacity-40";

  async function buy() {
    if (buying) return;
    setBuying(true);
    setError("");
    try {
      const supabase = createClient();
      const { data, error } = responseId
        ? await supabase.rpc("buy_offered_dream", { p_response: responseId, p_cheer: null })
        : await supabase.rpc("buy_dream", { p_dream: dreamId, p_cheer: null });
      if (error || !data) throw new Error(error?.message ?? "구매하지 못했어요. 다시 시도해 주세요.");
      router.push(`/trades/${data}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "연결을 확인하고 다시 시도해 주세요.");
      setBuying(false);
      setConfirming(false);
    }
  }

  if (viewer.kind === "seller") return <p className="text-sm text-white/60">내가 내놓은 꿈이에요.</p>;
  if (priceType !== "beads") return <p className="text-sm text-white/60">이전 판매 방식으로 등록된 꿈이에요. 판매자가 다시 등록하면 구매할 수 있어요.</p>;
  return <div className={bar ? "kk-buybar fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background pb-[env(safe-area-inset-bottom)]" : "mt-4"}>
    <div className={bar ? "mx-auto max-w-md px-5 py-3" : ""}>
      {confirming ? <div>
        <p className="mb-3 text-center text-sm">구슬 {price.toLocaleString()}개로 이 꿈을 살까요?</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={buying} onClick={() => setConfirming(false)} className="min-h-12 rounded-xl bg-white/5 font-cute">돌아가기</button>
          <button type="button" disabled={buying} onClick={buy} className={button}>{buying ? "사는 중…" : "꿈 사기"}</button>
        </div>
      </div> : <div className="flex items-center justify-between gap-3">
        <div><p className="font-medium">{price.toLocaleString()}구슬</p>{balance !== null && <p className="text-xs text-white/60">{short ? `${(price - balance).toLocaleString()}개가 모자라요` : `내 구슬 ${balance.toLocaleString()}개`}</p>}</div>
        {viewer.kind !== "member" ? <Link href={`/?next=${encodeURIComponent(here)}`} className={button}>닉네임 정하고 사기</Link>
          : short ? <Link href={`/beads?next=${encodeURIComponent(here)}`} className={button}>구슬 충전하기</Link>
          : <button type="button" onClick={() => setConfirming(true)} className={button}>꿈 사기</button>}
      </div>}
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
    </div>
  </div>;
}
