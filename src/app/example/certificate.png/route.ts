import { renderCertificate } from "@/lib/certificate-image";
import { EXAMPLE_CERTIFICATE } from "@/lib/example-dream";

// 예시 매매 증서 그림 (가상의 꿈·닉네임, 실제 거래 아님)
export async function GET() {
  const image = await renderCertificate(EXAMPLE_CERTIFICATE);
  image.headers.set("Cache-Control", "public, max-age=86400");
  return image;
}
