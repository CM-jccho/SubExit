export type QuotaKind = "daily" | "minute" | "unknown";
export class ProviderQuotaError extends Error {
  constructor(
    public kind: QuotaKind,
    public retryAfter?: number,
  ) {
    super("provider_rate_limit");
  }
}
export function parseQuota(
  body: unknown,
  header: string | null,
): ProviderQuotaError {
  const details = (body as { error?: { details?: unknown } })?.error?.details;
  let daily = false,
    minute = false,
    retryAfter: number | undefined;
  if (Array.isArray(details))
    for (const detail of details) {
      if (!detail || typeof detail !== "object") continue;
      if (Array.isArray(detail.violations))
        for (const v of detail.violations) {
          const id =
            String(v?.quotaId || "") + " " + String(v?.quotaMetric || "");
          daily ||= /per.?day|daily/i.test(id);
          minute ||= /per.?minute/i.test(id);
        }
      if (
        typeof detail.retryDelay === "string" &&
        /^\d+(\.\d+)?s$/.test(detail.retryDelay)
      )
        retryAfter = Math.ceil(parseFloat(detail.retryDelay));
    }
  if (header && /^\d+$/.test(header))
    retryAfter = Math.max(retryAfter || 0, Number(header));
  else if (header && Number.isFinite(Date.parse(header)))
    retryAfter = Math.max(
      retryAfter || 0,
      Math.ceil((Date.parse(header) - Date.now()) / 1000),
    );
  if (!retryAfter || !Number.isFinite(retryAfter) || retryAfter > 86400)
    retryAfter = undefined;
  return new ProviderQuotaError(
    daily ? "daily" : minute ? "minute" : "unknown",
    retryAfter,
  );
}
export function quotaMessage(error: ProviderQuotaError) {
  if (error.kind === "daily")
    return "Gemini의 일일 사용 한도에 도달했어요. Google 프로젝트의 한도를 확인해 주세요. 일일 한도는 태평양 시간 자정에 초기화돼요. 지금은 저장한 기록과 샘플을 이용할 수 있어요.";
  if (error.retryAfter)
    return `Gemini 요청 한도에 도달했어요. 최소 ${error.retryAfter}초 뒤 다시 시도해 주세요. 계속되면 Google AI Studio에서 사용 한도를 확인해 주세요.`;
  if (error.kind === "minute")
    return "Gemini의 분당 요청 또는 입력량 한도에 도달했어요. 1분 뒤 다시 시도해 주세요.";
  return "Gemini 사용 한도에 도달했어요. 잠시 뒤 다시 시도하고, 계속되면 Google AI Studio에서 분당·일일 한도를 확인해 주세요. 현재 응답만으로는 초기화 시점을 알 수 없어요.";
}

// Pacific midnight is 07:00 or 08:00 UTC depending on daylight saving time.
export function nextPacificReset(now = new Date()): Date {
  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    hourCycle: "h23",
  });
  for (let day = 0; day < 3; day++)
    for (const hour of [7, 8]) {
      const candidate = new Date(midnight + (day * 24 + hour) * 3600000);
      if (candidate > now && formatter.format(candidate) === "00")
        return candidate;
    }
  throw new Error("reset_time_unavailable");
}
export function koreanRetryTime(at: string | Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(at));
}
