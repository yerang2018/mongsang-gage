import type { CertificateRow } from "./certificate";
import type { Reading } from "./dream";

// "예시 결과 보기"(/example)에 쓰는 가상의 꿈. 운영자가 지어낸 꿈·닉네임이고 DB에는 없음.
// 실제로 꿈을 사면 받는 것(꿈 원문·상세 해몽·매매 증서)과 같은 모양으로만 채움
export const EXAMPLE_SELLER = "달토끼";
export const EXAMPLE_BUYER = "별사탕";

export const EXAMPLE_DREAM = {
  title: "금빛 잉어를 안은 꿈",
  grade: "SS",
  luck_score: 88,
  luck_tags: ["재물운", "합격운"],
  symbols: ["금빛 잉어", "맑은 연못", "할머니"],
  headline: "큰 기회가 품 안으로 들어올 기운",
  price_type: "beads" as const,
  price: 300,
  text: "할머니 댁 앞 맑은 연못에서 금빛 잉어가 크게 뛰어올라 제 품에 안겼어요. 비늘이 햇빛에 반짝였고, 할머니가 박수를 치면서 웃으셨어요. 저도 너무 기뻐서 잉어를 꼭 껴안았어요.",
  interpretation:
    "**금빛 잉어가 스스로 품에 안긴 장면은, 기다리던 기회를 받아들일 준비가 된 마음**으로 읽을 수 있어요. 잉어를 멀리서 구경한 것이 아니라 직접 안았다는 점이 이 꿈의 중심이에요. 맑은 연못은 상황을 차분히 바라보고 싶은 마음을, 빛나는 비늘은 놓치고 싶지 않은 기대를 떠올리게 해요. 할머니가 웃으며 박수를 친 모습에는 누군가에게 인정받고 응원받고 싶은 바람이 겹쳐 있을 수 있어요.\n\n앞으로의 흐름을 상징으로 그려 보면, **작은 제안이나 연락을 계기로 준비해 온 것을 꺼내 보일 기회**가 생기는 모습과 닮았어요. 다만 이 꿈이 실제 연락이나 합격을 예고하는 것은 아니에요. 평소라면 지나칠 제안을 조금 더 살펴보라는 이야기로 받아들여도 좋겠어요. 반가운 기회 앞에서 한 발 물러서기보다 조건을 묻고 내 생각을 말하는 태도가 도움이 될 수 있어요. 이 꿈이 건네는 말은 무조건 잘된다는 약속보다, 기회를 마주했을 때 스스로를 믿어 보라는 응원에 가까워요.",
  reading: {
    symbol_readings: [
      {
        symbol: "금빛 잉어",
        meaning: "전통 해몽에서 잉어는 출세와 재물을 뜻하고, 금빛으로 빛나면 그 기운이 더 커져요. 잉어가 스스로 뛰어올라 안긴 건 기회가 먼저 찾아온다는 뜻이에요.",
      },
      {
        symbol: "맑은 연못",
        meaning: "맑은 물은 막힘없이 순조로운 흐름을 뜻해요. 연못이 맑았다는 건 지금 하는 일의 바탕이 깨끗하고 탄탄하다는 의미예요.",
      },
      {
        symbol: "할머니",
        meaning: "꿈에 웃는 어른이 나오면 도움과 응원을 뜻해요. 박수를 쳐 준 건 당신의 선택을 반긴다는 신호예요.",
      },
    ],
    scene_reading:
      "잉어를 꼭 껴안은 행동은 들어온 기운을 내 것으로 만든다는 뜻이에요. 기쁜 마음으로 껴안았으니 기회를 부담이 아니라 반가움으로 받아들일 준비가 되어 있다는 의미도 있어요.",
    luck_reason:
      "금빛 잉어라는 귀한 상징에 맑은 물, 웃는 어른이 함께 나왔고, 기쁜 기분으로 잉어를 껴안은 행동과 반짝이는 비늘 같은 생생한 장면이 점수를 높였어요.",
    fortune_timing: "일주일 안에 반가운 연락이나 좋은 결과 소식으로 찾아올 기운이 있어요.",
    advice: {
      do: "**미뤄 둔 지원서나 연락 중 하나를 골라 작은 행동으로 옮겨 보세요.** 먼저 상대에게 확인할 질문과 내가 준비한 것을 짧게 적어 두면 좋아요. 바로 결정하기 어렵다면 오늘은 초안을 쓰거나 일정만 확인해도 충분해요. 응원해 주는 사람 한 명에게 진행 상황을 알려 보는 것도 도움이 될 수 있어요.",
      avoid: "**들뜬 마음만으로 조건을 확인하지 않고 약속하는 일은 피하세요.** 좋아 보이는 제안이라도 일정과 부담을 적어 보고, 지금 감당할 수 있는지 살펴보면 좋아요. 확신이 서지 않으면 잠깐 생각할 시간을 요청해도 괜찮아요.",
    },
  } satisfies Reading,
};

export const EXAMPLE_CHEER = "면접 꼭 붙을게, 좋은 꿈 고마워!";

// 예시 매매 증서 그림에 쓰는 값 (실제 거래 아님)
export const EXAMPLE_CERTIFICATE: CertificateRow = {
  luck_tags: EXAMPLE_DREAM.luck_tags,
  luck_score: EXAMPLE_DREAM.luck_score,
  headline: EXAMPLE_DREAM.headline,
  trade_id: "00000000-0000-0000-0000-000000000000",
  dream_id: "00000000-0000-0000-0000-000000000000",
  title: EXAMPLE_DREAM.title,
  grade: EXAMPLE_DREAM.grade,
  price_type: EXAMPLE_DREAM.price_type,
  price: EXAMPLE_DREAM.price,
  cheer_message: EXAMPLE_CHEER,
  created_at: "2026-10-30T09:00:00+09:00",
  seller_nickname: `${EXAMPLE_SELLER}(예시)`,
  buyer_nickname: `${EXAMPLE_BUYER}(예시)`,
};
