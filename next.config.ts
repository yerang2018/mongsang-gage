import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 그림 만드는 곳(증서·카톡 미리보기)의 예비 한글 폰트를 Vercel 배포 파일에 포함 (구글 폰트를 못 받을 때 씀)
  outputFileTracingIncludes: {
    "/trades/[id]/certificate.png": ["./assets/fonts/Pretendard-Bold.otf"],
    "/sale/[id]/opengraph-image": ["./assets/fonts/Pretendard-Bold.otf"],
    "/requests/[id]/opengraph-image": ["./assets/fonts/Pretendard-Bold.otf"],
    "/opengraph-image": ["./assets/fonts/Pretendard-Bold.otf"],
  },
};

export default nextConfig;
