import { GRADES } from "@/lib/grades";
import { createAdminClient } from "@/lib/supabase/admin";

// 관리자 화면 위쪽 테스트 지표 (v3 시작 2026-11-03부터 지금까지). 시험 계정(metrics_excluded_users)은 뺌
// 방문·선물 링크 방문은 운영 사이트(production) 기록만. 나머지는 서버가 확정한 표(충전 주문·거래·선물)에서 셈
export const METRICS_FROM = "2026-11-03T00:00:00+09:00";

export type Metric = { label: string; value: string; sub?: string };

export async function loadTestMetrics(): Promise<{ cards: Metric[]; byGrade: { name: string; count: number }[] }> {
  const db = createAdminClient();
  const [ex, orders, trades, gifts, visits, giftVisits, links, profiles, dreams] = await Promise.all([
    db.from("metrics_excluded_users").select("user_id"),
    db.from("bead_orders").select("user_id, amount_won, status").gte("created_at", METRICS_FROM),
    db.from("trades").select("buyer_id, seller_id, price").gte("created_at", METRICS_FROM),
    db.from("gifts").select("sender_id, kind, first_viewed_at, dreams(grade)").gte("created_at", METRICS_FROM),
    db.from("events").select("visitor_id").eq("type", "first_visit").eq("app_env", "production").gte("created_at", METRICS_FROM),
    db.from("events").select("visitor_id, created_at").eq("type", "gift_visit").eq("app_env", "production").gte("created_at", METRICS_FROM),
    db.from("events").select("visitor_id, user_id").eq("type", "session_link"),
    db.from("profiles").select("id, created_at, nickname").gte("created_at", METRICS_FROM),
    db.from("dreams").select("original_owner_id").gte("created_at", METRICS_FROM),
  ]);

  const exUsers = new Set((ex.data ?? []).map((r) => r.user_id as string));
  const linkRows = (links.data ?? []) as { visitor_id: string; user_id: string }[];
  const exVisitors = new Set(linkRows.filter((l) => exUsers.has(l.user_id)).map((l) => l.visitor_id));
  const real = (uid: string | null | undefined) => !!uid && !exUsers.has(uid);

  const paid = ((orders.data ?? []) as { user_id: string; amount_won: number; status: string }[]).filter((o) => o.status === "paid" && real(o.user_id));
  const tradeRows = ((trades.data ?? []) as { buyer_id: string; seller_id: string; price: number }[]).filter((t) => real(t.buyer_id) && real(t.seller_id));
  type GiftRow = { sender_id: string; kind: string; first_viewed_at: string | null; dreams: { grade: string | null } | null };
  const luckSets = ((gifts.data ?? []) as unknown as GiftRow[]).filter((g) => g.kind === "luck_set" && real(g.sender_id));
  const opened = luckSets.filter((g) => g.first_viewed_at).length;
  const visitors = new Set(((visits.data ?? []) as { visitor_id: string }[]).map((v) => v.visitor_id).filter((v) => !exVisitors.has(v)));
  const newUsers = ((profiles.data ?? []) as { id: string; nickname: string | null }[]).filter((p) => p.nickname && real(p.id));
  const dreamCount = ((dreams.data ?? []) as { original_owner_id: string }[]).filter((d) => real(d.original_owner_id)).length;

  // 선물 받은 사람 중 가입: 선물 링크로 처음 온 방문자 → 그 뒤에 만든 계정으로 이어진 사람
  const created = new Map(((profiles.data ?? []) as { id: string; created_at: string }[]).map((p) => [p.id, Date.parse(p.created_at)]));
  const giftVisitors = ((giftVisits.data ?? []) as { visitor_id: string; created_at: string }[]).filter((v) => !exVisitors.has(v.visitor_id));
  const signedUp = giftVisitors.filter((v) =>
    linkRows.some((l) => l.visitor_id === v.visitor_id && real(l.user_id) && (created.get(l.user_id) ?? 0) >= Date.parse(v.created_at)),
  ).length;

  const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "-");
  const cards: Metric[] = [
    { label: "방문자", value: `${visitors.size}명`, sub: "운영 사이트" },
    { label: "새로 시작", value: `${newUsers.length}명`, sub: "닉네임까지" },
    { label: "꿈 기록", value: `${dreamCount}편` },
    { label: "꿈 거래", value: `${tradeRows.length}건`, sub: `구슬 ${tradeRows.reduce((s, t) => s + t.price, 0).toLocaleString()}개` },
    { label: "충전 (목표 10)", value: `${paid.length}건`, sub: `${paid.reduce((s, o) => s + o.amount_won, 0).toLocaleString()}원` },
    { label: "행운 세트", value: `${luckSets.length}개`, sub: `열어 본 선물 ${opened}개 (${pct(opened, luckSets.length)})` },
    { label: "선물 링크 방문", value: `${giftVisitors.length}명`, sub: "운영 사이트" },
    { label: "선물 받고 가입 (목표 20%)", value: pct(signedUp, giftVisitors.length), sub: `${signedUp}명` },
  ];
  const byGrade = GRADES.filter((g) => g.priceType !== "none").map((g) => ({
    name: g.name,
    count: luckSets.filter((s) => s.dreams?.grade === g.code).length,
  }));
  return { cards, byGrade };
}
