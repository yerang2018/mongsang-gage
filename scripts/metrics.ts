// 행동 지표·AI 원가 보기 (운영자 전용, 서버 비밀 키로 metrics_report 실행). 정의: docs/metrics.md
// 실행: npx tsx --env-file=.env.local scripts/metrics.ts 2026-11-01 2026-11-14   (날짜는 한국 날짜, 둘 다 포함. 생략하면 최근 7일)
// 샌드박스 밖에서 실행. 0011_metrics.sql 을 먼저 적용해야 함
import { createClient } from "@supabase/supabase-js";

// AI 요율 (백만 토큰당 달러). 공식 요금표에서 확인한 값만 넣을 것 — 비워 두면 "비용 미확인"
// 예: { "gemini-3.5-flash": { input: 0, output: 0 } }  ← 0은 예시 자리이며 실제 요율이 아님
const AI_PRICES: Record<string, { input: number; output: number }> = {};

const seoulDate = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

async function main() {
  const [from = seoulDate(new Date(Date.now() - 6 * 86400_000)), to = seoulDate(new Date())] = process.argv.slice(2);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

  const { data, error } = await db.rpc("metrics_report", { p_from: from, p_to: to });
  if (error) throw new Error(`metrics_report 실패 (0011 적용했나요?): ${error.message}`);
  console.log(`\n몽상가게 지표 ${from} ~ ${to} (한국 날짜, 제외 계정 빼고)\n`);
  console.table(
    (data as { metric: string; numerator: number | null; denominator: number | null; note: string | null }[]).map((r) => ({
      지표: r.metric,
      값: r.numerator ?? (r.metric.includes("비용") ? "미확인" : "미측정"),
      분모: r.denominator ?? "",
      비율: r.numerator !== null && r.denominator ? `${Math.round((r.numerator / r.denominator) * 1000) / 10}%` : "",
      설명: r.note ?? "",
    })),
  );

  // 모델별 토큰·비용 (요율을 넣은 모델만 환산)
  const t0 = new Date(`${from}T00:00:00+09:00`).toISOString();
  const t1 = new Date(new Date(`${to}T00:00:00+09:00`).getTime() + 86400_000).toISOString();
  const { data: calls, error: e2 } = await db
    .from("ai_calls")
    .select("model, app_env, outcome, prompt_tokens, output_tokens, thinking_tokens")
    .gte("created_at", t0)
    .lt("created_at", t1);
  if (e2) throw e2;
  const byModel = new Map<string, { 시도: number; 실패: number; 입력: number; 출력: number; 생각: number }>();
  for (const c of calls ?? []) {
    const key = `${c.model} (${c.app_env ?? "?"})`;
    const row = byModel.get(key) ?? { 시도: 0, 실패: 0, 입력: 0, 출력: 0, 생각: 0 };
    row.시도 += 1;
    if (c.outcome === "error") row.실패 += 1;
    row.입력 += c.prompt_tokens ?? 0;
    row.출력 += c.output_tokens ?? 0;
    row.생각 += c.thinking_tokens ?? 0;
    byModel.set(key, row);
  }
  console.log("\nAI 호출 (모델별, 무료 등급 호출 포함)\n");
  console.table(
    [...byModel].map(([key, r]) => {
      const price = AI_PRICES[key.split(" (")[0]];
      const cost = price ? ((r.입력 * price.input + (r.출력 + r.생각) * price.output) / 1_000_000).toFixed(4) + " USD" : "비용 미확인 (요율 없음)";
      return { 모델: key, ...r, 환산비용: cost };
    }),
  );
  console.log("\n※ 지금은 Gemini 무료 등급이라 실제 청구액은 0이에요. 환산비용은 유료로 바꿨을 때의 추정치예요.");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
