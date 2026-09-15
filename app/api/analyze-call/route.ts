import { json, readBounded, apiError } from "@/lib/request-guard";
import { getScenario } from "@/lib/scenarios";
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    return json(
      {
        error:
          "이전 파일 분석 기능은 중단되었습니다. 지금 대화 코칭의 짧은 음성 입력을 이용해 주세요.",
      },
      501,
    );
  try {
    const d = JSON.parse(
      new TextDecoder().decode(await readBounded(request, 12000)),
    );
    if (!d || d.demo !== true || !getScenario(d.scenario))
      return json({ error: "명시적인 샘플 요청만 지원합니다." }, 400);
    return json({
      source: "sample",
      message: "새 샘플 체험은 /?demo=1 에서 확인해 주세요.",
      scenario: d.scenario,
    });
  } catch (e) {
    if (e instanceof SyntaxError)
      return json({ error: "잘못된 JSON입니다." }, 400);
    return apiError(e);
  }
}
