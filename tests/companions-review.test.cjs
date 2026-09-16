const ts = require("typescript"),
  Module = require("module"),
  path = require("path"),
  fs = require("fs");
const root = path.resolve(__dirname, ".."),
  resolve = Module._resolveFilename;
Module._resolveFilename = function (id, ...args) {
  return resolve.call(
    this,
    id.startsWith("@/") ? path.join(root, id.slice(2)) : id,
    ...args,
  );
};
for (const ext of [".ts", ".tsx"])
  require.extensions[ext] = function (module, file) {
    module._compile(
      ts.transpileModule(fs.readFileSync(file, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
          resolveJsonModule: true,
        },
      }).outputText,
      file,
    );
  };
const { test } = require("node:test"),
  assert = require("node:assert/strict");

const { IDBFactory } = require("fake-indexeddb");
const chars = require("../lib/companions.ts"),
  cards = require("../lib/conversation-cards.ts"),
  store = require("../lib/voice-notebook.ts"),
  samples = require("../lib/starter-data.ts"),
  review = require("../lib/practice-review.ts"),
  quota = require("../lib/quota.ts");
const chat = require("../app/api/companion/route.ts"),
  reviewAPI = require("../app/api/review/route.ts"),
  { apiError } = require("../lib/request-guard.ts");
function fresh() {
  global.indexedDB = new IDBFactory();
  const memory = new Map();
  global.localStorage = {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => memory.set(k, v),
  };
  return memory;
}
const consent = { consent: true, adultConsent: true, sampleConsent: true };
const req = (d) =>
  new Request("http://test", { method: "POST", body: JSON.stringify(d) });
const aiOutput = (d) =>
  Response.json({
    candidates: [{ content: { parts: [{ text: JSON.stringify(d) }] } }],
  });
