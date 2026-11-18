"use client";

import { useState } from "react";
import { track, type ShareTarget } from "@/lib/track-client";

// 친구에게 보내기 + 링크 복사 (판매 카드·내 꿈 화면·꿈 구해요 공통). 누를 때만 동작하고 메시지를 대신 보내지 않음
// 공유 창이 있는 기기(휴대폰)는 공유 창, 없으면 링크 복사. 공유 창을 닫으면(취소) 성공으로 세지 않음
// 링크엔 ?via=share|copy 를 붙여 "공유 링크로 들어온 방문"을 셀 수 있게 함 (tracker.tsx가 읽고 주소에서 지움)
export default function ShareButtons({
  target,
  id,
  path,
  title,
  text,
  label = "친구에게 보내기",
  secondary = false,
  compact = false,
}: {
  target: ShareTarget;
  id: string;
  path: string;
  title: string;
  text: string;
  label?: string;
  compact?: boolean;
  secondary?: boolean; // 눈에 덜 띄는 모양 (구매 버튼 아래 등)
}) {
  const [copied, setCopied] = useState(false);
  // 자동 복사가 막힌 브라우저(앱 안 브라우저·카톡 등)에선 링크를 화면에 보여 줌. window.prompt 도 막혀 있어서 쓰지 않음
  const [manualLink, setManualLink] = useState<string | null>(null);
  const url = (via: string) => `${window.location.origin}${path}?via=${via}`;

  async function share() {
    if (!navigator.share) return copy();
    track("share_attempt", { target, id, method: "native" });
    try {
      await navigator.share({ title, text, url: url("share") });
      track("share_complete", { target, id, method: "native" }); // 공유 창에서 앱을 골랐다는 뜻일 뿐, 상대가 받았다는 뜻은 아님
    } catch (e) {
      if ((e as Error).name === "AbortError") track("share_cancel", { target, id, method: "native" });
      else await copy(); // 공유 창을 못 열면 링크 복사로
    }
  }

  async function copy() {
    const link = url("copy");
    track("share_attempt", { target, id, method: "copy" });
    if (await writeClipboard(link)) {
      track("link_copied", { target, id, method: "copy" });
      setManualLink(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setManualLink(link);
    }
  }

  const manualBox = manualLink && (
    <div className="mt-2 rounded-xl bg-white/5 p-3 text-left">
      <p className="text-xs text-white/70">자동 복사가 안 되는 화면이에요. 아래 링크를 길게 눌러 복사해 주세요</p>
      <input
        readOnly
        value={manualLink}
        onFocus={(e) => e.currentTarget.select()}
        onClick={(e) => e.currentTarget.select()}
        className="mt-2 w-full rounded-lg bg-night/60 px-3 py-2.5 text-sm text-white select-all"
        aria-label="공유 링크"
      />
    </div>
  );

  if (compact) {
    return <div>
      <button type="button" onClick={share} className="min-h-12 w-full rounded-xl bg-moon px-4 font-cute text-night active:scale-[0.98]">{copied ? "링크 복사 완료" : label}</button>
      {manualBox}
      {copied && <p role="status" className="mt-2 text-center text-xs text-white/60">친구와의 대화에 붙여 넣어 보내 주세요.</p>}
    </div>;
  }

  if (secondary) {
    return (
      <div>
        <div className="flex items-center justify-center gap-4 text-sm">
          <button type="button" onClick={share} className="inline-flex min-h-11 items-center text-moon underline underline-offset-4">
            {label}
          </button>
          <button type="button" onClick={copy} className="inline-flex min-h-11 items-center text-white/70 underline underline-offset-4">
            {copied ? "복사 완료 ✓" : "링크 복사"}
          </button>
        </div>
        {manualBox}
      </div>
    );
  }
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={share} className="min-h-12 rounded-xl bg-moon font-cute text-night active:scale-[0.98]">
          {label}
        </button>
        <button type="button" onClick={copy} className="min-h-12 rounded-xl bg-white/10 font-cute active:scale-[0.98]">
          {copied ? "복사 완료 ✓" : "링크 복사"}
        </button>
      </div>
      {manualBox ?? (
        <p className="mt-2 text-center text-xs text-white/60" aria-live="polite">
          {copied ? "링크를 복사했어요. 카톡 등에 붙여 넣어 보내 주세요" :" "}
        </p>
      )}
    </div>
  );
}

// 클립보드 복사: 새 방식(navigator.clipboard)이 막히면 예전 방식(execCommand)으로 한 번 더. 둘 다 안 되면 false
async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    el.remove();
    return ok;
  }
}
