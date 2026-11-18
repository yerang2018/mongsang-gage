import Link from "next/link";
import { GradeThumb } from "@/app/market/listing-card";
import { GRADES, priceLabel } from "@/lib/grades";

export const metadata = { title: "꿈 등급 안내, 몽상가게" };

// 꿈 등급 안내: 장터에서 보는 등급이 얼마나 귀한 꿈인지 (누구나 볼 수 있음). 점수 구간·비율·꿈값은 grades.ts에서 가져옴
export default function GradesPage() {
  return (
    <div>
      <Link href="/market" className="-ml-1 inline-flex min-h-11 items-center px-1 text-sm text-white/70">
        ← 꿈 장터
      </Link>
      <h1 className="mt-4 font-title text-2xl font-bold">꿈 등급 안내</h1>
      <p className="mt-2 text-sm leading-relaxed break-keep text-white/70">
        해몽가가 꿈을 100점 만점으로 매기고, 점수에 따라 여섯 등급으로 나눠요. 등급이 높을수록 귀한 꿈이고 꿈값도 비싸요.
      </p>

      <ol className="mt-5 divide-y divide-white/10">
        {GRADES.map((g, i) => {
          const max = i === 0 ? 100 : GRADES[i - 1].minScore - 1;
          return (
            <li key={g.code} className="flex gap-4 py-4">
              <GradeThumb code={g.code} />
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline justify-between gap-2">
                  <span className="font-cute text-lg text-moon">
                    {g.name} <span className="text-xs text-white/60">{g.code}</span>
                  </span>
                  <span className="shrink-0 text-sm font-bold">{priceLabel(g)}</span>
                </p>
                <p className="mt-0.5 text-xs text-white/60">
                  {g.minScore}~{max}점
                </p>
                <p className="mt-1.5 text-sm break-keep">{g.blurb}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <section className="mt-4 space-y-2 text-sm leading-relaxed break-keep text-white/70">
        <p>꿈값은 등급으로 정해져서 판 사람이 마음대로 바꿀 수 없어요.</p>
        <p>꿈이 팔리면 판 사람은 꿈값을 그대로 구슬로 받아요 (수수료 없음). 액땜몽은 나쁜 기운을 털어 낸 꿈이라 팔 수 없어요.</p>
        <p className="text-xs text-white/60">등급은 점수로만 정해지고, 등급마다 나오는 개수를 정해 두지 않아요.</p>
      </section>

      <Link
        href="/market"
        className="mt-6 block w-full rounded-2xl bg-moon py-4 text-center font-cute text-lg text-night active:scale-[0.98]"
      >
        장터에서 꿈 구경하기
      </Link>
    </div>
  );
}
