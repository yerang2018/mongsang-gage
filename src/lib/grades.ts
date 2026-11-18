// 길몽 등급 설정. 점수 구간(minScore)은 실제 분포를 보며 여기서만 고치면 됨
// 2026-10-27 "빡빡하면 재미없으니 널널하게" → 97/90/78/60/30 에서 94/85/70/50/20
// 2026-10-30 "웬만한 꿈은 다 소길몽이라 재미없다" → 길몽 이상을 더 자주: 90/78/60/50/20 (시험 14개: 벚꽃 61·시험 63 = 길몽, 화해 56·대회 53 = 소길몽). targetShare(목표 비율)도 같이 바꿈
// 이미 기록한 꿈의 등급은 그대로(저장 당시 등급)
// 2026-11-03 v3 "구슬 하나로 통일": 꿈은 언제나 구슬로 (평몽도 30구슬)
// 거래 수수료 없음: 판매자는 꿈값을 그대로 받음. 충전 묶음은 src/lib/beads.ts에서 별도로 정해요.
// 꿈값을 바꾸면 0013_bead_units.sql 의 "판매 중 꿈값" 환산 표도 참고 (이미 판매 중인 꿈은 등록 때 값 그대로)
export const GRADES = [
  { code: "SSS", name: "천운몽", minScore: 90, price: 500, priceType: "beads", targetShare: 0.05, blurb: "손에 꼽히는 최고의 꿈" },
  { code: "SS", name: "대길몽", minScore: 78, price: 300, priceType: "beads", targetShare: 0.12, blurb: "흔치 않은 큰 길몽" },
  { code: "S", name: "길몽", minScore: 60, price: 200, priceType: "beads", targetShare: 0.23, blurb: "자랑해도 되는 좋은 꿈" },
  { code: "A", name: "소길몽", minScore: 50, price: 100, priceType: "beads", targetShare: 0.25, blurb: "좋은 기운이 살짝 깃든 꿈" },
  { code: "B", name: "평몽", minScore: 20, price: 30, priceType: "beads", targetShare: 0.25, blurb: "가장 흔한 평범한 꿈" },
  { code: "C", name: "액땜몽", minScore: 0, price: 0, priceType: "none", targetShare: 0.1, blurb: "나쁜 기운을 털어 내는 꿈" },
] as const;

export type Grade = (typeof GRADES)[number];
export type GradeCode = Grade["code"];

export const LUCK_TAGS = ["재물운", "합격운", "연애운", "건강운", "귀인운"] as const;
export type LuckTag = (typeof LUCK_TAGS)[number];

export function gradeForScore(score: number): Grade {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return GRADES.find((g) => s >= g.minScore) ?? GRADES[GRADES.length - 1];
}

export function priceLabel(g: Grade): string {
  return g.priceType === "beads" ? `${g.price.toLocaleString()} 구슬` : "팔 수 없음";
}

export function gradeByCode(code: string | null | undefined): Grade | undefined {
  return GRADES.find((g) => g.code === code);
}

// 무료 꿈 구슬 지급량. 실제 지급은 DB 함수가 함 (0013_bead_units.sql: handle_new_user·handle_user_linked·record_dream) — 바꾸면 거기도 같이
// 2026-11-03 v3: 무료로는 꿈을 넉넉히 살 수 없게 (가입 + 꿈 5번이면 소길몽 하나). 매일 첫 방문 구슬은 없앰
export const BEAD_REWARDS = {
  signupAnonymous: 300,
  accountLink: 70,
  dreamRecord: 50,
  dreamRecordDailyLimit: 3,
} as const;
