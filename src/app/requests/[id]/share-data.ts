import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAnonClient } from "@/lib/supabase/anon";

type ShareRow = { luck_tag: string; message: string | null; status: string; requester_nickname: string };

// 카톡 미리보기(제목·설명·그림)에 쓰는 꿈 구해요 공개 정보
export const requestShareData = cache(async (id: string) => {
  if (!isSupabaseConfigured || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createAnonClient().rpc("get_dream_request", { p_request: id }).maybeSingle<ShareRow>();
  return data ?? null;
});
