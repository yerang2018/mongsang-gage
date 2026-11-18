import Link from "next/link";

export type OpenRequest = {
  request_id: string;
  luck_tag: string;
  message: string | null;
  created_at: string;
  expires_at: string;
  requester_id: string;
  requester_nickname: string;
  offer_count: number;
};

// 장터 안의 "꿈 구해요" 줄: 제목 옆 [나도 꿈 구하기] + 옆으로 넘겨 보는 "구해요" 쪽지들
// (2026-10-29 "+ 카드는 뭔가를 올리는 느낌" → 구하는 쪽지 모양으로)
export default function RequestStrip({ requests, me, requestHref = "/requests/new" }: { requests: OpenRequest[]; me?: string; requestHref?: string }) {
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-title text-base font-bold">꿈 구해요</h2>
          <p className="text-xs text-white/60">{requests.length > 0 ? `${requests.length}명이 좋은 꿈을 기다려요` : "필요한 운을 알려 주면 친구들이 꿈을 내밀어요"}</p>
        </div>
        <Link
          href={requestHref}
          className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-moon/15 px-4 font-cute text-sm text-moon ring-1 ring-moon/40 active:scale-[0.98]"
        >
          나도 꿈 구하기
        </Link>
      </div>
      {requests.length > 0 && (
        <div className="kk-noscroll -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
          {requests.map((r) => (
            <Link
              key={r.request_id}
              href={`/requests/${r.request_id}`}
              className="flex w-48 shrink-0 flex-col rounded-2xl border border-moon/25 bg-white/10 p-3 active:scale-[0.98]"
            >
              <span className="self-start rounded-full bg-moon px-2 py-0.5 font-cute text-xs text-night">구해요</span>
              <span className="mt-2 font-cute text-xl text-moon">#{r.luck_tag} 꿈</span>
              <span className="mt-1 line-clamp-2 min-h-10 text-sm break-keep text-white/80">“{r.message ?? "좋은 꿈 나눠 주세요!"}”</span>
              <span className="mt-2 text-xs text-white/60">
                {r.requester_id === me ? "내 요청" : `${r.requester_nickname}님`}, 내민 꿈 {r.offer_count}개
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
