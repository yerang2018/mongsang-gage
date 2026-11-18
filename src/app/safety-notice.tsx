import Link from "next/link";

// 자해·성적 내용 등으로 safety_flag 가 켜졌을 때 보여주는 위로의 말 (그림·저장 없음)
export default function SafetyNotice() {
  return (
    <div className="mt-6 rounded-2xl bg-white/10 p-6 text-center text-sm leading-relaxed">
      <p className="text-4xl">🌙</p>
      <p className="mt-3 font-title text-xl font-bold">힘든 꿈을 꾸셨네요.</p>
      <p className="mt-4 text-white/80">
        무서운 꿈은 마음이 하루 동안 쌓인 걸
        <br />
        밤사이 털어내는 거래요.
      </p>
      <p className="mt-3 text-white/80">
        이 꿈은 그리지 않고, 어디에도 남기지 않았어요.
        <br />
        오늘은 따뜻한 물 한 잔 마시고 푹 쉬어요.
      </p>
      <p className="mt-4 font-cute text-moon">해몽가가 곁에 있을게요 ✨</p>
      <Link href="/" className="mt-6 block rounded-2xl bg-white/10 py-3">
        꿈 서랍으로 돌아가기
      </Link>
    </div>
  );
}
