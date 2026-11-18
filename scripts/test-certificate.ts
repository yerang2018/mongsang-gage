// 매매 증서 그림 시험: 가짜 거래로 PNG를 만들어 봄
// 실행: npx tsx --tsconfig tsconfig.scripts.json scripts/test-certificate.ts [저장할 파일]  (인터넷 필요: 구글 폰트)
import fs from "node:fs/promises";
import { renderCertificate } from "../src/lib/certificate-image";

async function main() {
  const out = process.argv[2] ?? "certificate-test.png";
  const res = await renderCertificate({
    trade_id: "t",
    dream_id: "d",
    title: "금빛 잉어를 안은 꿈",
    grade: "SS",
    luck_tags: ["재물운", "귀인운"],
    luck_score: 86,
    price_type: "beads",
    price: 300,
    cheer_message: null,
    created_at: new Date().toISOString(),
    seller_nickname: "하린(예시)",
    buyer_nickname: "서연(예시)",
  });
  await fs.writeFile(out, Buffer.from(await res.arrayBuffer()));
  console.log("저장:", out);
}
main();
