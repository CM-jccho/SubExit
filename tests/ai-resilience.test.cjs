const { simulate } = require("../scripts/simulate-ai-outages.cjs");
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const quota = require("../lib/quota.ts"),
  client = require("../lib/ai-client.ts"),
  bank = require("../lib/demo-bank.ts"),
  resilient = require("../lib/resilient-ai.ts");
test("all authored scenarios and operations survive the outage matrix without masking validation errors", async () => {
  const report = await simulate();
  assert.equal(
    report.verified,
    bank.demoCases.length *
      4 *
      require("../fixtures/ai-outages.json").cases.length,
  );
  assert.equal(report.liveAICalls, 0);
  assert.equal(report.authoredResponses, 208);
});
test("Pacific daily reset respects winter, summer, DST boundaries and midnight, and daily limits override short Retry-After", () => {
  for (const [now, expected] of [
    ["2026-01-01T07:00:00Z", "2026-01-01T08:00:00Z"],
    ["2026-09-16T07:01:00Z", "2026-09-17T07:00:00Z"],
    ["2026-03-08T08:00:00Z", "2026-03-09T07:00:00Z"],
    ["2026-11-01T07:00:00Z", "2026-11-02T08:00:00Z"],
  ])
    assert.equal(
      quota.nextPacificReset(new Date(now)).toISOString(),
      new Date(expected).toISOString(),
    );
  const now = Date.parse("2026-09-16T07:01:00Z");
  assert.equal(
    client.outageFor(429, { quotaKind: "daily", retryAfter: 45 }, now).retryAt,
    "2026-09-17T07:00:00.000Z",
  );
  assert(
    client
      .retryAdvice(client.outageFor(429, {}, Date.now()))
      .includes("정확한 한도 초기화 시점을 알 수 없어요"),
  );
});
test("sample selection avoids repeated responses until a bank is exhausted and every candidate has traceable provenance", () => {
  for (const row of bank.demoCases) {
    const previous = [];
    for (let i = 0; i < row.replies.length + 3; i++) {
      const d = bank.sampleResponse(
        "partner",
        row.keywords.join(" "),
        ["initial", ...previous],
        client.manualSample(),
        () => 0,
      );
      assert.notEqual(d.reply, previous.at(-1));
      if (i < row.replies.length) assert(!previous.includes(d.reply));
      previous.push(d.reply);
    }
    for (const [op, field] of [
      ["partner", "openings"],
      ["companion", "companion"],
      ["suggestions", "suggestions"],
      ["coach", "hints"],
    ]) {
      const selected = new Set();
      for (let i = 0; i < row[field].length; i++) {
        const d = bank.sampleResponse(
          op,
          row.keywords.join(" "),
          [],
          client.manualSample(),
          () => i / row[field].length,
        );
        selected.add(d.reply);
        assert(row[field].includes(d.reply));
      }
      assert.equal(selected.size, row[field].length);
    }
  }
});
test("daily cooldown blocks duplicate calls, survives reload storage, expires and returns to real AI", async () => {
  const oldWindow = global.window,
    oldFetch = global.fetch,
    dom = new JSDOM("", { url: "https://test.local" });
  global.window = dom.window;
  let calls = 0;
  const options = {
    operation: "partner",
    context: "일정",
    previous: [],
    url: "/api/roleplay",
    init: { method: "POST" },
  };
  try {
    global.fetch = async () => {
      calls++;
      return Response.json(
        { code: "provider_rate_limit", quotaKind: "daily", retryAfter: 5 },
        { status: 429 },
      );
    };
    const a = await resilient.sampledRequest(options);
    assert.equal(a.sample.outage.reason, "daily");
    const retry = client.readAIHold().retryAt;
    await resilient.sampledRequest(options);
    assert.equal(calls, 1);
    assert(
      !window.sessionStorage.getItem("ddeundeun-ai-wait-v1").includes("일정"),
    );
    client.readAIHold(Date.parse(retry) + 1);
    global.fetch = async () => {
      calls++;
      return Response.json({
        source: "ai",
        reply: "실제 테스트 응답",
        terms: [],
      });
    };
    const resumed = await resilient.sampledRequest(options);
    assert.equal(resumed.source, "ai");
    assert.equal(resumed.sample, undefined);
    assert.equal(calls, 2);
    const manual = await resilient.sampledRequest({ ...options, manual: true });
    assert.equal(manual.sample.outage.reason, "manual");
    assert.equal(calls, 2);
  } finally {
    global.window = oldWindow;
    global.fetch = oldFetch;
    dom.window.close();
  }
});

