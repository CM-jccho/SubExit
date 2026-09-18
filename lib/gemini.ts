import { parseQuota } from "./quota";
export function geminiConfig() {
  const keyConfigured = !!process.env.GEMINI_API_KEY?.trim();
  // Registering a key is enough to opt in; explicit switches remain authoritative.
  const enabled = (value: string | undefined) =>
    value === undefined ||
    value.trim() === "" ||
    value.trim().toLowerCase() === "true";
  const available = keyConfigured && enabled(process.env.COACH_AI_ENABLED);
  return {
    available,
    voiceAvailable: available && enabled(process.env.COACH_VOICE_ENABLED),
    // Configuration only: "configured" does not claim the key or quota is valid.
    configurationStatus: !keyConfigured
      ? "missing_key"
      : !available
        ? "disabled"
        : "configured",
    provider: "Google Gemini",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    sampleOnly: process.env.GEMINI_DATA_MODE !== "paid",
  };
}
export async function geminiGenerate(
  system: string,
  parts: unknown[],
  schema: unknown,
  signal?: AbortSignal,
  options?: { maxOutputTokens?: number },
): Promise<unknown> {
  const config = geminiConfig();
  if (!config.available) throw new Error("not_configured");
  if (!/^[a-zA-Z0-9.-]+$/.test(config.model)) throw new Error("invalid_model");
  const abort = new AbortController(),
    timer = setTimeout(() => abort.abort(), 20000);
  const cancel = () => abort.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) abort.abort();
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY!.trim(),
        },
        signal: abort.signal,
        cache: "no-store",
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: schema,
            maxOutputTokens: options?.maxOutputTokens ?? 1800,
            ...(config.model === "gemini-2.5-flash"
              ? { thinkingConfig: { thinkingBudget: 0 } }
              : {}),
          },
        }),
      },
    );
    if (response.status === 429)
      throw parseQuota(
        await response.json().catch(() => null),
        response.headers.get("Retry-After"),
      );
    if (!response.ok) throw new Error("provider_error");
    const body = await response.json();
    const content = body.candidates?.[0]?.content?.parts
      ?.filter((p: { thought?: boolean; text?: string }) => !p.thought)
      .map((p: { text?: string }) => p.text || "")
      .join("");
    if (!content) throw new Error("empty_output");
    return JSON.parse(content);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
