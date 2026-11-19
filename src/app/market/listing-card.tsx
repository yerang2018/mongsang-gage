import Link from "next/link";
import TimeAgo from "@/app/time-ago";
import type { Buzz } from "./market-ticker";
import { gradeByCode } from "@/lib/grades";
import type { MarketWish } from "@/lib/market-wishes";
import { normalizeMarketQuery, type MarketSort } from "@/lib/market-search";

// 장터 카드·방금 팔린 꿈·방금 소식 (장터 화면과 홈 화면이 같이 씀). 닉네임은 DB에서 가려져 옴(예랑 → 예*)
export type Listing = {
  dream_id: string;
  title: string;
  grade: string;
  luck_tags: string[];
  headline: string;
  price_type: "beads" | "cheer";
  price: number;
  sale_expires_at: string | null; // null = 팔릴 때까지 (24시간 규칙 없앰, 0010)
  listed_at: string;
  seller_id: string;
  seller_nickname: string;
  symbols?: string[] | null;
  luck_score?: number | null;
};
export type RecentSale = {
  dream_id: string;
  title: string;
  grade: string;
  price_type: string;
  price: number;
  sold_at: string;
  seller_nickname: string;
};

const priceText = (type: string, price: number) => (type === "beads" ? `구슬 ${price.toLocaleString()}개` : "응원 한마디");

// 내놓은 꿈 + 팔린 꿈을 최근 순으로 섞어 "방금 소식" 띠에 넣음 (등급 이름이 모두 '몽'으로 끝나 을/이로 고정)
export function buildBuzz(listings: Listing[], recent: RecentSale[]): Buzz[] {
  const items: Buzz[] = [
    ...listings.map((d) => ({
      key: `l-${d.dream_id}`,
      at: d.listed_at,
      href: `/sale/${d.dream_id}`,
      text: `${d.seller_nickname}님이 ${gradeByCode(d.grade)?.name ?? "꿈"}을 내놓았어요`,
    })),
    ...recent.map((r) => ({
      key: `s-${r.dream_id}`,
      at: r.sold_at,
      href: `/sale/${r.dream_id}`,
      text: `${r.seller_nickname}님의 ${gradeByCode(r.grade)?.name ?? "꿈"}이 ${priceText(r.price_type, r.price)}에 팔렸어요`,
    })),
  ];
  return items
    .filter((b) => b.at)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 8);
}


// 등급 색 네모 (목록 줄의 썸네일 자리). 높은 등급일수록 밝고 화려하게
// 작은 등급 썸네일은 등급 코드만 표시
const THUMB: Record<string, string> = {
  SSS: "from-[#fff1bf] to-[#f6c744] text-[#5a3d00]",
  SS: "from-[#efe7ff] to-[#b9a2f5] text-[#3b2386]",
  S: "from-[#e4ebff] to-[#9fb6f5] text-[#1d3478]",
  A: "from-[#dcf5f0] to-[#8fd3c6] text-[#0f4d45]",
  B: "from-[#f0f1f5] to-[#c9cdd8] text-[#3d4252]",
  C: "from-[#f3f3f5] to-[#dddde4] text-[#6b6b78]",
};
export const gradeTileClass = (code: string) => THUMB[code] ?? THUMB.B;
export function GradeThumb({ code, small }: { code: string; small?: boolean }) {
  return (
    <div
      className={`relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br ${THUMB[code] ?? THUMB.B} ${small ? "h-12 w-12" : "h-24 w-24"}`}
    >
      <span className={`font-cute leading-none ${small ? "text-xs" : "text-lg"}`}>{gradeByCode(code)?.name}</span>
      {!small && <span className="mt-1 text-[11px] opacity-85">{code}</span>}
    </div>
  );
}

