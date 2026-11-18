import FeedbackList from "./feedback-list";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeByCode } from "@/lib/grades";
import { REPORT_LABEL } from "@/lib/report";
import { formatAgo } from "@/lib/time";
import { loadTestMetrics } from "./metrics";
import OrderActions from "./order-actions";
import ReportActions from "./report-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "관리자 | 몽상가게", robots: { index: false, follow: false } };

type Order = {
  id: string;
  order_code: string;
  user_id: string;
  amount_won: number;
  beads: number;
  status: "pending" | "paid" | "refunded" | "cancelled";
  created_at: string;
  paid_at: string | null;
};

const STATUS: Record<Order["status"], string> = { pending: "입금 대기", paid: "입금 확인", refunded: "환불", cancelled: "취소" };
const TABS = [
  ["pending", "입금 대기"],
  ["paid", "입금 확인"],
  ["all", "전체"],
  ["reports", "🚩 신고"],
  ["dreams", "꿈 원문"],
  ["feedback", "익명 피드백"],
  ["trades", "거래 내역"],
] as const;
const OTHER: string[] = ["reports", "dreams", "feedback", "trades"];

// 관리자 화면: 테스트 지표 + 구슬 충전 주문 목록([입금 확인] [취소·환불]) + 신고 목록([문제없음] [숨김 유지])
// ADMIN_EMAILS 에 있는 이메일 계정만 (아니면 "없는 페이지")
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ status?: string; code?: string; page?: string }> }) {
  const admin = await getAdmin();
  if (!admin) notFound();
  const params = await searchParams;
  const want = params.status;
  const code = (params.code ?? "").replace(/[^0-9]/g, "").slice(0, 4);
  const tab = TABS.find(([t]) => t === want)?.[0] ?? "pending";

  const db = createAdminClient();
  const [metrics, reportCount] = await Promise.all([
    loadTestMetrics(),
    db.from("dream_reports").select("dream_id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  let q = db
    .from("bead_orders")
    .select("id, order_code, user_id, amount_won, beads, status, created_at, paid_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (tab !== "all" && !OTHER.includes(tab)) q = q.eq("status", tab);
  if (code) q = q.like("order_code", `${code}%`);
  const [{ data, error }, { data: counts }] = await Promise.all([OTHER.includes(tab) ? { data: [], error: null } : q, db.from("bead_orders").select("status, amount_won")]);
  const orders = (data ?? []) as Order[];
  const ids = [...new Set(orders.map((o) => o.user_id))];
  const { data: profiles } = ids.length ? await db.from("profiles").select("id, nickname").in("id", ids) : { data: [] };
  const nick = new Map(((profiles ?? []) as { id: string; nickname: string | null }[]).map((p) => [p.id, p.nickname ?? "(닉네임 없음)"]));

  const all = (counts ?? []) as { status: string; amount_won: number }[];
  const pendingCount = all.filter((o) => o.status === "pending").length;
  const paid = all.filter((o) => o.status === "paid");
  const paidWon = paid.reduce((s, o) => s + o.amount_won, 0);

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-title text-2xl font-bold">관리자</h1>
        <span className="truncate text-xs text-white/60">{admin.email}</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="입금 대기" value={`${pendingCount}건`} />
        <Stat label="입금 확인" value={`${paid.length}건`} />
        <Stat label="충전 금액" value={`${paidWon.toLocaleString()}원`} />
      </div>

      <details className="mt-4 rounded-2xl bg-white/5 p-4">
        <summary className="flex min-h-11 cursor-pointer items-center font-cute">📊 테스트 지표 (11월 3일부터, 시험 계정 뺌)</summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {metrics.cards.map((m) => (
            <Stat key={m.label} label={m.label} value={m.value} sub={m.sub} />
          ))}
        </div>
        <p className="mt-3 text-xs text-white/60">등급별 행운 세트</p>
        <p className="mt-1 text-sm">{metrics.byGrade.map((g) => `${g.name} ${g.count}`).join(", ")}</p>
      </details>

      <nav className="mt-5 flex flex-wrap gap-2" aria-label="관리 메뉴">
        {TABS.map(([t, label]) => (
          <Link
            key={t}
            href={t === "pending" ? "/admin" : `/admin?status=${t}`}
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm ${tab === t ? "bg-moon text-night" : "bg-white/10"}`}
          >
            {label}
            {t === "reports" && (reportCount.count ?? 0) > 0 ? ` ${reportCount.count}` : ""}
          </Link>
        ))}
      </nav>

      {!OTHER.includes(tab) && (
        <form action="/admin" className="mt-4 flex gap-2" role="search">
          {tab !== "pending" && <input type="hidden" name="status" value={tab} />}
          <label htmlFor="order-code" className="sr-only">주문번호</label>
          <input id="order-code" name="code" type="search" inputMode="numeric" maxLength={4} defaultValue={code} placeholder="송금 메모의 주문번호 4자리" className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/15 bg-night px-4 text-base" />
          <button type="submit" className="min-h-12 rounded-xl bg-moon px-5 font-cute text-night">찾기</button>
          {code && <Link href={tab === "pending" ? "/admin" : `/admin?status=${tab}`} className="inline-flex min-h-12 items-center px-2 text-sm text-moon">전체</Link>}
        </form>
      )}
      {tab === "feedback" && <FeedbackList />}
      {tab === "reports" && <ReportList />}
      {tab === "dreams" && <AdminDreamList page={params.page} />}
      {tab === "trades" && <TradeList />}

      {!OTHER.includes(tab) && error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">주문을 못 불러왔어요: {error.message}</p>}
      {OTHER.includes(tab) ? null : orders.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-white/5 p-6 text-center text-sm text-white/70">주문이 없어요</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {orders.map((o) => {
            const old = o.status === "pending" && Date.now() - Date.parse(o.created_at) > 24 * 3600_000;
            return (
              <li key={o.id} className="rounded-2xl bg-white/10 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-cute text-2xl text-moon">{o.order_code}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs ${o.status === "pending" ? "bg-moon text-night" : "bg-white/15"}`}>{STATUS[o.status]}</span>
                </div>
                <p className="mt-1 text-sm">
                  {nick.get(o.user_id)}, {o.amount_won.toLocaleString()}원 → 구슬 {o.beads.toLocaleString()}개
                </p>
                <p className="text-xs text-white/60">
                  {when(o.created_at)} 주문{o.paid_at ? `, ${when(o.paid_at)} 입금 확인` : ""}
                  {old && <span className="ml-1 text-red-600">(하루 넘게 대기)</span>}
                </p>
                <OrderActions id={o.id} code={o.order_code} status={o.status} wonLabel={`${o.amount_won.toLocaleString()}원`} />
              </li>
            );
          })}
        </ul>
      )}
      {!OTHER.includes(tab) && (
        <p className="mt-6 text-sm text-white/70">송금 메모의 4자리와 금액이 맞는지 확인한 뒤 [입금 확인]을 눌러 주세요. 환불은 구슬을 쓰지 않은 주문만 돼요.</p>
      )}
    </div>
  );
}

