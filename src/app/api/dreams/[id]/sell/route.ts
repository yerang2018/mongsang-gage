import { NextResponse } from "next/server";
import { gradeByCode } from "@/lib/grades";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 판매 등록: 꿈값은 grades.ts 등급표로 서버가 정함 (판매자가 못 바꿈). 규칙 검사는 DB 함수가 함
// 판매 서약(SALE_PLEDGE) 체크가 있어야 하고, 체크한 때를 dreams.sale_pledged_at 에 남김. 신고로 숨긴 꿈은 다시 못 올림
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { pledge } = (await req.json().catch(() => ({}))) as { pledge?: boolean };
  if (pledge !== true) return NextResponse.json({ error: "판매 서약에 체크해 주세요." }, { status: 400 });
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: ".env.local 에 SUPABASE_SECRET_KEY 를 넣고 서버를 다시 켜 주세요." }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { data: dream } = await supabase.from("dreams").select("grade, hidden_at").eq("id", id).maybeSingle<{ grade: string; hidden_at: string | null }>();
  const grade = gradeByCode(dream?.grade);
  if (!dream || !grade) return NextResponse.json({ error: "꿈을 찾을 수 없어요." }, { status: 404 });
  if (dream.hidden_at) return NextResponse.json({ error: "신고가 들어와 운영자가 확인 중인 꿈이에요." }, { status: 400 });
  if (grade.priceType === "none") return NextResponse.json({ error: "액땜몽은 팔 수 없어요." }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("list_dream_for_sale", {
    p_seller: user.id,
    p_dream: id,
    p_price_type: grade.priceType,
    p_price: grade.price,
  });
  if (error) {
    // P0001 = DB 함수가 일부러 낸 안내 문구 (예: "오늘은 이미 꿈을 3번 팔았어요")
    if (error.code === "P0001") return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("list_dream_for_sale error", error);
    return NextResponse.json({ error: "판매 등록에 실패했어요. 다시 시도해 주세요." }, { status: 500 });
  }
  await admin.from("dreams").update({ sale_pledged_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ expiresAt: data });
}
