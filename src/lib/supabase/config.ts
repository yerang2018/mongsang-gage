// Supabase 주소와 공개 키. 공개 키(publishable/anon)는 브라우저에 보여도 되는 키이고,
// 실제 보호는 DB의 RLS 규칙이 함. 비밀 키(secret/service_role)는 여기 두지 말 것.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const isSupabaseConfigured = SUPABASE_URL.startsWith("https://") && SUPABASE_KEY.length > 20;
