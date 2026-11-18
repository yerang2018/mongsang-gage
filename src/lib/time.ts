// "3시간 12분" 처럼 남은 시간을 쉬운 말로
export function formatRemaining(ms: number): string {
  if (ms <= 0) return "마감";
  const minutes = Math.ceil(ms / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (h >= 24) return h % 24 === 0 ? `${h / 24}일` : `${Math.floor(h / 24)}일 ${h % 24}시간`; // 꿈 구해요는 3일짜리
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

export function formatKoreanDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });
}

// "방금", "12분 전", "3시간 전" 처럼 지난 시간을 쉬운 말로
export function formatAgo(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const h = Math.floor(minutes / 60);
  return h < 24 ? `${h}시간 전` : `${Math.floor(h / 24)}일 전`;
}
