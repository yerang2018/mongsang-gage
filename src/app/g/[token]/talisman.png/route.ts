import { loadGift } from "@/lib/gift-data";
import { renderTalisman } from "@/lib/talisman-image";

// 부적 카드 그림: 행운 세트이고 열린 뒤에만 (열리기 전·응원 카드는 404). ?download=1 이면 저장
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const g = await loadGift(token, false);
  if (!g || !g.opened || g.kind !== "luck_set") return new Response("not found", { status: 404 });

  const image = await renderTalisman(g);
  image.headers.set("Cache-Control", "private, max-age=300");
  if (new URL(req.url).searchParams.has("download")) image.headers.set("Content-Disposition", `attachment; filename="mongsang-talisman.png"`);
  return image;
}
