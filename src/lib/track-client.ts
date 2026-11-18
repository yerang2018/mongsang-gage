// 행동 기록 보내기 (브라우저 → /api/track). 실패해도 화면엔 영향 없음
// 누가 보냈는지(user_id·방문자 id)는 서버가 쿠키·로그인 정보로 정함. 여기엔 꿈 내용·닉네임을 넣지 말 것
export type TrackType = "visit" | "share_attempt" | "share_complete" | "share_cancel" | "link_copied" | "fake_door";
export type ShareTarget = "sale" | "request" | "certificate" | "gift";

export function track(type: TrackType, meta: { target?: ShareTarget | string; id?: string; via?: string; method?: string; door?: string } = {}) {
  try {
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...meta }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}
