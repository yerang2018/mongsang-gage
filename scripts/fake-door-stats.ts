// 가짜 문을 몇 명이 눌렀는지 보기 (같은 사람이 여러 번 눌러도 1명)
// 실행: npx tsx --env-file=.env.local scripts/fake-door-stats.ts  (샌드박스 밖)
import { createClient } from "@supabase/supabase-js";

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const { data, error } = await db.from("events").select("user_id, visitor_id, meta, created_at").eq("type", "fake_door");
  if (error) throw error;
  const doors = new Map<string, { people: Set<string>; clicks: number }>();
  for (const e of data ?? []) {
    const door = (e.meta as { door?: string } | null)?.door ?? "?";
    const row = doors.get(door) ?? { people: new Set(), clicks: 0 };
    row.clicks += 1;
    const who = e.user_id ?? e.visitor_id; // 로그인 전 클릭은 방문자 번호로 (0011 이후)
    if (who) row.people.add(who);
    doors.set(door, row);
  }
  console.table([...doors].map(([door, r]) => ({ 가짜문: door, 누른사람: r.people.size, 누른횟수: r.clicks })).sort((a, b) => b.누른사람 - a.누른사람));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
