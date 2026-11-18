import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadGift } from "@/lib/gift-data";
import { createClient } from "@/lib/supabase/server";
import GiftScreen from "./gift-screen";

export const dynamic = "force-dynamic";

// 카톡 미리보기에는 꿈 내용을 넣지 않음 (보낸 사람 이름만). 그림은 첫 화면 기본 그림
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const g = await loadGift((await params).token, false);
  const title = g ? `${g.sender_name}님이 보낸 꿈 선물이 도착했어요` : "몽상가게 꿈 선물";
  return { title: `${title} | 몽상가게`, description: "열어 보면 좋은 꿈의 기운이 들어 있어요", robots: { index: false, follow: false }, openGraph: { title, description: "열어 보면 좋은 꿈의 기운이 들어 있어요", siteName: "몽상가게" } };
}

// 선물 링크 (로그인 없이). 열렸는지는 DB 함수 get_gift 가 서버 시간으로 판단 → 열리기 전엔 내용이 아예 내려오지 않음
// 보낸 사람이 자기 선물을 미리 보는 건 "본 횟수"에 안 셈 (gifts 표는 보낸 사람만 읽을 수 있음)
export default async function GiftPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: mine } = user ? await supabase.from("gifts").select("id").eq("token", token).maybeSingle() : { data: null };
  const g = await loadGift(token, !mine);
  if (!g) notFound();
  return <GiftScreen g={g} token={token} />;
}
