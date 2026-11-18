import { OG_SIZE, renderShareCard } from "@/lib/og-card";
import { requestShareData } from "./share-data";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "몽상가게 꿈 구해요";

// 꿈 구해요 링크를 카톡에 붙이면 뜨는 그림
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await requestShareData(id);
  if (!r) return renderShareCard({ kicker: "몽상가게 꿈 장터", title: "좋은 꿈, 친구랑 사고팔기" });
  return renderShareCard({
    kicker: `${r.requester_nickname}님이 꿈을 구해요`,
    title: `#${r.luck_tag} 꿈 구해요`,
    sub: r.message ? `“${r.message}”` : "내 꿈을 내밀고 꿈값을 받아 보세요",
    chips: [r.status === "open" ? "내 꿈 내밀기" : "마감된 요청"],
  });
}
