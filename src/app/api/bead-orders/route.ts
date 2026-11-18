import { NextResponse } from "next/server";
import { packById } from "@/lib/beads";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 구슬 충전 주문 만들기: 금액·구슬 수는 서버가 src/lib/beads.ts 묶음으로 정함 (브라우저가 보낸 금액은 안 믿음)
// 주문번호 4자리를 돌려주면 화면이 카카오페이 송금 안내를 보여 줌. 구슬은 운영자가 /admin 에서 입금 확인하면 들어감
export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: ".env.local 에 SUPABASE_SECRET_KEY 를 넣고 서버를 다시 켜 주세요." }, { status: 500 });
  }
  const { packId } = (await req.json().catch(() => ({}))) as { packId?: string };
  const pack = packById(packId);
  if (!pack) return NextResponse.json({ error: "충전할 금액을 골라 주세요." }, { status: 400 });

  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { data, error } = await createAdminClient()
    .rpc("create_bead_order", { p_user: user.id, p_amount_won: pack.won, p_beads: pack.beads })
    .single<{ order_id: string; order_code: string }>();
  if (error || !data) {
    // P0001 = DB 함수가 일부러 낸 안내 문구 (예: "입금 대기 중인 충전이 3개 있어요")
    if (error?.code === "P0001") return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("create_bead_order error", error);
    return NextResponse.json({ error: "충전 주문을 만들지 못했어요. 다시 시도해 주세요." }, { status: 500 });
  }
  return NextResponse.json({ orderId: data.order_id, code: data.order_code });
}