async function withAI(fn) {
  const oldFetch = global.fetch,
    oldEnv = { ...process.env };
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.COACH_AI_ENABLED;
  try {
    await fn();
  } finally {
    global.fetch = oldFetch;
    if (oldEnv.GEMINI_API_KEY === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldEnv.GEMINI_API_KEY;
    if (oldEnv.COACH_AI_ENABLED === undefined)
      delete process.env.COACH_AI_ENABLED;
    else process.env.COACH_AI_ENABLED = oldEnv.COACH_AI_ENABLED;
  }
}
const rawReview = {
  strength: {
    turnId: "turn-sample-1",
    quote: "스코프를 먼저 정하고",
    note: "범위를 먼저 확인했어요.",
  },
  improvement: {
    turnId: "turn-sample-3",
    quote: "다음 주 월요일에 공유하겠습니다.",
    note: "가능한 일정을 확인한 뒤 약속해 보세요.",
    rewrite: "핵심 지표를 정리할 일정을 확인한 뒤 말씀드릴게요.",
  },
  focus: "가능한 일정을 확인한 뒤 약속하기",
};
test("context recommendation, manual choice, builtin rename and custom appearance survive card reload", () => {
  fresh();
  assert.equal(chars.recommendCompanion({ partner: "친구" }).id, "tori");
  assert.equal(chars.recommendCompanion({ situation: "면접" }).id, "moa");
  assert.equal(chars.recommendCompanion({ goal: "추가 비용 협상" }).id, "coco");
  const renamed = { ...chars.defaultCompanions[0], name: "포포", shape: "cat" };
  chars.saveCompanion(renamed);
  const custom = {
    ...renamed,
    id: "custom-test",
    name: "루미",
    shape: "rabbit",
  };
  chars.saveCompanion(custom);
  const saved = cards.saveCard(
    cards.exampleProfile,
    "manual",
    undefined,
    custom.id,
  );
  const loaded = cards.readCards()[0];
  assert.equal(loaded.companion, "custom-test");
  assert.equal(
    chars.resolveCompanion(
      loaded.companion,
      { partner: "친구" },
      chars.readSavedCompanions(),
    ).name,
    "루미",
  );
  assert.equal(
    chars.resolveCompanion("dundi", undefined, chars.readSavedCompanions())
      .name,
    "포포",
  );
  assert.equal(chars.allCompanions(chars.readSavedCompanions()).length, 5);
  assert.equal(saved.length, 1);
  assert.throws(() => chars.parseCompanion({ ...custom, shape: "__proto__" }));
  localStorage.setItem(chars.COMPANIONS_KEY, "broken");
  assert.throws(() => chars.saveCompanion(custom));
  assert.equal(localStorage.getItem(chars.COMPANIONS_KEY), "broken");
});
test("new request examples migrate once without restoring earlier deleted samples", async () => {
  fresh();
  localStorage.setItem(
    cards.CARD_KEY,
    JSON.stringify({ version: 1, samplesInitialized: true, cards: [] }),
  );
  await store.seedNotebook([], [], false);
  await samples.seedStarterData();
  assert.deepEqual(
    cards.readCards().map((c) => c.id),
    samples.requestCards.map((c) => c.id),
  );
  assert.equal((await store.listSessions()).length, 2);
  cards.writeCards([]);
  await store.deleteSession(samples.requestSessions[0].id);
  await samples.seedStarterData();
  assert.equal(cards.readCards().length, 0);
  assert.equal((await store.listSessions()).length, 1);
});
test("quota classification uses provider evidence, prefers daily limit and never exposes provider details", async () => {
  const body = {
    error: {
      message: "PRIVATE-PROJECT-KEY",
      details: [
        {
          violations: [
            { quotaId: "GenerateRequestsPerDayPerProject" },
            { quotaId: "TokensPerMinute" },
          ],
        },
        { retryDelay: "42.4s" },
      ],
    },
  };
  const e = quota.parseQuota(body, "50");
  assert.equal(e.kind, "daily");
  assert.equal(e.retryAfter, 50);
  const r = apiError(e),
    d = await r.json();
  assert.equal(r.status, 429);
  assert.equal(r.headers.get("Retry-After"), "50");
  assert(!JSON.stringify(d).includes("PRIVATE"));
  assert(d.error.includes("자정"));
  assert.equal(quota.parseQuota({}, null).kind, "unknown");
  assert.equal(
    quota.parseQuota(
      {
        error: {
          details: [
            { violations: [{ quotaMetric: "generate_tokens_per_minute" }] },
          ],
        },
      },
      null,
    ).kind,
    "minute",
  );
  assert.equal(
    (await apiError(new Error("PRIVATE-KEY")).json()).code,
    "unknown",
  );
});
test("companion API enforces consent and receives only the selected character and current history", async () =>
  withAI(async () => {
    let payload;
    global.fetch = async (_, init) => {
      payload = JSON.parse(init.body);
      return aiOutput({
        reply: "검토를 부탁할 부분부터 정해볼까요?",
        terms: [],
      });
    };
    const companion = {
      ...chars.defaultCompanions[0],
      id: "custom-test",
      name: "루미",
      persona: "차분하게 검토 부탁을 연습한다.",
    };
    assert.equal(
      (await chat.POST(req({ companion, messages: [] }))).status,
      400,
    );
    assert.equal(payload, undefined);
    assert.equal(
      (
        await chat.POST(
          req({
            ...consent,
            companion,
            messages: [{ role: "user", text: "안녕" }],
          }),
        )
      ).status,
      400,
    );
    let r = await chat.POST(
      req({ ...consent, companion, messages: [], otherSessions: "PRIVATE" }),
    );
    assert.equal(r.status, 200);
    const input = JSON.parse(payload.contents[0].parts[0].text);
    assert.equal(input.character.name, "루미");
    assert.equal(input.character.persona, companion.persona);
    assert(!JSON.stringify(payload).includes("PRIVATE"));
  }));
test("review rejects fabricated evidence and replans from real exchanges while preserving goal, boundaries and character snapshot", async () => {
  fresh();
  const original = {
    ...samples.starterSession,
    id: "personal",
    isSample: false,
    context: { ...samples.starterCards[0] },
    companion: { ...chars.defaultCompanions[0], name: "기록 당시 이름" },
  };
  const r = review.validateReview(
    rawReview,
    cards.parseProfile(original.context),
    original.turns,
  );
  assert.equal(r.sourceKey, review.reviewKey(original.context, original.turns));
  assert.throws(
    () =>
      review.validateReview(
        {
          ...rawReview,
          strength: { ...rawReview.strength, quote: "하지 않은 말" },
        },
        original.context,
        original.turns,
      ),
    /ungrounded_output/,
  );
  const next = review.reviewDrill(original, r);
  assert.equal(next.context.goal, original.context.goal);
  assert.equal(next.context.boundaries, original.context.boundaries);
  assert.equal(next.turns.at(-1).text, original.turns[2].text);
  assert.equal(next.practicePlan.sourceSessionId, original.id);
  assert.equal(next.isSample, undefined);
  await store.putSession({ ...original, review: r });
  assert.deepEqual((await store.getSession(original.id)).review, r);
  chars.saveCompanion({ ...chars.defaultCompanions[0], name: "새 이름" });
  assert.equal(
    chars.companionForSession(await store.getSession(original.id)).name,
    "기록 당시 이름",
  );
  assert.throws(() =>
    review.reviewDrill(
      {
        ...original,
        turns: [...original.turns, { ...original.turns[0], id: "new" }],
      },
      r,
    ),
  );
});
test("review API validates consent, user evidence, bounded history and never sends audio or other sessions", async () =>
  withAI(async () => {
    let payload,
      calls = 0;
    global.fetch = async (_, init) => {
      calls++;
      payload = JSON.parse(init.body);
      return aiOutput(rawReview);
    };
    const d = {
      ...consent,
      context: cards.exampleProfile,
      turns: samples.starterSession.turns.map((t) => ({
        ...t,
        clip: { name: "PRIVATE-AUDIO" },
      })),
      otherSessions: "PRIVATE-HISTORY",
    };
    assert.equal(
      (await reviewAPI.POST(req({ ...d, consent: false }))).status,
      400,
    );
    assert.equal(
      (await reviewAPI.POST(req({ ...d, turns: d.turns.slice(0, 2) }))).status,
      400,
    );
    assert.equal(calls, 0);
    const good = await reviewAPI.POST(req(d));
    assert.equal(good.status, 200);
    assert.equal((await good.json()).source, "ai");
    assert(!JSON.stringify(payload).includes("PRIVATE"));
    global.fetch = async () =>
      aiOutput({
        ...rawReview,
        improvement: { ...rawReview.improvement, turnId: "missing" },
      });
    assert.equal((await reviewAPI.POST(req(d))).status, 500);
    global.fetch = async () =>
      Response.json(
        { error: { details: [{ retryDelay: "35s" }] } },
        { status: 429 },
      );
    const limited = await reviewAPI.POST(req(d));
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).retryAfter, 35);
  }));
