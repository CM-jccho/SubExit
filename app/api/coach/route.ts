import { parseProfile } from "@/lib/conversation-cards";
import { geminiConfig, geminiGenerate } from "@/lib/gemini";
import { getScenario, tones, type Tone } from "@/lib/scenarios";
import { coachSchema, systemPrompt, validateCoach } from "@/lib/coach-contract";
import {
  readBounded,
  rateAllowed,
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
      } catch {
        return json({ error: "저장된 대화 카드를 확인해 주세요." }, 400);
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
    if (!rateAllowed(request, "coach"))
      return json(
        { error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." },
        429,
      );
    const start = Date.now();
    const output = await geminiGenerate(
      systemPrompt,
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
      coachSchema,
      request.signal,
    );
    return json({
      ...validateCoach(output, d.opponent),
      source: "ai",
      provider: config.provider,
      model: config.model,
      latencyMs: Date.now() - start,
    });
  } catch (e) {
    return apiError(e);
  }
}
