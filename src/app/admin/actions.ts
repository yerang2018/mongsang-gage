"use server";

import { revalidatePath } from "next/cache";
import { getAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: boolean; message: string };

// 입금 확인: 관리자인지 다시 확인한 뒤 DB 함수로 구슬 지급 (두 번 눌러도 한 번만)
export async function confirmOrder(orderId: string): Promise<ActionResult> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, message: "관리자만 할 수 있어요" };
  const { data, error } = await createAdminClient().rpc("confirm_bead_order", { p_order: orderId, p_admin: admin.id });
  revalidatePath("/admin");
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: data ? `구슬 ${data}개를 넣었어요` : "이미 확인한 주문이에요" };
}

// 신고 처리: dismiss = 문제없음(숨김 풀고 다시 판매 중으로), hide = 숨김 유지(신고 인정). 환불·구슬 회수는 아직 직접 (수능 뒤)
export async function resolveReports(dreamId: string, action: "dismiss" | "hide"): Promise<ActionResult> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, message: "관리자만 할 수 있어요" };
  const { error } = await createAdminClient().rpc("resolve_dream_reports", { p_dream: dreamId, p_action: action, p_admin: admin.id });
  revalidatePath("/admin");
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: action === "dismiss" ? "문제없음으로 처리했어요. 다시 보여요" : "숨김을 유지해요" };
}

// 환불·취소: 입금 전이면 취소, 입금 후면 구슬을 안 썼을 때만 환불(구슬 회수). 실제 송금 반환은 운영자가 직접
export async function refundOrder(orderId: string): Promise<ActionResult> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, message: "관리자만 할 수 있어요" };
  const { data, error } = await createAdminClient().rpc("refund_bead_order", { p_order: orderId, p_admin: admin.id });
  revalidatePath("/admin");
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: data === "cancelled" ? "주문을 취소했어요" : "환불 처리했어요. 송금은 직접 돌려주세요" };
}
