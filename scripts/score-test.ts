// 점수 분포 테스트: 샘플 꿈 10개를 Gemini로 해몽해 점수·등급을 표로 출력 (DB 저장 안 함)
// 실행: npx tsx --env-file=.env.local scripts/score-test.ts
import { DEFAULT_CHARACTER_DESC } from "../src/lib/dream";
import { GEMINI_MODELS, interpretDream } from "../src/lib/gemini";
import { GRADES, gradeForScore } from "../src/lib/grades";

const SAMPLES = [
  "하늘에서 커다란 황금 용이 내려와 내 품에 안겼어요. 온몸이 따뜻하고 눈부셨어요.",
  "시골집 마당에 돼지 다섯 마리가 들어와서 엄마가 잡으라고 했어요. 신났어요.",
  "돌아가신 할아버지가 웃으면서 봉투를 주셨어요. 열어 보니 돈이 들어 있었어요.",
  "맑은 계곡물에 발을 담갔는데 물고기들이 반짝였어요. 기분이 상쾌했어요.",
  "시험장에 들어갔는데 문제가 다 아는 거라서 술술 풀었어요.",
  "친구랑 카페에서 수다 떨고 집에 오는 평범한 꿈이었어요.",
  "지하철을 놓쳐서 계속 뛰어다녔어요. 좀 답답했어요.",
  "이빨이 하나 흔들리더니 빠져 버렸어요. 깜짝 놀라서 깼어요.",
  "높은 건물에서 떨어지는 꿈을 꿨어요. 떨어지다가 깼어요.",
  "누군가에게 쫓겨서 골목을 도망 다녔어요. 무서웠어요.",
  // 평범하지만 기분 좋은 꿈들 (예전엔 다 68점 소길몽에 몰림 → 2026-10-29 점수 세분화)
  "엄마랑 바닷가로 여행을 갔어요. 같이 조개를 줍고 웃었어요. 따뜻했어요.",
  "친구랑 경진대회에 나가서 같이 발표를 했어요. 떨렸지만 끝까지 해냈어요.",
  "연인과 벚꽃길을 걸었어요. 분홍 꽃잎이 계속 떨어졌고 행복했어요.",
  "친구랑 크게 다퉜는데 마지막에 서로 사과하고 안아 줬어요.",
  "학교 복도를 그냥 걸어 다니는 꿈이었어요. 별일은 없었어요.",
];

async function main() {
  console.log(`모델 순서: ${GEMINI_MODELS.join(" → ")}\n`);
  const rows: { no: number; score: number; parts: string; grade: string; tags: string; title: string; headline: string; model: string; sec: string }[] = [];
  for (const [i, text] of SAMPLES.entries()) {
    const t0 = Date.now();
    try {
      const r = await interpretDream({ dreamText: text, characterDesc: DEFAULT_CHARACTER_DESC });
      const g = gradeForScore(r.luck_score);
      rows.push({ no: i + 1, score: r.luck_score, parts: Object.values(r.score_parts).join("/"), grade: `${g.name}(${g.code})`, tags: r.luck_tags.join(","), title: r.title, headline: r.headline, model: r.model, sec: ((Date.now() - t0) / 1000).toFixed(1) });
    } catch (e) {
      console.error(`#${i + 1} 실패:`, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 4000)); // 무료 등급 분당 요청 한도 대비
  }

  console.log("| # | 꿈 | 점수 | 상징/기분/행동/생생 | 등급 | 운 | 제목 | 결론 한 줄 | 모델 | 걸린 초 |");
  console.log("|---|---|---|---|---|---|---|---|---|---|");
  for (const r of rows) {
    console.log(`| ${r.no} | ${SAMPLES[r.no - 1].slice(0, 18)}… | ${r.score} | ${r.parts} | ${r.grade} | ${r.tags} | ${r.title} | ${r.headline} | ${r.model} | ${r.sec} |`);
  }

  console.log("\n등급 | 목표 비율 | 이번 결과");
  for (const g of GRADES) {
    const n = rows.filter((r) => r.grade.endsWith(`(${g.code})`)).length;
    console.log(`${g.name}(${g.code}) | ${g.targetShare * 100}% | ${n}/${rows.length}`);
  }
}

main();
