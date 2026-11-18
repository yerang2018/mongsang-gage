import type { Metadata, Viewport } from "next";
import { Gowun_Batang, Song_Myung } from "next/font/google";
import localFont from "next/font/local";
import Tracker from "./tracker";
import "./globals.css";

// 서비스 이름은 송명체, 제목은 고운바탕, 본문과 버튼은 SUIT를 사용해요.
const gowunBatang = Gowun_Batang({ weight: "400", subsets: ["latin"], variable: "--font-gowun-batang", display: "swap", preload: false });
const suit = localFont({ src: "./fonts/SUIT-Variable.woff2", weight: "100 900", variable: "--font-suit", display: "swap" });
const songMyung = Song_Myung({ weight: "400", variable: "--font-song-myung", display: "swap" });

// 공유 이미지도 실제 공개 서비스 주소에서 불러와요.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mongsang-gage-luckset-quanliza.vercel.app/";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "몽상가게 | 꿈을 사고파는 곳",
  description: "꿈을 사고파는 곳, 좋은 기운이 오가는 곳. 좋은 기운이 필요한 날, 마음에 드는 꿈을 골라보세요.",
  // 카톡·문자 링크 미리보기. 그림은 opengraph-image.tsx (판매 카드·꿈 구해요는 각자 그림)
  openGraph: {
    title: "몽상가게 | 꿈을 사고파는 곳",
    description: "꿈을 사고파는 곳, 좋은 기운이 오가는 곳. 좋은 기운이 필요한 날, 마음에 드는 꿈을 골라보세요.",
    siteName: "몽상가게",
    locale: "ko_KR",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${suit.variable} ${gowunBatang.variable} ${songMyung.variable}`}>
      <body className="antialiased">
        <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-6 pt-8">
          <div className="flex-1">{children}</div>
          <p className="mt-10 text-center text-xs text-white/60">🌙 꿈의 기운을 잇는 곳</p>
          <Tracker />
        </main>
      </body>
    </html>
  );
}
