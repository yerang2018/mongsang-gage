import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { NEXT_COOKIE, safeNextPath } from "@/lib/next-path";
import { createClient } from "@/lib/supabase/server";

// 이메일의 로그인 링크를 누르면 여기로 돌아옴 → 로그인 완료 처리 후 홈(또는 보던 판매 카드)으로
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const supabase = await createClient();
  const ok = code
    ? !(await supabase.auth.exchangeCodeForSession(code)).error
    : // 이메일 연결 확인처럼 code 없이 돌아오는 경우: 이미 로그인돼 있으면 성공으로 봄
      !!(await supabase.auth.getUser()).data.user && !searchParams.get("error");
  if (ok) {
    const cookieStore = await cookies();
    const next = safeNextPath(cookieStore.get(NEXT_COOKIE)?.value) ?? "/";
    cookieStore.delete(NEXT_COOKIE);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("nickname").eq("id", user.id).maybeSingle()
      : { data: null };
    const destination = profile?.nickname ? next : `/?next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(`${origin}${destination}`);
  }
  return NextResponse.redirect(`${origin}/?error=auth`);
}
