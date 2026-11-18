import { ImageResponse } from "next/og";
import { certificateFonts, loadGoogleFont } from "@/lib/og-fonts";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "몽상가게 — 꿈을 사고파는 곳, 좋은 기운이 오가는 곳.";

export default async function Image() {
  const text = "몽상가게 꿈을 사고파는 곳, 좋은 기운이 오가는 곳. 국내 최초 꿈 거래 서비스 닉네임으로 시작하기";
  const fonts = await certificateFonts(text);
  try {
    const brand = await loadGoogleFont("Song Myung", 400, "몽상가게");
    fonts.push({ name: "Brand", data: brand, weight: 400, style: "normal" });
  } catch {
    // 기본 글꼴로도 미리보기는 표시해요.
  }
  return new ImageResponse(
    <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#ffffff", color: "#403154", fontFamily: "Title" }}>
      <div style={{ display: "flex", fontFamily: fonts.some(f => f.name === "Brand") ? "Brand" : "Title", fontSize: 78 }}>몽상가게</div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 32, fontSize: 31, lineHeight: 1.65, color: "#626064" }}>
        <div style={{ display: "flex" }}>꿈을 사고파는 곳,</div>
        <div style={{ display: "flex" }}>좋은 기운이 오가는 곳.</div>
      </div>
      <div style={{ display: "flex", marginTop: 18, fontSize: 23, color: "#8b858f" }}>국내 최초 꿈 거래 서비스</div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: 490, height: 76, marginTop: 52, borderRadius: 16, background: "#403154", color: "#ffffff", fontSize: 29 }}>닉네임으로 시작하기</div>
    </div>,
    { ...size, fonts },
  );
}
