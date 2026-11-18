import ExperienceFeedback from "@/app/experience-feedback";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Reading } from "@/lib/dream";
import ReadingSections from "@/app/reading-sections";
import GradeLadder from "@/app/grade-ladder";
import { gradeByCode } from "@/lib/grades";
import { createClient } from "@/lib/supabase/server";
import { formatKoreanDate } from "@/lib/time";
import GradeReveal from "./grade-reveal";
import { SellButton, SharePanel } from "./sell-panel";
import DreamHero from "@/app/dream-hero";

type DreamRow = {
  id: string;
  owner_id: string;
  original_owner_id: string;
  text: string;
  title: string;
  symbols: string[];
  luck_score: number;
  grade: string;
  luck_tags: string[];
  headline: string;
  interpretation: string;
  visibility: "private" | "shared";
  created_at: string;
  sale_status: "none" | "on_sale" | "sold";
  sale_expires_at: string | null;
  reading: Reading | null;
  hidden_at: string | null; // 신고로 숨김 (0015)
};

type TradeRow = { id: string; seller_id: string; buyer_id: string; created_at: string };

export default async function DreamResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ beads?: string; new?: string }>;
}) {
  const { id } = await params;
  const { beads, new: isNew } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=${encodeURIComponent(`/dreams/${id}`)}`);

  const { data: dream } = await supabase.from("dreams").select("*").eq("id", id).maybeSingle<DreamRow>();
  if (!dream) notFound();

  const grade = gradeByCode(dream.grade);
  const isSeller = dream.original_owner_id === user.id; // 내가 꾼 꿈 (팔았어도)
  const isBuyer = dream.owner_id === user.id && !isSeller; // 친구에게 산 꿈

  // 팔린 꿈이면 거래 정보와 상대 닉네임
  let trade: TradeRow | null = null;
  let partnerNickname = "";
  if (dream.sale_status === "sold") {
    const { data } = await supabase.from("trades").select("id, seller_id, buyer_id, created_at").eq("dream_id", id).maybeSingle<TradeRow>();
    trade = data;
    if (trade) {
      const partnerId = isSeller ? trade.buyer_id : trade.seller_id;
      const { data: p } = await supabase.from("profiles").select("nickname").eq("id", partnerId).maybeSingle<{ nickname: string }>();
      partnerNickname = p?.nickname ?? "친구";
    }
  }

  return (
    <div>
      <Link href="/" className="-ml-1 inline-flex min-h-11 items-center px-1 text-sm text-white/70">
        ← 꿈 서랍
      </Link>

      {beads && <p className="mt-3 rounded-xl bg-moon/15 p-3 text-sm text-moon">꿈 기록 선물로 구슬 {beads}개를 받았어요 🔮</p>}

      <GradeReveal sealed={!!isNew && !isBuyer} gradeName={grade?.name ?? "해몽 완료"} score={dream.luck_score} rare={!!grade && ["SSS", "SS", "S"].includes(grade.code)}>
      {/* 당근·배민 상세처럼 (2026-11-04): 위 큰 사진 → 산 사람/꾼 사람 줄 → 제목·운 태그·해몽 한 줄 → 자세한 해몽 */}
      <div className="mt-2">
        <DreamHero grade={dream.grade} score={dream.luck_score} />
      </div>

      <div className="flex items-center gap-3 border-b border-white/10 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-moon/15 font-cute text-moon">
          {(isBuyer ? partnerNickname : "나").slice(0, 1)}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm">
          {isBuyer && trade ? (
            <>
              <b>{partnerNickname}님</b>에게 {formatKoreanDate(trade.created_at)}에 산 꿈
            </>
          ) : (
            <>
              <b>내가 꾼 꿈</b> · {formatKoreanDate(dream.created_at)}
            </>
          )}
        </p>
      </div>

      <section className="py-5">
        <p className="text-sm text-white/60">꿈 해몽</p>
        <h1 className="mt-1 font-title text-xl font-bold leading-snug break-keep">{dream.title}</h1>
        <p className="mt-1 text-sm text-white/50">
          {[...dream.luck_tags.map((t) => `#${t}`), ...dream.symbols].join(" · ")}
        </p>
        <p className="mt-4 text-base leading-relaxed break-keep">“{dream.headline}”</p>
      </section>

      <GradeLadder current={dream.grade} />

      <ReadingSections dream={dream} gradeName={grade?.name} />
      <ExperienceFeedback kind="reading" localKey={dream.id} />
      {trade && <ExperienceFeedback kind="trade" localKey={trade.id} />}

      <details className="mt-4 rounded-2xl bg-white/5 p-5 text-sm leading-relaxed">
        <summary className="flex min-h-11 cursor-pointer items-center font-cute text-white/70">{isBuyer ? "친구가 꾼 꿈 원문 보기" : "내가 적은 꿈 보기"}</summary>
        <p className="mt-3 whitespace-pre-wrap text-white/80">{dream.text}</p>
      </details>

      <div className="mt-6">
        {isBuyer && trade && <CertificateLink tradeId={trade.id} />}
        {isSeller && <SellerSection dream={dream} grade={grade} trade={trade} buyerNickname={partnerNickname} />}
      </div>
      <Link href="/market" className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl border border-moon/30 font-cute text-moon">꿈장터로 가기</Link>
      </GradeReveal>
    </div>
  );
}

function CertificateLink({ tradeId }: { tradeId: string }) {
  return (
    <Link
      href={`/trades/${tradeId}`}
      className="block w-full rounded-2xl bg-moon py-4 text-center font-cute text-lg text-night active:scale-[0.98]"
    >
      📜 매매 증서 보기
    </Link>
  );
}

// 판매자 화면: 상태에 따라 [팔기] / 공유 패널 / 팔림 / 못 팖 안내
function SellerSection({
  dream,
  grade,
  trade,
  buyerNickname,
}: {
  dream: DreamRow;
  grade: ReturnType<typeof gradeByCode>;
  trade: TradeRow | null;
  buyerNickname: string;
}) {
  const note = (text: string) => <p className="pt-2 text-center text-sm text-white/60">{text}</p>;

  if (dream.sale_status === "sold" && trade) {
    return (
      <div className="space-y-3">
        <p className="rounded-2xl bg-moon/15 p-4 text-center text-sm text-moon">🎉 {buyerNickname}님이 이 꿈을 샀어요!</p>
        <CertificateLink tradeId={trade.id} />
      </div>
    );
  }
  if (!grade || grade.priceType === "none") return note("액땜몽은 팔 수 없어요. 나쁜 기운은 여기서 털고 가요 🍃");
  if (dream.hidden_at) return note("신고가 들어와 운영자가 확인 중이에요. 확인이 끝날 때까지 장터에 보이지 않아요.");
  // 24시간 규칙은 없앰(0010): 언제든 팔 수 있고 팔릴 때까지 장터에. 마감이 남아 있는 예전 꿈만 시간 표시
  if (dream.sale_status === "on_sale") {
    if (dream.sale_expires_at && new Date(dream.sale_expires_at).getTime() <= Date.now()) return note("판매가 종료된 꿈이에요.");
    return <SharePanel dreamId={dream.id} title={dream.title} expiresAt={dream.sale_expires_at} />;
  }
  return (
    <SellButton
      dreamId={dream.id}
      price={grade.price}
    />
  );
}
