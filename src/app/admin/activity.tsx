import { gradeByCode } from "@/lib/grades";
import { createAdminClient } from "@/lib/supabase/admin";

// 관리자 "활동" 탭: 누가 언제 들어와 뭘 봤고 뭘 샀는지(사람별 여정), 어떤 꿈에 반응이 있는지, 단계별 이탈, 시간대·유입
// 시험 계정(metrics_excluded_users)과 그 기기(방문자 번호)는 뺌. 화면 조회(page_view)는 이 기능을 배포한 뒤부터 쌓임
const FROM = "2026-11-18T00:00:00+09:00";
const KST: Intl.DateTimeFormatOptions = { timeZone: "Asia/Seoul" };

type Ev = { visitor_id: string | null; user_id: string | null; type: string; meta: Record<string, string> | null; created_at: string };
type DreamRow = { id: string; title: string | null; grade: string | null; luck_tags: string[] | null; original_owner_id: string; created_at: string; listed_at: string | null; sale_status: string };
type TradeRow = { id: string; dream_id: string; seller_id: string; buyer_id: string; price: number; price_type: string; created_at: string };
type OrderRow = { user_id: string; amount_won: number; status: string; created_at: string };
type Step = { at: number; text: string };

const PAGE_LABEL: Record<string, string> = {
  home: "MY 화면",
  market: "꿈 장터",
  beads: "구슬 충전 화면",
  gift: "선물 링크",
  example: "예시 화면",
  onboarding: "시작 화면",
  other: "다른 화면",
};

