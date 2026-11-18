import { gradeByCode } from "./grades";
import { formatKoreanDate } from "./time";

export type CertificateRow = {
  headline?: string | null;
  luck_tags?: string[] | null;
  luck_score?: number | null;
  trade_id: string;
  dream_id: string;
  title: string;
  grade: string;
  price_type: "beads" | "cheer";
  price: number;
  cheer_message: string | null;
  created_at: string;
  seller_nickname: string;
  buyer_nickname: string;
};

export const CERTIFICATE_PHRASE = "이 꿈의 좋은 기운은 이제 당신의 것이에요";

// 증서에 적히는 칸들 (화면·이미지 공통)
export function certificateFields(c: CertificateRow) {
  const grade = gradeByCode(c.grade);
  return [
    { label: "꿈 이름", value: c.title },
    { label: "등급", value: grade ? `${grade.name} (${grade.code})` : c.grade },
    { label: "꿈값", value: c.price_type === "beads" ? `꿈 구슬 ${c.price.toLocaleString()}개` : "응원 한마디" },
    { label: "판 사람", value: c.seller_nickname },
    { label: "산 사람", value: c.buyer_nickname },
    { label: "날짜", value: formatKoreanDate(c.created_at) },
  ];
}
