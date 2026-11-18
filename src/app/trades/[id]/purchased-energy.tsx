const ENERGY: Record<string, { name: string; flow: string; effect: string }> = {
  재물운: { name: "재복을 맞아들이는 기운", flow: "흩어져 있던 기회가 한곳으로 모이고, 공들인 일이 결실로 이어지는 흐름으로 읽습니다.", effect: "새로운 제안을 알아보는 눈과 시작을 망설이던 일에 첫발을 내딛는 힘을 기대해 볼 수 있어요." },
  합격운: { name: "문턱을 넘어서는 문서운", flow: "시험·면접·발표처럼 평가를 앞둔 자리에서, 쌓아 온 노력이 제 모습을 드러내는 흐름을 담고 있어요.", effect: "중요한 순간에 마음을 모으고, 준비한 것을 끝까지 펼쳐 보이는 담대함을 기대해 보세요." },
  연애운: { name: "인연의 실을 잇는 기운", flow: "멀어진 마음의 간격을 돌아보고, 닫혀 있던 관계의 문을 다시 두드리는 흐름으로 풀 수 있어요.", effect: "마음을 전할 계기를 알아차리거나 새로운 만남을 받아들이는 여유를 기대해 볼 수 있어요." },
  건강운: { name: "흐트러진 기운을 고르는 평안운", flow: "지친 마음을 가라앉히고 생활의 균형을 되찾는 방향으로 읽는 꿈이에요.", effect: "무리하던 속도를 늦추고 편안한 일상을 되찾는 마음가짐을 기대해 보세요." },
  귀인운: { name: "좋은 인연을 불러들이는 귀인운", flow: "혼자 막혀 있던 일에 다른 시선이 더해지고, 뜻밖의 만남이 길의 실마리가 되는 흐름을 품고 있어요.", effect: "주변의 호의와 조언을 알아보고 도움을 청할 용기를 얻는 계기로 간직해 보세요." },
};
export default function PurchasedEnergy({ tags, symbols, buyerName }: { tags: string[]; symbols: string[]; buyerName: string }) {
  const entries = [...new Set(tags)].map(tag => ENERGY[tag]).filter(Boolean);
  return <section className="mt-7 rounded-2xl bg-moon/5 p-5 text-sm leading-loose">
    <h2 className="font-title text-xl">이 꿈이 주는 기운</h2>
    {symbols.length > 0 && <p className="mt-3 text-white/75">꿈속의 {symbols.slice(0, 3).map(symbol => `‘${symbol}’`).join(", ")}에 담긴 뜻을 당신의 바람과 함께 읽어봅니다.</p>}
    {(entries.length ? entries : [{ name: "새로운 흐름을 맞이하는 기운", flow: "익숙한 일상을 지나 새로운 가능성을 받아들이는 꿈으로 읽습니다.", effect: "마음에 품고 있던 바람을 돌아보고 다음 걸음을 정하는 계기로 간직해 보세요." }]).map(item => <div key={item.name} className="mt-4">
      <h3 className="font-medium text-moon">{item.name}</h3><p className="mt-1">{item.flow}</p>
      <p className="mt-2"><mark className="rounded-sm bg-moon/15 px-0.5 text-moon">{item.effect}</mark></p>
    </div>)}
  </section>;
}
