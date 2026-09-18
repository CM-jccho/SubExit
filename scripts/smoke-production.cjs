// Explicitly opt in: QA_ALLOW_AI=1 node scripts/smoke-production.cjs <origin>
// Sends only fictional fixtures; never reads credentials or user records.
const assert = require("node:assert/strict");
const origin = new URL(process.argv[2] || "http://localhost:3000").origin;
const context = {
  title: "QA 일정 조율",
  myRole: "업무 담당자",
  partner: "동료",
  situation: "추가 작업과 기존 작업의 마감을 조율하는 가상 연습",
  goal: "우선순위를 확인하고 가능한 기한을 조율하기",
  boundaries: "확인하지 않은 일정은 약속하지 않기",
  tone: "firm_polite",
};
const consent = { consent: true, adultConsent: true, sampleConsent: true };
const opponent = "추가 작업도 오늘까지 끝낼 수 있나요?";
const coach = {
  mode: "ai",
  quick: true,
  context,
  tone: "firm_polite",
  opponent,
  reply: "",
};
let failures = 0;
async function check(name, path, body, expected, validate = () => {}) {
  const start = Date.now();
  try {
    const response = await fetch(origin + path, {
      ...(body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await response.json();
    assert.equal(response.status, expected, data.error);
    validate(data);
    console.log(
      JSON.stringify({
        name,
        result: "pass",
        status: response.status,
        elapsedMs: Date.now() - start,
        source: data.source,
      }),
    );
  } catch (error) {
    failures++;
    console.log(
      JSON.stringify({
        name,
        result: "fail",
        elapsedMs: Date.now() - start,
        error: error.message,
      }),
    );
  }
}
async function main() {
  await check("health", "/api/coach", undefined, 200, (d) =>
    assert.equal(typeof d.available, "boolean"),
  );
  await check("missing-consent", "/api/coach", coach, 400);
  await check(
    "empty-input",
    "/api/coach",
    { ...coach, ...consent, opponent: "" },
    400,
  );
  await check(
    "long-input",
    "/api/coach",
    { ...coach, ...consent, opponent: "가".repeat(1001) },
    400,
  );
  await check(
    "invalid-turn-order",
    "/api/roleplay",
    {
      context,
      industry: "일반",
      messages: [{ role: "user", text: "안녕하세요" }],
      ...consent,
    },
    400,
  );
  await check(
    "unconfirmed-speaker",
    "/api/recording-review",
    {
      context,
      segments: [
        { id: "segment-0", role: "unknown", text: "확인 부탁합니다." },
      ],
      confirmed: true,
      ...consent,
    },
    400,
  );
  if (process.env.QA_ALLOW_AI === "1") {
    await check(
      "live-hint",
      "/api/coach",
      { ...coach, ...consent },
      200,
      (d) => {
        assert.equal(d.source, "ai");
        assert.ok(d.suggestion?.trim());
        assert.ok(opponent.includes(d.evidence));
      },
    );
    await check(
      "roleplay-opening",
      "/api/roleplay",
      { context, industry: "일반", messages: [], ...consent },
      200,
      (d) => {
        assert.equal(d.source, "ai");
        assert.ok(d.reply?.trim());
      },
    );
    await check(
      "three-candidates",
      "/api/roleplay",
      {
        context,
        industry: "일반",
        action: "suggest",
        messages: [{ role: "assistant", text: opponent }],
        ...consent,
      },
      200,
      (d) => {
        assert.equal(d.source, "ai");
        assert.equal(d.suggestions.length, 3);
        assert.ok(d.suggestions.every((s) => s.trim()));
      },
    );
    await check(
      "term-extraction",
      "/api/terms",
      {
        action: "extract",
        industry: "IT",
        text: "SLA와 API 응답 시간을 확인해 주세요.",
        ...consent,
      },
      200,
      (d) => {
        assert.equal(d.source, "ai");
        assert.ok(d.terms.length);
        assert.ok(
          d.terms.every((t) =>
            "SLA와 API 응답 시간을 확인해 주세요.".includes(t),
          ),
        );
      },
    );
    const text =
      "현재 작업 일정을 먼저 확인한 뒤 가능한 기한을 말씀드려도 될까요?";
    await check(
      "solo-recording-review",
      "/api/recording-review",
      {
        context,
        segments: [{ id: "segment-0", role: "user", text }],
        confirmed: true,
        ...consent,
      },
      200,
      (d) => {
        assert.equal(d.source, "ai");
        assert.ok(d.review);
      },
    );
  }
  process.exitCode = failures ? 1 : 0;
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
