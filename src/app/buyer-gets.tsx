const BUYER_FIT: Record<string, readonly string[]> = {
  합격운: ["시험을 앞둔 분", "면접 합격을 바라는 분", "발표에 자신감이 필요한 분"],
  재물운: ["새 사업을 시작하는 분", "금전 고민이 있는 분", "일의 성과를 바라는 분"],
  연애운: ["좋아하는 사람이 있는 분", "재회를 바라는 분", "새 인연을 기다리는 분"],
  건강운: ["요즘 지쳐 있는 분", "마음의 여유가 필요한 분", "생활 리듬을 되찾고 싶은 분"],
  귀인운: ["새 환경에 적응 중인 분", "든든한 내 편이 필요한 분", "좋은 인연을 만나고 싶은 분"],
};
const DEFAULT_FIT = ["새 출발을 앞둔 분", "응원이 필요한 분", "좋은 기운을 간직하고 싶은 분"];

export default function BuyerGets({ tags }: { tags: string[] }) {
  const groups = tags.map(tag => BUYER_FIT[tag]).filter(Boolean);
  // 운이 둘이면 두 종류를 번갈아 골라 짧게 네 줄, 한 종류면 세 줄.
  const people = groups.length
    ? [...new Set([0, 1, 2].flatMap(index => groups.map(group => group[index])))].slice(0, 4)
    : DEFAULT_FIT;
  return <section className="rounded-2xl bg-moon/5 px-5 py-4">
    <h2 className="font-title text-base">이 꿈을 사면 좋은 사람</h2>
    <ul className="mt-3 divide-y divide-moon/10 text-sm text-white/85">
      {people.map(person => <li key={person} className="py-2 first:pt-0 last:pb-0">{person}</li>)}
    </ul>
  </section>;
}
