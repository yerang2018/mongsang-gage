"use client";

import { useState } from "react";
import TimeAgo from "@/app/time-ago";
import BuyForm from "@/app/sale/[id]/buy-form";
import { gradeByCode } from "@/lib/grades";

export type Offer = {
  response_id: string;
  dream_id: string;
  title: string;
  grade: string;
  luck_tags: string[];
  headline: string;
  price_type: "beads" | "cheer";
  price: number;
  created_at: string;
  responder_id: string;
  responder_nickname: string;
  sold: boolean;
};

// 내민 꿈 한 장. 요청한 사람에겐 [이 꿈 고르기] → 꿈 사기 칸이 펼쳐짐
export default function OfferCard({ o, canBuy, balance, mine }: { o: Offer; canBuy: boolean; balance: number; mine: boolean }) {
  const [picking, setPicking] = useState(false);
  const grade = gradeByCode(o.grade);
  return (
    <div className={`rounded-2xl p-4 ${o.sold ? "bg-white/5 opacity-70" : "bg-white/10"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-cute text-2xl text-moon">
            {grade?.name} <span className="text-xs text-white/60">{o.grade}</span>
          </p>
        </div>
        <p className="shrink-0 font-cute text-lg">{o.price_type === "beads" ? `🔮 ${o.price.toLocaleString()}` : "💌 응원"}</p>
      </div>
      <p className="mt-2 truncate font-title text-base font-bold">{o.title}</p>
      <p className="mt-0.5 truncate text-sm text-white/70">“{o.headline}”</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 gap-1.5 overflow-hidden">
          {o.luck_tags.map((t) => (
            <span key={t} className="shrink-0 rounded-full bg-moon/15 px-2 py-0.5 text-xs text-moon">
              #{t}
            </span>
          ))}
        </div>
        <span className="shrink-0 text-xs text-white/60">
          {mine ? "내 꿈" : `${o.responder_nickname}님`}, <TimeAgo at={o.created_at} />
        </span>
      </div>

      {o.sold ? (
        <p className="mt-3 text-center text-xs text-white/60">팔린 꿈이에요</p>
      ) : (
        canBuy &&
        (picking ? (
          <div className="mt-4 border-t border-white/10 pt-4">
            <BuyForm dreamId={o.dream_id} responseId={o.response_id} priceType={o.price_type} price={o.price} viewer={{ kind: "member", balance }} />
            <button type="button" onClick={() => setPicking(false)} className="mt-2 block min-h-11 w-full text-sm text-white/60">
              접기
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="mt-3 block min-h-11 w-full rounded-xl bg-moon font-cute text-night active:scale-[0.98]"
          >
            이 꿈 고르기
          </button>
        ))
      )}
    </div>
  );
}
