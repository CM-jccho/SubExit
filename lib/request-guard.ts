import { NextResponse } from "next/server";
const buckets = new Map<string, { count: number; until: number }>();
export function rateAllowed(request: Request, scope: string) {
  const now = Date.now(),
    key =
      scope +
      ":" +
      (request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        "unknown");
  for (const [k, v] of buckets) if (v.until <= now) buckets.delete(k);
  const row = buckets.get(key) || { count: 0, until: now + 60000 };
  if (row.count >= 12 || (!buckets.has(key) && buckets.size >= 2000))
    return false;
  row.count++;
  buckets.set(key, row);
  return true;
}
export async function readBounded(request: Request, max: number) {
  if (Number(request.headers.get("content-length")) > max)
    throw new Error("too_large");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw new Error("too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.length;
  }
  return all;
}
export const json = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
export function apiError(error: unknown) {
  const code = error instanceof Error ? error.message : "unknown";
  const status =
    code === "too_large"
      ? 413
      : code === "provider_rate_limit"
        ? 429
        : code === "not_configured"
          ? 503
          : 502;
  return json(
    {
      error:
        code === "too_large"
          ? "입력 크기를 줄여 주세요."
          : status === 429
            ? "요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."
            : status === 503
              ? "AI가 아직 연결되지 않았습니다."
              : "AI 응답을 받지 못했습니다. 입력을 확인하고 다시 시도해 주세요.",
      code,
    },
    status,
  );
}
export function checkConsent(
  data: Record<string, unknown>,
  sampleOnly: boolean,
) {
  return (
    data.consent === true &&
    data.adultConsent === true &&
    (!sampleOnly || data.sampleConsent === true)
  );
}
