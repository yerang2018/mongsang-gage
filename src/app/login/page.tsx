"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { NEXT_COOKIE, safeNextPath } from "@/lib/next-path";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(params.get("error") ? "로그인 링크가 만료됐거나 다른 브라우저에서 열렸어요. 다시 받아 주세요." : "");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    // 판매 카드에서 왔으면 로그인 뒤 그 카드로 돌아가도록
    const next = safeNextPath(params.get("next"));
    document.cookie = next
      ? `${NEXT_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=3600; samesite=lax`
      : `${NEXT_COOKIE}=; path=/; max-age=0`;
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSending(false);
    if (error) {
      setError(
        error.status === 429
          ? "메일을 너무 자주 보냈어요. 잠시 후(최대 1시간) 다시 시도해 주세요."
          : `메일을 보내지 못했어요: ${error.message}`,
      );
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="mt-10 rounded-2xl bg-white/10 p-5 text-sm leading-relaxed">
        <p className="font-cute text-lg text-moon">📮 메일을 보냈어요!</p>
        <p className="mt-2">
          <b>{email}</b> 메일함에서 로그인 링크를 눌러 주세요. 이 브라우저에서 열어야 로그인돼요.
        </p>
        <p className="mt-2 text-white/60">메일이 안 보이면 스팸함도 확인해 주세요.</p>
      </div>
    );
  }

  return (
    <form onSubmit={sendLink} className="mt-8">
      <label className="block text-sm text-white/70">
        이메일
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-2 w-full rounded-xl bg-white/10 px-4 py-3 text-base outline-none ring-moon/60 placeholder:text-white/30 focus:ring-2"
        />
      </label>
      <button
        disabled={sending}
        className="mt-5 w-full rounded-2xl bg-moon py-4 font-cute text-lg text-night active:scale-[0.98] disabled:opacity-40"
      >
        {sending ? "보내는 중…" : "로그인 링크 받기"}
      </button>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <p className="mt-4 text-xs text-white/60">비밀번호 없이, 메일로 온 링크를 누르면 로그인돼요. 처음이면 자동으로 가입돼요.</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div>
      <Link href="/" className="-ml-1 inline-flex min-h-11 items-center px-1 text-sm text-white/70">
        ← 처음으로
      </Link>
      <h1 className="mt-4 font-title text-2xl font-bold">몽상가게 시작하기</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