// "11. 3. 오후 2:05 (12분 전)": 송금 알림 시각과 맞춰 보기 쉽게
function when(iso: string) {
  const at = new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
  return `${at} (${formatAgo(Date.now() - Date.parse(iso))})`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-3">
      <p className="text-xs text-white/60">{label}</p>
      <p className="mt-1 font-cute text-lg">{value}</p>
      {sub && <p className="text-xs text-white/60">{sub}</p>}
    </div>
  );
}

type TradeRow = { id: string; dream_id: string; seller_id: string; buyer_id: string; price_type: string; price: number; cheer_message: string | null; created_at: string; dreams: { title: string | null; grade: string | null } | null };

// 거래 내역: 어떤 꿈이 누구에게서 누구에게 얼마에 팔렸는지 (최근 100건, 관리자에게는 실제 닉네임)
async function TradeList() {
  const db = createAdminClient();
  const { data, error } = await db.from("trades").select("id, dream_id, seller_id, buyer_id, price_type, price, cheer_message, created_at, dreams(title, grade)").order("created_at", { ascending: false }).limit(100);
  if (error) return <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">거래 내역을 못 불러왔어요: {error.message}</p>;
  const trades = (data ?? []) as unknown as TradeRow[];
  if (trades.length === 0) return <p className="mt-6 rounded-2xl bg-white/5 p-6 text-center text-sm text-white/70">아직 거래가 없어요</p>;
  const ids = [...new Set(trades.flatMap((t) => [t.seller_id, t.buyer_id]))];
  const { data: profiles } = await db.from("profiles").select("id, nickname").in("id", ids);
  const nick = new Map(((profiles ?? []) as { id: string; nickname: string | null }[]).map((p) => [p.id, p.nickname ?? "(닉네임 없음)"]));
  return (
    <ul className="mt-4 space-y-3">
      {trades.map((t) => (
        <li key={t.id} className="rounded-2xl bg-white/10 p-4">
          <p className="font-cute">
            <span className="text-moon">{gradeByCode(t.dreams?.grade ?? null)?.name}</span> {t.dreams?.title ?? "제목 없는 꿈"}
          </p>
          <p className="mt-1 text-sm">{nick.get(t.seller_id)} → {nick.get(t.buyer_id)}, {t.price_type === "beads" ? `구슬 ${t.price.toLocaleString()}개` : `응원 한마디${t.cheer_message ? ` “${t.cheer_message}”` : ""}`}</p>
          <p className="text-xs text-white/60">{when(t.created_at)}</p>
        </li>
      ))}
    </ul>
  );
}

type AdminDream = { id: string; title: string | null; text: string; grade: string | null; created_at: string; sale_status: string };

