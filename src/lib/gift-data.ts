import { cache } from "react";
import type { GiftView } from "./gift";
import { isSupabaseConfigured } from "./supabase/config";
import { createAnonClient } from "./supabase/anon";

// 선물 링크 한 개 읽기 (로그인 없이, 토큰으로). count=true면 열린 뒤 본 횟수를 셈 (화면 볼 때만, 메타데이터·그림은 false)
export const loadGift = cache(async (token: string, count: boolean): Promise<GiftView | null> => {
  if (!isSupabaseConfigured || !/^[0-9a-f]{64}$/.test(token)) return null;
  const { data } = await createAnonClient().rpc("get_gift", { p_token: token, p_count: count }).maybeSingle<GiftView>();
  return data ?? null;
});
