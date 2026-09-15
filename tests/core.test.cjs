const ts = require("typescript"),
  Module = require("module"),
  path = require("path");
const root = path.resolve(__dirname, ".."),
  resolve = Module._resolveFilename;
Module._resolveFilename = function (id, ...args) {
  return resolve.call(
    this,
    id.startsWith("@/") ? path.join(root, id.slice(2)) : id,
    ...args,
  );
};
require.extensions[".ts"] = function (module, file) {
  module._compile(
    ts.transpileModule(require("fs").readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        resolveJsonModule: true,
      },
    }).outputText,
    file,
  );
};
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const p = require("../lib/progress.ts"),
  { scenarios } = require("../lib/scenarios.ts"),
  { validateCoach } = require("../lib/coach-contract.ts");
const coach = require("../app/api/coach/route.ts"),
  voice = require("../app/api/transcribe/route.ts"),
  legacy = require("../app/api/analyze-call/route.ts");
const req = (d) =>
  new Request("http://test/api/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d),
  });
const data = {
  scenario: "sales",
  tone: "firm_polite",
  mode: "ai",
  opponent: "지금 가입하세요. 무료입니다.",
  reply: "가입하지 않겠습니다.",
  consent: true,
  adultConsent: true,
  sampleConsent: true,
};
const output = {
  pattern: "가입 권유",
  evidence: "지금 가입하세요.",
  reason: "선택을 분명히 밝힙니다.",
  suggestion: "가입하지 않겠습니다.",
  feedback: "의사를 분명하게 밝혔어요.",
};
test("sample viewing does not grant XP", () =>
  assert.equal(p.stats({ awards: [] }).xp, 0));
test("first and revision rewards cannot be repeated", () => {
  let x = p.awardRound({ awards: [] }, "sales-1", false, "2026-09-15");
  x = p.awardRound(x, "sales-1", false, "2026-09-15");
  x = p.awardRound(x, "sales-1", true, "2026-09-15");
  x = p.awardRound(x, "sales-1", true, "2026-09-15");
  assert.equal(p.stats(x).xp, 15);
  assert.equal(p.stats(x).rounds, 1);
});
test("revision without first attempt gets no reward", () =>
  assert.equal(p.awardRound({ awards: [] }, "sales-1", true).awards.length, 0));
