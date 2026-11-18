// 판매 서약·신고 공용 문구 (DB: 0015_reports.sql)

// 판매 등록·꿈 내밀기 때 꼭 체크하는 서약
export const SALE_PLEDGE = "제가 실제로 꾼 꿈이에요. 베낀 꿈이나 남의 꿈으로 밝혀지면 받은 구슬이 취소되고 판매가 정지될 수 있어요.";

// 신고는 확인할 수 있는 것만 ("지어낸 꿈 같아요"는 받지 않음). 서로 다른 3명이 신고하면 자동으로 숨김
export const REPORT_REASONS = [
  { code: "copied", label: "베낀 꿈", hint: "인터넷 글이나 다른 사람 꿈과 똑같아요" },
  { code: "personal_info", label: "개인정보", hint: "실명·학교·연락처 같은 게 보여요" },
  { code: "offensive", label: "불쾌한 내용", hint: "욕설·혐오·성적인 내용이 있어요" },
  { code: "ad", label: "광고", hint: "홍보나 다른 곳으로 끌어가는 글이에요" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["code"];

export const REPORT_LABEL: Record<string, string> = Object.fromEntries(REPORT_REASONS.map((r) => [r.code, r.label]));
