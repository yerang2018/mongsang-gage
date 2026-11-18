import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

// 서버 전용 관리자 연결 (비밀 키 사용). 등급처럼 사용자가 조작하면 안 되는 값을 저장할 때만 씀.
// 절대 "use client" 파일에서 import 하지 말 것.
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY 가 .env.local 에 없어요");
  return createClient(SUPABASE_URL, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function isAdminConfigured() {
  return (process.env.SUPABASE_SECRET_KEY ?? "").length > 20;
}
