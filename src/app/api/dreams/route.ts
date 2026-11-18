import { NextResponse } from "next/server";
import { DEFAULT_CHARACTER_DESC, readingOf } from "@/lib/dream";
import { DreamInputSchema, type DreamRequestInput } from "@/lib/dream-input";
import { GeminiBusyError, GeminiError, interpretDream, isGeminiConfigured, type DreamProgress } from "@/lib/gemini";
import { gradeForScore } from "@/lib/grades";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// 모델을 여러 개 시도할 수 있어 넉넉히
export const maxDuration = 120;

// 화면으로 한 줄씩 보내는 소식 (NDJSON: 줄마다 JSON 하나)
export type DreamStreamEvent =
  | DreamProgress
  | { type: "done"; id: string; beadsAwarded: number }
  | { type: "safety" }
  | { type: "error"; error: string };

// 꿈 올리기: Gemini 해몽(만들어지는 중간 내용을 실시간 전송) → 등급 계산 → DB 저장 (+ 꿈 기록 구슬)
export async function POST(req: Request) {
  if (!isGeminiConfigured() || !isAdminConfigured()) {
    return NextResponse.json(
      { error: "해몽 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const parsed = DreamInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "입력을 확인해 주세요." }, { status: 400 });
  }
  const input = parsed.data;

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: DreamStreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        send(await interpretAndSave(user.id, input, send));
      } catch (err) {
        console.error("dream stream error", err);
        send({ type: "error", error: "해몽 중 오류가 났어요. 다시 시도해 주세요." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

async function interpretAndSave(
  userId: string,
  input: DreamRequestInput,
  send: (e: DreamStreamEvent) => void,
): Promise<DreamStreamEvent> {
  let ai;
  try {
    ai = await interpretDream(
      {
        dreamText: input.dreamText,
        excludedScenes: input.excludedScenes,
        birthDate: input.birthDate,
        characterDesc: DEFAULT_CHARACTER_DESC,
      },
      send,
      { userId },
    );
  } catch (err) {
    if (err instanceof GeminiBusyError) return { type: "error", error: err.message };
    console.error("Gemini error", err);
    return { type: "error", error: err instanceof GeminiError ? err.message : "해몽 중 오류가 났어요. 다시 시도해 주세요." };
  }

  // 힘든 꿈: 저장하지 않고 위로의 말만
  if (ai.safety_flag) return { type: "safety" };

  const grade = gradeForScore(ai.luck_score);
  const { data, error } = await createAdminClient()
    .rpc("record_market_dream", {
      p_owner: userId,
      p_text: input.dreamText,
      p_excluded_scenes: input.excludedScenes || null,
      p_price: grade.price,
      p_title: ai.title,
      p_symbols: ai.symbols,
      p_luck_score: ai.luck_score,
      p_grade: grade.code,
      p_luck_tags: ai.luck_tags,
      p_headline: ai.headline,
      p_interpretation: ai.interpretation,
      p_lucky: null, // 예전 DB 함수 인자는 유지하되, 행운의 색·물건은 더 만들지 않아요.
      p_panels: [], // 4컷 그림 보류 중이라 콘티를 만들지 않음
      p_reading: readingOf(ai),
    })
    .single<{ dream_id: string; beads_awarded: number }>();

  if (error || !data) {
    console.error("record_dream error", error);
    return { type: "error", error: "꿈을 저장하지 못했어요." };
  }
  return { type: "done", id: data.dream_id, beadsAwarded: data.beads_awarded };
}
