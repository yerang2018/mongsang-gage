"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LUCK_TAGS, type LuckTag } from "@/lib/grades";
import { createClient } from "@/lib/supabase/client";

// 고르면 운 태그·하고 싶은 말을 채워 주는 예시 (고른 뒤에도 고칠 수 있음). tag가 없으면 말만 채움
const PRESETS: { label: string; tag?: LuckTag; message: string }[] = [
  { label: "시험 앞두고 합격운", tag: "합격운", message: "곧 시험이에요! 합격운 담긴 꿈 나눠 주세요" },
  { label: "면접 앞두고 귀인운", tag: "귀인운", message: "면접 앞두고 있어요. 좋은 사람 만나는 기운 주세요" },
  { label: "고백 앞두고 연애운", tag: "연애운", message: "용기 내 보려고요. 연애운 꿈 있으면 내밀어 주세요" },
  { label: "친구에게 응원받고 싶어요", message: "요즘 힘이 필요해요. 좋은 꿈으로 응원해 주세요" },
];

export default function RequestForm({ initialTag, initialMessage = "" }: { initialTag?: LuckTag; initialMessage?: string }) {
  const router = useRouter();
  const [tag, setTag] = useState<LuckTag | null>(initialTag ?? null);
  const [message, setMessage] = useState(initialMessage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!tag) return;
    setBusy(true);
    setError("");
    const { data, error } = await createClient().rpc("create_dream_request", { p_tag: tag, p_message: message.trim() || null });
    if (error || !data) {
      setError(error?.message ?? "꿈 구해요를 올리지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
      return;
    }
    router.push(`/requests/${data}`);
  }

  return (
    <div className="mt-6">
      <p className="text-sm text-white/70">이럴 때 구해요 <span className="text-white/60">(누르면 채워져요, 고칠 수 있어요)</span></p>
      <div className="mt-2 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              if (p.tag) setTag(p.tag);
              setMessage(p.message);
            }}
            className="inline-flex min-h-11 items-center rounded-full border border-white/20 px-4 text-sm text-white/85 active:scale-[0.98]"
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="mt-6 text-sm text-white/70">필요한 운</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {LUCK_TAGS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTag(t)}
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm active:scale-[0.98] ${tag === t ? "bg-moon font-bold text-night" : "bg-white/10 text-white/80"}`}
          >
            #{t}
          </button>
        ))}
      </div>

      <label className="mt-6 block text-sm text-white/70">
        하고 싶은 말 <span className="text-white/60">(선택)</span>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={40}
          placeholder="예) 내일 면접이에요! 좋은 기운 나눠 주세요"
          className="mt-2 w-full rounded-xl bg-white/10 px-4 py-3 text-base outline-none ring-moon/60 placeholder:text-white/30 focus:ring-2"
        />
      </label>
      <p className="text-right text-xs text-white/60">{message.trim().length}/40</p>

      <button
        type="button"
        onClick={submit}
        disabled={!tag || busy}
        className="mt-4 block w-full rounded-2xl bg-moon py-4 text-center font-cute text-lg text-night active:scale-[0.98] disabled:opacity-40"
      >
        {busy ? "올리는 중…" : tag ? `#${tag} 꿈 구하기` : "필요한 운을 골라 주세요"}
      </button>
      <p className="mt-2 text-center text-xs text-white/60">장터에 3일 동안 올라가요</p>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
