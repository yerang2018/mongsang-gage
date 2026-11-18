import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

// 로그인 정보 없이 공개 정보만 읽는 연결 (카톡 미리보기 그림·제목처럼 누가 보든 같은 내용)
export function createAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
}
