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
const store = require("../lib/voice-notebook.ts"),
  roleplay = require("../app/api/roleplay/route.ts"),
  terms = require("../app/api/terms/route.ts"),
  voice = require("../app/api/transcribe/route.ts");
const { exampleProfile } = require("../lib/conversation-cards.ts");
const req = (d) =>
  new Request("http://test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d),
  });
const consent = { consent: true, adultConsent: true, sampleConsent: true };
function withAI(fn) {
  const fetchOld = global.fetch,
    env = { ...process.env };
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.COACH_AI_ENABLED;
  delete process.env.COACH_VOICE_ENABLED;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      global.fetch = fetchOld;
      for (const k of [
        "GEMINI_API_KEY",
        "COACH_AI_ENABLED",
        "COACH_VOICE_ENABLED",
      ])
        if (env[k] === undefined) delete process.env[k];
        else process.env[k] = env[k];
    });
}
const output = (d) =>
  Response.json({
    candidates: [{ content: { parts: [{ text: JSON.stringify(d) }] } }],
  });
test("normalizes mobile recording MIME and rejects non-audio", () => {
  assert.equal(
    store.normalizeAudioMime("audio/mp4;codecs=mp4a.40.2"),
    "audio/m4a",
  );
  assert.equal(store.normalizeAudioMime("audio/x-m4a"), "audio/m4a");
  assert.equal(store.normalizeAudioMime("", "note.m4a"), "audio/m4a");
  assert.equal(store.normalizeAudioMime("text/html", "note.mp3"), null);
});
test("term extraction includes only words present in the conversation", () => {
  assert.deepEqual(
    store.termCandidates(
      ["SLA", "SLA", "NDA", "런칭"],
      "SLA를 정하고 런칭해요",
    ),
    ["SLA", "런칭"],
  );
});
test("guide and portable glossary exclude conversation quote and session references", () => {
  const t = store.parseTerm({
    term: "SLA",
    industry: "IT",
    meaning: "서비스 수준 합의",
    usage: "SLA를 정하죠.",
    caution: "수치를 확인해요.",
    memo: "팀 메모",
    quote: "PRIVATE CONVERSATION",
    sessionId: "SECRET-ID",
    source: "ai",
    reviewed: false,
  });
  const md = store.guideMarkdown([t]);
  assert(!md.includes("PRIVATE"));
  assert(!md.includes("SECRET"));
  assert(md.includes("AI 설명 초안"));
  assert(md.includes("팀 메모"));
  const imported = store.parseTermImport(
    JSON.stringify({ version: 1, terms: [t] }),
  );
  assert.equal(imported[0].quote, "");
  assert.equal(imported[0].sessionId, "");
  assert.notEqual(imported[0].id, t.id);
  assert.throws(() => store.parseTermImport('{"version":99}'));
});
test("roleplay preserves persona, industry and turn history without exposing key", () =>
  withAI(async () => {
    let sent;
    global.fetch = async (url, options) => {
      sent = JSON.parse(options.body);
      return output({
        reply: "마감 일정을 어떻게 조율하면 좋을까요?",
        terms: ["마감 일정", "가짜"],
      });
    };
    const r = await roleplay.POST(
      req({
        ...consent,
        context: exampleProfile,
        industry: "IT 서비스 기획",
        messages: [
          { role: "assistant", text: "금요일까지 가능할까요?" },
          { role: "user", text: "다음 주로 마감 일정을 옮기고 싶어요." },
        ],
      }),
    );
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.equal(d.source, "ai");
    assert.deepEqual(d.terms, ["마감 일정"]);
    const passed = JSON.parse(sent.contents[0].parts[0].text);
    assert.equal(passed.context.goal, undefined);
    assert.equal(passed.context.boundaries, undefined);
    assert.equal(passed.context.situation, exampleProfile.situation);
    assert.equal(passed.industry, "IT 서비스 기획");
    assert.equal(passed.messages.length, 2);
    assert(!JSON.stringify(d).includes("test-key"));
  }));
