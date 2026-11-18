import { createClient } from "./supabase/server";

// 관리자 = 이메일로 로그인한 계정 중 ADMIN_EMAILS(쉼표로 여러 개)에 있는 사람. 서버에서만 확인
// 익명 계정은 이메일이 없어서 관리자가 될 수 없음 → 관리자는 /account/link 로 이메일을 연결해야 함
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function getAdmin(): Promise<{ id: string; email: string } | null> {
  const list = adminEmails();
  if (list.length === 0) return null;
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!user || user.is_anonymous || !email || !list.includes(email)) return null;
  return { id: user.id, email };
}
