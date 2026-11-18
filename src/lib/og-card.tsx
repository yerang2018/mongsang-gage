import { ImageResponse } from "next/og";
import { gradeByCode } from "./grades";
import { certificateFonts } from "./og-fonts";

// 카톡·문자에 링크를 붙였을 때 뜨는 미리보기 그림 (1200×630). 판매 카드·꿈 구해요·첫 화면이 같이 씀
export const OG_SIZE = { width: 1200, height: 630 };

const MOON = "#403154"; // 2026-11-04 흰 바탕 앱에 맞춰 밝은 그림: 강조색은 보라
// 장터 목록의 등급 색 네모(listing-card.tsx THUMB)와 같은 색
const GRADE_BG: Record<string, [string, string, string]> = {
  SSS: ["#fff1bf", "#f6c744", "#5a3d00"],
  SS: ["#efe7ff", "#b9a2f5", "#3b2386"],
  S: ["#e4ebff", "#9fb6f5", "#1d3478"],
  A: ["#dcf5f0", "#8fd3c6", "#0f4d45"],
  B: ["#f0f1f5", "#c9cdd8", "#3d4252"],
  C: ["#f3f3f5", "#dddde4", "#6b6b78"],
};

export type ShareCard = {
  kicker: string; // 맨 위 작은 글씨
  title: string;
  sub?: string;
  score?: number | null;
  grade?: string; // 등급 코드가 있으면 왼쪽에 등급 네모
  chips?: string[];
  footer?: string;
};

export async function renderShareCard(c: ShareCard) {
  const g = c.grade ? gradeByCode(c.grade) : undefined;
  const badgeSub = typeof c.score === "number" ? `${c.score}점` : (g?.code ?? "");
  const footer = c.footer ?? "꿈의 기운을 잇는 곳";
  const chips = c.chips ?? [];
  const text = [c.kicker, c.title, c.sub ?? "", g?.name ?? "", badgeSub, footer, "몽상가게", ...chips].join("");
  const fonts = await certificateFonts(text + "0123456789,.%#~ ");
  const [from, to, ink] = GRADE_BG[c.grade ?? ""] ?? GRADE_BG.B;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "56px 72px",
          background: "linear-gradient(160deg, #ffffff 0%, #ece5fd 70%)",
          color: "#212124",
          fontFamily: "Title",
        }}
      >
        <div style={{ display: "flex", fontFamily: "Cute", fontSize: 34, color: MOON }}>{c.kicker}</div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 56 }}>
          {g && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: 270,
                height: 270,
                flexShrink: 0,
                borderRadius: 40,
                background: `linear-gradient(135deg, ${from}, ${to})`,
                color: ink,
              }}
            >
              <div style={{ display: "flex", fontFamily: "Cute", fontSize: 72 }}>{g.name}</div>
              <div style={{ display: "flex", marginTop: 10, fontSize: 26, opacity: 0.85 }}>{badgeSub}</div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", fontFamily: "Cute", fontSize: 68, lineHeight: 1.2, wordBreak: "keep-all" }}>{c.title}</div>
            {c.sub && <div style={{ display: "flex", marginTop: 20, fontSize: 36, lineHeight: 1.4, color: "rgba(33,33,36,0.8)", wordBreak: "keep-all" }}>{c.sub}</div>}
            {chips.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 30 }}>
                {chips.map((chip, i) => (
                  <div
                    key={chip}
                    style={{
                      display: "flex",
                      padding: "10px 26px",
                      borderRadius: 999,
                      fontFamily: "Cute",
                      fontSize: 32,
                      background: i === 0 ? MOON : "rgba(33,33,36,0.14)",
                      color: i === 0 ? "#ffffff" : "#212124",
                    }}
                  >
                    {chip}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "rgba(33,33,36,0.6)" }}>
          <div style={{ display: "flex" }}>{footer}</div>
          <div style={{ display: "flex", fontFamily: "Cute", color: MOON }}>몽상가게</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
