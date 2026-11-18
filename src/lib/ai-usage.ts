import { randomUUID } from "node:crypto";
import { ApiError, type GenerateContentResponseUsageMetadata } from "@google/genai";
import { createAdminClient, isAdminConfigured } from "./supabase/admin";

// AI 호출 1번(시도 1번)마다 ai_calls 표에 남김: 무슨 용도·모델·성공/실패·걸린 시간·토큰 수. 꿈 내용·해몽 내용은 넣지 않음
// 0011_metrics.sql 적용 전이거나 비밀 키가 없으면 조용히 건너뜀 (해몽은 그대로 됨)
export type AiCallType = "interpret" | "reading_backfill";
export type AiCallContext = { callType: AiCallType; userId?: string | null };

export type AiAttempt = {
  requestId: string;
  attempt: number;
  model: string;
  startedAt: number;
  thinkingFallback: boolean;
};

let warned = false;

export function newAiRequest() {
  return randomUUID();
}

function errorKind(err: unknown): string {
  if (err instanceof ApiError) return "api";
  if (err instanceof SyntaxError) return "format";
  if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) return "timeout";
  if (err instanceof Error && err.name === "GeminiError") return "format";
  return "other";
}

export async function logAiCall(
  ctx: AiCallContext | undefined,
  a: AiAttempt,
  result: { ok: true; usage?: GenerateContentResponseUsageMetadata } | { ok: false; error: unknown; usage?: GenerateContentResponseUsageMetadata },
) {
  if (!ctx || !isAdminConfigured()) return;
  const usage = result.usage;
  const err = result.ok ? undefined : result.error;
  try {
    const { error } = await createAdminClient()
      .from("ai_calls")
      .insert({
        app_env: process.env.VERCEL_ENV ?? "development",
        call_type: ctx.callType,
        request_id: a.requestId,
        attempt: a.attempt,
        model: a.model,
        outcome: result.ok ? "success" : "error",
        error_status: err instanceof ApiError ? err.status : null,
        error_kind: result.ok ? null : errorKind(err),
        thinking_fallback: a.thinkingFallback,
        latency_ms: Date.now() - a.startedAt,
        prompt_tokens: usage?.promptTokenCount ?? null,
        output_tokens: usage?.candidatesTokenCount ?? null,
        thinking_tokens: usage?.thoughtsTokenCount ?? null,
        total_tokens: usage?.totalTokenCount ?? null,
        user_id: ctx.userId ?? null,
      });
    if (error && !warned) {
      warned = true;
      console.warn("ai_calls 기록 실패 (0011_metrics.sql 적용 전이면 정상)", error.message);
    }
  } catch {}
}
