"use client";

import ShareButtons from "@/app/share-buttons";

// 요청한 사람에게: 친구에게 링크 보내기 (휴대폰은 공유 창, 컴퓨터는 링크 복사)
export default function ShareRequest({ path, tag, requestId }: { path: string; tag: string; requestId: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-5">
      <p className="text-sm break-keep text-white/70">장터에 올라갔어요. 링크를 친구에게 보내면 꿈이 더 빨리 모여요.</p>
      <div className="mt-4">
        <ShareButtons target="request" id={requestId} path={path} title="몽상가게 · 꿈 구해요" text={`🌙 #${tag} 꿈 구해요! 좋은 꿈 꾼 사람 내밀어 줘`} />
      </div>
    </div>
  );
}
