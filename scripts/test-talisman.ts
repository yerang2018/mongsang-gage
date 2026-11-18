// 부적 카드 그림 시험: 가짜 선물로 PNG를 만들어 봄
// 실행: npx tsx --tsconfig tsconfig.scripts.json scripts/test-talisman.ts [저장할 파일]  (인터넷 필요: 구글 폰트, 샌드박스 밖)
import fs from "node:fs/promises";
import { renderTalisman } from "../src/lib/talisman-image";

async function main() {
  const out = process.argv[2] ?? "talisman-test.png";
  const res = await renderTalisman({
    kind: "luck_set",
    sender_name: "예랑",
    recipient_name: "민지",
    open_at: "2026-11-19T07:00:00+09:00",
    opened: true,
    message: "수능 대박 나자!",
    dream_id: null,
    title: "금빛 잉어를 안은 꿈",
    grade: "SS",
    luck_tags: ["합격운", "재물운"],
    headline: "큰 기회가 품 안으로 들어올 기운",
    dream_text: null,
    interpretation: null,
    reading: null,
    lucky: null,
    on_sale: false,
  });
  await fs.writeFile(out, Buffer.from(await res.arrayBuffer()));
  console.log("저장:", out);
}
main();
