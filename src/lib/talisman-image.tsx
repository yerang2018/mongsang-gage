import { ImageResponse } from "next/og";
import { luckWish, type GiftView } from "./gift";
import { gradeByCode } from "./grades";
import { certificateFonts } from "./og-fonts";

// 행운 세트 부적 카드 (1080×1920, 휴대폰 배경화면 크기). 보라 밤하늘 + 금색, 글꼴은 화면과 같은 고운돋움
// 받는 사람 이름을 새김: "민지님의 합격을 빕니다". 꿈 원문은 넣지 않음(카드만 따로 퍼져도 괜찮게)
const W = 1080;
const H = 1920;
const MOON = "#403154"; // 2026-11-04 흰 바탕 앱에 맞춰 밝은 그림: 강조색은 보라
const NIGHT = "#4a3200"; // 금색 인장·뱃지 위 글자
const SUB = "rgba(33,33,36,0.7)";
const FOOTER = "꿈의 기운을 잇는 곳, 몽상가게";
// [가로, 세로, 크기] — 카드 안 여백에 흩뿌린 별
const STARS: [number, number, number][] = [
  [120, 360, 16],
  [800, 300, 12],
  [860, 700, 18],
  [90, 900, 12],
  [780, 1060, 14],
  [180, 1180, 18],
  [640, 1290, 10],
];

export async function renderTalisman(g: GiftView) {
  const grade = gradeByCode(g.grade);
  const wish = luckWish(g.recipient_name, g.luck_tags);
  const date = new Date(g.open_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });
  const tags = (g.luck_tags ?? []).map((t) => `#${t}`);
  const allText = ["행운 부적", "몽상가게", grade?.name ?? "", g.headline ?? "", wish, date, FOOTER, `${g.sender_name}님이 보냄`, g.message ?? "", "“”", ...tags].join("");
  const fonts = await certificateFonts(allText + "0123456789,.#()년월일 ");

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          padding: 64,
          background: "linear-gradient(170deg, #ffffff 0%, #f5f1ff 55%, #e9e1fd 100%)",
          fontFamily: "Title",
          color: "#212124",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            borderRadius: 56,
            border: `3px solid rgba(106,79,214,0.45)`,
            padding: "80px 64px 64px",
            position: "relative",
          }}
        >
          {/* 작은 별 (돌린 네모) */}
          {STARS.map(([x, y, size], i) => (
            <div key={i} style={{ position: "absolute", left: x, top: y, width: size, height: size, background: MOON, opacity: 0.7, transform: "rotate(45deg)" }} />
          ))}
          <div style={{ display: "flex", fontSize: 40, color: MOON, letterSpacing: 8 }}>행운 부적</div>

          {/* 금색 달 */}
          <div
            style={{
              display: "flex",
              marginTop: 90,
              width: 340,
              height: 340,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #f7d774 0%, #d9932f 100%)",
              boxShadow: "0 0 90px rgba(247,215,116,0.45)",
            }}
          >
            <div style={{ display: "flex", fontFamily: "Cute", fontSize: 92, color: NIGHT, lineHeight: 1.1 }}>{grade?.name ?? "길몽"}</div>
          </div>

          <div style={{ display: "flex", gap: 18, marginTop: 70 }}>
            {tags.map((t) => (
              <div key={t} style={{ display: "flex", padding: "12px 32px", borderRadius: 999, background: "rgba(106,79,214,0.1)", color: MOON, fontSize: 38 }}>
                {t}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", marginTop: 70, fontSize: 50, lineHeight: 1.4, textAlign: "center", wordBreak: "keep-all", maxWidth: 820 }}>
            “{g.headline}”
          </div>

          <div style={{ display: "flex", flex: 1 }} />
          {g.message && (
            <div style={{ display: "flex", fontSize: 40, color: "rgba(33,33,36,0.85)", textAlign: "center", wordBreak: "keep-all", maxWidth: 820, marginBottom: 70 }}>
              “{g.message}”
            </div>
          )}

          <div style={{ display: "flex", fontFamily: "Cute", fontSize: 64, color: MOON, textAlign: "center", wordBreak: "keep-all" }}>{wish}</div>
          <div style={{ display: "flex", marginTop: 26, fontSize: 34, color: SUB }}>
            {date}, {g.sender_name}님이 보냄
          </div>
          <div style={{ display: "flex", marginTop: 70, fontSize: 28, color: "rgba(33,33,36,0.55)" }}>{FOOTER}</div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts },
  );
}
