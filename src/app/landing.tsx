"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BEAD_REWARDS } from "@/lib/grades";
import { NEXT_COOKIE, safeNextPath } from "@/lib/next-path";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/track-client";

// 닉네임 자동 추천 (2026-11-18): 형용사 + 동물 + 두 자리 숫자. 12자 안, 겹치면 다시 추천
const ADJECTIVES = ["포근한", "반짝이는", "졸린", "다정한", "느긋한", "씩씩한", "엉뚱한", "상냥한", "푸른", "고요한"];
const ANIMALS = ["고양이", "여우", "토끼", "곰", "다람쥐", "펭귄", "수달", "부엉이", "사슴", "고래"];
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const suggestNickname = () => `${pick(ADJECTIVES)}${pick(ANIMALS)}${Math.floor(Math.random() * 90) + 10}`;

// 첫 화면: 서비스 소개 + [카카오로 시작하기] + [게스트로 들어가기].
// 카카오로 로그인한 뒤 닉네임이 아직 없으면 같은 화면에서 이어서 닉네임을 받음 (예전 두 번째 화면 '/onboarding'을 합침, 2026-11-17)
// mode "login" = 카카오 시작 버튼, "nickname" = 카카오로 로그인은 했고 닉네임만 남음
export default function Landing({ mode = "login", guest = false }: { mode?: "login" | "nickname"; guest?: boolean }) {
  return (
    <Suspense>
      <LandingBody mode={mode} guest={guest} />
    </Suspense>
  );
}

function LandingBody({ mode, guest }: { mode: "login" | "nickname"; guest: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [nickname, setNickname] = useState("");
  // 서버에서 그린 화면과 달라지지 않게, 화면이 뜬 뒤에 추천 이름을 채움 (직접 고칠 수 있음)
  useEffect(() => {
    if (mode === "nickname") setNickname(suggestNickname());
  }, [mode]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(params.get("error") ? "카카오 로그인을 완료하지 못했어요. 다시 시도해 주세요." : "");

  async function kakaoLogin() {
    setSaving(true);
    setError("");
    document.cookie = next
      ? `${NEXT_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=3600; samesite=lax`
      : `${NEXT_COOKIE}=; path=/; max-age=0; samesite=lax`;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const options = { redirectTo: `${window.location.origin}/auth/callback`, scopes: "", queryParams: { scope: "" } };
    const result = user?.is_anonymous
      ? await supabase.auth.linkIdentity({ provider: "kakao", options })
      : await supabase.auth.signInWithOAuth({ provider: "kakao", options });
    if (result.error) {
      setError("카카오 연결을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setSaving(false);
    }
  }

  // 게스트로 들어가기: 카카오 없이 익명 계정으로 시작 → 닉네임 정하는 화면으로
  async function guestStart() {
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      setError("게스트로 들어가지 못했어요. 잠시 후 다시 시도해 주세요.");
      setSaving(false);
      return;
    }
    router.refresh();
    setSaving(false); // 같은 화면에서 닉네임 입력으로 바뀌므로, 버튼이 "준비하는 중"에 멈추지 않게 풀어 줌
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError("로그인이 풀렸어요. 처음 화면에서 다시 시작해 주세요.");
      return;
    }
    const { data: existing, error: profileError } = await supabase.from("profiles").select("nickname").eq("id", user.id).single();
    if (profileError) {
      setSaving(false);
      setError("기존 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    if (existing?.nickname) {
      setSaving(false);
      router.replace(next ?? "/");
      router.refresh();
      return;
    }
    // 닉네임이 겹치면 여기서 오류 → 같은 계정으로 다른 닉네임을 다시 시도하면 됨
    const { error } = await supabase.rpc("set_nickname", { new_nickname: nickname });
    setSaving(false);
    if (error) {
      setError(error.message);
      setNickname(suggestNickname()); // 겹친 이름이면 새 추천으로 바꿔 줌
      return;
    }
    track("visit", { target: "nickname_set" }); // 서버가 방문자 번호 ↔ 새 계정을 연결 (유입 경로 이어 붙이기)
    router.replace(next ?? "/");
    router.refresh();
  }

  const length = nickname.trim().length;

  return (
    <section className="kk-landing flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center text-center">
      <div className="w-full max-w-xs pb-8">
        {/* h1은 전역 규칙(globals.css)이 고운바탕으로 덮어쓰므로, 송명체가 나오게 글꼴을 직접 지정 */}
        <h1
          className="font-brand text-[2.5rem] leading-tight text-moon"
          style={{ fontFamily: "var(--font-brand)", letterSpacing: "normal" }}
        >
          몽상가게
        </h1>
        {mode === "login" ? (
          <>
            <p className="mt-6 text-base leading-8 break-keep text-white/65">
              꿈을 사고파는 곳,
              <br />
              좋은 기운이 오가는 곳.
            </p>
            <p className="mt-4 text-sm text-white/50">국내 최초 꿈 거래 서비스</p>
            <button
              type="button"
              onClick={kakaoLogin}
              disabled={saving}
              className="mt-12 min-h-14 w-full rounded-xl bg-[#FEE500] px-5 py-4 text-base font-medium text-[#191919] transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40"
            >
              {saving ? "연결하는 중…" : "카카오로 시작하기"}
            </button>
            <button
              type="button"
              onClick={guestStart}
              disabled={saving}
              className="mt-3 min-h-14 w-full rounded-xl border border-white/15 px-5 py-4 text-base font-medium text-[#191919] transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40"
            >
              게스트로 들어가기
            </button>
            {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
          </>
        ) : (
          <div className="mt-10">
            <h2 className="font-title text-2xl leading-relaxed">어떻게 불러드릴까요?</h2>
            <form onSubmit={save} className="mt-6">
              <label htmlFor="nickname" className="sr-only">닉네임</label>
              <input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={12}
                placeholder="닉네임을 입력해 주세요"
                className="min-h-14 w-full rounded-xl border border-white/15 bg-transparent px-4 text-base ring-moon/60 placeholder:text-white/35 focus:outline-none focus:ring-2"
              />
              <p className="mt-2 text-right text-xs text-white/60">{length}/12 (2자 이상)</p>
              <button
                disabled={saving || length < 2}
                className="mt-5 min-h-14 w-full rounded-xl bg-moon px-5 py-4 font-cute text-base text-night active:opacity-80 disabled:opacity-40"
              >
                {saving ? "준비하는 중…" : "이 이름으로 시작하기"}
              </button>
              {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
            </form>
            <p className="mt-6 text-sm text-moon">시작 선물 꿈 구슬 {BEAD_REWARDS.signupAnonymous.toLocaleString()}개</p>
            {!guest && <p className="mt-6 text-xs leading-relaxed text-white/60">다음에도 같은 카카오 계정으로 로그인하면 이 닉네임과 꿈·구슬을 그대로 사용할 수 있어요.</p>}
          </div>
        )}
      </div>
    </section>
  );
}
