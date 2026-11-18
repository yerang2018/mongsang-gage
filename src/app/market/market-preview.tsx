import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildBuzz, ListingRow, type Listing, type RecentSale } from "./listing-card";
import MarketTicker from "./market-ticker";
import { DEFAULT_MARKET_SORT, sortMarketListings } from "@/lib/market-search";

// 홈 화면의 "지금 장터": 방금 소식 띠 + 새로 나온 꿈 3줄, 제목 옆 [전체 N개 ›]
// 2026-11-04 혼잡함 줄이기: 큰 [장터 전체 보기] 버튼·방금 팔린 꿈 목록은 뺌 (방금 소식 띠와 /market에 있음)
// compact: 첫 화면용 (2줄)
export default async function MarketPreview({ me, compact }: { me?: string; compact?: boolean }) {
  const supabase = await createClient();
  const [listingsRes, recentRes] = await Promise.all([
    supabase.rpc("market_listings", { p_tag: null, p_sort: DEFAULT_MARKET_SORT }),
    supabase.rpc("market_recent_sales"),
  ]);
  const listings = sortMarketListings((listingsRes.data ?? []) as Listing[], DEFAULT_MARKET_SORT);
  const sales = (recentRes.data ?? []) as RecentSale[];

  return (
    <section className="mt-8 text-left">
      <div className="flex items-center justify-between">
        <h2 className="font-title text-lg font-bold">🏮 지금 장터</h2>
        {listings.length > 0 && (
          <Link href="/market" className="-mr-1 inline-flex min-h-11 items-center px-1 text-sm text-moon">
            전체 {listings.length}개 ›
          </Link>
        )}
      </div>
      <MarketTicker items={buildBuzz(listings, sales)} />

      {listings.length === 0 ? (
        <div className="mt-2 rounded-2xl bg-white/5 p-5 text-center text-sm text-white/60">
          <p>아직 장터에 나온 꿈이 없어요. 첫 꿈을 걸어 보세요!</p>
          <Link
            href={me ? "/dreams/new" : "/"}
            className="mt-3 inline-flex min-h-11 items-center rounded-full bg-moon px-5 font-cute text-night active:scale-[0.98]"
          >
            내 꿈 팔기
          </Link>
        </div>
      ) : (
        <ul className="mt-1 divide-y divide-white/10">
          {listings.slice(0, compact ? 2 : 3).map((d) => (
            <li key={d.dream_id}>
              <ListingRow d={d} mine={d.seller_id === me} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
