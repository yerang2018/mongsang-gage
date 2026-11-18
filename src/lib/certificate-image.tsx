import { ImageResponse } from "next/og";
import { type CertificateRow } from "./certificate";
import { gradeByCode } from "./grades";
import { formatKoreanDate } from "./time";
import { certificateFonts } from "./og-fonts";
import { subjectParticle } from "./korean";

const W = 1080;
const H = 1528;
const INK = "#29232e";
const LINE = "#d5cfd9";

export async function renderCertificate(c: CertificateRow) {
  const grade = gradeByCode(c.grade);
  const date = formatKoreanDate(c.created_at);
  const serial = c.trade_id.replace(/[^a-z0-9]/gi, "").slice(0, 12).toUpperCase() || "EXAMPLE";
  const tags = [...new Set(c.luck_tags ?? [])].join(" · ") || "기운 정보 없음";
  const declaration = `${c.seller_nickname}의 꿈을 ${c.buyer_nickname}${subjectParticle(c.buyer_nickname)} 이어받습니다.`;
  const introduction = `양도인 ${c.seller_nickname} 님과 양수인 ${c.buyer_nickname} 님은 몽상가게에서 이루어진 아래 꿈 거래 내용을 확인합니다.`;
  const price = c.price_type === "beads" ? `꿈 구슬 ${c.price.toLocaleString()}개` : "응원 한마디";
  const terms = [
    { label: "꿈 이름", value: c.title },
    { label: "꿈 등급", value: `${grade?.name ?? c.grade}${typeof c.luck_score === "number" ? ` · ${c.luck_score}점` : ""}` },
    { label: "꿈에 담긴 기운", value: tags },
    { label: "양도 대가", value: price },
    { label: "거래일", value: date },
  ];
  const summary = c.headline || "이 꿈의 원문과 자세한 해몽은 양수인의 꿈서랍에서 확인할 수 있습니다.";
  const words = ["몽상가게", "꿈 양도·양수 계약서", "아 래", "거래번호", "양도인", "양수인", "꿈 설명", "거래 확인", "본 문서는 몽상가게에서 완료된 꿈 거래 내역을 기록한 증서입니다.", introduction, declaration, summary, serial, ...terms.flatMap(t => [t.label, t.value])].join(" ");
  const fonts = await certificateFonts(words, true);
  return new ImageResponse(
    <div style={{ width: W, height: H, display: "flex", background: "#ffffff", color: INK, padding: 48, fontFamily: "Body" }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, border: `2px solid ${INK}`, padding: "64px 56px 48px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 20, color: "#776d7e" }}>거래번호 {serial}</div>
        <div style={{ display: "flex", justifyContent: "center", fontFamily: "Title", fontSize: 49, letterSpacing: 2, marginTop: 48 }}>꿈 양도·양수 계약서</div>
        <div style={{ display: "flex", marginTop: 58, fontSize: 26, lineHeight: 1.9 }}>{introduction}</div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 38, fontSize: 29, letterSpacing: 18 }}>아 래</div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 28, borderTop: `1px solid ${LINE}` }}>
          {terms.map(term => <div key={term.label} style={{ display: "flex", borderBottom: `1px solid ${LINE}`, padding: "16px 0", fontSize: 27, lineHeight: 1.65 }}>
            <div style={{ display: "flex", width: 205, flexShrink: 0, color: "#776d7e", fontSize: 24 }}>{term.label}</div>
            <div style={{ display: "flex", flex: 1 }}>{term.value}</div>
          </div>)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 32 }}>
          <div style={{ display: "flex", fontSize: 23, color: "#776d7e" }}>꿈 설명</div>
          <div style={{ display: "flex", marginTop: 10, fontSize: 26, lineHeight: 1.8 }}>{summary}</div>
        </div>
        <div style={{ display: "flex", marginTop: 32, fontSize: 27, lineHeight: 1.8 }}>{declaration}</div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: "auto", paddingTop: 32, fontSize: 27 }}>{date}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 36, fontSize: 27 }}>
          <Signature label="양도인" name={c.seller_nickname} />
          <Signature label="양수인" name={c.buyer_nickname} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", fontFamily: "Title", fontSize: 29, marginTop: 40 }}>몽상가게</div>
        <div style={{ display: "flex", justifyContent: "center", textAlign: "center", fontSize: 18, color: "#776d7e", marginTop: 16 }}>본 문서는 몽상가게에서 완료된 꿈 거래 내역을 기록한 증서입니다.</div>
      </div>
    </div>,
    { width: W, height: H, fonts },
  );
}

function Signature({ label, name }: { label: string; name: string }) {
  return <div style={{ display: "flex", alignItems: "center" }}>
    <div style={{ display: "flex", width: 205, flexShrink: 0 }}>{label}</div>
    <div style={{ display: "flex", flex: 1 }}>{name}</div>
    <div style={{ display: "flex", fontSize: 21, color: "#776d7e" }}>거래 확인</div>
  </div>;
}
