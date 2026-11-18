"use client";

import { useEffect, useRef, useState } from "react";
const RATINGS = ["매우 불만족", "불만족", "보통", "만족", "매우 만족"];

export default function ExperienceFeedback({ kind, localKey }: { kind: "reading" | "trade"; localKey: string }) {
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const submissionId = useRef<string | null>(null);
  const storageKey = `kk_feedback:${kind}:${localKey}`;
  useEffect(() => {
    try { setSent(sessionStorage.getItem(storageKey) === "sent"); } catch { /* 저장소가 막혀도 의견 제출 가능 */ }
  }, [storageKey]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending || sent || (rating === null && !message.trim())) return;
    setSending(true); setError("");
    submissionId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/feedback", {
        method: "POST", credentials: "omit", referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: submissionId.current, kind, rating, message: message.trim() }),
      });
      if (!response.ok) throw new Error("save");
      setSent(true); setMessage("");
      try { sessionStorage.setItem(storageKey, "sent"); } catch { /* 제출 결과는 유지 */ }
    } catch { setError("보내지 못했어요. 잠시 후 다시 시도해 주세요."); }
    finally { setSending(false); }
  }

  return (
    <section className="mt-7 rounded-2xl border border-moon/15 p-5" aria-label={kind === "reading" ? "해몽 만족도" : "거래 만족도"}>
      <h2 className="font-title text-lg">{kind === "reading" ? "꿈 풀이가 어떠셨나요?" : "꿈 거래가 어떠셨나요?"}</h2>
      {sent ? <p role="status" className="mt-3 text-sm text-moon">의견을 보내주셔서 감사합니다.</p> : (
        <form onSubmit={submit}>
          <fieldset disabled={sending} className="mt-4">
            <legend className="sr-only">만족도를 선택해 주세요</legend>
            <div className="grid grid-cols-5 gap-1.5">
              {RATINGS.map((label, index) => <label key={label} className={`flex min-h-14 cursor-pointer items-center justify-center rounded-lg border px-1 py-2 text-center text-xs leading-relaxed has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-moon ${rating === index + 1 ? "border-moon bg-moon text-night" : "border-white/15 text-white/75"}`}>
                <input className="sr-only" type="radio" name={`rating-${kind}`} value={index + 1} checked={rating === index + 1} onChange={() => setRating(index + 1)} />{label}
              </label>)}
            </div>
          </fieldset>
          <label className="mt-5 block text-sm font-medium" htmlFor={`feedback-${kind}`}>몽상가게 사장한테 한마디(익명)</label>
          <p className="mt-1 text-xs leading-relaxed text-white/60">계정·닉네임·꿈·거래 번호는 함께 저장하지 않아요. 의견에 개인정보를 적지 말아 주세요.</p>
          <textarea id={`feedback-${kind}`} value={message} onChange={(e) => setMessage(e.target.value)} disabled={sending} maxLength={1000} rows={3} placeholder="좋았던 점이나 불편했던 점을 자유롭게 남겨 주세요. (선택)" className="mt-3 w-full resize-y rounded-xl border border-white/15 bg-transparent p-3 text-sm" />
          <p className="text-right text-xs text-white/50">{message.length}/1000</p>
          <button disabled={sending || (rating === null && !message.trim())} className="mt-3 min-h-12 w-full rounded-xl bg-moon px-4 text-sm text-night disabled:opacity-40">{sending ? "보내는 중…" : "의견 보내기"}</button>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        </form>
      )}
    </section>
  );
}
