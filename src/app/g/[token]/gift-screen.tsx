import Link from "next/link";
import Brand from "@/app/brand";
import { MoonEnvelope } from "@/app/dreams/[id]/grade-reveal";
import ReadingSections from "@/app/reading-sections";
import { formatOpenAt, type GiftView } from "@/lib/gift";
import { gradeByCode } from "@/lib/grades";
import OpenCountdown from "./open-countdown";

// 선물 링크 화면 그리기 (데이터는 page.tsx 가 서버에서 읽어 줌). 열리기 전 = 봉투 + 남은 시간 + 보낸 사람,
// 열린 뒤 = 행운 세트(부적·원문·해몽) / 응원 카드(등급·한 줄·메시지)
export default function GiftScreen({ g, token }: { g: GiftView; token: string }) {
  if (!g.opened) {
    return (
      <div>
        <Brand />
        <section className="mt-6 flex flex-col items-center rounded-3xl border border-moon/30 bg-gradient-to-b from-[#f4f0ff] to-[#e7defd] px-6 py-12 text-center">
          <MoonEnvelope />
          <p className="mt-6 font-title text-xl font-bold break-keep">
            {g.recipient_name}님에게
            <br />
            {g.sender_name}님이 꿈 선물을 보냈어요
          </p>
          <p className="mt-4 text-base text-moon">{formatOpenAt(g.open_at)}에 열려요</p>
          <p className="mt-1 text-sm text-white/75">
            <OpenCountdown until={g.open_at} />
          </p>
        </section>
        <p className="mt-6 text-center text-sm break-keep text-white/75">이 링크를 저장해 두고 그때 다시 열어 보세요</p>
        <Cta />
      </div>
    );
  }

  const grade = gradeByCode(g.grade);
  return (
    <div>
      <Brand />
      <p className="mt-6 text-sm text-moon">
        {g.kind === "luck_set" ? "🎁 행운 세트" : "💌 응원 카드"}, {forSelf(g) ? `${g.sender_name}님의 부적` : `${g.sender_name}님이 ${g.recipient_name}님에게`}
      </p>
      {g.message && <p className="mt-3 rounded-2xl bg-white/10 p-4 text-base break-keep">“{g.message}”</p>}

      {g.kind === "luck_set" && (
        <section className="mt-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- 서버가 그린 부적 카드 그림 */}
          <img
            src={`/g/${token}/talisman.png`}
            alt={`${g.recipient_name}님을 위한 ${grade?.name ?? ""} 부적 카드`}
            width={1080}
            height={1920}
            className="mx-auto w-full max-w-xs rounded-2xl bg-night shadow-lg"
          />
          <a
            href={`/g/${token}/talisman.png?download=1`}
            className="mt-3 flex min-h-12 items-center justify-center rounded-2xl bg-moon font-cute text-lg text-night active:scale-[0.98]"
          >
            부적 카드 저장하기
          </a>
        </section>
      )}

      <section className="mt-5 rounded-3xl bg-white/10 p-6 text-center">
        <h1 className="font-title text-2xl font-bold break-keep">{g.title}</h1>
        <p className="mt-3 font-cute text-4xl text-moon">{grade?.name}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {(g.luck_tags ?? []).map((t) => (
            <span key={t} className="rounded-full bg-moon/20 px-3 py-1 text-xs text-moon">
              #{t}
            </span>
          ))}
        </div>
        <p className="mt-4 font-cute text-lg break-keep">“{g.headline}”</p>
      </section>

      {g.kind === "luck_set" && g.interpretation ? (
        <>
          {g.dream_text && (
            <section className="mt-4 rounded-2xl bg-white/5 p-5 text-sm leading-relaxed">
              <h2 className="font-cute text-white/75">선물받은 꿈 원문</h2>
              <p className="mt-2 whitespace-pre-wrap text-white/85">{g.dream_text}</p>
            </section>
          )}
          <ReadingSections dream={{ interpretation: g.interpretation, reading: g.reading, luck_tags: g.luck_tags }} gradeName={grade?.name} />
        </>
      ) : (
        g.on_sale &&
        g.dream_id && (
          <p className="mt-5 text-center text-sm break-keep text-white/75">
            꿈 원문과 자세한 해몽이 궁금하다면{" "}
            <Link href={`/sale/${g.dream_id}`} className="inline-flex min-h-11 items-center text-moon underline underline-offset-4">
              장터에서 이 꿈 보기
            </Link>
          </p>
        )
      )}
      <Cta />
    </div>
  );
}

function Cta() {
  return (
    <div className="mt-8 space-y-2">
      <Link href="/" className="block w-full rounded-2xl bg-white/10 py-4 text-center font-cute text-lg active:scale-[0.98]">
        나도 어젯밤 꿈 해몽받기
      </Link>
    </div>
  );
}

// 나에게 만든 부적: [나에게 부적 만들기]는 받는 사람 = 내 닉네임으로 저장됨 → 이름이 같을 때만 "○○님의 부적"
// (받는 사람 칸에 적은 글자로 짐작하지 않음: 2026-11-04 사용자 "이름이 '나에게'일 수도 있어")
function forSelf(g: GiftView) {
  return g.recipient_name.trim() === g.sender_name.trim();
}
