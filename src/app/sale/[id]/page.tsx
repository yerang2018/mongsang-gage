import type { Metadata } from "next";
import Link from "next/link";
import Brand from "@/app/brand";
import { notFound } from "next/navigation";
import Countdown from "@/app/countdown";
import { gradeByCode } from "@/lib/grades";
import BuyerGets from "@/app/buyer-gets";
import ShareButtons from "@/app/share-buttons";
import DreamHero from "@/app/dream-hero";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import BuyForm, { type Viewer } from "./buy-form";
import { saleShareData } from "./share-data";
import { marketWishById, marketWishHref } from "@/lib/market-wishes";
import { normalizeMarketQuery, resolveMarketSort } from "@/lib/market-search";

export const dynamic = "force-dynamic";

type SaleCard = {
  dream_id: string;
  title: string;
  grade: string;
  luck_tags: string[];
  headline: string;
  price_type: "beads" | "cheer";
  price: number;
  sale_status: "on_sale" | "sold";
  sale_expires_at: string | null;
  expired: boolean;
  seller_id: string;
  seller_nickname: string;
  has_reading: boolean;
  symbols?: string[] | null; // 0016부터
  luck_score?: number | null;
};

// 카톡 미리보기 제목·설명: "대길몽, 돼지와 입맞춤한 꿈" / "해몽 한 줄, 구슬 700개"
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const d = await saleShareData((await params).id);
  if (!d) return {};
  const title = `${d.gradeName}, ${d.title}`;
  const description = `${d.headline} (${d.price}${d.sale_status === "sold" ? ", 이미 팔린 꿈" : ""})`;
  return { title: `${title} | 몽상가게`, description, openGraph: { title, description, siteName: "몽상가게", locale: "ko_KR", type: "website" } };
}

