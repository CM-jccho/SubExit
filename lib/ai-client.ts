import { nextPacificReset, koreanRetryTime } from "./quota";
export type AIOutage = {
  reason:
    | "daily"
    | "minute"
    | "quota"
    | "app_limit"
    | "connection"
    | "unavailable"
    | "response"
    | "manual";
  occurredAt: string;
  retryAt?: string;
};
export class AIServiceError extends Error {
  constructor(public outage: AIOutage) {
    super(outageMessage(outage));
  }
}
const HOLD_KEY = "ddeundeun-ai-wait-v1";
const reasons = [
  "daily",
  "minute",
  "quota",
  "app_limit",
  "connection",
  "unavailable",
  "response",
];
export function manualSample(): AIOutage {
  return { reason: "manual", occurredAt: new Date().toISOString() };
}
export function outageLabel(d: AIOutage) {
  return {
    daily: "일일 한도 초과",
    minute: "분당 한도 초과",
    quota: "AI 사용 한도 초과",
    app_limit: "앱 요청 한도 초과",
    connection: "AI 연결 오류",
    unavailable: "AI 연결 준비 중",
    response: "AI 응답 확인 실패",
    manual: "샘플 모드",
  }[d.reason];
}
export function retryAdvice(d: AIOutage) {
  if (d.reason === "manual")
    return "AI로 전환하면 실제 응답을 요청할 수 있어요.";
  if (d.retryAt && Date.parse(d.retryAt) <= Date.now())
    return "이 응답을 만들 때의 대기 시간이 지났어요. AI로 다시 시도할 수 있어요.";
  const time = d.retryAt ? koreanRetryTime(d.retryAt) : "잠시 뒤";
  if (d.reason === "daily")
    return `일일 한도 초기화 예정인 ${time} 이후 다시 시도해 주세요. (한국 시간)`;
  if (d.reason === "unavailable")
    return "서비스의 AI 연결이 준비된 뒤 다시 시도해 주세요.";
  if (d.reason === "quota")
    return `${time} 이후 다시 시도해 주세요. 현재 오류로는 정확한 한도 초기화 시점을 알 수 없어요. (한국 시간)`;
  return `${time} 이후 다시 시도해 주세요. (한국 시간)`;
}
export function outageMessage(d: AIOutage) {
  return `${outageLabel(d)}. ${retryAdvice(d)}`;
}
export function readAIHold(now = Date.now()): AIOutage | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(HOLD_KEY) || "null");
    const until = Date.parse(raw?.retryAt);
    if (
      raw?.version === 1 &&
      reasons.includes(raw.reason) &&
      Number.isFinite(Date.parse(raw.occurredAt)) &&
      until > now &&
      until <= now + 26 * 3600000
    )
      return {
        reason: raw.reason,
        occurredAt: raw.occurredAt,
        retryAt: raw.retryAt,
      };
    window.sessionStorage.removeItem(HOLD_KEY);
  } catch {
    /* Storage is optional; the actual response still carries its label. */
  }
  return null;
}
export function clearAIHold() {
  try {
    if (typeof window !== "undefined")
      window.sessionStorage.removeItem(HOLD_KEY);
  } catch {
    /* optional */
  }
}
function hold(d: AIOutage) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      HOLD_KEY,
      JSON.stringify({ ...d, version: 1 }),
    );
  } catch {
    /* optional */
  }
}
export function outageFor(
  status: number,
  data: unknown,
  now = Date.now(),
): AIOutage | null {
  if (status !== 429 && status < 500) return null;
  const d = data as {
    code?: string;
    quotaKind?: string;
    retryAfter?: number;
    retryAt?: string;
  } | null;
  const reason: AIOutage["reason"] =
    status === 429
      ? d?.code === "app_rate_limit"
        ? "app_limit"
        : d?.quotaKind === "daily"
          ? "daily"
          : d?.quotaKind === "minute"
            ? "minute"
            : "quota"
      : ["invalid_output", "ungrounded_output", "empty_output"].includes(
            d?.code || "",
          )
        ? "response"
        : status === 503
          ? "unavailable"
          : "connection";
  const seconds =
    typeof d?.retryAfter === "number" &&
    Number.isFinite(d.retryAfter) &&
    d.retryAfter > 0
      ? Math.min(86400, d.retryAfter)
      : reason === "connection"
        ? 30
        : 60;
  let until =
    reason === "daily"
      ? nextPacificReset(new Date(now)).getTime()
      : now + seconds * 1000;
  const supplied = Date.parse(d?.retryAt || "");
  if (supplied > now && supplied <= now + 26 * 3600000)
    until = Math.max(until, supplied);
  return {
    reason,
    occurredAt: new Date(now).toISOString(),
    retryAt: new Date(until).toISOString(),
  };
}
export function connectionOutage(): AIOutage {
  return {
    reason: "connection",
    occurredAt: new Date().toISOString(),
    retryAt: new Date(Date.now() + 30000).toISOString(),
  };
}
export async function aiFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const active = readAIHold();
  if (active) throw new AIServiceError(active);
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw e;
    const outage = connectionOutage();
    hold(outage);
    throw new AIServiceError(outage);
  }
  if (!response.ok && (response.status === 429 || response.status >= 500)) {
    const data = await response
      .clone()
      .json()
      .catch(() => null);
    // Search-specific grounding/capability failures do not disable working voice/chat APIs.
    if (
      url === "/api/term-trends" &&
      ["search_unavailable", "search_not_grounded"].includes(data?.code)
    )
      return response;
    const outage = outageFor(response.status, data)!;
    hold(outage);
    throw new AIServiceError(outage);
  }
  return response;
}
