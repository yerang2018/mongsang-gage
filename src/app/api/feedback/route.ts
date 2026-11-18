import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

const Body = z.object({
  submissionId: z.string().uuid(),
  kind: z.enum(["reading", "trade"]),
  rating: z.number().int().min(1).max(5).nullable(),
  message: z.string().trim().max(1000),
}).strict().refine((b) => b.rating !== null || b.message.length > 0);

// 계정·쿠키·IP·리퍼러·꿈/거래 번호를 읽거나 저장하지 않습니다.
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 10000) return new Response(null, { status: 413 });
  const raw = await request.text();
  if (raw.length > 10000) return new Response(null, { status: 413 });
  let input: unknown;
  try { input = JSON.parse(raw); } catch { return new Response(null, { status: 400 }); }
  const parsed = Body.safeParse(input);
  if (!parsed.success) return new Response(null, { status: 400 });
  if (!isAdminConfigured()) return NextResponse.json({ error: "의견을 저장하지 못했어요. 잠시 후 다시 보내 주세요." }, { status: 503 });
  const b = parsed.data;
  const { error } = await createAdminClient().from("anonymous_feedback").insert({ submission_id: b.submissionId, kind: b.kind, rating: b.rating, message: b.message });
  if (error && error.code !== "23505") return NextResponse.json({ error: "의견을 저장하지 못했어요. 잠시 후 다시 보내 주세요." }, { status: 503 });
  return new Response(null, { status: 204 });
}