// 판매 카드: 공유 링크로 열리는 화면. 로그인 안 해도 볼 수 있고, 꿈 원문·상세 해몽은 산 사람(과 꿈꾼 사람)만 봄.
// 원문·해몽은 get_sale_card가 아예 돌려주지 않음 (화면에서 가리는 게 아니라 HTML에도 없음). 산 사람은 /dreams/[id]에서 봄(DB 보안 규칙)
// 상태(판매 중·판매 완료·판매 마감) × 보는 사람(판 사람·산 사람·다른 사람)에 맞춰 제목·안내·버튼을 고름
export default async function SaleCardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ wish?: string; q?: string; sort?: string; preview?: string }> }) {
  const { id } = await params;
  if (!isSupabaseConfigured || !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: card } = await supabase.rpc("get_sale_card", { p_dream: id }).maybeSingle<SaleCard>();
  if (!card) notFound();
  const context = await searchParams;
  const selectedWish = marketWishById(context.wish);
  const wish = selectedWish && card.luck_tags.includes(selectedWish.tag) ? selectedWish : undefined;
  const query = normalizeMarketQuery(context.q);
  const sort = resolveMarketSort(context.sort);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const status: SaleState = card.sale_status === "sold" ? "sold" : card.expired ? "ended" : "on_sale";
  let viewer: Viewer = { kind: "guest" };
  let tradeId: string | null = null;
  let isBuyer = false;
  if (user) {
    const [{ data: profile }, { data: summary }, { data: trade }] = await Promise.all([
      supabase.from("profiles").select("nickname").eq("id", user.id).maybeSingle<{ nickname: string | null }>(),
      supabase.rpc("my_summary").single<{ bead_balance: number }>(),
      // 거래 줄은 판 사람·산 사람에게만 보임 (RLS) → 다른 사람에겐 항상 null
      status === "sold"
        ? supabase.from("trades").select("id, buyer_id").eq("dream_id", id).maybeSingle<{ id: string; buyer_id: string }>()
        : Promise.resolve({ data: null }),
    ]);
    tradeId = trade?.id ?? null;
    isBuyer = trade?.buyer_id === user.id;
    if (user.id === card.seller_id) viewer = { kind: "seller" };
    else if (!profile?.nickname) viewer = { kind: "no_nickname" };
    else viewer = { kind: "member", balance: summary?.bead_balance ?? 0 };
  }
  const preview = context.preview === "1" && user?.id === card.seller_id;
  if (preview) viewer = { kind: "guest" };
  const isSeller = viewer.kind === "seller";
  // 일반 방문자와 친구 미리보기에는 원문을 절대 전달하지 않아요.
  const admin = user && !preview ? await getAdmin() : null;
  const { data: adminDream } = admin
    ? await createAdminClient().from("dreams").select("text").eq("id", id).maybeSingle<{ text: string }>()
    : { data: null };


  const grade = gradeByCode(card.grade);
  const priceLabel = card.price_type === "beads" ? `${card.price.toLocaleString()}구슬` : "응원 한마디";
  const shareText = `🌙 "${card.title}" ${grade?.name ?? "꿈"}, 몽상가게 꿈 장터에 나왔어!`;
  const headline =
    status === "on_sale"
      ? isSeller
        ? "내가 내놓은 꿈이에요"
        : `${card.seller_nickname}님이 꿈을 팔고 있어요`
      : status === "sold"
        ? isBuyer
          ? "내가 산 꿈이에요"
          : isSeller
            ? "내 꿈이 팔렸어요"
            : `${card.seller_nickname}님의 꿈, 이미 팔렸어요`
        : `${card.seller_nickname}님의 꿈, 판매가 끝났어요`;

  const sellerName = isSeller ? "내 꿈" : `${card.seller_nickname}님`;

  // 당근 상세처럼 (2026-11-04): 위 큰 등급 그림 → 판 사람 줄 → 제목·운 태그·해몽 한 줄 → (사는 사람이면) 아래 고정 [꿈값 | 꿈 사기]
  return (
    <div>
      {preview && <aside className="mb-4 rounded-xl border border-moon/30 bg-moon/10 p-4">
        <p className="font-cute text-moon">친구가 보는 구매 화면</p>
        <p className="mt-1 text-xs leading-relaxed text-white/70">로그인하지 않은 친구가 판매 링크를 열었을 때의 화면이에요. 구매하면 친구에게 보내거나 직접 간직할 수 있어요.</p>
        <Link href={`/dreams/${id}`} className="mt-2 inline-flex min-h-11 items-center text-sm text-moon underline">미리보기 닫기</Link>
      </aside>}
      <div className="flex items-center justify-between">
        <Link href={marketWishHref(wish, sort, query)} className="-ml-1 inline-flex min-h-11 items-center px-1 text-sm text-white/70">
          ‹ 장터
        </Link>
        <Brand href="/" />
      </div>

      <div className="mt-2">
        <DreamHero grade={card.grade} score={card.luck_score} />
      </div>

      <div className="flex items-center gap-3 border-b border-white/10 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-moon/15 font-cute text-moon">{card.seller_nickname.slice(0, 1)}</span>
        <p className="min-w-0 flex-1 truncate font-bold">{sellerName}</p>
        <StateBadge status={status} />
      </div>

      {admin && adminDream && (
        <details className="mt-4 rounded-xl border border-moon/20 bg-moon/5 p-4 text-sm">
          <summary className="cursor-pointer font-medium text-moon">관리자 전용 · 꿈 원문 보기</summary>
          <p className="mt-3 whitespace-pre-wrap leading-relaxed">{adminDream.text}</p>
        </details>
      )}
      <section className="py-5">
        <p className="text-sm text-white/60">{headline}</p>
        <h1 className="mt-1 font-title text-xl font-bold leading-snug break-keep">{card.title}</h1>
        <p className="mt-1 text-sm text-white/50">{card.luck_tags.map((t) => `#${t}`).join(" ")}</p>
        {wish && (
          <aside className="mt-4 rounded-xl border border-moon/10 bg-moon/5 px-4 py-3">
            <p className="text-xs font-bold text-moon">{wish.label}</p>
            <p className="mt-1 text-sm leading-relaxed break-keep text-white/75">{wish.saleLine}</p>
          </aside>
        )}
        <p className="mt-4 text-base leading-relaxed break-keep">“{card.headline}”</p>
        {!(status === "on_sale" && !isSeller) && (
          <p className={`mt-4 text-lg font-bold ${status === "on_sale" ? "" : "text-white/50 line-through decoration-1"}`}>{priceLabel}</p>
        )}
        {status === "on_sale" && card.sale_expires_at && <Countdown until={card.sale_expires_at} className="mt-1 block text-xs text-white/60" />}
      </section>

      <div className="mt-5">
        {status === "on_sale" ? (
          isSeller ? (
            <div className="space-y-3 rounded-2xl border border-moon/40 bg-moon/10 p-5">
              <p className="font-cute text-lg text-moon">공유하기</p>
              <p className="text-sm break-keep text-white/70">장터에도 올라가 있어요. 꿈이 필요한 친구에게 링크를 보내 보세요. 자기 꿈은 자기가 살 수 없어요.</p>
              <ShareButtons target="sale" id={card.dream_id} path={`/sale/${card.dream_id}`} title="몽상가게 · 꿈 팔아요" text={shareText} label="공유하기" />
              <Link href={`/dreams/${card.dream_id}`} className="flex min-h-11 items-center justify-center text-sm text-white/70 underline underline-offset-4">
                내 꿈 해몽 보기
              </Link>
            </div>
          ) : (
            <div>
              {preview ? <div className="rounded-2xl bg-white/5 p-4"><p className="mb-3 text-sm">{priceLabel}</p><button type="button" disabled className="min-h-12 w-full rounded-xl bg-moon font-cute text-night">닉네임만 정하고 꿈 사기</button><p className="mt-2 text-center text-xs text-white/60">미리보기에서는 구매할 수 없어요</p></div> : <BuyForm bar dreamId={card.dream_id} priceType={card.price_type} price={card.price} viewer={viewer} />}

            </div>
          )
        ) : isBuyer && tradeId ? (
          <div className="space-y-2">
            <Link href={`/dreams/${card.dream_id}`} className="block w-full rounded-2xl bg-moon py-4 text-center font-cute text-lg text-night active:scale-[0.98]">
              산 꿈 해몽 전체 보기
            </Link>
            <Link href={`/trades/${tradeId}`} className="block w-full rounded-2xl bg-white/10 py-4 text-center font-cute text-lg active:scale-[0.98]">
              📜 매매 증서 보기
            </Link>
          </div>
        ) : isSeller ? (
          <div className="space-y-2">
            <p className="rounded-2xl bg-moon/10 p-4 text-center text-sm text-moon">
              {status === "sold" ? "🎉 친구가 이 꿈을 샀어요!" : "판매 시간이 끝나 내가 간직하는 꿈이에요"}
            </p>
            {tradeId && (
              <Link href={`/trades/${tradeId}`} className="block w-full rounded-2xl bg-moon py-4 text-center font-cute text-lg text-night active:scale-[0.98]">
                📜 매매 증서 보기
              </Link>
            )}
            <Link href={`/dreams/${card.dream_id}`} className="block w-full rounded-2xl bg-white/10 py-4 text-center font-cute text-lg active:scale-[0.98]">
              내 꿈 해몽 보기
            </Link>
          </div>
        ) : (
          <Closed text={status === "sold" ? "이미 다른 친구가 산 꿈이에요. 꿈은 한 사람만 살 수 있어요." : "판매가 끝난 꿈이에요."} signedIn={viewer.kind === "member"} />
        )}
      </div>

      {!isBuyer && (
        <div className="mt-5">
          <BuyerGets tags={card.luck_tags} />
        </div>
      )}


    </div>
  );
}

type SaleState = "on_sale" | "sold" | "ended";

function StateBadge({ status }: { status: SaleState }) {
  const [label, cls] =
    status === "on_sale" ? ["판매 중", "bg-moon text-night"] : status === "sold" ? ["판매 완료", "bg-white/20 text-white"] : ["판매 마감", "bg-white/10 text-white/70"];
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{label}</span>;
}

// 팔린 꿈·끝난 꿈 링크로 온 사람: 막히지 않게 다른 꿈 보기·내 꿈 팔기로 이어 줌
function Closed({ text, signedIn }: { text: string; signedIn: boolean }) {
  return (
    <div className="space-y-2">
      <p className="rounded-2xl bg-white/10 p-4 text-center text-sm break-keep text-white/80">{text}</p>
      <Link href="/market" className="block w-full rounded-2xl bg-moon py-4 text-center font-cute text-lg text-night active:scale-[0.98]">
        장터에서 다른 꿈 보기
      </Link>
      <Link href={signedIn ? "/dreams/new" : "/"} className="flex min-h-12 items-center justify-center rounded-xl bg-white/10 font-cute active:scale-[0.98]">
        내 꿈 팔기
      </Link>
    </div>
  );
}
