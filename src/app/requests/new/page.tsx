import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RequestForm from "./request-form";
import { marketWishById, marketWishHref, wishRequestHref } from "@/lib/market-wishes";

export const dynamic = "force-dynamic";

// 꿈 구하기: 어떤 운이 필요한지 + 하고 싶은 말. 한 번에 하나만 열어 둘 수 있음
export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ wish?: string }> }) {
  const wish = marketWishById((await searchParams).wish);
  const next = wishRequestHref(wish);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/?next=${encodeURIComponent(next)}`);
  const { data: profile } = await supabase.from("profiles").select("nickname").eq("id", user.id).single();
  if (!profile?.nickname) redirect(`/?next=${encodeURIComponent(next)}`);

  const { data: open } = await supabase
    .from("dream_requests")
    .select("id")
    .eq("requester_id", user.id)
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<{ id: string }>();

  return (
    <div>
      <Link href={marketWishHref(wish)} className="-ml-1 inline-flex min-h-11 items-center px-1 text-sm text-white/70">
        ← 꿈 장터
      </Link>
      <h1 className="mt-4 font-title text-2xl font-bold">어떤 꿈이 필요해요?</h1>
      <p className="mt-2 text-sm leading-relaxed break-keep text-white/70">
        친구들이 자기 꿈 중에서 골라 내밀어 줘요. 마음에 드는 꿈을 하나 사면 끝나요.
      </p>
      {open ? (
        <div className="mt-6 rounded-2xl bg-white/10 p-5 text-center text-sm text-white/70">
          <p>이미 꿈을 구하고 있어요. 지금 요청이 끝나면 새로 구할 수 있어요.</p>
          <Link
            href={`/requests/${open.id}`}
            className="mt-4 inline-flex min-h-11 items-center rounded-full bg-moon px-5 font-cute text-night active:scale-[0.98]"
          >
            내 꿈 구해요 보러 가기
          </Link>
        </div>
      ) : (
        <RequestForm initialTag={wish?.tag} initialMessage={wish?.requestMessage} />
      )}
    </div>
  );
}
