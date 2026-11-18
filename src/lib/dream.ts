import { z } from "zod";
import { LUCK_TAGS } from "./grades";

export const PanelSchema = z.object({
  no: z.number().int(),
  scene: z.string(),
  dialogue: z.string(),
});
export type Panel = z.infer<typeof PanelSchema>;

// 산 사람만 보는 상세 해몽 (DB dreams.reading 에 통째로 저장)
export const ReadingSchema = z.object({
  symbol_readings: z.array(z.object({ symbol: z.string(), meaning: z.string() })).min(1).max(4),
  scene_reading: z.string(),
  luck_reason: z.string(),
  fortune_timing: z.string(),
  advice: z.object({ do: z.string(), avoid: z.string() }),
  gift_recommendation: z.object({ person: z.string(), reason: z.string(), message: z.string() }).optional(),
});
export type Reading = z.infer<typeof ReadingSchema>;

// Gemini가 돌려줄 해몽 JSON 모양 (이 스키마로 출력을 강제).
// 순서가 곧 생성 순서: safety_flag 를 맨 앞에 둬서 힘든 꿈은 풀이가 화면에 흘러나오기 전에 멈추고,
// 상징 풀이를 앞쪽에 둬서 기다리는 동안 실시간으로 보여 줌. 점수·등급은 뒤쪽(결과 화면에서 공개)
// 4컷 콘티(panels)는 그림 보류 동안 빼 둠 (2026-10-29, 해몽 시간 단축). 그림을 다시 하면 여기와 프롬프트에 되살리기
export const DreamAISchema = z.object({
  safety_flag: z.boolean(),
  title: z.string(),
  symbols: z.array(z.string()),
  symbol_readings: ReadingSchema.shape.symbol_readings,
  scene_reading: z.string(),
  score_parts: z.object({ symbol: z.number(), feeling: z.number(), action: z.number(), vividness: z.number() }),
  luck_reason: z.string(),
  luck_tags: z.array(z.enum(LUCK_TAGS)).min(1).max(2),
  headline: z.string(),
  interpretation: z.string(),
  fortune_timing: z.string(),
  advice: ReadingSchema.shape.advice,
  gift_recommendation: z.object({ person: z.string(), reason: z.string(), message: z.string() }),
});
export type DreamAI = z.infer<typeof DreamAISchema>;

// 길몽 점수 = 네 부분 점수의 합 (2026-10-29 "웬만한 꿈은 다 소길몽이라 재미없다" → 한 번에 점수를 고르게 하면 68점 같은 값에 몰려서,
// 상징·기분·행동·생생함을 따로 매기고 코드가 더함). 소수 부분을 보존해 더한 뒤 마지막에 한 번만 반올림
export const SCORE_PART_RANGE = { symbol: [5, 65], feeling: [-5, 12], action: [-5, 13], vividness: [0, 10] } as const;
export function scoreOf(parts: DreamAI["score_parts"]): number {
  const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
  const sum = (Object.keys(SCORE_PART_RANGE) as (keyof typeof SCORE_PART_RANGE)[]).reduce((t, k) => t + clamp(parts[k], SCORE_PART_RANGE[k]), 0);
  return Math.min(100, Math.max(0, Math.round(sum)));
}

export function readingOf(ai: DreamAI): Reading {
  return {
    symbol_readings: ai.symbol_readings,
    scene_reading: ai.scene_reading,
    luck_reason: ai.luck_reason,
    fortune_timing: ai.fortune_timing,
    advice: ai.advice,
    gift_recommendation: ai.gift_recommendation,
  };
}

export type DreamInput = {
  dreamText: string;
  excludedScenes?: string;
  birthDate?: string;
  characterDesc: string;
};

