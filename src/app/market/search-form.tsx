import Link from "next/link";
import { marketWishHref, type MarketWish } from "@/lib/market-wishes";
import { MARKET_QUERY_LIMIT, type MarketSort } from "@/lib/market-search";

export default function MarketSearchForm({ query, sort, wish, grade }: { query: string; sort: MarketSort; wish?: MarketWish; grade?: string | null }) {
  return (
    <div className="mt-5">
      <form key={query} action="/market" role="search">
        <label htmlFor="market-query" className="block text-sm text-white/75">지금 필요한 꿈을 찾아보세요</label>
        <div className="mt-2 flex items-stretch gap-2">
          <input
            id="market-query"
            name="q"
            type="search"
            defaultValue={query}
            maxLength={MARKET_QUERY_LIMIT}
            placeholder="예) 수능 찍은거 다 맞게 해주세요"
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/15 bg-night px-3 text-base placeholder:text-white/40 focus:outline-moon"
          />
          {sort === "grade" && <input type="hidden" name="sort" value="grade" />}
          {grade && <input type="hidden" name="grade" value={grade} />}
          <button type="submit" className="min-h-12 shrink-0 rounded-xl bg-moon px-4 font-cute text-night">찾기</button>
        </div>
      </form>
      <div className="mt-1 flex items-start justify-between gap-3">
        <p className="py-2 text-xs leading-relaxed text-white/60">바라는 일을 적으면 관련 운이 담긴 꿈을 찾아드려요.</p>
        {query && <Link href={(() => { const href = marketWishHref(wish, sort); return grade ? `${href}${href.includes("?") ? "&" : "?"}grade=${grade}` : href; })()} className="inline-flex min-h-11 shrink-0 items-center text-xs text-moon">검색 지우기</Link>}
      </div>
    </div>
  );
}
