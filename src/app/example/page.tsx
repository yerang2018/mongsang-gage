import Link from "next/link";
import Brand from "@/app/brand";
import ReadingSections from "@/app/reading-sections";
import { CERTIFICATE_PHRASE } from "@/lib/certificate";
import { EXAMPLE_BUYER, EXAMPLE_CHEER, EXAMPLE_DREAM, EXAMPLE_SELLER } from "@/lib/example-dream";
import { gradeByCode, priceLabel } from "@/lib/grades";

export const metadata = { title: "예시 결과 보기 | 몽상가게", description: "꿈을 사면 어떤 해몽과 매매 증서를 받는지 예시로 보여 드려요." };

// 예시 결과: 꿈을 사면 보이는 화면을 가상의 꿈으로 미리 보여 줌 (누구나 볼 수 있음, DB 데이터 없음)
export default function ExamplePage() {
  const d = EXAMPLE_DREAM;
  const grade = gradeByCode(d.grade);
  return (
    <div>
      <div className="flex items-center justify-between">
        <Brand />
        <Link href="/market" className="inline-flex min-h-11 items-center text-xs text-white/70 underline underline-offset-4">
          🏮 꿈 장터
        </Link>
      </div>

      <p className="mt-5 rounded-2xl border border-moon/50 bg-moon/10 p-4 text-sm leading-relaxed break-keep text-moon">
        <b>예시 화면이에요.</b> 운영자가 지어낸 꿈과 닉네임으로 만들었어요. 실제로 꿈을 사면 이런 모양으로 열려요.
      </p>

      <p className="mt-5 rounded-xl bg-moon/15 p-3 text-sm text-moon">
        🧧 {EXAMPLE_SELLER}(예시)님에게 산 꿈이에요
      </p>

      <section className="mt-4 rounded-3xl bg-white/10 p-6 text-center">
        <p className="text-xs text-white/60">해몽 예시</p>
        <h1 className="mt-2 font-title text-2xl font-bold">{d.title}</h1>
        <p className="mt-4 font-cute text-4xl text-moon">{grade?.name}</p>
        <p className="mt-1 text-xs text-white/60">
          {d.grade}등급, 길몽 점수 {d.luck_score}점, 꿈값 {grade ? priceLabel(grade) : ""}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {d.luck_tags.map((t) => (
            <span key={t} className="rounded-full bg-moon/20 px-3 py-1 text-xs text-moon">
              #{t}
            </span>
          ))}
          {d.symbols.map((s) => (
            <span key={s} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
              {s}
            </span>
          ))}
        </div>
        <p className="mt-5 font-cute text-lg">“{d.headline}”</p>
      </section>

      <section className="mt-4 rounded-2xl bg-white/5 p-5 text-sm leading-relaxed">
        <h2 className="font-cute text-white/70">친구가 꾼 꿈 원문</h2>
        <p className="mt-2 whitespace-pre-wrap text-white/85">{d.text}</p>
      </section>

      <ReadingSections dream={d} gradeName={grade?.name} />

      <section className="mt-6">
        <h2 className="font-title text-lg font-bold">📜 꿈 매매 증서</h2>
        <p className="mt-1 text-sm break-keep text-white/70">{CERTIFICATE_PHRASE}</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- 서버가 그린 예시 증서 그림 */}
        <img
          src="/example/certificate.png?v=dream-contract-1"
          alt={`${d.title} 예시 매매 증서, ${EXAMPLE_SELLER}에서 ${EXAMPLE_BUYER}에게, 응원 한마디: ${EXAMPLE_CHEER}`}
          width={1080}
          height={1528}
          className="mt-3 w-full bg-night"
        />
      </section>

      <div className="mt-6 space-y-2">
        <Link href="/market" className="block w-full rounded-2xl bg-moon py-4 text-center font-cute text-lg text-night active:scale-[0.98]">
          장터에서 진짜 꿈 보기
        </Link>
        <Link href="/onboarding" className="block w-full rounded-2xl bg-white/10 py-4 text-center font-cute text-lg active:scale-[0.98]">
          내 꿈 적고 해몽받기
        </Link>
      </div>
    </div>
  );
}