// 방금 팔린 꿈: 중고 거래 앱의 "거래 완료"처럼 흐린 줄 + 판매 완료 딱지
export function RecentSales({ recent }: { recent: RecentSale[] }) {
  if (recent.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="font-title text-base font-bold">방금 팔린 꿈</h2>
      <ul className="mt-1 divide-y divide-white/10">
        {recent.map((r) => (
          <li key={r.dream_id} className="flex items-center gap-3 py-3">
            <div className="opacity-60">
              <GradeThumb code={r.grade} small />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-white/80">{r.title}</p>
              <p className="mt-0.5 text-xs text-white/60">
                {priceText(r.price_type, r.price)}, <TimeAgo at={r.sold_at} />
              </p>
            </div>
            <span className="shrink-0 rounded-md bg-white/10 px-2 py-1 text-xs text-white/70">판매 완료</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// 등급 딱지 (배민의 "쿠폰·신규"처럼 색깔 있는 작은 딱지)
const BADGE: Record<string, string> = {
  SSS: "bg-[#f6c744] text-[#4a3200]",
  SS: "bg-moon text-night",
  S: "bg-[#3a5bc7] text-night",
  A: "bg-[#1f9a87] text-night",
  B: "bg-[#9aa0ad] text-night",
  C: "bg-[#c4c4cc] text-night",
};
export function GradeBadge({ code }: { code: string }) {
  return <span className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${BADGE[code] ?? BADGE.B}`}>{gradeByCode(code)?.name}</span>;
}

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden className="shrink-0">
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 4.8V8l2.2 1.4" strokeLinecap="round" />
    </svg>
  );
}

// 판매 중인 꿈 한 줄 (2026-11-04 배민 목록처럼 다채롭게): 꿈 그림 네모 + 제목·등급 딱지 / ★ 점수·운 태그 / 🕐 시간 | 판 사람 | 꿈값
export function ListingRow({ d, mine, wish, query, sort }: { d: Listing; mine: boolean; wish?: MarketWish; query?: string; sort?: MarketSort }) {
  const context = new URLSearchParams();
  if (wish && d.luck_tags.includes(wish.tag)) context.set("wish", wish.id);
  const q = normalizeMarketQuery(query);
  if (q) context.set("q", q);
  if (sort === "grade") context.set("sort", sort);
  const href = `/sale/${d.dream_id}${context.size ? `?${context}` : ""}`;
  return (
    <Link href={href} className="-mx-2 flex items-center gap-4 rounded-lg px-2 py-4 active:bg-white/5">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5">
          <span className="truncate text-base font-bold">{d.title}</span>
          <GradeBadge code={d.grade} />
        </p>
        <p className="mt-1 truncate text-sm">
          {d.luck_score != null && (
            <>
              <b>{d.luck_score}점</b>{" "}
            </>
          )}
          <span className="text-white/50">{d.luck_tags.join(", ")}</span>
        </p>
        <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-white/60">
          <ClockIcon />
          {d.listed_at ? <TimeAgo at={d.listed_at} freshClassName="text-moon" /> : "판매 중"}
          <span className="text-white/20">|</span>
          <span className="truncate">{mine ? "내 꿈" : `${d.seller_nickname}님`}</span>
          <span className="text-white/20">|</span>
          <b className="shrink-0 text-white">{d.price_type === "beads" ? `${d.price.toLocaleString()}구슬` : "응원 한마디"}</b>
        </p>
      </div>
    </Link>
  );
}

// 장터 상품 카드 (2026-11-04 "거래 어플처럼": 2열 격자). 위에 등급 색 사진 자리, 아래 제목·꿈값·판 사람
export function ProductCard({ d, mine }: { d: Listing; mine: boolean }) {
  const g = gradeByCode(d.grade);
  return (
    <Link href={`/sale/${d.dream_id}`} className="block active:opacity-80">
      <div className={`relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${THUMB[d.grade] ?? THUMB.B}`}>
        <span className="font-cute text-3xl leading-none">{g?.name}</span>
        <span className="mt-1.5 text-xs opacity-85">{d.grade}등급</span>
        <span className="absolute left-2 top-2 flex gap-1">
          {mine && <span className="rounded-full bg-night/70 px-2 py-0.5 text-xs text-white">내 꿈</span>}
        </span>
        {d.luck_tags[0] && <span className="absolute bottom-2 left-2 rounded-full bg-night/50 px-2 py-0.5 text-xs text-white">#{d.luck_tags[0]}</span>}
      </div>
      <p className="mt-2 line-clamp-2 text-sm leading-snug font-bold break-keep">{d.title}</p>
      <p className="mt-1 font-cute text-lg leading-none">{d.price_type === "beads" ? `🔮 ${d.price.toLocaleString()}` : "💌 응원 한마디"}</p>
      <p className="mt-1 truncate text-xs text-white/60">
        {mine ? "내 꿈" : `${d.seller_nickname}님`}
        {d.listed_at && (
          <>
            , <TimeAgo at={d.listed_at} freshClassName="text-moon" />
          </>
        )}
      </p>
    </Link>
  );
}
