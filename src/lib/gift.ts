// 꿈 선물(행운 세트·응원 카드) 공용 설정. DB: 0014_gifts.sql (create_gift·get_gift)

// 수능 아침 바로가기 (2026 수능: 11월 19일 목요일). 열리는 시각 선택지에 지난 날이면 안 보임
export const SUNEUNG_OPEN_AT = "2026-11-19T07:00:00+09:00";

export type GiftKind = "luck_set" | "cheer_card";

export type GiftView = {
  kind: GiftKind;
  sender_name: string;
  recipient_name: string;
  open_at: string;
  opened: boolean;
  message: string | null;
  dream_id: string | null;
  title: string | null;
  grade: string | null;
  luck_tags: string[] | null;
  headline: string | null;
  dream_text: string | null;
  interpretation: string | null;
  reading: import("./dream").Reading | null;
  lucky: { color: string; item: string } | null;
  on_sale: boolean | null;
};

// 부적 문구: "○○님의 합격을 빕니다" (모든 낱말이 받침으로 끝나서 '을')
const LUCK_WISH: Record<string, string> = {
  합격운: "합격",
  재물운: "넉넉한 재물",
  연애운: "사랑",
  건강운: "건강",
  귀인운: "좋은 인연",
};
export function luckWish(recipient: string, tags: string[] | null | undefined): string {
  const wish = LUCK_WISH[tags?.[0] ?? ""] ?? "행운";
  return `${recipient}님의 ${wish}을 빕니다`;
}

// "11월 19일 오전 7시" (분이 있으면 "오전 7시 30분")
export function formatOpenAt(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const minute = get("minute");
  return `${get("month")}월 ${get("day")}일 ${get("dayPeriod")} ${get("hour")}시${minute && minute !== "00" && minute !== "0" ? ` ${Number(minute)}분` : ""}`;
}