test("calendar day controls rewards and streak; missing day preserves XP", () => {
  let x = p.awardRound({ awards: [] }, "sales-1", false, "2026-09-14");
  x = p.awardRound(x, "sales-1", false, "2026-09-15");
  assert.equal(p.stats(x, new Date(2026, 8, 15)).streak, 2);
  assert.equal(p.stats(x, new Date(2026, 8, 17)).streak, 0);
  assert.equal(p.stats(x).xp, 20);
  assert.equal(p.localDay(new Date(2026, 8, 15, 0, 1)), "2026-09-15");
});
test("corrupt and duplicate storage are handled", () => {
  assert.deepEqual(p.parseProgress("{no"), { awards: [] });
  const x = p.awardRound({ awards: [] }, "sales-1");
  assert.equal(
    p.parseProgress(
      JSON.stringify({ awards: [...x.awards, ...x.awards, { xp: 900 }] }),
    ).awards.length,
    1,
  );
});
test("all seven scenarios have unique rounds and complete tones", () => {
  assert.equal(scenarios.length, 7);
  const ids = new Set();
  for (const s of scenarios)
    for (const r of s.rounds) {
      assert(!ids.has(r.id));
      ids.add(r.id);
      for (const t of ["firm_polite", "warm", "cold"])
        assert(r.cues[t].length > 10);
    }
});
test("interview and presentation keep their own context", () => {
  for (const s of scenarios.filter((s) =>
    ["job_interview", "work_presentation"].includes(s.id),
  ))
    for (const r of s.rounds)
      for (const cue of Object.values(r.cues))
        assert(!/가입하지|전화.*끊|통화.*마치/.test(cue));
});
test("AI evidence must match actual input", () => {
  assert.equal(
    validateCoach(output, data.opponent).suggestion,
    output.suggestion,
  );
  assert.throws(() =>
    validateCoach({ ...output, evidence: "존재하지 않는 발언" }, data.opponent),
  );
  assert.throws(() =>
    validateCoach({ ...output, suggestion: "" }, data.opponent),
  );
});
test("sample API labels source and rejects invalid scenario", async () => {
  const r = await coach.POST(
    req({ ...data, mode: "sample", roundId: "sales-1" }),
  );
  assert.equal((await r.json()).source, "sample");
  assert.equal(
    (await coach.POST(req({ ...data, scenario: "unknown" }))).status,
    400,
  );
});
test("disabled provider never returns sample as AI", async () => {
  const old = process.env.COACH_AI_ENABLED;
  process.env.COACH_AI_ENABLED = "false";
  try {
    assert.equal((await coach.POST(req(data))).status, 503);
    assert.equal((await voice.POST(req(data))).status, 503);
  } finally {
    if (old === undefined) delete process.env.COACH_AI_ENABLED;
    else process.env.COACH_AI_ENABLED = old;
  }
});
test("malformed and oversized inputs are rejected", async () => {
  assert.equal(
    (
      await coach.POST(
        new Request("http://test", { method: "POST", body: "{" }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await coach.POST(req({ ...data, opponent: "x".repeat(20000) }))).status,
    413,
  );
});
test("legacy audio cannot return fixture analysis", async () => {
  assert.equal(
    (
      await legacy.POST(
        new Request("http://test", {
          method: "POST",
          body: new Blob(["audio"]),
        }),
      )
    ).status,
    501,
  );
  assert.equal(
    (await legacy.POST(req({ demo: true, scenario: "sales" }))).status,
    200,
  );
});
test("Gemini adapter: key header, consent, genuine AI label, quota, evidence", async () => {
  const fetchBefore = global.fetch;
  const env = { ...process.env };
  process.env.COACH_AI_ENABLED = "true";
  process.env.GEMINI_API_KEY = "mock-key";
  process.env.GEMINI_DATA_MODE = "free";
  let calls = 0;
  global.fetch = async (url, init) => {
    calls++;
    assert(!url.includes("mock-key"));
    assert.equal(init.headers["x-goog-api-key"], "mock-key");
    return Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }],
    });
  };
  try {
    assert.equal(
      (await coach.POST(req({ ...data, sampleConsent: false }))).status,
      400,
    );
    assert.equal(calls, 0);
    assert.equal(
      (await coach.POST(req({ ...data, adultConsent: false }))).status,
      400,
    );
    let r = await coach.POST(req(data));
    assert.equal(r.status, 200);
    assert.equal((await r.json()).source, "ai");
    global.fetch = async () => Response.json({}, { status: 429 });
    assert.equal((await coach.POST(req(data))).status, 429);
    global.fetch = async () =>
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                { text: JSON.stringify({ ...output, evidence: "없는 말" }) },
              ],
            },
          },
        ],
      });
    assert.equal((await coach.POST(req(data))).status, 502);
  } finally {
    global.fetch = fetchBefore;
    for (const k of Object.keys(process.env))
      if (!(k in env)) delete process.env[k];
    Object.assign(process.env, env);
  }
});
test("short voice transcription does not invent speaker labels", async () => {
  const old = { ...process.env },
    before = global.fetch;
  Object.assign(process.env, {
    COACH_AI_ENABLED: "true",
    COACH_VOICE_ENABLED: "true",
    GEMINI_API_KEY: "mock-key",
    GEMINI_DATA_MODE: "free",
  });
  global.fetch = async () =>
    Response.json({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify({ text: "지금 가입하세요." }) }],
          },
        },
      ],
    });
  try {
    const form = new FormData();
    form.set(
      "audio",
      new Blob(["a".repeat(200)], { type: "audio/webm" }),
      "sample.webm",
    );
    for (const key of ["consent", "adultConsent", "sampleConsent"])
      form.set(key, "true");
    const r = await voice.POST(
      new Request("http://test", { method: "POST", body: form }),
    );
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.equal(d.text, "지금 가입하세요.");
    assert.equal(d.speakerSeparated, false);
  } finally {
    global.fetch = before;
    for (const k of Object.keys(process.env))
      if (!(k in old)) delete process.env[k];
    Object.assign(process.env, old);
  }
});

