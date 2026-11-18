import type { Reading } from "@/lib/dream";

export type ReadingView = {
  interpretation: string;
  reading: Reading | null;
  luck_tags?: string[] | null;
};

// React가 텍스트를 그대로 이스케이프해요. HTML을 해석하지 않고 핵심 문구만 강조합니다.
function Highlight({ text }: { text: string }) {
  const marked = text.includes("**") ? text : text.replace(/^(.{1,140}?[.!?])(?=\s|$)/u, "**$1**");
  return <>{marked.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**") && part.endsWith("**")
    ? <mark key={i} className="rounded-sm bg-moon/15 px-0.5 font-medium text-moon">{part.slice(2, -2)}</mark>
    : part)}</>;
}

const GIFT_PEOPLE: Record<string, { person: string; reason: string; message: string }> = {
  합격운: { person: "시험이나 면접을 앞두고 긴장하는 사람", reason: "이 꿈에 담긴 합격운을 응원하는 마음으로 전해 보세요. 결과를 보장하는 선물이 아니라, 준비해 온 시간을 믿어 준다는 뜻을 담을 수 있어요.", message: "준비한 만큼 차분히 해내길 바라. 좋은 꿈 하나 보낼게." },
  재물운: { person: "새로운 일이나 사업을 시작하는 사람", reason: "넉넉함과 기회를 바라는 마음을 담아 보내기 좋은 꿈이에요. 새 출발을 지켜보고 응원한다는 메시지와 함께 전해 보세요.", message: "새로 시작하는 일이 잘 풀렸으면 좋겠어. 좋은 기운을 나눌게." },
  연애운: { person: "새로운 인연을 기다리는 사람", reason: "따뜻한 만남과 관계를 바라는 마음을 담아 전할 수 있어요. 특정인의 마음이나 재회를 약속하기보다 편안한 인연을 응원해 보세요.", message: "너를 편안하게 해주는 좋은 인연이 찾아오길 바라." },
  건강운: { person: "몸과 마음이 지쳐 쉬어 갈 시간이 필요한 사람", reason: "무탈하고 편안한 하루를 바라는 응원으로 보내 보세요. 건강의 회복을 보장하기보다 곁에서 마음을 보탠다는 뜻을 전할 수 있어요.", message: "오늘은 네 마음이 조금 더 편안했으면 좋겠어." },
  귀인운: { person: "새 환경에 적응하며 응원이 필요한 사람", reason: "좋은 만남과 도움을 바라는 마음을 담아 보내기 좋아요. 혼자 애쓰지 않아도 된다는 말을 함께 전해 보세요.", message: "새로운 곳에서도 네 편이 되어 줄 사람들을 만나길 바라." },
};

export default function ReadingSections({ dream }: { dream: ReadingView; gradeName?: string }) {
  const r = dream.reading;
  const card = "mt-4 rounded-2xl bg-white/10 p-5 text-sm leading-loose";
  const heading = "font-title text-lg font-bold";
  const gift = r?.gift_recommendation ?? GIFT_PEOPLE[dream.luck_tags?.[0] ?? ""] ?? {
    person: "요즘 응원 한마디가 필요한 사람", reason: "이 꿈에서 마음에 남은 장면을 떠올리며 그 사람에게 전하고 싶은 말을 적어 보세요.", message: "네 하루에 좋은 기운이 머물렀으면 좋겠어.",
  };
  return (
    <>
      <section className={`${card} mt-6`}>
        <h2 className={heading}>이 꿈이 품은 징조</h2>
        <p className="mt-3 whitespace-pre-line"><Highlight text={dream.interpretation} /></p>
      </section>
      {r && <>
        <section className={card}>
          <h2 className={heading}>상징을 풀어보면</h2>
          <ul className="mt-3 space-y-4">{r.symbol_readings.map((s) => <li key={s.symbol} className="border-l-2 border-moon/40 pl-3">
            <p className="font-cute text-moon">「{s.symbol}」</p>
            <p className="mt-1 whitespace-pre-line text-white/85"><Highlight text={s.meaning} /></p>
          </li>)}</ul>
        </section>
        <section className={card}>
          <h2 className={heading}>이 꿈에 담긴 나의 속마음</h2>
          <p className="mt-3 whitespace-pre-line text-white/85"><Highlight text={r.scene_reading} /></p>
        </section>
        <section className={card}>
          <h2 className={heading}>오늘의 조언</h2>
          <h3 className="mt-3 text-sm text-moon">해 보면 좋아요</h3>
          <p className="mt-1 whitespace-pre-line"><Highlight text={r.advice.do} /></p>
          <h3 className="mt-4 text-sm text-white/75">조심해요</h3>
          <p className="mt-1 whitespace-pre-line"><Highlight text={r.advice.avoid} /></p>
        </section>
      </>}
      <section className={card}>
        <h2 className={heading}>이 꿈을 보내주면 좋은 사람</h2>
        <p className="mt-3 font-medium text-moon">{gift.person}</p>
        <p className="mt-2"><Highlight text={gift.reason} /></p>
        <p className="mt-4 border-l-2 border-moon/30 pl-3 text-white/75">“{gift.message}”</p>
      </section>
    </>
  );
}