// 관리자 인증을 마친 뒤에만 원문을 조회해요.
async function AdminDreamList({ page }: { page?: string }) {
  const parsed = Number.parseInt(page ?? "1", 10);
  const current = Number.isFinite(parsed) ? Math.min(10000, Math.max(1, parsed)) : 1;
  const pageSize = 30;
  const { data, error } = await createAdminClient().from("dreams")
    .select("id, title, text, grade, created_at, sale_status")
    .order("created_at", { ascending: false }).range((current - 1) * pageSize, current * pageSize);
  const dreams = (data ?? []) as AdminDream[];
  if (error) return <p className="mt-4 text-sm text-red-600">꿈 목록을 불러오지 못했어요.</p>;
  return <section className="mt-5">
    <h2 className="font-title text-lg">꿈 원문</h2>
    <ul className="mt-3 space-y-3">
      {dreams.slice(0, pageSize).map(dream => <li key={dream.id} className="rounded-xl border border-white/10 p-4">
        <p className="font-medium">{dream.title ?? "제목 없는 꿈"}</p>
        <p className="mt-1 text-xs text-white/60">{gradeByCode(dream.grade)?.name ?? "등급 없음"} · {when(dream.created_at)}</p>
        <details className="mt-3 text-sm"><summary className="cursor-pointer text-moon">관리자 전용 · 꿈 원문 보기</summary><p className="mt-3 whitespace-pre-wrap leading-relaxed">{dream.text}</p></details>
      </li>)}
    </ul>
    {dreams.length === 0 && <p className="mt-3 text-sm text-white/60">표시할 꿈이 없어요.</p>}
    <nav className="mt-4 flex justify-between text-sm text-moon" aria-label="꿈 목록 페이지">
      {current > 1 ? <Link href={`/admin?status=dreams&page=${current - 1}`}>← 이전</Link> : <span />}
      {dreams.length > pageSize && <Link href={`/admin?status=dreams&page=${current + 1}`}>다음 →</Link>}
    </nav>
  </section>;
}

type ReportRow = { dream_id: string; reason: string; detail: string | null; status: string; created_at: string };
type ReportedDream = { id: string; title: string | null; grade: string | null; text: string; headline: string | null; original_owner_id: string; sale_status: string; hidden_at: string | null };

// 신고 목록: 아직 처리 안 한 신고가 있거나 숨겨진 꿈. 베낀 꿈·개인정보를 판단하려면 원문이 필요해서 관리자에게만 원문을 보여 줌
async function ReportList() {
  const db = createAdminClient();
  const [{ data: open }, { data: hiddenRows }] = await Promise.all([
    db.from("dream_reports").select("dream_id, reason, detail, status, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(300),
    db.from("dreams").select("id").not("hidden_at", "is", null).limit(100),
  ]);
  const reports = (open ?? []) as ReportRow[];
  const ids = [...new Set([...reports.map((r) => r.dream_id), ...((hiddenRows ?? []) as { id: string }[]).map((d) => d.id)])];
  if (ids.length === 0) return <p className="mt-6 rounded-2xl bg-white/5 p-6 text-center text-sm text-white/70">확인할 신고가 없어요</p>;

  const { data: dreamRows } = await db.from("dreams").select("id, title, grade, text, headline, original_owner_id, sale_status, hidden_at").in("id", ids);
  const dreams = (dreamRows ?? []) as ReportedDream[];
  const { data: profiles } = await db.from("profiles").select("id, nickname").in("id", [...new Set(dreams.map((d) => d.original_owner_id))]);
  const nick = new Map(((profiles ?? []) as { id: string; nickname: string | null }[]).map((p) => [p.id, p.nickname ?? "(닉네임 없음)"]));
  // 숨긴 꿈 먼저, 그다음 신고 많은 순
  const count = (id: string) => reports.filter((r) => r.dream_id === id).length;
  dreams.sort((a, b) => Number(!!b.hidden_at) - Number(!!a.hidden_at) || count(b.id) - count(a.id));

  return (
    <ul className="mt-4 space-y-3">
      {dreams.map((d) => {
        const mine = reports.filter((r) => r.dream_id === d.id);
        return (
          <li key={d.id} className="rounded-2xl bg-white/10 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 truncate font-cute">
                <span className="text-moon">{gradeByCode(d.grade)?.name}</span> {d.title ?? "제목 없는 꿈"}
              </p>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${d.hidden_at ? "bg-red-100 text-red-700" : "bg-white/15"}`}>
                {d.hidden_at ? "숨김" : d.sale_status === "sold" ? "팔림" : d.sale_status === "on_sale" ? "판매 중" : "보임"}
              </span>
            </div>
            <p className="mt-1 text-xs text-white/60">
              판 사람 {nick.get(d.original_owner_id)}, 처리 안 한 신고 {mine.length}건
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {mine.map((r, i) => (
                <li key={i} className="break-all">
                  🚩 {REPORT_LABEL[r.reason] ?? r.reason} <span className="text-xs text-white/60">({formatAgo(Date.now() - Date.parse(r.created_at))})</span>
                  {r.detail && <span className="block text-xs text-white/70">{r.detail}</span>}
                </li>
              ))}
            </ul>
            <details className="mt-2 text-sm">
              <summary className="flex min-h-11 cursor-pointer items-center text-white/70">꿈 원문 보기</summary>
              <p className="whitespace-pre-wrap text-white/80">{d.text}</p>
            </details>
            <ReportActions dreamId={d.id} hidden={!!d.hidden_at} />
          </li>
        );
      })}
    </ul>
  );
}
