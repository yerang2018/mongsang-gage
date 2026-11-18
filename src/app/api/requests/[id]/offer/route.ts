import { NextResponse } from "next/server";
import { gradeByCode } from "@/lib/grades";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 꿈 구해요에 내 꿈 내밀기: 꿈값은 일반 판매처럼 grades.ts 등급표로 서버가 정함. 규칙 검사(한 사람 하나, 팔린 꿈 안 됨 등)는 DB 함수가 함
// 판매 등록처럼 서약 체크가 있어야 함 (dreams.sale_pledged_at 기록). 신고로 숨긴 꿈은 못 내밂
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: ".env.local 에 SUPABASE_SECRET_KEY 를 넣고 서버를 다시 켜 주세요." }, { status: 500 });
  }
  const { dreamId, pledge } = (await req.json().catch(() => ({}))) as { dreamId?: string; pledge?: boolean };
  if (!dreamId) return NextResponse.json({ error: "내밀 꿈을 골라 주세요." }, { status: 400 });
  if (pledge !== true) return NextResponse.json({ error: "판매 서약에 체크해 주세요." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { data: dream } = await supabase.from("dreams").select("grade, hidden_at").eq("id", dreamId).maybeSingle<{ grade: string; hidden_at: string | null }>();
  const grade = gradeByCode(dream?.grade);
  if (!dream || !grade) return NextResponse.json({ error: "꿈을 찾을 수 없어요." }, { status: 404 });
  if (dream.hidden_at) return NextResponse.json({ error: "신고가 들어와 운영자가 확인 중인 꿈이에요." }, { status: 400 });
  if (grade.priceType === "none") return NextResponse.json({ error: "액땜몽은 내밀 수 없어요." }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.rpc("offer_dream", {
    p_responder: user.id,
    p_request: id,
    p_dream: dreamId,
    p_price_type: grade.priceType,
    p_price: grade.price,
  });
  if (error) {
    // P0001 = DB 함수가 일부러 낸 안내 문구 (예: "이미 꿈을 내밀었어요")
    if (error.code === "P0001") return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("offer_dream error", error);
    return NextResponse.json({ error: "꿈을 내밀지 못했어요. 다시 시도해 주세요." }, { status: 500 });
  }
  await admin.from("dreams").update({ sale_pledged_at: new Date().toISOString() }).eq("id", dreamId);
  return NextResponse.json({ ok: true });
}
