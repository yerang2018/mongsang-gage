// 로그인 뒤 돌아갈 주소. 메일 링크 주소엔 붙일 수 없어서(Supabase 허용 주소 제한) 쿠키에 잠깐 보관
export const NEXT_COOKIE = "kk_next";

// 우리 사이트 안의 주소("/..."로 시작)만 허용. 다른 사이트로 튕기는 것 방지
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  let v: string;
  try {
    v = decodeURIComponent(value);
  } catch {
    return null;
  }
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : null;
}
