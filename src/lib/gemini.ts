import { ApiError, GoogleGenAI, ThinkingLevel, type GenerateContentResponseUsageMetadata } from "@google/genai";
import { z } from "zod";
import { logAiCall, newAiRequest, type AiAttempt, type AiCallContext } from "./ai-usage";
import { buildDreamPrompt, buildReadingPrompt, DreamAISchema, ReadingSchema, scoreOf, type DreamAI, type DreamInput, type Reading, type ReadingInput } from "./dream";

// Flash 계열 모델을 순서대로 시도. 무료 등급은 "사용량 많음(503)"이 자주 나서 다음 모델로 넘어감.
// 바꾸려면 .env.local 에 GEMINI_MODELS=모델1,모델2
export const GEMINI_MODELS = (process.env.GEMINI_MODELS || "gemini-3.5-flash,gemini-flash-lite-latest,gemini-3.8-flash,gemini-flash-latest")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const PER_TRY_TIMEOUT_MS = 30_000; // 한 번 시도 제한 (오래 멈춘 모델은 빨리 포기)
const TOTAL_BUDGET_MS = 100_000; // 전체 제한 (서버 120초 안에 끝내기)
const ROUNDS = 2; // 모델 목록을 두 바퀴까지 (일시적인 혼잡은 금방 풀려서)

// "생각"을 짧게: 기본값이면 3.x Flash가 쓰기 전에 40초 넘게 생각만 함 (2026-10-29 측정: 첫 글자 48초 → 5초, 끝까지 50초 → 9초).
// 이 설정을 모르는 모델은 400을 내므로, 그때는 같은 모델로 설정 없이 한 번 더
const THINKING = { thinkingLevel: ThinkingLevel.LOW };
const isThinkingRejected = (err: unknown) => err instanceof ApiError && err.status === 400 && /thinking/i.test(err.message);
async function withThinkingFallback<T>(call: (thinking?: typeof THINKING) => Promise<T>, onFallback?: () => void): Promise<T> {
  try {
    return await call(THINKING);
  } catch (err) {
    if (!isThinkingRejected(err)) throw err;
    onFallback?.();
    return call(undefined);
  }
}

let ai: GoogleGenAI | null = null;
function client() {
  ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
}

export function isGeminiConfigured() {
  return (process.env.GEMINI_API_KEY ?? "").length > 20;
}

export class GeminiError extends Error {
  name = "GeminiError";
}
export class GeminiBusyError extends GeminiError {}

// 해몽이 만들어지는 동안 화면에 보여 줄 중간 소식
export type DreamProgress =
  | { type: "title"; value: string }
  | { type: "symbols"; value: string[] }
  | { type: "reading"; symbol: string; meaning: string }
  | { type: "scoring" }
  | { type: "retry" }; // 다른 모델로 다시 시작 → 화면의 중간 내용을 지움

// 받는 중인 JSON 조각에서 "다 쓴" 항목만 골라 냄
const STR = String.raw`"((?:[^"\\]|\\.)*)"`;
const unescape = (s: string) => {
  try {
    return JSON.parse(`"${s}"`) as string;
  } catch {
    return s;
  }
};
function progressWatcher(emit: (p: DreamProgress) => void) {
  let safe: boolean | null = null;
  let title = false;
  let symbols = false;
  let readings = 0;
  let scoring = false;
  return (text: string) => {
    if (safe === null) {
      const m = /"safety_flag"\s*:\s*(true|false)/.exec(text);
      if (m) safe = m[1] === "false";
    }
    if (!safe) return; // 안전 확인 전이거나 힘든 꿈이면 아무것도 안 보냄
    if (!title) {
      const m = new RegExp(String.raw`"title"\s*:\s*` + STR).exec(text);
      if (m) {
        title = true;
        emit({ type: "title", value: unescape(m[1]) });
      }
    }
    if (!symbols) {
      const m = /"symbols"\s*:\s*(\[[^\]]*\])/.exec(text);
      if (m) {
        symbols = true;
        try {
          emit({ type: "symbols", value: JSON.parse(m[1]) });
        } catch {}
      }
    }
    const pairs = [...text.matchAll(new RegExp(String.raw`"symbol"\s*:\s*` + STR + String.raw`\s*,\s*"meaning"\s*:\s*` + STR, "g"))];
    for (; readings < pairs.length; readings++) {
      emit({ type: "reading", symbol: unescape(pairs[readings][1]), meaning: unescape(pairs[readings][2]) });
    }
    if (!scoring && text.includes('"score_parts"')) {
      scoring = true;
      emit({ type: "scoring" });
    }
  };
}

