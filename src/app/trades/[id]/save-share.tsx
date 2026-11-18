"use client";

import { useState } from "react";
import { track } from "@/lib/track-client";

// 증서 이미지 저장 / 공유 (휴대폰은 공유 창으로 카톡·인스타에 바로, 안 되면 내려받기). 누를 때만 동작
export default function SaveShare({ imageUrl, title, tradeId }: { imageUrl: string; title: string; tradeId: string }) {
  const [busy, setBusy] = useState(false);
  const downloadUrl = `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}download=1`;

  async function share() {
    setBusy(true);
    try {
      const blob = await (await fetch(imageUrl)).blob();
      const file = new File([blob], "mongsang-certificate.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        track("share_attempt", { target: "certificate", id: tradeId, method: "native" });
        try {
          await navigator.share({ files: [file], title: `몽상가게 · ${title} 꿈 계약서` });
          track("share_complete", { target: "certificate", id: tradeId, method: "native" });
        } catch (e) {
          if ((e as Error).name === "AbortError") track("share_cancel", { target: "certificate", id: tradeId, method: "native" });
        }
      } else {
        window.location.href = downloadUrl;
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 grid grid-cols-2 gap-2">
      <a href={downloadUrl} className="rounded-xl bg-white/10 py-4 text-center font-cute text-base active:scale-[0.98]">
        이미지 저장
      </a>
      <button type="button" onClick={share} disabled={busy} className="rounded-xl bg-moon py-4 font-cute text-base text-night active:scale-[0.98] disabled:opacity-40">
        {busy ? "준비 중…" : "공유하기"}
      </button>
    </div>
  );
}
