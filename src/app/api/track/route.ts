import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 행동 기록 받기 (브라우저 → 여기 → events 표). 지표 정의: docs/metrics.md
// - 누가 보냈는지는 서버가 정함: 방문자 번호는 쿠키(kk_vid), 계정은 로그인 정보. 브라우저가 보낸 id를 믿지 않음
// - 받는 값은 정해진 종류·짧은 이름·꿈/요청 id 뿐. 꿈 내용·닉네임·전체 주소는 받지 않음
// - DB에 0011이 아직 없거나 오류가 나도 화면엔 영향 없음 (항상 204)
const VISITOR_COOKIE = "kk_vid";
const APP_ENV = process.env.VERCEL_ENV ?? "development";
const UUID = /^[0-9a-f-]{36}$/i;

const Body = z.object({
  type: z.enum(["visit", "page_view", "share_attempt", "share_complete", "share_cancel", "link_copied", "fake_door"]),
  target: z.string().regex(/^[a-z_]{1,24}$/).optional(), // 화면 종류 (sale·request·market…)
  id: z.string().regex(UUID).optional(), // 꿈 id 또는 꿈 구해요 id
  via: z.enum(["share", "copy"]).optional(), // 공유 링크로 들어왔는지
  method: z.enum(["native", "copy"]).optional(),
  door: z.string().regex(/^[a-z_]{1,32}$/).optional(), // 가짜 문 이름
});

type Row = { type: string; visitor_id: string; user_id: string | null; app_env: string; dedup_key: string | null; meta: Record<string, string> | null };

let warned = false;

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  const b = parsed.data;

  const jar = await cookies();
  const existing = jar.get(VISITOR_COOKIE)?.value;
  const isNewVisitor = !existing || !UUID.test(existing);
  const visitorId = isNewVisitor ? randomUUID() : existing;
  if (isNewVisitor) {
    jar.set(VISITOR_COOKIE, visitorId, { httpOnly: true, sameSite: "lax", secure: APP_ENV !== "development", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  if (!isAdminConfigured()) return new Response(null, { status: 204 });

  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const base = { visitor_id: visitorId, user_id: user?.id ?? null, app_env: APP_ENV };
  const meta = (m: Record<string, string | undefined>) => Object.fromEntries(Object.entries(m).filter(([, v]) => v)) as Record<string, string>;
  const rows: Row[] = [];

  if (b.type === "visit") {
    if (isNewVisitor) rows.push({ ...base, type: "first_visit", dedup_key: "first", meta: meta({ page: b.target, via: b.via }) });
    // 공유 링크(?via=)로 온 방문: 같은 사람이 같은 꿈 링크를 여러 번 열어도 한 번
    if (b.via && b.id && (b.target === "sale" || b.target === "request")) {
      rows.push({ ...base, type: "share_visit", dedup_key: `${b.target}:${b.id}`, meta: meta({ target: b.target, id: b.id, via: b.via }) });
    }
    // 선물 링크(/g/)로 처음 들어온 방문자: 사람마다 한 번 (선물 받은 사람 중 가입한 비율을 셈. 토큰은 남기지 않음)
    if (b.target === "gift") rows.push({ ...base, type: "gift_visit", dedup_key: "gift", meta: null });
    // 로그인한 방문: 방문자 번호 ↔ 계정 연결 (익명 시작 전 유입 경로를 이어 붙이는 데 씀)
    if (user) rows.push({ ...base, type: "session_link", dedup_key: user.id, meta: null });
  } else if (b.type === "page_view") {
    // 화면을 옮길 때마다 한 줄 (어떤 화면·어떤 꿈을 봤는지. 꿈 내용은 기록하지 않음)
    rows.push({ ...base, type: "page_view", dedup_key: null, meta: meta({ target: b.target, id: b.id }) });
  } else if (b.type === "fake_door") {
    if (b.door) rows.push({ ...base, type: "fake_door", dedup_key: null, meta: meta({ door: b.door }) });
  } else {
    rows.push({ ...base, type: b.type, dedup_key: null, meta: meta({ target: b.target, id: b.id, method: b.method }) });
  }

  if (rows.length > 0) {
    const { error } = await createAdminClient().from("events").upsert(rows, { onConflict: "visitor_id,type,dedup_key", ignoreDuplicates: true });
    if (error && !warned) {
      warned = true;
      console.warn("track: 기록 실패 (0011_metrics.sql 적용 전이면 정상)", error.message);
    }
  }
  return new Response(null, { status: 204 });
}
