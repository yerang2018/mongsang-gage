import { type CertificateRow } from "@/lib/certificate";
import { renderCertificate } from "@/lib/certificate-image";
import { createClient } from "@/lib/supabase/server";

// 매매 증서 이미지 (판 사람·산 사람만 받을 수 있음)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase.rpc("trade_certificate", { p_trade: id }).maybeSingle<CertificateRow>();
  if (!c) return new Response("not found", { status: 404 });

  const { data: dream } = await supabase.from("dreams").select("luck_tags, luck_score, headline").eq("id", c.dream_id).maybeSingle<{ luck_tags: string[] | null; luck_score: number | null; headline: string | null }>();
  const image = await renderCertificate({ ...c, luck_tags: dream?.luck_tags, luck_score: dream?.luck_score, headline: dream?.headline });
  const download = new URL(req.url).searchParams.has("download");
  image.headers.set("Cache-Control", "private, max-age=300");
  if (download) image.headers.set("Content-Disposition", `attachment; filename="mongsang-energy-deed.png"`);
  return image;
}
