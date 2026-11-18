import type { LuckTag } from "./grades";
import { DEFAULT_MARKET_SORT, normalizeMarketQuery, type MarketSort } from "./market-search";

// 꿈의 효능이나 새로운 해몽 등급이 아니라, 구매자가 꿈을 고르는 마음이에요.
// 재회와 새 사랑은 모두 기존 연애운 꿈을 보여 줘요. 실제 꿈의 제목·해몽은 바꾸지 않아요.
export const MARKET_WISHES = [
  {
    id: "reunion",
    label: "다시 연락 오게 해주세요",
    lines: ["다시 연락", "오게 해주세요"],
    tag: "연애운",
    title: "끝난 인연도, 마음에는 남으니까.",
    description: "다시 닿고 싶은 마음으로 고르는 연애운 꿈이에요.",
    saleLine: "다시 시작하고 싶은 마음을 담아, 나에게 좋은 기운 한 장.",
    requestMessage: "다시 닿고 싶은 인연이 있어요. 연애운 꿈 구해요",
  },
  {
    id: "love",
    label: "새로운 사랑이 시작되게 해주세요",
    lines: ["새로운 사랑이", "시작되게", "해주세요"],
    tag: "연애운",
    title: "이번엔, 내가 더 사랑받는 연애.",
    description: "새로운 인연을 기다리는 마음으로 고르는 연애운 꿈이에요.",
    saleLine: "새로운 사랑을 바라는 나에게, 설레는 꿈 한 장.",
    requestMessage: "새로운 사랑을 시작하고 싶어요. 연애운 꿈 구해요",
  },
  {
    id: "success",
    label: "찍은 거 다 맞게 해주세요",
    lines: ["찍은 거 다", "맞게 해주세요"],
    tag: "합격운",
    title: "기다리던 ‘합격’ 두 글자가 필요한 날.",
    description: "시험, 면접, 발표를 앞둔 마음으로 고르는 합격운 꿈이에요.",
    saleLine: "애써 준비한 나에게, 응원하는 마음으로 좋은 꿈 한 장.",
    requestMessage: "이번엔 꼭 붙고 싶어요. 합격운 꿈으로 응원해 주세요",
  },
  {
    id: "money",
    label: "적게 일하고 많이 벌게 해주세요",
    lines: ["적게 일하고", "많이 벌게", "해주세요"],
    tag: "재물운",
    title: "통장 확인할 때, 한숨 대신 웃음이 났으면.",
    description: "조금 더 넉넉한 내일을 바라는 마음으로 고르는 재물운 꿈이에요.",
    saleLine: "여유로운 내일을 바라는 마음에, 재물운 꿈 한 장.",
    requestMessage: "조금 더 여유로운 날을 바라요. 재물운 꿈 구해요",
  },
  {
    id: "rest",
    label: "모든 걱정이 사라지게 해주세요",
    lines: ["모든 걱정이", "사라지게", "해주세요"],
    tag: "건강운",
    title: "요즘은 그저, 무탈한 하루였으면.",
    description: "몸과 마음이 편안한 날을 바라는 마음으로 고르는 건강운 꿈이에요.",
    saleLine: "오늘도 애쓴 나에게, 편안한 꿈 한 장을 건네요.",
    requestMessage: "편안한 하루를 바라고 있어요. 건강운 꿈 구해요",
  },
  {
    id: "health",
    label: "건강하게 해주세요",
    lines: ["건강하게 해주세요"],
    tag: "건강운",
    title: "나와 소중한 사람들의 건강을 바라며.",
    description: "몸과 마음이 건강하기를 바라는 마음으로 고르는 건강운 꿈이에요.",
    saleLine: "건강한 날들을 바라는 마음에, 좋은 꿈 한 장.",
    requestMessage: "나와 소중한 사람들의 건강을 바라요. 건강운 꿈 구해요",
  },
] as const satisfies readonly {
  id: string;
  label: string;
  lines: readonly string[];
  tag: LuckTag;
  title: string;
  description: string;
  saleLine: string;
  requestMessage: string;
}[];

export type MarketWish = (typeof MARKET_WISHES)[number];

export function marketWishById(id?: string): MarketWish | undefined {
  return MARKET_WISHES.find((wish) => wish.id === id);
}

// 예전에 공유한 ?tag=연애운 같은 장터 링크도 그대로 쓸 수 있어요.
export function resolveMarketWish(params: { wish?: string; tag?: string }): MarketWish | undefined {
  return marketWishById(params.wish)
    ?? MARKET_WISHES.find((wish) => wish.tag === params.tag && wish.id !== "reunion");
}

export function marketWishHref(wish?: MarketWish, sort: MarketSort = DEFAULT_MARKET_SORT, search?: string): string {
  const query = new URLSearchParams();
  if (wish) query.set("wish", wish.id);
  const q = normalizeMarketQuery(search);
  if (q) query.set("q", q);
  if (sort !== DEFAULT_MARKET_SORT) query.set("sort", sort);
  return query.size ? `/market?${query}` : "/market";
}

export function wishRequestHref(wish?: MarketWish): string {
  return wish ? `/requests/new?wish=${wish.id}` : "/requests/new";
}