const fmt = (ms: number) => new Date(ms).toLocaleString("ko-KR", { ...KST, month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "-");

export default async function ActivityTab() {
  const db = createAdminClient();
  const [ex, links, evs, profs, dreamsQ, tradesQ, ordersQ] = await Promise.all([
    db.from("metrics_excluded_users").select("user_id"),
    db.from("events").select("visitor_id, user_id").eq("type", "session_link"),
    db
      .from("events")
      .select("visitor_id, user_id, type, meta, created_at")
      .in("type", ["first_visit", "page_view", "share_visit", "gift_visit", "fake_door"])
      .eq("app_env", "production")
      .gte("created_at", FROM)
      .order("created_at", { ascending: false })
      .limit(5000),
    db.from("profiles").select("id, nickname, created_at"),
    db.from("dreams").select("id, title, grade, luck_tags, original_owner_id, created_at, listed_at, sale_status"),
    db.from("trades").select("id, dream_id, seller_id, buyer_id, price, price_type, created_at").gte("created_at", FROM),
    db.from("bead_orders").select("user_id, amount_won, status, created_at").gte("created_at", FROM),
  ]);

  const exUsers = new Set(((ex.data ?? []) as { user_id: string }[]).map((r) => r.user_id));
  const linkRows = (links.data ?? []) as { visitor_id: string; user_id: string }[];
  const exVisitors = new Set(linkRows.filter((l) => exUsers.has(l.user_id)).map((l) => l.visitor_id));
  const visitorUser = new Map<string, string>();
  for (const l of linkRows) if (!exUsers.has(l.user_id)) visitorUser.set(l.visitor_id, l.user_id);
  const nick = new Map(((profs.data ?? []) as { id: string; nickname: string | null }[]).map((p) => [p.id, p.nickname ?? "(닉네임 없음)"]));
  const dreams = new Map(((dreamsQ.data ?? []) as DreamRow[]).map((d) => [d.id, d]));
  const trades = ((tradesQ.data ?? []) as TradeRow[]).filter((t) => !exUsers.has(t.buyer_id) && !exUsers.has(t.seller_id));
  const orders = ((ordersQ.data ?? []) as OrderRow[]).filter((o) => !exUsers.has(o.user_id));
  const events = ((evs.data ?? []) as Ev[]).filter((e) => !(e.visitor_id && exVisitors.has(e.visitor_id)) && !(e.user_id && exUsers.has(e.user_id)));
  const dreamTitle = (id?: string) => (id && dreams.get(id)?.title) || "꿈";

  // 한 사람(계정 또는 방문자)으로 묶는 키
  const actorOf = (e: Ev) => {
    const uid = e.user_id ?? (e.visitor_id ? visitorUser.get(e.visitor_id) : undefined);
    return uid ? `u:${uid}` : e.visitor_id ? `v:${e.visitor_id}` : "v:?";
  };
  const actorName = (key: string) => (key.startsWith("u:") ? nick.get(key.slice(2)) ?? "(알 수 없음)" : `방문자 ${key.slice(2, 6)}`);

  // ───── 1. 사람별 여정 ─────
  const steps = new Map<string, Step[]>();
  const add = (key: string, at: number, text: string) => {
    if (!steps.has(key)) steps.set(key, []);
    steps.get(key)!.push({ at, text });
  };
  for (const e of events) {
    const at = Date.parse(e.created_at);
    const key = actorOf(e);
    const t = e.meta?.target;
    if (e.type === "first_visit") add(key, at, "처음 접속");
    else if (e.type === "share_visit") add(key, at, `공유 링크로 들어옴 (${e.meta?.via === "copy" ? "복사한 링크" : "공유 창"})`);
    else if (e.type === "gift_visit") add(key, at, "선물 링크로 들어옴");
    else if (e.type === "fake_door") add(key, at, `준비 중 버튼 누름 (${e.meta?.door ?? ""})`);
    else if (e.type === "page_view") {
      if (t === "sale") add(key, at, `판매 카드 봄: ${dreamTitle(e.meta?.id)}`);
      else if (t === "dream") add(key, at, `꿈 결과 봄: ${dreamTitle(e.meta?.id)}`);
      else if (t === "trade") add(key, at, "매매 증서 봄");
      else add(key, at, `${PAGE_LABEL[t ?? "other"] ?? "다른 화면"} 봄`);
    }
  }
  for (const d of dreams.values()) {
    if (exUsers.has(d.original_owner_id)) continue;
    const key = `u:${d.original_owner_id}`;
    if (Date.parse(d.created_at) >= Date.parse(FROM)) add(key, Date.parse(d.created_at), `꿈 해몽 받음: ${d.title ?? "제목 없음"} (${gradeByCode(d.grade)?.name ?? "-"})`);
    if (d.listed_at && Date.parse(d.listed_at) >= Date.parse(FROM)) add(key, Date.parse(d.listed_at), `판매 등록: ${d.title ?? "제목 없음"}`);
  }
  for (const t of trades) {
    const at = Date.parse(t.created_at);
    const price = t.price_type === "beads" ? `구슬 ${t.price}개` : "응원 한마디";
    add(`u:${t.buyer_id}`, at, `구매: ${dreamTitle(t.dream_id)} (${price})`);
    add(`u:${t.seller_id}`, at, `판매됨: ${dreamTitle(t.dream_id)} (${price})`);
  }
  for (const o of orders) add(`u:${o.user_id}`, Date.parse(o.created_at), `충전 주문 ${o.amount_won.toLocaleString()}원 (${o.status === "paid" ? "입금 확인" : o.status === "pending" ? "입금 대기" : o.status})`);

  const journeys = [...steps.entries()]
    .map(([key, list]) => {
      list.sort((a, b) => a.at - b.at);
      // 같은 줄이 연달아 나오면 "×N"으로 줄임
      const merged: { at: number; text: string; n: number }[] = [];
      for (const s of list) {
        const last = merged[merged.length - 1];
        if (last && last.text === s.text) last.n++;
        else merged.push({ ...s, n: 1 });
      }
      return { key, merged, first: list[0].at, last: list[list.length - 1].at };
    })
    .sort((a, b) => b.last - a.last)
    .slice(0, 40);

  // ───── 2. 꿈별 반응 ─────
  const saleViews = new Map<string, { total: number; people: Set<string> }>();
  const dreamViews = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "page_view" || !e.meta?.id) continue;
    if (e.meta.target === "sale") {
      const v = saleViews.get(e.meta.id) ?? { total: 0, people: new Set<string>() };
      v.total++;
      v.people.add(actorOf(e));
      saleViews.set(e.meta.id, v);
    } else if (e.meta.target === "dream") dreamViews.set(e.meta.id, (dreamViews.get(e.meta.id) ?? 0) + 1);
  }
  const soldIds = new Set(trades.map((t) => t.dream_id));
  const reaction = [...saleViews.entries()]
    .map(([id, v]) => ({ id, d: dreams.get(id), total: v.total, people: v.people.size, sold: soldIds.has(id) }))
    .sort((a, b) => b.people - a.people || b.total - a.total)
    .slice(0, 15);
  const byGrade = new Map<string, { views: number; sold: number }>();
  const byTag = new Map<string, { views: number; sold: number }>();
  for (const [id, v] of saleViews) {
    const d = dreams.get(id);
    if (!d) continue;
    const g = gradeByCode(d.grade)?.name ?? "-";
    const gr = byGrade.get(g) ?? { views: 0, sold: 0 };
    gr.views += v.people.size;
    if (soldIds.has(id)) gr.sold++;
    byGrade.set(g, gr);
    for (const tag of d.luck_tags ?? []) {
      const tr = byTag.get(tag) ?? { views: 0, sold: 0 };
      tr.views += v.people.size;
      if (soldIds.has(id)) tr.sold++;
      byTag.set(tag, tr);
    }
  }

  // ───── 3. 단계별 이탈 ─────
  const actors = (filter: (e: Ev) => boolean) => new Set(events.filter(filter).map(actorOf));
  const visitedActors = actors((e) => e.type === "first_visit" || e.type === "page_view");
  const started = new Set(((profs.data ?? []) as { id: string; nickname: string | null; created_at: string }[]).filter((p) => p.nickname && !exUsers.has(p.id) && Date.parse(p.created_at) >= Date.parse(FROM)).map((p) => `u:${p.id}`));
  const dreamers = new Set([...dreams.values()].filter((d) => !exUsers.has(d.original_owner_id) && Date.parse(d.created_at) >= Date.parse(FROM)).map((d) => `u:${d.original_owner_id}`));
  const sellers = new Set([...dreams.values()].filter((d) => !exUsers.has(d.original_owner_id) && d.listed_at && Date.parse(d.listed_at) >= Date.parse(FROM)).map((d) => `u:${d.original_owner_id}`));
  const marketViewers = actors((e) => e.type === "page_view" && e.meta?.target === "market");
  const saleViewers = actors((e) => e.type === "page_view" && e.meta?.target === "sale");
  const buyers = new Set(trades.map((t) => `u:${t.buyer_id}`));
  const funnel: [string, number][] = [
    ["접속", visitedActors.size],
    ["시작 (닉네임 정함)", started.size],
    ["꿈 해몽 받음", dreamers.size],
    ["판매 등록", sellers.size],
    ["장터 둘러봄", marketViewers.size],
    ["판매 카드 봄", saleViewers.size],
    ["꿈 구매", buyers.size],
  ];

  // ───── 4. 시간대·유입 ─────
  const hourCount = Array.from({ length: 24 }, () => new Set<string>());
  for (const e of events) {
    if (e.type !== "first_visit" && e.type !== "page_view") continue;
    const h = Number(new Date(e.created_at).toLocaleString("en-GB", { ...KST, hour: "2-digit", hour12: false })) % 24;
    hourCount[h].add(actorOf(e));
  }
  const maxHour = Math.max(1, ...hourCount.map((s) => s.size));
  const shareVisits = actors((e) => e.type === "share_visit").size;
  const giftVisits = actors((e) => e.type === "gift_visit").size;
  const firstCount = events.filter((e) => e.type === "first_visit").length;

  return (
    <div className="mt-4 space-y-4">
      <p className="text-xs text-white/60">11월 18일 0시부터, 시험 계정·내 기기 뺌. 화면 조회 기록은 이 기능을 올린 뒤부터 쌓여요.</p>

      <section className="rounded-2xl bg-white/5 p-4">
        <h2 className="font-cute">단계별 이탈</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {funnel.map(([label, n], i) => (
            <li key={label} className="flex justify-between gap-2">
              <span>{label}</span>
              <span>
                {n}명 <span className="text-xs text-white/60">{i === 0 ? "" : `(앞 단계의 ${pct(n, funnel[i - 1][1])})`}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-white/60">단계마다 서로 다른 기록에서 세어서, 앞 단계보다 숫자가 클 수도 있어요.</p>
      </section>

      <section className="rounded-2xl bg-white/5 p-4">
        <h2 className="font-cute">시간대별 접속자 (한국 시간)</h2>
        <ul className="mt-2 space-y-0.5 text-xs">
          {hourCount.map((set, h) => (
            <li key={h} className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-right text-white/60">{h}시</span>
              <span className="h-2.5 rounded bg-moon" style={{ width: `${(set.size / maxHour) * 70}%`, minWidth: set.size ? 4 : 0 }} />
              <span>{set.size || ""}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          유입: 처음 접속 {firstCount}건, 공유 링크로 온 사람 {shareVisits}명, 선물 링크로 온 사람 {giftVisits}명
        </p>
      </section>

      <section className="rounded-2xl bg-white/5 p-4">
        <h2 className="font-cute">꿈별 반응 (판매 카드를 본 사람 순)</h2>
        {reaction.length === 0 ? (
          <p className="mt-2 text-sm text-white/60">아직 판매 카드 조회 기록이 없어요.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {reaction.map((r) => (
              <li key={r.id} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">
                  <span className="text-moon">{gradeByCode(r.d?.grade ?? null)?.name}</span> {r.d?.title ?? "꿈"}
                </span>
                <span className="shrink-0">
                  {r.people}명 · {r.total}번{r.sold ? " · 팔림" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-white/60">등급별: {[...byGrade].map(([g, v]) => `${g} ${v.views}명(팔림 ${v.sold})`).join(", ") || "-"}</p>
        <p className="mt-1 text-xs text-white/60">운 태그별: {[...byTag].map(([g, v]) => `${g} ${v.views}명(팔림 ${v.sold})`).join(", ") || "-"}</p>
      </section>

      <section className="rounded-2xl bg-white/5 p-4">
        <h2 className="font-cute">사람별 여정 (최근 활동 순, 40명)</h2>
        {journeys.length === 0 && <p className="mt-2 text-sm text-white/60">기록이 없어요.</p>}
        <ul className="mt-2 space-y-2">
          {journeys.map((j) => (
            <li key={j.key}>
              <details className="rounded-xl bg-white/5 p-3">
                <summary className="cursor-pointer text-sm">
                  <b>{actorName(j.key)}</b> <span className="text-xs text-white/60">{fmt(j.first)} ~ {fmt(j.last)}, {j.merged.length}단계</span>
                </summary>
                <ol className="mt-2 space-y-1 text-xs">
                  {j.merged.slice(-40).map((s, i) => (
                    <li key={i}>
                      <span className="text-white/60">{fmt(s.at)}</span> {s.text}
                      {s.n > 1 ? ` ×${s.n}` : ""}
                    </li>
                  ))}
                </ol>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
