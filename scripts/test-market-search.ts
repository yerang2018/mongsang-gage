import assert from "node:assert/strict";
import { analyzeMarketQuery, normalizeMarketQuery, resolveMarketSort, searchMarketListings, sortMarketListings } from "../src/lib/market-search";
import { marketWishById, marketWishHref, resolveMarketWish } from "../src/lib/market-wishes";

const dreams = [
  { id: "exam", title: "돼지와 싸워 이긴 꿈", headline: "도전을 이겨 내는 기운", symbols: ["돼지"], luck_tags: ["합격운", "재물운"], grade: "S", luck_score: 76, listed_at: "2026-11-05T00:00:00Z" },
  { id: "money", title: "할머니와 계곡 여행 꿈", headline: "넉넉함을 나누는 기운", symbols: ["할머니", "계곡"], luck_tags: ["귀인운", "재물운"], grade: "S", luck_score: 72, listed_at: "2026-11-06T00:00:00Z" },
  { id: "love", title: "꽃다발을 받은 꿈", headline: "새 인연의 기운", symbols: ["꽃"], luck_tags: ["연애운"], grade: "A", luck_score: 59, listed_at: "2026-11-07T00:00:00Z" },
  { id: "rest", title: "포근한 이불 속 꿈", headline: "편안하게 쉬는 기운", symbols: ["이불"], luck_tags: ["건강운"], grade: "SS", luck_score: 84, listed_at: "2026-11-03T00:00:00Z" },
];
const ids = (items: typeof dreams) => items.map((dream) => dream.id);

assert.deepEqual(ids(searchMarketListings(dreams, "수능을 잘 봤으면 좋겠다")), ["exam"]);
assert.deepEqual(ids(searchMarketListings(dreams, "면접에 꼭 붙고 싶어요")), ["exam"]);
assert.deepEqual(ids(searchMarketListings(dreams, "전남친이랑 재회하고 싶어")), ["love"]);
assert.deepEqual(analyzeMarketQuery("남자친구와 다시 만나고 싶어요").tags, ["연애운"]);
assert.deepEqual(ids(searchMarketListings(dreams, "돈 걱정 없이 살고 싶다")), ["exam", "money"]);
assert.deepEqual(ids(searchMarketListings(dreams, "내 편이 생겼으면 좋겠다")), ["money"]);
assert.deepEqual(ids(searchMarketListings(dreams, "몸이 건강해졌으면 좋겠어요")), ["rest"]);
assert.deepEqual(ids(searchMarketListings(dreams, "돼지가 나오는 꿈")), ["exam"]);
assert.deepEqual(ids(searchMarketListings(dreams, "돼지꿈")), ["exam"]);
assert.deepEqual(ids(searchMarketListings(dreams, "우주정거장")), []);
assert.deepEqual(ids(searchMarketListings(dreams, "좋은 꿈")), []);
assert.deepEqual(ids(searchMarketListings(dreams, " ")), ids(dreams));
assert.deepEqual(ids(sortMarketListings(dreams, "grade")), ["rest", "exam", "money", "love"]);
assert.deepEqual(ids(sortMarketListings(dreams, "new")), ["love", "money", "exam", "rest"]);
assert.deepEqual(ids(dreams), ["exam", "money", "love", "rest"]); // 정렬해도 원래 목록은 바뀌지 않아요
assert.equal(resolveMarketSort(), "new");
assert.equal(resolveMarketSort("invalid"), "new");
assert.equal(resolveMarketSort("new"), "new");
assert.equal(resolveMarketSort("grade"), "grade");
assert.equal(normalizeMarketQuery(["bad"]), "");
assert.equal(normalizeMarketQuery("a".repeat(140)).length, 120);

const wish = marketWishById("success");
const url = new URL(marketWishHref(wish, "new", "수능을 잘 봤으면 좋겠다"), "https://example.com");
assert.equal(url.searchParams.get("wish"), "success");
assert.equal(url.searchParams.get("sort"), null);
assert.equal(new URL(marketWishHref(wish, "grade"), "https://example.com").searchParams.get("sort"), "grade");
assert.equal(url.searchParams.get("q"), "수능을 잘 봤으면 좋겠다");
assert.equal(marketWishHref(), "/market");
assert.equal(resolveMarketWish({ tag: "합격운" })?.id, "success");
console.log("PASS: natural-language intent search, literal symbol search, empty results, grade sorting, and navigation context");