// usage: 토큰 수 (스트림 마지막 조각에 옴). 형식 오류로 실패해도 토큰은 이미 쓴 것이라 오류에 붙여 둠
class AttemptError extends Error {
  constructor(
    readonly cause: unknown,
    readonly usage?: GenerateContentResponseUsageMetadata,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

async function tryModel(
  model: string,
  prompt: string,
  onText: ((text: string) => void) | undefined,
  attempt: AiAttempt,
): Promise<{ ai: DreamAI; usage?: GenerateContentResponseUsageMetadata }> {
  const stream = await withThinkingFallback(
    (thinking) =>
      client().models.generateContentStream({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(DreamAISchema),
          abortSignal: AbortSignal.timeout(PER_TRY_TIMEOUT_MS),
          ...(thinking && { thinkingConfig: thinking }),
        },
      }),
    () => (attempt.thinkingFallback = true),
  );
  let text = "";
  let usage: GenerateContentResponseUsageMetadata | undefined;
  try {
    for await (const chunk of stream) {
      text += chunk.text ?? "";
      if (chunk.usageMetadata) usage = chunk.usageMetadata;
      onText?.(text);
    }
    if (!text) throw new GeminiError("해몽 응답이 비어 있어요");
    const parsed = DreamAISchema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new GeminiError("해몽 응답 형식이 올바르지 않아요");
    return { ai: parsed.data, usage };
  } catch (err) {
    throw new AttemptError(err, usage);
  }
}

const unwrap = (err: unknown) => (err instanceof AttemptError ? err.cause : err);

// 다음 모델로 넘어가도 되는 오류: 사용량 많음·한도 초과·모델 없음·시간 초과·형식 오류
function isRetryable(err: unknown) {
  if (err instanceof ApiError) return [404, 429, 500, 503].includes(err.status);
  if (err instanceof GeminiError) return true;
  if (err instanceof SyntaxError) return true;
  return err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
}

// 꿈 → 해몽·점수 JSON. onProgress 를 주면 만들어지는 중간 내용을 알려 줌. usage 를 주면 시도마다 ai_calls 에 기록
export async function interpretDream(
  input: DreamInput,
  onProgress?: (p: DreamProgress) => void,
  usage?: Omit<AiCallContext, "callType">,
): Promise<DreamAI & { luck_score: number; model: string }> {
  const prompt = buildDreamPrompt(input);
  const ctx: AiCallContext = { callType: "interpret", ...usage };
  const requestId = newAiRequest();
  let last: unknown;
  let started = false;
  const begin = Date.now();
  const order = Array.from({ length: ROUNDS }, () => GEMINI_MODELS).flat();
  for (const [i, model] of order.entries()) {
    if (Date.now() - begin > TOTAL_BUDGET_MS - 8_000) break;
    if (started && onProgress) onProgress({ type: "retry" });
    const watch = onProgress ? progressWatcher(onProgress) : undefined;
    const attempt: AiAttempt = { requestId, attempt: i + 1, model, startedAt: Date.now(), thinkingFallback: false };
    try {
      const { ai, usage: tokens } = await tryModel(
        model,
        prompt,
        (text) => {
          started = true;
          watch?.(text);
        },
        attempt,
      );
      await logAiCall(ctx, attempt, { ok: true, usage: tokens });
      return { ...ai, luck_score: scoreOf(ai.score_parts), model };
    } catch (wrapped) {
      const err = unwrap(wrapped);
      await logAiCall(ctx, attempt, { ok: false, error: err, usage: wrapped instanceof AttemptError ? wrapped.usage : undefined });
      last = err;
      if (!isRetryable(err)) throw err;
      console.warn(`Gemini ${model} 실패 → 다음 모델`, err instanceof ApiError ? err.status : (err as Error).message);
    }
  }
  if (last instanceof ApiError && last.status === 429) throw new GeminiBusyError("무료 사용 한도에 걸렸어요. 1분 뒤 다시 시도해 주세요.");
  throw new GeminiBusyError("지금 해몽 서버가 붐벼요. 잠시 후 다시 시도해 주세요.");
}

// 예전 꿈에 상세 해몽만 새로 받기 (모델을 차례로 시도하는 방식은 위와 같음)
export async function generateReading(input: ReadingInput): Promise<Reading> {
  const prompt = buildReadingPrompt(input);
  const ctx: AiCallContext = { callType: "reading_backfill" };
  const requestId = newAiRequest();
  let last: unknown;
  for (const [i, model] of GEMINI_MODELS.entries()) {
    const attempt: AiAttempt = { requestId, attempt: i + 1, model, startedAt: Date.now(), thinkingFallback: false };
    let tokens: GenerateContentResponseUsageMetadata | undefined;
    try {
      const res = await withThinkingFallback(
        (thinking) =>
          client().models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseJsonSchema: z.toJSONSchema(ReadingSchema),
              abortSignal: AbortSignal.timeout(PER_TRY_TIMEOUT_MS),
              ...(thinking && { thinkingConfig: thinking }),
            },
          }),
        () => (attempt.thinkingFallback = true),
      );
      tokens = res.usageMetadata;
      const parsed = ReadingSchema.safeParse(JSON.parse(res.text ?? ""));
      if (!parsed.success) throw new GeminiError("상세 해몽 형식이 올바르지 않아요");
      await logAiCall(ctx, attempt, { ok: true, usage: tokens });
      return parsed.data;
    } catch (err) {
      await logAiCall(ctx, attempt, { ok: false, error: err, usage: tokens });
      last = err;
      if (!isRetryable(err)) throw err;
      console.warn(`Gemini ${model} 실패 → 다음 모델`, err instanceof ApiError ? err.status : (err as Error).message);
    }
  }
  throw last instanceof GeminiError ? last : new GeminiBusyError("지금 해몽 서버가 붐벼요. 잠시 후 다시 시도해 주세요.");
}

