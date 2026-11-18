import Link from "next/link";
import Brand from "@/app/brand";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { BEAD_REWARDS, gradeByCode } from "@/lib/grades";
import InfoTip from "@/app/info-tip";
import Landing from "@/app/landing";
import TabBar from "@/app/tab-bar";

// 로그인 상태에 따라 매번 다르게 그리는 화면
export const dynamic = "force-dynamic";

type DreamRow = { id: string; title: string | null; grade: string | null; created_at: string; sale_status: string; symbols: string[] | null };

type TradeRow = {
  id: string;
  seller_id: string;
  buyer_id: string;
  price_type: string;
  price: number;
  created_at: string;
  dream: { title: string | null; luck_tags: string[] | null; headline: string | null } | null;
};

const SALE_BADGE: Record<string, string> = { on_sale: "판매 중", sold: "판매 완료" };

export default async function Home() {
  if (!isSupabaseConfigured) return <SetupNeeded />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <Landing />;

  const { data: profile } = await supabase.from("profiles").select("nickname").eq("id", user.id).single();
  // 닉네임이 아직 없으면 첫 화면에서 이어서 닉네임을 받음 (게스트도 여기서 닉네임을 정함)
  if (!profile?.nickname) return <Landing mode="nickname" guest={user.is_anonymous} />;

  const [{ data: summary }, { data: myDreams }, { data: trades, error: tradeError }] = await Promise.all([
    supabase.rpc("my_summary").single<{ bead_balance: number }>(),
    supabase
      .from("dreams")
      .select("id, title, grade, created_at, sale_status, symbols")
      .eq("original_owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("trades")
      .select("id, seller_id, buyer_id, price_type, price, created_at, dream:dreams(title, luck_tags, headline)")
      .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .returns<TradeRow[]>()
  ]);

  const selling = (myDreams ?? []).filter((d) => d.sale_status === "on_sale");
  const sold = (trades ?? []).filter((trade) => trade.seller_id === user.id);
  const bought = (trades ?? []).filter((trade) => trade.buyer_id === user.id);
  const kept = (myDreams ?? []).filter((d) => d.sale_status !== "on_sale" && d.sale_status !== "sold");

  return (
    <div className="kk-my">
      <header className="flex items-center justify-between">
        <Brand href={null} />
        {/* 익명 계정은 로그아웃하면 다시 못 들어오므로 버튼을 숨김 */}
        {!user.is_anonymous && (
          <form action="/auth/signout" method="post">
            <button className="inline-flex min-h-11 items-center text-xs text-white/60 underline underline-offset-4">로그아웃</button>
          </form>
        )}
      </header>


      {/* 나의 당근처럼: 프로필 줄 → 꿈 올리기 → 구슬 칸 → 판 꿈·산 꿈 바로가기 → 목록 (2026-11-04) */}
      <div className="kk-profile mt-5 flex items-center gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-moon/15 font-cute text-2xl text-moon">{profile.nickname.slice(0, 1)}</span>
        <div className="min-w-0">
          <h1 className="truncate font-title text-xl font-bold">{profile.nickname} 님의</h1>
          <p className="text-sm text-white/50">꿈서랍</p>
        </div>
      </div>


      <Link
        href="/dreams/new"
        className="mt-5 block w-full rounded-lg bg-moon py-4 text-center font-cute text-lg text-night active:scale-[0.98]"
      >
        내 꿈 팔기
      </Link>

      {/* 꿈 구슬 잔액과 충전 */}
      <section className="kk-beads relative mt-3 rounded-xl border border-white/10 px-4 pt-3">
        <div className="flex items-center">
          <p className="text-xs text-white/60">꿈 구슬</p>
          <InfoTip label="꿈 구슬은 어디에 쓰나요?">
            <span className="block leading-7">
              꿈 구슬은 장터에서 꿈을 살 때 사용해요. 처음 가입하면 {BEAD_REWARDS.signupAnonymous}개를 받고,
              꿈을 기록하면 하루 {BEAD_REWARDS.dreamRecordDailyLimit}번까지 {BEAD_REWARDS.dreamRecord}개씩 받아요.
              내 꿈이 팔리면 꿈값만큼 구슬이 들어오고, 부족한 구슬은 충전할 수 있어요.
              구슬을 현금으로 바꿀 수는 없어요.
            </span>
          </InfoTip>
        </div>
        <div className="flex items-center justify-between pb-1">
          <p className="text-2xl font-bold">
            {(summary?.bead_balance ?? 0).toLocaleString()}
            <span className="ml-0.5 text-base font-normal">개</span>
          </p>
          <Link href="/beads" className="-mr-1 inline-flex min-h-10 items-center rounded-lg bg-white/5 px-4 font-cute text-sm active:scale-[0.98]">
            + 충전
          </Link>
        </div>

      </section>

      {/* 바로가기 동그라미 2개 (나의 당근의 판매내역·구매내역처럼) */}
      <nav className="kk-shortcuts mt-6 grid grid-cols-2 text-center text-sm" aria-label="내 꿈 바로가기">
        <Shortcut href="#sold" label="판 꿈" value={sold.length} />
        <Shortcut href="#bought" label="산 꿈" value={bought.length} />
      </nav>

      <section className="mt-8" aria-labelledby="trade-history-heading">
        <h2 id="trade-history-heading" className="font-title text-xl">꿈 거래내역</h2>
        {tradeError ? (
          <p className="mt-3 text-sm text-white/60">거래내역을 불러오지 못했어요. 잠시 후 다시 확인해 주세요.</p>
        ) : (
          <div className="mt-5 space-y-8">
            <TradeList id="sold" title="판 꿈" trades={sold} selling />
            <TradeList id="bought" title="산 꿈" trades={bought} />
          </div>
        )}
      </section>
      {selling.length > 0 && <DreamList title="판매 중인 꿈" showSale dreams={selling} empty="" />}
      {kept.length > 0 && <DreamList title="이전 꿈 기록" dreams={kept} empty="" />}
      {(myDreams ?? []).length === 0 && <p className="mt-8 text-center text-sm text-white/60">아직 기록한 꿈이 없어요. 첫 꿈을 올려 보세요!</p>}

      <TabBar />
    </div>
  );
}

function Shortcut({ href, label, value }: { href: string; label: string; value: number | string }) {
  return (
    <Link href={href} className="flex min-h-11 flex-col items-center gap-1.5 active:opacity-70">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-moon/10 text-lg font-bold text-moon">{value}</span>
      <span>{label}</span>
    </Link>
  );
}

// 실제 거래 금액과 공개 해몽을 정돈된 내역으로 보여줘요.
function TradeList({ id, title, trades, selling = false }: { id: string; title: string; trades: TradeRow[]; selling?: boolean }) {
  return (
    <section id={id} className="min-w-0 scroll-mt-4">
      <div className="flex items-center justify-between border-b border-white/15 pb-3">
        <h3 className="font-title text-lg">{title}</h3>
        <span className="text-xs text-white/50">{trades.length}건</span>
      </div>
      {trades.length === 0 ? (
        <p className="py-5 text-sm text-white/60">{selling ? "아직 판매가 완료된 꿈이 없어요." : "아직 구매한 꿈이 없어요."}</p>
      ) : (
        <ul className="divide-y divide-white/10">
          {trades.map((trade) => (
            <li key={trade.id}>
              <Link href={`/trades/${trade.id}`} className="block py-5 active:opacity-70">
                <div className="flex items-center justify-between gap-3 text-xs text-white/50">
                  <span>{new Date(trade.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</span>
                  <span className="text-moon">{selling ? "판매 완료" : "구매 완료"}</span>
                </div>
                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                  <p className="break-words text-base font-medium">{trade.dream?.title ?? "제목 없는 꿈"}</p>
                  <p className="text-right text-base font-medium text-moon">{trade.price_type === "beads" ? `${trade.price.toLocaleString()}구슬` : "응원 거래"}</p>
                </div>
                <p className="mt-2 text-xs text-white/60">{trade.dream?.luck_tags?.length ? trade.dream.luck_tags.join(" · ") : "기운 정보 없음"}</p>
                {trade.dream?.headline && <p className="mt-3 text-sm leading-relaxed text-white/70">{trade.dream.headline}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// 내 꿈 목록: 장터 목록처럼 왼쪽 등급 사진 자리 + 제목·날짜 (당근 판매내역처럼, 2026-11-04)
function DreamList({ id, title, dreams, empty, showSale }: { id?: string; title: string; dreams: DreamRow[]; empty: string; showSale?: boolean }) {
  return (
    <section id={id} className="kk-records min-w-0 mt-8 scroll-mt-4">
      <h2 className="font-title text-lg font-bold">{title}</h2>
      {dreams.length === 0 ? (
        <p className="mt-2 text-sm text-white/60">{empty}</p>
      ) : (
        <ul className="mt-1 divide-y divide-white/10">
          {dreams.map((d) => (
            <li key={d.id}>
              <Link href={`/dreams/${d.id}`} className="flex items-center gap-3 py-3 active:bg-white/5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{d.title ?? "제목 없는 꿈"}</span>
                  <span className="block text-xs text-white/50">
                    {gradeByCode(d.grade)?.name}
                    {" · "}
                    {new Date(d.created_at).toLocaleDateString("ko-KR")}
                  </span>
                </span>
                {showSale && SALE_BADGE[d.sale_status] && (
                  <span className={`shrink-0 rounded-md px-2 py-1 text-xs ${d.sale_status === "on_sale" ? "bg-moon/10 text-moon" : "bg-white/5 text-white/60"}`}>
                    {SALE_BADGE[d.sale_status]}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Supabase 키가 아직 없을 때 보이는 안내
function SetupNeeded() {
  return (
    <div className="rounded-2xl bg-white/10 p-5 text-sm leading-relaxed break-all">
      <p className="font-cute text-lg text-moon">🔧 설정이 필요해요</p>
      <p className="mt-2">
        <code>.env.local</code> 파일에 Supabase 주소(<code>NEXT_PUBLIC_SUPABASE_URL</code>)와 공개 키(
        <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>)를 넣고 서버를 다시 켜 주세요.
      </p>
      <p className="mt-2 text-white/60">자세한 방법은 프로젝트의 SETUP.md 파일에 있어요.</p>
    </div>
  );
}
