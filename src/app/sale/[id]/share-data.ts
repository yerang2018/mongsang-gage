import { cache } from "react";
import { gradeByCode } from "@/lib/grades";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAnonClient } from "@/lib/supabase/anon";

type ShareRow = { luck_score?: number | null; title: string; grade: string; luck_tags: string[]; headline: string; price_type: string; price: number; sale_status: string; seller_nickname: string };

// 카톡 미리보기(제목·설명·그림)에 쓰는 판매 카드 공개 정보
export const saleShareData = cache(async (id: string) => {
  if (!isSupabaseConfigured || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createAnonClient().rpc("get_sale_card", { p_dream: id }).maybeSingle<ShareRow>();
  if (!data) return null;
  const price = data.price_type === "beads" ? `구슬 ${data.price.toLocaleString()}개` : "응원 한마디";
  return { ...data, gradeName: gradeByCode(data.grade)?.name ?? "꿈", price };
});
