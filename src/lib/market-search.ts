import { GRADES, type GradeCode, type LuckTag } from "./grades";

export type MarketSort = "grade" | "new";
export const DEFAULT_MARKET_SORT: MarketSort = "new";
export const MARKET_QUERY_LIMIT = 120;

export function resolveMarketSort(value?: string): MarketSort {
  return value === "grade" ? "grade" : DEFAULT_MARKET_SORT;
}

// 주소의 ?grade=SSS 같은 값을 확인. 팔 수 있는 등급(액땜몽 제외)만 인정하고, 이상한 값은 "전체"로 봄
export function resolveMarketGrade(value?: string): GradeCode | null {
  const grade = GRADES.find((g) => g.code === value && g.priceType === "beads");
  return grade ? grade.code : null;
}

export function normalizeMarketQuery(value: unknown): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, MARKET_QUERY_LIMIT) : "";
}

function normalizeText(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

// 검색할 때 AI를 새로 호출하지 않고, 일상적인 바람을 기존 운 태그로 연결해요.
// 원문·비공개 해몽은 검색하지 않으며, 실제 꿈의 태그·제목·상징만 사용해요.
const INTENTS: readonly { tag: LuckTag; words: readonly string[] }[] = [
  { tag: "합격운", words: ["찍은거", "다맞게", "수능", "시험", "합격", "입시", "수험", "성적", "면접", "취업", "입사", "자격증", "고시", "승진", "대학", "공부", "붙고", "붙었", "붙으면"] },
  { tag: "연애운", words: ["연애", "재회", "전남친", "전여친", "전애인", "짝사랑", "썸", "고백", "결혼", "남자친구", "여자친구", "남친", "여친", "애인", "사랑", "헤어진", "헤어졌", "다시연락", "연락이왔", "연락왔", "다시만나"] },
  { tag: "재물운", words: ["적게일", "많이벌", "재물", "금전", "돈", "통장", "월급", "수입", "매출", "보너스", "사업", "부자", "경제", "빚"] },
  { tag: "건강운", words: ["모든걱정", "건강", "회복", "아프", "아픈", "불면", "피곤", "지친", "지쳤", "휴식", "쉬고", "평온", "평안", "스트레스", "마음편", "편안"] },
  { tag: "귀인운", words: ["귀인", "도움", "내편", "인맥", "응원", "외로", "혼자", "직장동료", "사람", "친구", "관계"] },
];

export function analyzeMarketQuery(value: unknown) {
  const query = normalizeMarketQuery(value);
  const text = normalizeText(query);
  const tags = INTENTS.filter(({ words }) => words.some((word) => text.includes(word))).map(({ tag }) => tag);
  // '남자친구'의 '친구'만으로 연애 검색에 귀인운까지 섞지 않아요.
  if (tags.includes("연애운") && !["귀인", "도움", "내편", "인맥", "직장동료"].some((word) => text.includes(word))) {
    const index = tags.indexOf("귀인운");
    if (index >= 0) tags.splice(index, 1);
  }
  const stopWords = new Set(["꿈", "좋은꿈", "좋은", "나오는", "나온", "있는", "갖고", "싶어", "싶다", "싶어요", "찾아", "찾아줘", "보여줘", "보여주세요", "꿈을", "꿈이", "꿈들", "봤으면", "좋겠다", "좋겠어", "좋겠어요"]);
  const tokens = query.normalize("NFKC").toLowerCase().split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word && !stopWords.has(word))
    .map((word) => word.length >= 3 ? word.replace(/(?:에게|에서|처럼|으로|하고|이랑|은|는|을|를|이|가|도|만|의)$/u, "") : word)
    .map((word) => word.replace(/꿈$/u, ""))
    .filter((word) => word && !stopWords.has(word));
  return { query, tags, tokens };
}

type SearchableDream = { title: string; headline: string; luck_tags: readonly string[]; symbols?: readonly string[] | null };

export function searchMarketListings<T extends SearchableDream>(listings: readonly T[], query: string): T[] {
  const intent = analyzeMarketQuery(query);
  if (!intent.query) return [...listings];
  if (intent.tags.length) return listings.filter((dream) => intent.tags.some((tag) => dream.luck_tags.includes(tag)));
  if (!intent.tokens.length) return [];
  return listings.filter((dream) => {
    const text = normalizeText([dream.title, dream.headline, ...dream.luck_tags, ...(dream.symbols ?? [])].join(" "));
    return intent.tokens.every((token) => text.includes(normalizeText(token)));
  });
}

type SortableDream = { grade: string; luck_score?: number | null; listed_at?: string | null };
const gradeOrder = new Map<string, number>(GRADES.map((grade, index) => [grade.code, index]));
const timestamp = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;

export function sortMarketListings<T extends SortableDream>(listings: readonly T[], sort: MarketSort): T[] {
  return [...listings].sort((a, b) => {
    if (sort === "grade") {
      const grade = (gradeOrder.get(a.grade) ?? GRADES.length) - (gradeOrder.get(b.grade) ?? GRADES.length);
      if (grade) return grade;
      const score = (b.luck_score ?? -1) - (a.luck_score ?? -1);
      if (score) return score;
    }
    return timestamp(b.listed_at) - timestamp(a.listed_at);
  });
}
