import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/next-path";
import { createClient } from "@/lib/supabase/server";
import ChargeForm from "./charge-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "구슬 충전 | 몽상가게" };

type Order = { id: string; order_code: string; amount_won: number; beads: number; status: string; created_at: string };

// 구슬 충전 (v3, 2026-11-03): 금액 고르기 → 주문번호 4자리 → 송금(메모에 번호) → 운영자 입금 확인 → 구슬 들어옴
// 2026-11-04 사용자 "토스 송금 링크로": toss.me/<아이디>/<금액> 이면 금액이 미리 채워진 채 토스가 열림. 아이디는 TOSS_ME_ID (서버에서 읽음)
// 토스 아이디가 없으면 예전 카카오페이 송금 링크(NEXT_PUBLIC_KAKAOPAY_SEND_URL), 둘 다 없으면 "준비 중". 카드 결제는 사업자 등록 뒤
export default async function BeadsPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=${encodeURIComponent("/beads")}`);

  const [{ data: summary }, { data: orderRows }] = await Promise.all([
    supabase.rpc("my_summary").single<{ bead_balance: number }>(),
    supabase.from("bead_orders").select("id, order_code, amount_won, beads, status, created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  const orders = (orderRows ?? []) as Order[];
  const pending = orders.filter((o) => o.status === "pending");
  const done = orders.filter((o) => o.status !== "pending");
  const tossId = process.env.TOSS_ME_ID?.trim().replace(/^https?:\/\/toss\.me\//, "").replace(/\/.*$/, "");
  const kakaoUrl = process.env.NEXT_PUBLIC_KAKAOPAY_SEND_URL;

  return (
    <div className="kk-charge">
      <Link href={next ?? "/"} className="-ml-1 inline-flex min-h-11 items-center px-1 text-sm text-white/70">
        ← {next ? "꿈으로 돌아가기" : "꿈 서랍"}
      </Link>
      <h1 className="mt-4 font-title text-2xl font-bold">구슬 충전</h1>
      <div className="mt-6 rounded-xl border border-moon/10 bg-moon/[0.025] p-5">
        <p className="text-xs text-white/60">보유 구슬</p>
        <p className="mt-2 text-3xl font-medium text-moon">{(summary?.bead_balance ?? 0).toLocaleString()}<span className="ml-1 text-base">개</span></p>
      </div>

      {pending.length > 0 && (
        <section className="mt-6 space-y-3">
          {pending.map((o) => (
            <div key={o.id} className="rounded-xl border border-moon/15 bg-moon/[0.025] p-5">
              <p className="text-sm text-moon">입금 대기</p>
              <p className="mt-2 text-sm">
                송금 메모에 이 번호를 꼭 적어 주세요
                <span className="mt-1 block font-cute text-4xl tracking-[0.2em] text-moon">{o.order_code}</span>
              </p>
              <p className="mt-2 text-base">
                보낼 금액 <b>{o.amount_won.toLocaleString()}원</b>, 받을 구슬 {o.beads.toLocaleString()}
              </p>
              {tossId ? (
                <a
                  href={`https://toss.me/${encodeURIComponent(tossId)}/${o.amount_won}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-[#0064ff] font-cute text-lg text-night active:scale-[0.98]"
                >
                  토스로 {o.amount_won.toLocaleString()}원 보내기
                </a>
              ) : kakaoUrl ? (
                <a
                  href={kakaoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-[#ffeb00] font-cute text-lg text-[#191919] active:scale-[0.98]"
                >
                  카카오페이로 {o.amount_won.toLocaleString()}원 보내기
                </a>
              ) : (
                <p className="mt-4 rounded-xl bg-white/10 p-3 text-center text-sm">송금 링크를 준비하고 있어요</p>
              )}
              {tossId ? (
                <p className="mt-2 text-xs text-white/60">금액은 채워져 있어요. 토스에서 받는 분에게 보낼 메모에 {o.order_code}를 적어 주세요</p>
              ) : kakaoUrl ? (
                <p className="mt-2 text-xs text-white/60">
                  카카오페이에서 <b>{o.amount_won.toLocaleString()}원</b>을 입력하고, 메모에 <b>{o.order_code}</b>를 적어 주세요
                </p>
              ) : null}
            </div>
          ))}
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-title text-lg font-bold">{pending.length > 0 ? "더 충전하기" : "얼마나 충전할까요?"}</h2>
        <p className="mt-1 text-sm text-white/70">900원에 구슬 100개. 꿈을 사고팔 땐 수수료가 없어요.</p>
        <div className="mt-3">
          <ChargeForm />
        </div>
      </section>

      <ul className="mt-6 space-y-1.5 text-sm text-white/75">
        <li>· 충전한 구슬을 쓰지 않았다면 환불해 드려요. 운영자에게 주문번호를 알려 주세요.</li>
      </ul>

      {done.length > 0 && (
        <section className="mt-6">
          <h2 className="font-title text-base font-bold">지난 충전</h2>
          <ul className="mt-2 divide-y divide-white/10 text-sm">
            {done.map((o) => (
              <li key={o.id} className="flex justify-between py-2.5">
                <span>
                  {o.order_code}, {o.amount_won.toLocaleString()}원
                </span>
                <span className="text-white/70">{o.status === "paid" ? `+${o.beads}` : o.status === "refunded" ? "환불" : "취소"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 border-t border-white/10 pt-4 text-center text-xs text-white/60">
        문의·환불 운영자 이메일{" "}
        <a href="mailto:woonyoungja@gmail.com" className="underline">
          woonyoungja@gmail.com
        </a>
      </p>
    </div>
  );
}
