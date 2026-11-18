import type { Metadata } from "next";
import Link from "next/link";
import Brand from "@/app/brand";
import { notFound } from "next/navigation";
import Countdown from "@/app/countdown";
import TimeAgo from "@/app/time-ago";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import OfferCard, { type Offer } from "./offer-card";
import OfferPicker, { type MyDream } from "./offer-picker";
import ShareRequest from "./share-request";
import { requestShareData } from "./share-data";

export const dynamic = "force-dynamic";

type DreamRequest = {
  request_id: string;
  luck_tag: string;
  message: string | null;
  status: "open" | "done";
  created_at: string;
  expires_at: string;
  requester_id: string;
  requester_nickname: string;
};

// 카톡 미리보기 제목·설명
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const r = await requestShareData((await params).id);
  if (!r) return {};
  const title = `${r.requester_nickname}님이 #${r.luck_tag} 꿈을 구해요`;
  const description = r.message ? `“${r.message}” 내 꿈을 내밀고 꿈값을 받아 보세요` : "내 꿈을 내밀고 꿈값을 받아 보세요";
  return { title: `${title} | 몽상가게`, description, openGraph: { title, description, siteName: "몽상가게", locale: "ko_KR", type: "website" } };
}

// 꿈 구해요 한 장: 링크로 누구나 봄. 친구는 자기 꿈을 내밀고, 요청한 사람은 내민 꿈 중 하나를 삼
export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSupabaseConfigured || !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: r }, { data: offerRows }, { data: auth }] = await Promise.all([
    supabase.rpc("get_dream_request", { p_request: id }).maybeSingle<DreamRequest>(),
    supabase.rpc("request_offers", { p_request: id }),
    supabase.auth.getUser(),
  ]);
  if (!r) notFound();
  const offers = (offerRows ?? []) as Offer[];
  const user = auth.user;
  const isRequester = user?.id === r.requester_id;
  const expired = new Date(r.expires_at).getTime() <= Date.now();
  const open = r.status === "open" && !expired;

  let nickname: string | null = null;
  let balance = 0;
  let myDreams: MyDream[] = [];
  let tradeId: string | null = null;
  if (user) {
    const [{ data: profile }, { data: summary }] = await Promise.all([
      supabase.from("profiles").select("nickname").eq("id", user.id).maybeSingle<{ nickname: string | null }>(),
      supabase.rpc("my_summary").single<{ bead_balance: number }>(),
    ]);
    nickname = profile?.nickname ?? null;
    balance = summary?.bead_balance ?? 0;
    if (open && !isRequester) {
      const { data } = await supabase
        .from("dreams")
        .select("id, title, grade, luck_tags, created_at")
        .eq("original_owner_id", user.id)
        .eq("owner_id", user.id)
        .eq("visibility", "shared")
        .neq("sale_status", "sold")
        .is("hidden_at", null)
        .not("grade", "is", null)
        .neq("grade", "C")
        .order("luck_score", { ascending: false });
      myDreams = (data ?? []) as MyDream[];
    }
    if (isRequester && r.status === "done") {
      const { data } = await supabase.from("trades").select("id").eq("request_id", id).maybeSingle<{ id: string }>();
      tradeId = data?.id ?? null;
    }
  }
  const myOffer = user ? offers.find((o) => o.responder_id === user.id) : undefined;
  const here = `/requests/${id}`;

  return (
    <div>
      <div className="flex items-center justify-between">
        <Brand />
        <Link href="/market" className="inline-flex min-h-11 items-center text-xs text-white/70 underline underline-offset-4">
          🏮 꿈 장터
        </Link>
      </div>

      <p className="mt-6 text-sm text-white/70">
        <b className="text-white">{isRequester ? "내가" : `${r.requester_nickname}님이`}</b> 꿈을 구해요, <TimeAgo at={r.created_at} />
      </p>
      <section className="mt-3 rounded-3xl border border-moon/40 bg-gradient-to-br from-moon/15 to-white/5 p-6 text-center">
        <p className="font-cute text-4xl text-moon">#{r.luck_tag}</p>
        <p className="mt-1 font-cute text-lg">꿈 구해요</p>
        {r.message && <p className="mt-4 text-base break-keep text-white/90">“{r.message}”</p>}
        <p className="mt-4 text-xs text-white/60">
          {r.status === "done" ? (
            "꿈을 골랐어요"
          ) : expired ? (
            "꿈 구해요 시간이 끝났어요"
          ) : (
            <Countdown until={r.expires_at} />
          )}
        </p>
      </section>

      {/* 내가 할 수 있는 일 */}
      <div className="mt-6">
        {r.status === "done" ? (
          isRequester && tradeId ? (
            <Link href={`/trades/${tradeId}`} className="block w-full rounded-2xl bg-moon py-4 text-center font-cute text-lg text-night">
              매매 증서 보기
            </Link>
          ) : (
            <Notice text="마음에 드는 꿈을 찾았대요. 고마워요!" />
          )
        ) : expired ? (
          <Notice text="꿈 구해요 시간이 끝났어요" />
        ) : isRequester ? (
          <ShareRequest path={here} tag={r.luck_tag} requestId={r.request_id} />
        ) : !user || !nickname ? (
          <div>
            <Link
              href={`/?next=${encodeURIComponent(here)}`}
              className="block w-full rounded-2xl bg-moon py-4 text-center font-cute text-lg text-night active:scale-[0.98]"
            >
              닉네임만 정하고 꿈 내밀기
            </Link>
          </div>
        ) : myOffer ? (
          <Notice text={`"${myOffer.title}" 꿈을 내밀었어요. 골라 주면 꿈값을 받아요!`} />
        ) : (
          <OfferPicker requestId={id} luckTag={r.luck_tag} dreams={myDreams} />
        )}
      </div>

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-title text-lg font-bold">내민 꿈</h2>
          <span className="text-xs text-white/60">{offers.length}개</span>
        </div>
        {offers.length === 0 ? (
          <p className="mt-2 rounded-2xl bg-white/5 p-4 text-sm text-white/60">
            {isRequester ? "아직 내민 꿈이 없어요. 링크를 친구에게 보내 보세요!" : "아직 내민 꿈이 없어요. 첫 꿈을 내밀어 보세요!"}
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {offers.map((o) => (
              <li key={o.response_id}>
                <OfferCard o={o} canBuy={isRequester && open} balance={balance} mine={o.responder_id === user?.id} />
              </li>
            ))}
          </ul>
        )}
        {offers.length > 0 && (
          <p className="mt-3 text-center text-xs text-white/60">꿈 원문과 자세한 해몽은 산 사람만 볼 수 있어요</p>
        )}
      </section>
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return <p className="rounded-2xl bg-white/10 p-4 text-center text-sm break-keep text-white/70">{text}</p>;
}