test("roleplay rejects missing consent, wrong order and excess history before model call", () =>
  withAI(async () => {
    global.fetch = async () => {
      throw Error("must not call");
    };
    assert.equal(
      (
        await roleplay.POST(
          req({ context: exampleProfile, industry: "", messages: [] }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await roleplay.POST(
          req({
            ...consent,
            context: exampleProfile,
            industry: "",
            messages: [{ role: "user", text: "bad order" }],
          }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await roleplay.POST(
          req({
            ...consent,
            context: exampleProfile,
            industry: "",
            messages: [{ role: "assistant", text: "unanswered" }],
          }),
        )
      ).status,
      400,
    );
  }));
test("provider rate limits and invalid output stay errors, never fabricated conversation", () =>
  withAI(async () => {
    global.fetch = async () => new Response("{}", { status: 429 });
    assert.equal(
      (
        await roleplay.POST(
          req({
            ...consent,
            context: exampleProfile,
            industry: "",
            messages: [],
          }),
        )
      ).status,
      429,
    );
    global.fetch = async () => output({ reply: 17, terms: [] });
    assert.equal(
      (
        await roleplay.POST(
          req({
            ...consent,
            context: exampleProfile,
            industry: "",
            messages: [],
          }),
        )
      ).status,
      500,
    );
  }));
test("term explanation is explicitly an unverified AI draft", () =>
  withAI(async () => {
    global.fetch = async () =>
      output({
        meaning: "업종에 따라 뜻이 달라요.",
        usage: "동료에게 의미를 확인해요.",
        caution: "사내 약어일 수 있어요.",
      });
    const r = await terms.POST(
      req({
        ...consent,
        action: "explain",
        term: "PM",
        industry: "IT",
        text: "PM과 이야기해요.",
      }),
    );
    const d = await r.json();
    assert.equal(d.verified, false);
    assert.equal(d.source, "ai");
  }));
test("M4A uploads reach provider under supported MIME, with untruncated transcript", () =>
  withAI(async () => {
    let mime;
    const transcript = "원문 ".repeat(300);
    global.fetch = async (url, options) => {
      const b = JSON.parse(options.body);
      mime = b.contents[0].parts[0].inline_data.mime_type;
      return output({ text: transcript });
    };
    const f = new FormData();
    f.append(
      "audio",
      new Blob([new Uint8Array(300)], { type: "audio/x-m4a" }),
      "memo.m4a",
    );
    for (const [k, v] of Object.entries(consent)) f.append(k, String(v));
    const r = await voice.POST(
      new Request("http://test", { method: "POST", body: f }),
    );
    assert.equal(r.status, 200);
    assert.equal(mime, "audio/m4a");
    assert.equal((await r.json()).text, transcript.trim());
  }));
test("audio and text persist together and delete as a single record", async () => {
  global.indexedDB = require("fake-indexeddb").indexedDB;
  const s = {
    id: "test-session",
    title: "연습",
    kind: "recording",
    industry: "IT",
    turns: [
      {
        id: "t1",
        role: "recording",
        text: "SLA를 확인해요.",
        terms: ["SLA"],
        clip: {
          blob: new Blob(["test voice"], { type: "audio/webm" }),
          duration: 1,
          peaks: [0.5],
        },
        createdAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await store.putSession(s);
  const saved = await store.getSession(s.id);
  assert.equal(await saved.turns[0].clip.blob.text(), "test voice");
  assert.equal(saved.turns[0].text, "SLA를 확인해요.");
  await store.deleteSession(s.id);
  assert.equal(await store.getSession(s.id), undefined);
});

test("candidate coaching receives the goal separately from the practice partner", () =>
  withAI(async () => {
    let sent;
    global.fetch = async (url, options) => {
      sent = JSON.parse(options.body);
      return output({
        suggestions: [
          "다음 주로 조율하고 싶어요.",
          "다음 주에 진행할 수 있을까요?",
          "우선순위를 확인하고 다음 주로 정해볼까요?",
        ],
      });
    };
    const r = await roleplay.POST(
      req({
        ...consent,
        action: "suggest",
        context: exampleProfile,
        industry: "IT",
        messages: [{ role: "assistant", text: "어떤 일정을 원하세요?" }],
      }),
    );
    assert.equal(r.status, 200);
    assert.equal((await r.json()).suggestions.length, 3);
    assert.equal(
      JSON.parse(sent.contents[0].parts[0].text).context.goal,
      exampleProfile.goal,
    );
  }));
