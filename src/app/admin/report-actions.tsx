"use client";

import { useState, useTransition } from "react";
import { resolveReports } from "./actions";

// 신고 한 줄의 [문제없음] [숨김 유지]. order-actions 처럼 화면 안에서 한 번 더 물어봄 (window.confirm 은 앱 안 브라우저에서 막힘)
export default function ReportActions({ dreamId, hidden }: { dreamId: string; hidden: boolean }) {
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState<"dismiss" | "hide" | null>(null);
  const [msg, setMsg] = useState("");

  const run = (action: "dismiss" | "hide") => {
    setAsk(null);
    start(async () => setMsg((await resolveReports(dreamId, action)).message));
  };

  if (ask) {
    return (
      <div className="mt-2 rounded-xl bg-moon/10 p-3">
        <p className="text-sm break-keep">
          {ask === "dismiss" ? "문제없는 꿈인가요? 숨김을 풀고 판매 중이었으면 다시 장터에 올려요" : "신고를 인정하고 계속 숨길까요? 장터·판매 카드에서 안 보여요"}
        </p>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => run(ask)} className="min-h-11 flex-1 rounded-xl bg-moon font-cute text-night">
            네
          </button>
          <button type="button" onClick={() => setAsk(null)} className="min-h-11 flex-1 rounded-xl bg-white/10 font-cute">
            아니요
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-2">
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => setAsk("dismiss")} className="min-h-11 flex-1 rounded-xl bg-white/10 font-cute disabled:opacity-40">
          문제없음
        </button>
        <button type="button" disabled={pending} onClick={() => setAsk("hide")} className="min-h-11 flex-1 rounded-xl bg-moon font-cute text-night disabled:opacity-40">
          {pending ? "처리 중…" : hidden ? "숨김 유지" : "숨기기"}
        </button>
      </div>
      {msg && <p className="mt-1 text-sm text-moon">{msg}</p>}
    </div>
  );
}
