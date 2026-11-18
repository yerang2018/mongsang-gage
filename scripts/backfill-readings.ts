// 상세 해몽(reading)이 없는 예전 꿈에 상세 해몽만 채워 넣기. 등급·점수·결론은 건드리지 않음
// 실행: npx tsx --env-file=.env.local scripts/backfill-readings.ts        (먼저 무엇을 채울지 보기만)
//       npx tsx --env-file=.env.local scripts/backfill-readings.ts --write (실제로 저장)
import { createClient } from "@supabase/supabase-js";
import { generateReading } from "../src/lib/gemini";
import { gradeByCode } from "../src/lib/grades";

const write = process.argv.includes("--write");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

async function main() {
  const { data: dreams, error } = await admin
    .from("dreams")
    .select("id, text, title, grade, luck_score, headline, interpretation, sale_status")
    .is("reading", null)
    .order("created_at");
  if (error) throw error;
  console.log(`상세 해몽이 없는 꿈 ${dreams.length}개${write ? " → 채워 넣기" : " (보기만, 저장하려면 --write)"}`);
  for (const d of dreams) {
    const label = `${d.title} (${gradeByCode(d.grade)?.name}, ${d.sale_status})`;
    if (!write) {
      console.log(" -", label);
      continue;
    }
    try {
      const reading = await generateReading({
        dreamText: d.text,
        title: d.title,
        gradeName: gradeByCode(d.grade)?.name ?? d.grade,
        score: d.luck_score,
        headline: d.headline,
        interpretation: d.interpretation,
      });
      const { error: upErr } = await admin.from("dreams").update({ reading }).eq("id", d.id).is("reading", null);
      if (upErr) throw upErr;
      console.log(" ✓", label, `상징 ${reading.symbol_readings.map((s) => s.symbol).join(", ")}`);
    } catch (e) {
      console.log(" ✗", label, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 4000)); // 무료 등급 분당 한도 대비
  }
}
main();
