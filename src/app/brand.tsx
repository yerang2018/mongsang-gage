import Link from "next/link";
import InfoTip from "@/app/info-tip";

// 화면 맨 위 로고 "🌙 몽상가게" + 옆의 ⓘ 서비스 설명
export default function Brand({ href = "/" }: { href?: string | null }) {
  const logo = <span className="font-brand text-lg text-moon">🌙 몽상가게</span>;
  return (
    <div className="relative flex items-center">
      {href ? (
        <Link href={href} className="inline-flex min-h-11 items-center">
          {logo}
        </Link>
      ) : (
        logo
      )}
      <InfoTip label="몽상가게 이용 방법">
        <span className="block font-cute text-sm text-moon">몽상가게 이용 순서</span>
        <span className="mt-2 block space-y-2">
          <span className="block">1. 내 꿈을 올리면 AI 해몽가가 풀이하고, 등급에 따라 꿈값을 책정해요.</span>
          <span className="block">2. 판매 가능한 꿈은 해몽이 끝나면 장터에 자동으로 등록돼요.</span>
          <span className="block">3. 구슬로 필요한 꿈을 사요. 누군가 내 꿈을 사면 꿈값만큼 구슬을 받아요.</span>
          <span className="block">4. 구슬이 부족하면 충전할 수 있어요.</span>
        </span>
      </InfoTip>
    </div>
  );
}
