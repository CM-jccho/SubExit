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
  assert.equal(report.verified, 480);
  assert.equal(report.liveAICalls, 0);
  assert.equal(report.authoredResponses, 128);
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