const cardModel = require("../lib/conversation-cards.ts");
const contextRoute = require("../app/api/context/route.ts");
test("card storage validates schema, strips extra conversation data and deduplicates", () => {
  const card = {
    ...cardModel.exampleProfile,
    id: "card-test",
    createdAt: "2026-09-15T10:00:00Z",
    updatedAt: "2026-09-15T10:00:00Z",
    lastUsedAt: null,
    useCount: 0,
    source: "manual",
    transcript: "must not persist",
  };
  const parsed = cardModel.parseCards(
    JSON.stringify({
      version: 1,
      cards: [card, card, { ...card, id: "card-bad", goal: "" }],
    }),
  );
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].transcript, undefined);
  assert.deepEqual(cardModel.parseCards("broken"), []);
  assert.deepEqual(
    cardModel.parseCards(JSON.stringify({ version: 99, cards: [card] })),
    [],
  );
});
test("save, update, reuse and search preserve identity and independent goals", () => {
  const old = global.localStorage;
  let stored = null;
  global.localStorage = {
    getItem: () => stored,
    setItem: (_, v) => (stored = v),
  };
  try {
    let cards = cardModel.saveCard(cardModel.exampleProfile, "manual");
    const id = cards[0].id,
      created = cards[0].createdAt;
    cards = cardModel.saveCard(
      { ...cardModel.exampleProfile, goal: "다음 주 일정 확정" },
      "manual",
      id,
    );
    assert.equal(cards.length, 1);
    assert.equal(cards[0].createdAt, created);
    cards = cardModel.markUsed(id);
    assert.equal(cards[0].useCount, 1);
    assert.equal(cardModel.searchCards(cards, "팀장 다음 주").length, 1);
    assert.equal(cardModel.searchCards(cards, "병원").length, 0);
  } finally {
    global.localStorage = old;
  }
});
test("storage failure is surfaced instead of pretending saved", () => {
  const old = global.localStorage;
  global.localStorage = {
    getItem: () => null,
    setItem: () => {
      throw Error("quota");
    },
  };
  try {
    assert.throws(() => cardModel.saveCard(cardModel.exampleProfile, "guided"));
  } finally {
    global.localStorage = old;
  }
});
test("guided setup accepts a novel situation without fixed scenario mapping", () => {
  const messages = [
    "집주인에게 누수 수리 일정을 물으려고 해요",
    "집주인",
    "수리 날짜 확정",
    "비난하지 않기",
  ].map((text) => ({ role: "user", text }));
  const d = cardModel.guidedReply(messages);
  assert.equal(d.profile.partner, "집주인");
  assert.equal(d.profile.goal, "수리 날짜 확정");
  assert(!Object.hasOwn(d.profile, "scenario"));
  assert.doesNotThrow(() => cardModel.parseProfile(d.profile));
});
test("custom context reaches coach provider instead of the default sales goal", async () => {
  const old = { ...process.env },
    before = global.fetch;
  Object.assign(process.env, {
    COACH_AI_ENABLED: "true",
    GEMINI_API_KEY: "mock-key",
    GEMINI_DATA_MODE: "free",
  });
  let payload;
  global.fetch = async (_, init) => {
    payload = JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
    return Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }],
    });
  };
  try {
    const r = await coach.POST(
      req({ ...data, scenario: undefined, context: cardModel.exampleProfile }),
    );
    assert.equal(r.status, 200);
    assert.equal(payload.goal, cardModel.exampleProfile.goal);
    assert.equal(payload.context.partner, cardModel.exampleProfile.partner);
    assert.equal(
      (
        await coach.POST(
          req({ ...data, context: { ...cardModel.exampleProfile, goal: "" } }),
        )
      ).status,
      400,
    );
  } finally {
    global.fetch = before;
    for (const k of Object.keys(process.env))
      if (!(k in old)) delete process.env[k];
    Object.assign(process.env, old);
  }
});
test("AI context requires consent and returns a reviewable profile; no hidden fallback", async () => {
  const old = { ...process.env },
    before = global.fetch;
  Object.assign(process.env, {
    COACH_AI_ENABLED: "true",
    GEMINI_API_KEY: "mock-key",
    GEMINI_DATA_MODE: "free",
  });
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return Response.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  profile: cardModel.exampleProfile,
                  question: "",
                }),
              },
            ],
          },
        },
      ],
    });
  };
  const d = {
    messages: [{ role: "user", text: "팀장에게 마감 조율을 요청하고 싶어요." }],
    consent: true,
    adultConsent: true,
    sampleConsent: true,
  };
  try {
    assert.equal(
      (await contextRoute.POST(req({ ...d, sampleConsent: false }))).status,
      400,
    );
    assert.equal(calls, 0);
    const r = await contextRoute.POST(req(d));
    assert.equal(r.status, 200);
    assert.equal((await r.json()).source, "ai");
    process.env.COACH_AI_ENABLED = "false";
    assert.equal((await contextRoute.POST(req(d))).status, 503);
  } finally {
    global.fetch = before;
    for (const k of Object.keys(process.env))
      if (!(k in old)) delete process.env[k];
    Object.assign(process.env, old);
  }
});