test("request practice fallbacks use the saved goal instead of treating a review request as feedback", () => {
  const { requestCards } = require("../lib/starter-data.ts");
  assert.equal(
    bank.chooseDemoCase(bank.practiceSampleContext(requestCards[0])).id,
    "request",
  );
  assert.equal(bank.practiceSampleContext(undefined), "");
  assert.equal(
    bank.chooseDemoCase("환불을 부탁하는 고객의 추가 보상 요구").id,
    "refund-pressure",
  );
});

test("friend scheduling keeps its relationship across every sample operation and business scheduling stays formal", () => {
  const { requestCards } = require("../lib/starter-data.ts");
  const friend = requestCards[1];
  for (const profile of [
    friend,
    {
      ...friend,
      title: "시간 변경",
      situation: "약속 시간을 바꾸고 싶다.",
      goal: "가능한 날짜와 시간 정하기",
      myRole: "나",
    },
  ]) {
    const context = bank.practiceSampleContext(profile);
    assert.equal(bank.chooseDemoCase(context).id, "friend-schedule");
    for (const [operation, field] of [
      ["coach", "hints"],
      ["suggestions", "suggestions"],
      ["partner", "openings"],
      ["companion", "companion"],
    ]) {
      const row = bank.demoCases.find((r) => r.id === "friend-schedule");
      for (let i = 0; i < row[field].length; i++) {
        const result = bank.sampleResponse(
          operation,
          context,
          [],
          client.manualSample(),
          () => i / row[field].length,
        );
        assert(result.sample.sampleId.startsWith("friend-schedule:"));
        assert.doesNotMatch(result.reply, /여쭤|확정하기|담당자|보고서|업무/);
        if (operation === "suggestions")
          assert.equal(result.suggestions.length, 3);
      }
    }
  }
  assert.equal(
    bank.chooseDemoCase("팀장님과 마감 일정 시간 날짜 조율").id,
    "schedule",
  );
  assert.equal(bank.chooseDemoCase("친구의 고민을 듣기").id, "friend");
  assert.equal(
    bank.chooseDemoCase("친구와 약속 시간을 바꾸기").id,
    "friend-schedule",
  );
});

test("money refusal samples explicitly refuse lending without invented reasons or future promises", () => {
  const contexts = [
    "친구가 돈을 빌려달라고 한다. 정중하게 거절하고 싶다.",
    "직장 동료 금전 부탁 거절하기",
    "가족이 생활비를 빌려달라고 해요. 사양하고 싶어요.",
    "친구와 약속 시간을 정하다가 30만원을 빌려달라는 부탁을 받음. 거절하기",
  ];
  for (const context of contexts) {
    assert.equal(bank.chooseDemoCase(context).id, "money-decline");
    for (const op of ["coach", "suggestions"]) {
      const previous = [];
      for (let i = 0; i < 3; i++) {
        const d = bank.sampleResponse(
          op,
          context,
          previous,
          client.manualSample(),
          () => 0,
        );
        const texts = op === "coach" ? [d.reply] : d.suggestions;
        for (const text of texts) {
          assert.match(text, /돈.*(?:어려워|어려워요|없어요)/);
          assert.doesNotMatch(
            text,
            /조건|확인|업무|다음에|나중에|월급|대출|일부|조금은/,
          );
        }
        previous.push(d.reply);
      }
    }
  }
  for (const text of [
    "친구에게 돈을 빌려달라고 정중하게 부탁하기",
    "친구에게 빌린 돈을 돌려주는 날짜 정하기",
    "친구가 책을 빌려달라는 부탁을 거절하기",
    "돈이 아니라 책을 빌려달라는 부탁을 거절하기",
    "친구의 돈 빌려달라는 부탁을 거절하지 않고 도와주고 싶다",
  ])
    assert.notEqual(bank.chooseDemoCase(text).id, "money-decline");
  const refusal = bank.demoCases.find((r) => r.id === "decline");
  for (const text of [...refusal.hints, ...refusal.suggestions]) {
    assert.match(text, /어려|어렵/);
    assert.doesNotMatch(text, /조건|먼저|확인|될까요|나중/);
  }
});
