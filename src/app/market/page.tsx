import Link from "next/link";
import Brand from "@/app/brand";
import TabBar from "@/app/tab-bar";
import { MARKET_WISHES, marketWishHref, resolveMarketWish, wishRequestHref } from "@/lib/market-wishes";
import { buildBuzz, ListingRow, RecentSales, type Listing, type RecentSale } from "./listing-card";
import MarketTicker from "./market-ticker";
import RequestStrip, { type OpenRequest } from "./request-strip";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import MarketSearchForm from "./search-form";
import GradeSelect from "./grade-select";
import { analyzeMarketQuery, resolveMarketGrade, resolveMarketSort, searchMarketListings, sortMarketListings } from "@/lib/market-search";
import { GRADES } from "@/lib/grades";

export const dynamic = "force-dynamic";

const SORTS = [
  ["new", "최신순"],
  ["grade", "등급순"],
] as const;

// 공개 꿈 장터: 판매 중인 꿈을 누구나 둘러봄. 카드를 누르면 판매 카드(/sale/[id])로
export default async function MarketPage({ searchParams }: { searchParams: Promise<{ wish?: string; tag?: string; sort?: string; q?: string; all?: string; grade?: string }> }) {
  const sp = await searchParams;
  const wish = resolveMarketWish(sp);
  const tag = wish?.tag ?? null;
  const sort = resolveMarketSort(sp.sort);
  const search = analyzeMarketQuery(sp.q);
  const gradeFilter = resolveMarketGrade(sp.grade); // 고른 꿈 등급 (없으면 전체)
  // 주소에 등급 선택을 붙여 줌. 등급을 바꾸거나 정렬·추천 검색어를 눌러도 선택이 유지되게
  const withGrade = (href: string, code: string | null = gradeFilter) => (code ? `${href}${href.includes("?") ? "&" : "?"}grade=${code}` : href);

  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const searchTags = tag ? [tag] : search.tags.length ? search.tags : [null];
  const [listingResults, recentRes, requestsRes, { data: auth }] = await Promise.all([
    Promise.all(searchTags.map((searchTag) => supabase.rpc("market_listings", { p_tag: searchTag, p_sort: sort }))),
    supabase.rpc("market_recent_sales"),
    supabase.rpc("open_dream_requests"),
    supabase.auth.getUser(),
  ]);
  const listingError = listingResults.some((result) => result.error);
  const pool = [...new Map(listingResults.flatMap((result) => (result.data ?? []) as Listing[]).map((dream) => [dream.dream_id, dream])).values()];
  const allListings = sortMarketListings(searchMarketListings(pool, search.query), sort);
  const listings = gradeFilter ? allListings.filter((d) => d.grade === gradeFilter) : allListings;
  const gradeName = GRADES.find((g) => g.code === gradeFilter)?.name;
  const visibleListings = sp.all === "1" ? listings : listings.slice(0, 10);
  const baseHref = withGrade(marketWishHref(wish, sort, search.query));
  const allHref = `${baseHref}${baseHref.includes("?") ? "&" : "?"}all=1`;
  const recent = (recentRes.data ?? []) as RecentSale[];
  const requests = ((requestsRes.data ?? []) as OpenRequest[]).filter((request) => !search.query || !search.tags.length || search.tags.some((value) => value === request.luck_tag));
  const me = auth.user?.id;
  const requestWish = wish ?? (search.tags.length === 1 ? resolveMarketWish({ tag: search.tags[0] }) : undefined);
  const requestHref = wishRequestHref(requestWish);

  return (
    <div className="kk-market">
      <header className="flex items-center justify-between">
        <Brand />
        {/* 로그인했으면 아래 탭(MY)으로 돌아감 */}
        {!me && (
          <Link href="/" className="inline-flex min-h-11 items-center text-xs text-white/70 underline underline-offset-4">
            나도 시작하기
          </Link>
        )}
      </header>

      <div className="kk-market-news"><MarketTicker items={buildBuzz(allListings, recent, requests)} /></div>
      <div className="kk-market-heading mt-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="font-title text-[28px] font-bold leading-snug">꿈 장터</h1>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-moon/65">
            <path d="M18.4 14.4A7.6 7.6 0 0 1 9.6 5.6 7.7 7.7 0 1 0 18.4 14.4Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M18 3.5v4M16 5.5h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        </div>
        <Link href="/grades" className="inline-flex min-h-11 items-center gap-1 text-sm text-white/60">
          등급 안내 ›
        </Link>
      </div>
      <MarketSearchForm query={search.query} sort={sort} wish={wish} grade={gradeFilter} />
      {!search.query && <section className="mt-5" aria-labelledby="market-wish-heading">
        <div className="flex items-center justify-between gap-3">
          <p id="market-wish-heading" className="text-sm text-white/75">추천 검색어</p>

        </div>
        <nav className="kk-market-wishes" aria-label="추천 검색어">
          {MARKET_WISHES.map((item) => (
            <Link
              key={item.id}
              href={withGrade(marketWishHref(item, sort))}
              aria-label={item.label}
              aria-current={wish?.id === item.id ? "page" : undefined}
              className="kk-market-wish"
            >
              {item.lines.map((line) => <span key={line} className="block">{line}</span>)}
            </Link>
          ))}
        </nav>
      </section>}

      {wish && (
        <section className="kk-market-wish-story" aria-labelledby="selected-wish-heading">
          <p className="text-xs font-bold text-moon">{wish.label}</p>
          <h2 id="selected-wish-heading" className="mt-2 text-xl font-bold leading-relaxed break-keep">{wish.title}</h2>
          <p className="mt-2 text-sm leading-relaxed break-keep text-white/70">{wish.description}</p>
        </section>
      )}

      {search.query && (
        <section className="mt-4 rounded-xl bg-moon/5 px-4 py-3" aria-label="검색 기준">
          <p className="break-words text-sm text-white/85">“{search.query}” 검색 결과</p>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            {search.tags.length ? `${search.tags.map((value) => `#${value}`).join(" · ")}이 붙은 꿈을 찾았어요.` : "꿈 제목과 상징, 공개된 해몽 한 줄에서 찾았어요."}
          </p>
        </section>
      )}

      {/* 정렬은 마음을 고른 뒤에도 유지하고, 목록을 내려 볼 때 위에 붙어요. */}
      <div className="kk-market-filters sticky top-0 z-30 -mx-5 mt-4 border-b border-white/10 bg-background/95 px-5 backdrop-blur">
        <p className="pt-3 text-xs text-white/60">{gradeName ? `${gradeName} · ` : ""}{search.query ? "검색 결과" : tag ? `${tag} 꿈` : "판매 중"} {listings.length}개</p>
        <div className="flex items-center justify-between gap-1">
          {/* 꿈 등급 고르기: 맨 왼쪽의 선택 상자. 하나를 고르면 그 등급만 보이고, "전체 등급"으로 돌아올 수 있어요. */}
          <GradeSelect
            value={gradeFilter ?? ""}
            options={[
              { value: "", label: "전체 등급", href: withGrade(marketWishHref(wish, sort, search.query), null) },
              ...GRADES.filter((g) => g.priceType === "beads").map((g) => ({ value: g.code, label: g.name, href: withGrade(marketWishHref(wish, sort, search.query), g.code) })),
            ]}
          />
          <nav className="flex shrink-0 text-xs" aria-label="정렬">
            {SORTS.map(([s, label]) => (
              <Link key={s} href={withGrade(marketWishHref(wish, s, search.query))} aria-current={sort === s ? "page" : undefined} className={`inline-flex min-h-11 items-center px-1.5 ${sort === s ? "font-bold text-moon" : "text-white/60"}`}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {listingError ? (
        <p className="mt-6 rounded-xl bg-white/5 p-5 text-sm text-white/70">장터를 불러오지 못했어요. 잠시 뒤 다시 확인해 주세요.</p>
      ) : listings.length === 0 ? (
        <div className="kk-market-empty mt-6 rounded-2xl px-6 py-8 text-center text-sm text-white/60">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true" className="mx-auto mb-4 text-moon/65">
            <path d="M29 24A12 12 0 0 1 15 10a12.2 12.2 0 1 0 14 14Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
            <path d="m29 5 1.3 4.7L35 11l-4.7 1.3L29 17l-1.3-4.7L23 11l4.7-1.3L29 5Z" fill="currentColor" opacity=".6" />
          </svg>
          <p className="mt-2">{gradeFilter ? `${gradeName} 꿈은 아직 장터에 없어요.` : search.query ? "검색한 마음에 맞는 꿈은 아직 장터에 없어요." : wish ? "이 마음에 어울리는 꿈은 아직 기다리는 중이에요." : "아직 장터에 나온 꿈이 없어요."}</p>
          {gradeFilter ? (
            <Link href={marketWishHref(wish, sort, search.query)} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-moon px-5 font-cute text-night">
              전체 등급 보기
            </Link>
          ) : (
            <Link href={wish || search.query ? requestHref : me ? "/dreams/new" : "/"} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-moon px-5 font-cute text-night">
              {wish || search.query ? "이 마음으로 꿈 구하기" : "첫 꿈 올리러 가기"}
            </Link>
          )}
          {wish && <Link href={marketWishHref(undefined, sort)} className="mt-2 flex min-h-11 items-center justify-center text-sm text-moon underline underline-offset-4">다른 꿈도 둘러보기</Link>}
        </div>
      ) : (
        <ul className="kk-market-list divide-y divide-white/10">
          {visibleListings.map((d) => (
            <li key={d.dream_id}>
              <ListingRow d={d} mine={d.seller_id === me} wish={wish} query={search.query} sort={sort} />
            </li>
          ))}
        </ul>
      )}

      {!listingError && sp.all !== "1" && listings.length > 10 && (
        <Link href={allHref} className="mt-4 flex min-h-12 items-center justify-center rounded-xl border border-moon/20 text-sm font-medium text-moon">전체보기 ({listings.length}개)</Link>
      )}
      <div className="kk-market-requests">
        <RequestStrip requests={requests} me={me} requestHref={requestHref} />
      </div>
      {!search.query && <div className="kk-market-recent">
        <RecentSales recent={recent} />
      </div>}

      <p className="mt-6 text-center text-xs text-white/60">꿈 원문과 자세한 해몽은 산 사람만 볼 수 있어요</p>

      {/* 중고 거래 앱의 "글쓰기"처럼 오른쪽 아래에 떠 있는 버튼 */}
      <div className="kk-fab kk-market-actions pointer-events-none fixed inset-x-0 bottom-5 z-40 mx-auto flex max-w-md justify-end px-5">
        <Link
          href={me ? "/dreams/new" : "/"}
          className="kk-market-compose pointer-events-auto inline-flex min-h-12 items-center rounded-full bg-moon px-5 font-cute text-base text-night active:scale-[0.97]"
        >
          + 꿈 올리기
        </Link>
      </div>
      <TabBar />
    </div>
  );
}
