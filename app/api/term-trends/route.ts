import { geminiConfig } from "@/lib/gemini";
import { parseQuota } from "@/lib/quota";
import {
  parseTrendResult,
  trendLanguages,
  trendPrompt,
  type TrendLanguage,
} from "@/lib/trend-search";
import {
  apiError,
  appRateError,
  checkConsent,
  json,
  rateAllowed,
  readBounded,
} from "@/lib/request-guard";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const abort = new AbortController();
  const cancel = () => abort.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    let d;
    try {
      d = JSON.parse(
        new TextDecoder().decode(await readBounded(request, 1000)),
      );
    } catch (e) {
      if (e instanceof Error && e.message === "too_large") throw e;
      return json({ error: "검색 언어를 선택해 주세요." }, 400);
    }
    if (
      !d ||
      typeof d.language !== "string" ||
      !Object.hasOwn(trendLanguages, d.language)
    )
      return json({ error: "검색 언어를 선택해 주세요." }, 400);
    if (!checkConsent(d, true))
      return json({ error: "공개 표현 검색 전송 안내를 확인해 주세요." }, 400);
    const config = geminiConfig();
    if (!config.available) throw new Error("not_configured");
    if (!/^[a-zA-Z0-9.-]+$/.test(config.model))
      throw new Error("invalid_model");
    if (!rateAllowed(request, "term-trends")) return appRateError();
    const now = new Date(),
      language = d.language as TrendLanguage;
    timer = setTimeout(cancel, 45000);
    request.signal.addEventListener("abort", cancel, { once: true });
    if (request.signal.aborted) cancel();
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY!.trim(),
        },
        cache: "no-store",
        signal: abort.signal,
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: trendPrompt(language, now) }] },
          ],
          tools: [{ google_search: {} }],
          generationConfig: { maxOutputTokens: 3000 },
        }),
      },
    );
    if (r.status === 429)
      throw parseQuota(
        await r.json().catch(() => null),
        r.headers.get("Retry-After"),
      );
    if ([400, 403, 404].includes(r.status))
      return json(
        {
          code: "search_unavailable",
          error:
            "현재 연결된 AI에서 웹 검색을 사용할 수 없어요. 아래 Google 검색으로 직접 확인하거나 나중에 다시 시도해 주세요.",
        },
        503,
      );
    if (!r.ok) throw new Error("provider_error");
    return json(
      parseTrendResult(await r.json(), language, new Date().toISOString()),
    );
  } catch (e) {
    if (e instanceof Error && e.message === "ungrounded_output")
      return json(
        {
          code: "search_not_grounded",
          error:
            "검색 출처가 붙은 결과를 확보하지 못했어요. 최신 용어를 추측해 표시하지 않았습니다. 다시 검색하거나 Google 검색을 열어 주세요.",
        },
        502,
      );
    return apiError(e);
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", cancel);
  }
}
