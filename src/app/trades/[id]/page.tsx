import ExperienceFeedback from "@/app/experience-feedback";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CERTIFICATE_PHRASE, type CertificateRow } from "@/lib/certificate";
import { createClient } from "@/lib/supabase/server";
import SaveShare from "./save-share";
import PurchasedEnergy from "./purchased-energy";

// 매매 증서 화면: 판 사람·산 사람만 볼 수 있음
export default async function TradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=${encodeURIComponent(`/trades/${id}`)}`);

  const [{ data: c }, { data: trade }] = await Promise.all([
    supabase.rpc("trade_certificate", { p_trade: id }).maybeSingle<CertificateRow>(),
    supabase.from("trades").select("buyer_id").eq("id", id).maybeSingle<{ buyer_id: string }>(),
  ]);
  if (!c) notFound();
  const { data: dream } = await supabase.from("dreams").select("luck_tags, symbols").eq("id", c.dream_id).maybeSingle<{ luck_tags: string[] | null; symbols: string[] | null }>();

  const isBuyer = trade?.buyer_id === user.id;
  const imageUrl = `/trades/${id}/certificate.png?v=dream-contract-1`;

  return (
    <div>
      <h1 className="mt-4 font-title text-2xl font-bold">{isBuyer ? "🎉 꿈을 샀어요!" : "🧧 꿈을 팔았어요!"}</h1>
      <p className="mt-2 text-sm break-keep text-white/70">
        {isBuyer
          ? `“${c.title}” 꿈이 당신의 서랍에 들어왔어요.`
          : c.price_type === "beads"
            ? `${c.buyer_nickname}님이 꿈 구슬 ${c.price.toLocaleString()}개를 내고 "${c.title}" 꿈을 샀어요.`
            : `${c.buyer_nickname}님이 응원 한마디를 건네고 "${c.title}" 꿈을 샀어요.`}
      </p>
      {c.cheer_message && (
        <p className="mt-3 rounded-2xl bg-white/10 p-4 text-sm break-keep">
          <span className="block text-xs text-white/60">{isBuyer ? "내가 건넨 응원 한마디" : "받은 응원 한마디"}</span>“{c.cheer_message}”
        </p>
      )}

      <ExperienceFeedback kind="trade" localKey={id} />

      <h2 className="mt-8 font-title text-lg font-bold">꿈 양도·양수 계약서</h2>
      <p className="mt-1 text-sm break-keep text-white/70">{CERTIFICATE_PHRASE}</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- 서버가 그린 증서 그림을 그대로 보여 줌 */}
      <img src={imageUrl} alt={`${c.title} 꿈 매매 증서`} width={1080} height={1528} className="mt-4 w-full bg-night" />

      <SaveShare imageUrl={imageUrl} title={c.title} tradeId={id} />

      {isBuyer && <PurchasedEnergy buyerName={c.buyer_nickname} tags={dream?.luck_tags ?? []} symbols={dream?.symbols ?? []} />}
      <div className="mt-7 grid grid-cols-2 gap-3">
        <Link href="/" className="flex min-h-12 items-center justify-center rounded-xl bg-moon px-3 text-sm font-medium text-night">내 꿈서랍으로 가기</Link>
        <Link href="/market" className="flex min-h-12 items-center justify-center rounded-xl border border-moon/25 px-3 text-sm font-medium text-moon">장터 더 둘러보기</Link>
      </div>
    </div>
  );
}
