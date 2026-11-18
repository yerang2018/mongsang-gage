import { OG_SIZE, renderShareCard } from "@/lib/og-card";
import { saleShareData } from "./share-data";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "몽상가게 꿈 판매 카드";

// 판매 카드 링크를 카톡에 붙이면 뜨는 그림: 등급 네모 + 꿈 제목 + 해몽 한 줄 + 꿈값
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await saleShareData(id);
  if (!d) return renderShareCard({ kicker: "몽상가게 꿈 장터", title: "좋은 꿈, 친구랑 사고팔기" });
  return renderShareCard({
    kicker: d.sale_status === "sold" ? "이미 팔린 꿈이에요" : `${d.seller_nickname}님이 내놓은 꿈`,
    title: d.title,
    sub: d.headline,
    grade: d.grade,
    score: d.luck_score,
    chips: [d.price, ...d.luck_tags.map((t) => `#${t}`)],
    footer: "사면 자세한 해몽이 열려요",
  });
}
