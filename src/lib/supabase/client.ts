import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

// 브라우저(화면)에서 쓰는 Supabase 연결
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}
