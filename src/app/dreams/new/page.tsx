"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DreamStreamEvent } from "@/app/api/dreams/route";
import PledgeCheck from "@/app/pledge-check";
import SafetyNotice from "@/app/safety-notice";
import { BEAD_REWARDS } from "@/lib/grades";
import DreamWaiting, { type LiveReading } from "./dream-waiting";
import { isValidBirthDate, todayInKorea } from "@/lib/birth-date";

const EMPTY_LIVE: LiveReading = { readings: [], scoring: false, retrying: false };

export default function NewDreamPage() {
  const router = useRouter();
  const [dreamText, setDreamText] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [pledged, setPledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState<LiveReading>(EMPTY_LIVE);
  const [error, setError] = useState("");
  const [safety, setSafety] = useState(false);

  // 서버가 해몽을 만드는 동안 한 줄씩 보내는 소식(NDJSON)을 받아 기다림 화면에 반영
  function apply(e: DreamStreamEvent) {
    switch (e.type) {
      case "title":
        return setLive((l) => ({ ...l, title: e.value, retrying: false }));
      case "symbols":
        return setLive((l) => ({ ...l, symbols: e.value }));
      case "reading":
        return setLive((l) => ({ ...l, readings: [...l.readings, { symbol: e.symbol, meaning: e.meaning }] }));
      case "scoring":
        return setLive((l) => ({ ...l, scoring: true }));
      case "retry":
        return setLive({ ...EMPTY_LIVE, retrying: true });
    }
  }

  async function submit() {
    if (!pledged) { setError("판매 서약에 체크해 주세요."); return; }
    if (!isValidBirthDate(birthDate)) {
      setError("생년월일을 확인해 주세요.");
      return;
    }
    setLoading(true);
    setError("");
    setLive(EMPTY_LIVE);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const res = await fetch("/api/dreams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 4컷 그림 보류 중이라 "그리지 않을 장면" 칸은 숨기고 빈 값으로 보냄
        body: JSON.stringify({ dreamText, excludedScenes: "", birthDate, visibility: "shared", pledge: pledged }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "오류가 났어요.");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as DreamStreamEvent;
          if (e.type === "error") throw new Error(e.error);
          if (e.type === "safety") return setSafety(true);
          if (e.type === "done") {
            const q = new URLSearchParams({ new: "1", ...(e.beadsAwarded ? { beads: String(e.beadsAwarded) } : {}) });
            router.push(`/dreams/${e.id}?${q}`);
            return;
          }
          apply(e);
        }
      }
      throw new Error("해몽이 중간에 끊겼어요. 다시 시도해 주세요.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 났어요.");
      setLoading(false);
    }
  }

  if (safety) return <SafetyNotice />;
  if (loading) return <DreamWaiting live={live} />;

  const len = dreamText.trim().length;

  return (
    <div>
      <Link href="/" className="-ml-1 inline-flex min-h-11 items-center px-1 text-sm text-white/70">
        ← 꿈 서랍
      </Link>
      <h1 className="mt-4 font-title text-2xl font-bold">어젯밤 무슨 꿈 꿨어요?</h1>

      <ul className="mt-4 space-y-1 text-sm text-white/60">
        <li>· 기억나는 장면</li>
        <li>· 누가 나왔는지</li>
        <li>· 그때 기분</li>
      </ul>

      <textarea
        aria-label="꿈 내용"
        value={dreamText}
        onChange={(e) => setDreamText(e.target.value)}
        rows={7}
        maxLength={2000}
        placeholder="예) 시골집 마당에 커다란 돼지가 들어왔는데, 금화를 물고 있었어요. 엄마가 웃으면서 잡으라고 했고 저는 신났어요."
        className="mt-3 w-full rounded-2xl bg-white/10 p-4 text-base outline-none ring-moon/60 placeholder:text-white/30 focus:ring-2"
      />
      <p className="text-right text-xs text-white/60">{len}/2000</p>

      <label className="mt-4 block text-sm text-white/70">
        생년월일 <span className="text-white/60">(양력, 선택)</span>
        <input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          min="1900-01-01"
          max={todayInKorea()}
          aria-describedby="birth-date-help"
          className="mt-2 min-h-12 w-full min-w-0 rounded-xl bg-white/10 px-4 py-3 text-base outline-none ring-moon/60 focus:ring-2"
        />
      </label>
      <p id="birth-date-help" className="mt-2 text-xs leading-relaxed text-white/60">입력한 생년월일은 프로필에 저장하지 않아요.</p>

      <p className="mt-5 text-sm text-white/60">판매 가능한 꿈은 해몽 후 장터에 자동으로 올라가요. 원문과 자세한 해몽은 구매자에게만 공개돼요.</p>

      <div className="mt-4"><PledgeCheck checked={pledged} onChange={setPledged} /></div>
      <button
        type="button"
        onClick={submit}
        disabled={loading || len < 10 || !pledged}
        className="mt-6 w-full rounded-2xl bg-moon py-4 font-cute text-lg text-night active:scale-[0.98] disabled:opacity-40"
      >
        {loading ? "꿈에 남은 징조를 읽는 중" : `해몽받기, 구슬 +${BEAD_REWARDS.dreamRecord}`}
      </button>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <p className="mt-3 text-center text-xs text-white/60">꿈 기록 구슬은 하루 3번까지 받아요</p>
    </div>
  );
}
