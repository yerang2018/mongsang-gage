"use client";

import { useState, useTransition } from "react";
import { confirmOrder, refundOrder, type ActionResult } from "./actions";

type Ask = { question: string; yes: string; fn: (id: string) => Promise<ActionResult> };

// 주문 한 줄의 [입금 확인] [취소·환불] 버튼. 누르면 화면 안에서 한 번 더 물어봄
// (window.confirm 은 앱 안 브라우저·일부 휴대폰 앱에서 막혀서 아무 반응이 없음)
export default function OrderActions({ id, code, status }: { id: string; code: string; status: string; wonLabel: string }) {
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState<Ask | null>(null);
  const [msg, setMsg] = useState("");

  const run = (fn: Ask["fn"]) => {
    setAsk(null);
    start(async () => {
      const r = await fn(id);
      setMsg(r.message);
    });
  };

  if (status !== "pending" && status !== "paid") return null;

  if (ask) {
    return (
      <div className="mt-2 rounded-xl bg-moon/10 p-3">
        <p className="text-sm break-keep">{ask.question}</p>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => run(ask.fn)} className="min-h-11 flex-1 rounded-xl bg-moon font-cute text-night">
            {ask.yes}
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
        {status === "pending" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(confirmOrder)}
            className="min-h-11 flex-1 rounded-xl bg-moon font-cute text-night disabled:opacity-40"
          >
            {pending ? "처리 중…" : "입금 확인 · 구슬 지급"}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            setAsk(
              status === "pending"
                ? { question: `주문 ${code}을 취소할까요?`, yes: "네, 취소해요", fn: refundOrder }
                : { question: `주문 ${code}을 환불할까요? 구슬을 회수하고, 송금은 직접 돌려줘야 해요`, yes: "네, 환불해요", fn: refundOrder },
            )
          }
          className="min-h-11 flex-1 rounded-xl bg-white/10 font-cute disabled:opacity-40"
        >
          {status === "pending" ? "취소" : "환불"}
        </button>
      </div>
      {msg && <p className="mt-1 text-sm text-moon">{msg}</p>}
    </div>
  );
}