// 기획서의 해몽 프롬프트를 바탕으로, 해몽을 더 구체적으로 쓰도록 확장 (2026-10-27 사용자 결정: "3문장 이내" 규칙 해제)
const PROMPT_TEMPLATE = `당신은 한국 전통 꿈 해몽에 밝고 다정한 말투를 쓰는 "징조"입니다.
사용자의 꿈을 해몽하고, 길몽 점수를 매겨 주세요.

[입력]
- 꿈 내용: {{dream_text}}
- 그리지 않을 장면(선택): {{excluded_scenes}}
- 생년월일(양력, 선택): {{birth_date}}
- 주인공 캐릭터 설명: {{character_desc}}

[규칙]
1. 꿈 내용을 지어내지 말고 빈 부분만 자연스럽게 이어 붙이세요.
2. 길몽 점수는 score_parts 네 가지를 따로 매기면 합쳐서 정해집니다. 각 항목은 소수 첫째 자리까지 세밀하게 평가하고, 합계를 먼저 정해 놓고 끼워 맞추지 마세요.
   - 60점·65점·68점·70점처럼 익숙한 총점이나 예시 숫자를 그대로 반복하지 마세요. 같은 상징도 행동·감정·상황에 따라 세부 점수를 달리하세요.
   - 색·숫자·크기·상징을 얻었는지 잃었는지·감정 변화 등 실제로 적힌 차이를 근거로 항목 점수를 조정하세요. 적히지 않은 디테일은 점수에 보태지 마세요.
   - 점수를 다르게 만들기 위한 무작위 가감은 하지 마세요. 내용이 비슷하면 같은 점수가 나와도 됩니다. 최종 점수는 서버가 합산 후 한 번만 정수로 반올림합니다.
   - symbol(5~65): 핵심 상징의 한국 전통 해몽 기준 길흉.
     용·봉황·임금=60~65(최상), 돼지·조상·큰불·똥=50~58(매우 높음), 맑은 물·금은보화·흰 동물=40~48(높음),
     꽃·과일·하늘 날기·합격=30~38(보통 이상), 일상 장면=20~29(중간), 이빨 빠짐·추락·쫓김=8~18(낮음).
     같은 무리 안에서도 크기·수·색이 클수록, 빛날수록 높게.
   - feeling(-5~12): 꿈 속 기분. 벅차고 행복함=10~12, 즐겁고 따뜻함=5~9, 덤덤함=0~4, 불안·답답함=-1~-3, 무서움·슬픔=-4~-5.
   - action(-5~13): 내가 한 행동. 받기·껴안기·먹기·잡기·올라타기·집으로 들어옴=9~13, 함께하기·도전·이겨 냄=4~8,
     구경만 함=0~3, 잃어버림·빼앗김·도망침=-1~-5.
   - vividness(0~10): 색·숫자·크기·빛·소리 같은 생생한 디테일이 많을수록 높게. 흐릿하면 0~3.
3. luck_tags는 [재물운, 합격운, 연애운, 건강운, 귀인운] 중 1~2개.
4. 자해·자살, 성적 내용, 실존 인물 비방이 있으면 safety_flag=true 로 하고, 나머지 글은 아주 짧게.

[해몽 쓰는 법 — 가장 중요]
A. 이 사람만의 해몽을 쓰세요. 꿈에 나온 구체적인 디테일(색, 크기, 숫자, 장소, 등장인물, 내가 한 행동, 그때 기분)을
   직접 짚어서 풀이하고, 누구 꿈에나 붙일 수 있는 말("좋은 일이 생길 거예요")만으로 채우지 마세요.
B. 상징 풀이: 한국 전통 해몽에서 그 상징이 뜻하는 바를 먼저 말하고, 꿈 속 상황에 따라 뜻이 어떻게 달라지는지 이어서 설명하세요.
   (예: 돼지가 집으로 들어오면 재물이 들어오고 나가면 새어 나감 / 맑은 물은 순조로움, 흙탕물은 근심 /
   받거나 껴안으면 그 기운이 내 것이 됨 / 크고 많을수록 기운이 큼 / 조상이 웃으면 도움, 말이 없으면 당부)
C. 꿈 속 감정이 해석을 바꿉니다. 기분이 좋았는지 무서웠는지, 누가 함께 있었는지를 반드시 반영하세요.
D. 흉몽은 "액땜"이나 "반대로 풀리는 꿈(역몽)"의 관점으로 풀어 마지막은 안심으로 끝내세요.
E. "~할 것입니다", "~하게 됩니다"처럼 단정하지 말고 "~할 기운이 있어요", "~하면 좋아요" 같은 다정한 해요체로 쓰세요. "보장", "반드시" 같은 말도 쓰지 마세요.
   꿈꾼 사람을 "작성자님", "사용자님"이라고 부르지 말고, 부를 땐 "당신"이라고 하세요. 재미로 보는 해몽입니다.
F. 로또·복권·도박·주식·코인 같은 말은 절대 쓰지 마세요. 건강운은 의학적 판단 없이 생활 습관 정도로만.
G. 생년월일은 꿈을 풀어 주는 말투와 조언에 재미로 참고하는 선택 정보입니다. 이 입력만으로 점수·등급·운 태그를 바꾸거나,
   실제 사주·간지·오행을 계산했다거나 해몽 정확성이 높아진다고 말하지 마세요. 꿈에 나온 장면과 감정이 풀이의 근거입니다.
   생년월일은 title, headline, interpretation 등 어떤 출력에도 직접 쓰거나 나이·생일로 바꿔 드러내지 마세요.
   생년월일이 없으면 꿈 내용만으로 풀어 주세요. 행운의 색이나 행운의 물건은 만들지 마세요.
H. 이 해몽은 장터에 공개되고 다른 사람에게 팔립니다. 꿈에 나온 사람의 이름(실명·별명·연예인 이름 포함)과 학교·회사 이름은
   어떤 항목에도 쓰지 말고 "친구", "엄마", "직장 동료", "유명 가수", "학교"처럼 관계나 종류로 바꿔 쓰세요. 특히 title·headline 은 꼭 지키세요.

[표현과 강조]
- 핵심 문구만 **이렇게** 감싸세요. 종합 풀이에 2~3곳, 다른 항목은 1곳 정도만 강조하며 문단 전체를 강조하지 마세요.
- title, headline, symbols, gift_recommendation.person과 message에는 강조 기호를 넣지 마세요.
- 예언은 꿈의 상징에서 상상해 보는 미래의 가능성으로 풀어 주세요. 확정된 사건·날짜나 타인의 실제 속마음을 안다고 말하지 마세요.
- 실제 병명·사고·죽음·재산 손실을 예고하거나 불안을 자극하지 마세요.
- 속마음은 진단하지 말고 꿈속 행동과 감정에 근거해 가능한 해석으로 제시하세요.

[각 항목 분량]
- symbol_readings: 꿈의 핵심 상징 1~4개. meaning 은 3~4문장 (전통적 의미 + 이 꿈 속 상황에서의 의미)
- scene_reading: 이 꿈에 담긴 나의 속마음. 행동·감정으로 짐작할 수 있는 바람·갈등·욕구를 4~6문장으로 설명
- luck_reason: 이 점수를 준 이유 1~2문장 (어떤 상징·기분·행동·디테일이 점수를 올리고 내렸는지. 숫자는 쓰지 말 것)
- interpretation: 꿈의 세부 장면을 연결한 종합 해몽 8~10문장. 두세 문단으로 나누고, 끝에는 이 상징이 예고하는 듯한 미래의 가능성을 2~3문장 포함
- fortune_timing: 호환용 빈 문자열. 별도의 시기 예측 항목은 만들지 마세요
- advice.do: 오늘 실천할 행동을 왜·언제·어떻게 할지 3~4문장 / advice.avoid: 피할 행동과 그 대신 할 행동을 2~3문장
- gift_recommendation: 이 꿈을 보내주면 좋은 사람. person은 구체적인 상황(실명 금지), reason은 꿈의 상징과 연결한 이유 2~3문장, message는 함께 보낼 짧은 응원 한마디
- headline: 해몽 결론 한 줄 20자 이내 / title: 꿈 제목 12자 이내

[출력]
{
  "safety_flag": false,
  "title": "꿈 제목 12자 이내",
  "symbols": ["돼지", "금화"],
  "symbol_readings": [{"symbol": "돼지", "meaning": "2~3문장"}],
  "scene_reading": "2~3문장",
  "score_parts": {"symbol": 36.3, "feeling": 8.6, "action": 9.2, "vividness": 6.4},
  "luck_reason": "1~2문장",
  "luck_tags": ["재물운"],
  "headline": "해몽 결론 한 줄 (20자 이내)",
  "interpretation": "종합 해몽과 미래의 가능성 8~10문장",
  "fortune_timing": "",
  "advice": {"do": "실천할 행동 3~4문장", "avoid": "조심할 행동과 대안 2~3문장"},
  "gift_recommendation": {"person": "이런 상황의 사람", "reason": "꿈의 상징과 연결한 이유", "message": "함께 보낼 응원"}
}`;

