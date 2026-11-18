import { createAdminClient } from "@/lib/supabase/admin";
const LABELS = ["매우 불만족", "불만족", "보통", "만족", "매우 만족"];
type Row = { submission_id: string; kind: "reading" | "trade"; rating: number | null; message: string; submitted_on: string };
export default async function FeedbackList() {
  const { data, error } = await createAdminClient().from("anonymous_feedback").select("submission_id, kind, rating, message, submitted_on").order("submitted_on", { ascending: false }).limit(300);
  if (error) return <p className="mt-5 text-sm">피드백을 불러오지 못했습니다.</p>;
  const rows = (data ?? []) as Row[];
  return <section className="mt-6">
    <h2 className="font-title text-xl">익명 피드백</h2>
    <p className="mt-2 text-xs text-white/60">최근 날짜 기준 최대 300건입니다. 작성자 정보는 수집하지 않습니다.</p>
    {(["reading", "trade"] as const).map((kind) => {
      const ratings = rows.filter((r) => r.kind === kind && r.rating !== null);
      return <div key={kind} className="mt-4 rounded-xl bg-white/5 p-4 text-sm"><b>{kind === "reading" ? "해몽" : "거래"} 만족도</b><p className="mt-2">{LABELS.map((label, i) => `${label} ${ratings.filter((r) => r.rating === i + 1).length}건`).join(" · ")}</p></div>;
    })}
    {!rows.length && <p className="mt-5 text-sm text-white/60">아직 받은 의견이 없습니다.</p>}
    <div className="mt-4 space-y-3">{rows.map((r) => <article key={r.submission_id} className="rounded-xl border border-white/10 p-4"><p className="text-xs text-white/60">{r.submitted_on} · {r.kind === "reading" ? "해몽" : "거래"} · {r.rating === null ? "평가 없이 의견만" : LABELS[r.rating - 1]}</p>{r.message && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{r.message}</p>}</article>)}</div>
  </section>;
}
