import { parseProfile } from "@/lib/conversation-cards";
import { geminiConfig, geminiGenerate } from "@/lib/gemini";
import { getScenario, tones, type Tone } from "@/lib/scenarios";
import { coachSchema, systemPrompt, validateCoach } from "@/lib/coach-contract";
import {
  readBounded,
  rateAllowed,
  appRateError,
  json,
  apiError,
  checkConsent,
} from "@/lib/request-guard";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export function GET() {
  return json(geminiConfig());
}
export async function POST(request: Request) {
  try {
    let d;
    try {
      d = JSON.parse(
        new TextDecoder().decode(await readBounded(request, 12000)),
      );
    } catch (e) {
      if (e instanceof Error && e.message === "too_large") throw e;
      return json({ error: "올바른 JSON 입력이 필요합니다." }, 400);
    }
    if (!d || typeof d !== "object")
      return json({ error: "입력을 확인해 주세요." }, 400);
    const scenario = getScenario(d.scenario);
    let context;
    if (d.context !== undefined) {
      try {
        context = parseProfile(d.context);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        return json(
          {
            error:
              msg === "incomplete_context"
                ? "대화 카드의 목표, 상대, 상황을 모두 입력해 주세요."
                : "저장된 대화 카드를 확인해 주세요.",
          },
          400,
        );
      }
    }
    if ((!scenario && !context) || !tones.some((t) => t.id === d.tone))
      return json({ error: "상황과 말투를 확인해 주세요." }, 400);
    if (d.mode === "sample") {
      if (!scenario) return json({ error: "샘플 상황을 확인해 주세요." }, 400);
      const round = scenario.rounds.find((r) => r.id === d.roundId);
      if (!round) return json({ error: "샘플 구간을 찾지 못했습니다." }, 400);
      return json({
        source: "sample",
        pattern: round.pattern,
        evidence: round.opponent,
        reason: round.hint,
        suggestion: round.cues[d.tone as Tone],
        feedback: round.hint,
      });
    }
    if (
      d.mode !== "ai" ||
      typeof d.opponent !== "string" ||
      d.opponent.trim().length < 2 ||
      d.opponent.length > 1000 ||
      typeof d.reply !== "string" ||
      d.reply.length > 1000
    )
      return json(
        { error: "상대 말과 답변은 각각 1,000자 이내로 입력해 주세요." },
        400,
      );
    const config = geminiConfig();
    if (!config.available)
      return json({ error: "AI가 아직 연결되지 않았습니다." }, 503);
    if (!checkConsent(d, config.sampleOnly))
      return json(
        { error: "전송·성인 여부 및 무료 API 샘플 조건을 확인해 주세요." },
        400,
      );
    const quick = d.quick === true && !d.reply.trim();
    if (!rateAllowed(request, "coach", quick ? 24 : 12)) return appRateError();
    const start = Date.now();
    const output = await geminiGenerate(
      systemPrompt +
        (quick
          ? "\n지금은 실시간 힌트다. suggestion은 120자 이내의 짧은 한 문장, reason은 짧은 한 문장, evidence는 짧고 정확한 인용만 출력한다. opponent와 context에 없는 날짜·요일·기간·금액·수치·약속을 새로 만들거나 바꾸지 않는다. 입력의 '내일', '금요일', '다음 주' 같은 시간 표현을 다른 시점으로 바꾸지 않는다. pattern과 feedback은 출력하지 않는다."
          : ""),
      [
        {
          text: JSON.stringify({
            goal: context?.goal || scenario!.goal,
            context,
            tone: d.tone,
            opponent: d.opponent,
            reply: d.reply,
          }),
        },
      ],
      quick
        ? {
            type: "object",
            properties: Object.fromEntries(
              ["suggestion", "evidence", "reason"].map((k) => [
                k,
                { type: "string" },
              ]),
            ),
            required: ["suggestion", "evidence", "reason"],
            additionalProperties: false,
          }
        : coachSchema,
      request.signal,
      quick ? { maxOutputTokens: 500 } : undefined,
    );
    return json({
      ...validateCoach(
        quick && output && typeof output === "object"
          ? {
              ...output,
              pattern: "다음 한마디",
              feedback: "상황에 맞게 고쳐 말해보세요.",
            }
          : output,
        d.opponent,
      ),
      source: "ai",
      provider: config.provider,
      model: config.model,
      latencyMs: Date.now() - start,
    });
  } catch (e) {
    return apiError(e);
  }
}