export function buildDreamPrompt(input: DreamInput): string {
  const values: Record<string, string> = {
    dream_text: input.dreamText,
    excluded_scenes: input.excludedScenes?.trim() || "없음",
    birth_date: input.birthDate?.trim() || "없음",
    character_desc: input.characterDesc,
  };
  return PROMPT_TEMPLATE.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key]);
}

// 캐릭터 프리셋은 3단계에서 연결. 지금은 기본 주인공
export const DEFAULT_CHARACTER_DESC =
  "a cheerful Korean college student in their 20s with a short bob haircut, wearing yellow pajamas";

// 상세 해몽 도입 전에 기록한 꿈에 상세 해몽만 덧붙이기 (등급·점수·결론은 그대로 두고 맞춰서)
export type ReadingInput = {
  dreamText: string;
  title: string;
  gradeName: string;
  score: number;
  headline: string;
  interpretation: string;
};

export function buildReadingPrompt(input: ReadingInput): string {
  const rules = PROMPT_TEMPLATE.slice(PROMPT_TEMPLATE.indexOf("[해몽 쓰는 법"), PROMPT_TEMPLATE.indexOf("[출력]"));
  return `당신은 한국 전통 꿈 해몽에 밝고 다정한 말투를 쓰는 "징조"입니다.
이미 등급과 결론이 정해진 꿈에 "상세 해몽"을 덧붙여 주세요. 등급·점수·결론은 바꾸지 말고, 그에 어울리게 풀이하세요.

[꿈]
- 꿈 내용: ${input.dreamText}
- 제목: ${input.title}
- 등급: ${input.gradeName} (길몽 점수 ${input.score}점)
- 결론 한 줄: ${input.headline}
- 먼저 쓴 풀이: ${input.interpretation}

${rules}[출력]
{
  "symbol_readings": [{"symbol": "상징", "meaning": "2~3문장"}],
  "scene_reading": "2~3문장",
  "luck_reason": "1~2문장",
  "fortune_timing": "",
  "advice": {"do": "실천할 행동 3~4문장", "avoid": "조심할 행동과 대안 2~3문장"},
  "gift_recommendation": {"person": "이런 상황의 사람", "reason": "꿈의 상징과 연결한 이유", "message": "함께 보낼 응원"}
}`;
}

