"use client";

import Link from "next/link";
import { useState } from "react";
import ShareButtons from "@/app/share-buttons";
import { formatOpenAt, SUNEUNG_OPEN_AT, type GiftKind } from "@/lib/gift";
import { createClient } from "@/lib/supabase/client";

type When = "now" | "suneung" | "custom";

// 행운 세트 선물 만들기 (구매 완료 화면). DB 함수 create_gift 가 규칙을 검사. 무료 응원 카드는 2026-11-04 사용자 결정으로 뺌
// 만들면 로그인 없이 열리는 링크(/g/토큰)가 나오고, 친구에게 보내기·링크 복사 버튼이 붙음
export default function GiftForm({
  kind,
  dreamId,
  nickname,
  allowSelf = false,
}: {
  kind: GiftKind;
  dreamId: string;
  nickname: string;
  allowSelf?: boolean; // 행운 세트는 "나에게 부적 만들기"도 됨
}) {
  const suneungLeft = Date.parse(SUNEUNG_OPEN_AT) > Date.now();
  const [toSelf, setToSelf] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [sender, setSender] = useState(nickname);
  const [message, setMessage] = useState("");
  const [when, setWhen] = useState<When>("now");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);

  const to = toSelf ? nickname : recipient.trim();
  const openAt = when === "now" ? null : when === "suneung" ? SUNEUNG_OPEN_AT : custom ? new Date(custom).toISOString() : null;

  async function submit() {
    if (when === "custom" && !custom) {
      setError("열릴 날짜와 시간을 골라 주세요");
      return;
    }
    setBusy(true);
    setError("");
    const { data, error } = await createClient().rpc("create_gift", {
      p_kind: kind,
      p_dream: dreamId,
      p_sender_name: sender.trim(),
      p_recipient_name: to,
      p_message: message.trim() || null,
      p_open_at: openAt,
    });
    setBusy(false);
    if (error || !data) {
      setError(error?.message ?? "선물을 만들지 못했어요. 다시 시도해 주세요.");
      return;
    }
    setToken(data as string);
  }

  if (token) {
    return (
      <div className="rounded-2xl border border-moon/40 bg-moon/10 p-5">
        <p className="font-cute text-lg text-moon">{toSelf ? "🪄 내 부적이 준비됐어요" : "선물이 준비됐어요"}</p>
        <p className="mt-1 text-sm break-keep text-white/80">
          {openAt ? `${formatOpenAt(openAt)}에 열려요. ` : "지금 바로 열려요. "}
          {toSelf ? "링크를 저장해 두세요." : "링크를 친구에게 보내 주세요. 친구는 로그인 없이 열 수 있어요."}
        </p>
        <div className="mt-4">
          <GiftShare token={token} dreamId={dreamId} recipient={to} sender={sender.trim()} />
        </div>
      </div>
    );
  }

  const input = "mt-2 w-full rounded-xl bg-white/10 px-4 py-3 text-base outline-none ring-moon/60 placeholder:text-white/30 focus:ring-2";
  const chip = (on: boolean) => `min-h-11 rounded-xl px-3 text-sm ${on ? "bg-moon text-night" : "bg-white/10"}`;

  return (
    <div className="space-y-4">
      {allowSelf && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setToSelf(false)} className={chip(!toSelf)}>
            🎁 친구에게 선물
          </button>
          <button type="button" onClick={() => setToSelf(true)} className={chip(toSelf)}>
            🪄 나에게 부적
          </button>
        </div>
      )}
      {!toSelf && (
        <label className="block text-sm text-white/80">
          받는 사람 이름
          <input value={recipient} onChange={(e) => setRecipient(e.target.value)} maxLength={12} placeholder="예) 민지" className={input} />
        </label>
      )}
      <details className="rounded-xl bg-white/5 p-3">
        <summary className="cursor-pointer text-sm text-white/70">메시지·보내는 이름·예약 설정</summary>
        <div className="mt-3 space-y-4">
      <label className="block text-sm text-white/80">
        보내는 사람 이름
        <input value={sender} onChange={(e) => setSender(e.target.value)} maxLength={12} className={input} />
      </label>
      <label className="block text-sm text-white/80">
        응원 한마디 <span className="text-white/60">(선택)</span>
        <input value={message} onChange={(e) => setMessage(e.target.value)} maxLength={50} placeholder="예) 시험 잘 봐! 좋은 꿈 보낸다 🍀" className={input} />
      </label>
      <div>
        <p className="text-sm text-white/80">언제 열릴까요?</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button type="button" onClick={() => setWhen("now")} className={chip(when === "now")}>
            바로
          </button>
          <button type="button" onClick={() => setWhen("custom")} className={chip(when === "custom")}>
            날짜 고르기
          </button>
          {/* 수능 전까지만 보이는 바로가기 (수능만 노리는 게 아니라 기본은 바로·날짜 고르기) */}
          {suneungLeft && (
            <button type="button" onClick={() => setWhen("suneung")} className={chip(when === "suneung")}>
              수능날 아침
            </button>
          )}
        </div>
        {when === "suneung" && <p className="mt-2 text-sm text-moon">{formatOpenAt(SUNEUNG_OPEN_AT)}에 열려요</p>}
        {when === "custom" && <input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} className={input} />}
      </div>
        </div>
      </details>
      <button
        type="button"
        onClick={submit}
        disabled={busy || (!toSelf && !recipient.trim()) || !sender.trim()}
        className="block w-full rounded-2xl bg-moon py-4 text-center font-cute text-lg text-night active:scale-[0.98] disabled:opacity-40"
      >
        {busy ? "만드는 중…" : toSelf ? "내 부적 만들기" : "이 꿈으로 선물 준비하기"}
      </button>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}

// 이미 만든 선물의 링크 보내기 + 친구가 받는 선물 보기 (만든 직후, 구매 완료 화면에서 씀)
export function GiftShare({ token, dreamId, recipient, sender }: { token: string; dreamId: string; recipient: string; sender: string }) {
  return (
    <div>
      <ShareButtons
        compact
        target="gift"
        id={dreamId}
        path={`/g/${token}`}
        title="몽상가게 · 꿈 선물"
        text={`🎁 ${recipient}님에게 ${sender}님이 보낸 꿈 선물이 도착했어요`}
        label="친구에게 보내기"
      />
      <Link href={`/g/${token}`} className="flex min-h-11 items-center justify-center text-sm text-white/70 underline underline-offset-4">
        친구가 받는 선물 보기
      </Link>
    </div>
  );
}
