const ts = require("typescript"),
  Module = require("module"),
  path = require("path"),
  fs = require("fs");
const base = path.resolve(__dirname, ".."),
  resolve = Module._resolveFilename;
Module._resolveFilename = function (id, ...args) {
  return resolve.call(
    this,
    id.startsWith("@/") ? path.join(base, id.slice(2)) : id,
    ...args,
  );
};
for (const ext of [".ts", ".tsx"])
  require.extensions[ext] = function (m, file) {
    m._compile(
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
const { JSDOM } = require("jsdom"),
  React = require("react"),
  { act } = React,
  { createRoot } = require("react-dom/client"),
  { Simulate } = require("react-dom/test-utils"),
  { IDBFactory } = require("fake-indexeddb");
const recording = require("../lib/recording-analysis.ts"),
  reviews = require("../lib/practice-review.ts"),
  store = require("../lib/voice-notebook.ts"),
  gemini = require("../lib/gemini.ts"),
  language = require("../lib/conversation-language.ts"),
  {
    termCatalogue,
    termGroups,
    schoolCompanion,
  } = require("../lib/term-catalogue.ts");
const consent = { consent: true, adultConsent: true, sampleConsent: true },
  config = { available: true, voiceAvailable: true, sampleOnly: true };
const example = recording.recordingExamples[0];
const source = {
  id: "turn-recorded",
  role: "recording",
  text: example.segments.map((s) => s.text).join("\n"),
  terms: [],
  createdAt: new Date().toISOString(),
  clip: {
    blob: new Blob(["test audio"], { type: "audio/wav" }),
    duration: 20,
    peaks: [],
    name: "test.wav",
  },
};
function draft() {
  return {
    sourceTurnId: source.id,
    inputKey: recording.recordingInputKey(source),
    transcript: source.text,
    segments: structuredClone(example.segments),
    context: { ...example.context },
    confirmed: true,
  };
}
function session() {
  return {
    id: "session-recorded",
    title: "검증용 녹음",
    kind: "recording",
    industry: "기획",
    turns: [source],
    createdAt: source.createdAt,
    updatedAt: source.createdAt,
    recordingAnalysis: draft(),
  };
}
const req = (d) =>
  new Request("https://test.local/api", {
    method: "POST",
    body: JSON.stringify(d),
  });
async function ai(fn) {
  const old = { config: gemini.geminiConfig, generate: gemini.geminiGenerate };
  gemini.geminiConfig = () => config;
  try {
    await fn();
  } finally {
    gemini.geminiConfig = old.config;
    gemini.geminiGenerate = old.generate;
  }
}
async function mount(C, props = {}, prepare = () => {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://test.local" });
  const old = {
    window: global.window,
    document: global.document,
    fetch: global.fetch,
    localStorage: global.localStorage,
    navigator: Object.getOwnPropertyDescriptor(global, "navigator"),
  };
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = window.localStorage;
  Object.defineProperty(global, "navigator", {
    value: window.navigator,
    configurable: true,
  });
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.indexedDB = new IDBFactory();
  window.matchMedia = () => ({ matches: false });
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  global.fetch = async () => Response.json(config);
  prepare();
  const root = createRoot(document.getElementById("root"));
  await act(async () => root.render(React.createElement(C, props)));
  return {
    root,
    async cleanup() {
      await act(async () => root.unmount());
      dom.window.close();
      global.window = old.window;
      global.document = old.document;
      global.fetch = old.fetch;
      global.localStorage = old.localStorage;
      Object.defineProperty(global, "navigator", old.navigator);
    },
  };
}
const button = (text) =>
  [...document.querySelectorAll("button")].find(
    (b) =>
      b.textContent.trim() === text || b.getAttribute("aria-label") === text,
  );
const click = async (el) => {
  assert(el, "element missing");
  await act(async () => el.click());
};
const change = async (el, value) => {
  assert(el, "input missing");
  await act(async () => {
    el.value = value;
    Simulate.change(el, { target: { value } });
  });
};
const settle = async () => {
  for (let i = 0; i < 3; i++)
    await act(async () => new Promise((r) => setTimeout(r, 5)));
};
test("recording contract requires confirmed speakers, bounded segments and exact user quote grounding", () => {
  const d = draft();
  assert.equal(recording.validateRecordingInput(d).turns.length, 4);
  for (const bad of [
    { ...d, confirmed: false },
    { ...d, segments: d.segments.map((s) => ({ ...s, role: "unknown" })) },
    { ...d, segments: [d.segments[0], d.segments[0]] },
    {
      ...d,
      segments: d.segments.map((s) => ({ ...s, text: "a".repeat(2000) })),
    },
  ])
    assert.throws(() => recording.validateRecordingInput(bad));
  const consecutive = {
    ...d,
    segments: [
      d.segments[0],
      d.segments[1],
      { ...d.segments[1], id: "segment-another" },
      d.segments[2],
      d.segments[3],
    ],
  };
  assert.equal(recording.validateRecordingInput(consecutive).turns.length, 5);
  assert.throws(() =>
    reviews.validateReview(
      {
        ...example.review,
        strength: { ...example.review.strength, quote: "없는 말" },
      },
      d.context,
      recording.recordingTurns(d.segments),
    ),
  );
});
test("recording endpoint validates consent and grounding; no sample analysis is fabricated on invalid output", async () =>
  ai(async () => {
    const route = require("../app/api/recording-review/route.ts");
    let calls = 0;
    gemini.geminiGenerate = async (system, parts) => {
      calls++;
      assert(system.includes("번갈아 나오지"));
      assert(!parts[0].text.includes("test audio"));
      return example.review;
    };
    assert.equal((await route.POST(req(draft()))).status, 400);
    assert.equal(calls, 0);
    const res = await route.POST(req({ ...draft(), ...consent }));
    assert.equal(res.status, 200);
    assert.equal((await res.json()).source, "ai");
    assert.equal(calls, 1);
    gemini.geminiGenerate = async () => ({
      ...example.review,
      improvement: {
        ...example.review.improvement,
        quote: "I invented this quote",
      },
    });
    const invalid = await route.POST(req({ ...draft(), ...consent }));
    assert.equal(invalid.status, 500);
    assert(!(await invalid.json()).review);
  }));
test("recording draft, original audio and language survive storage; replay uses the actual preceding opponent and rejects stale analysis", async () => {
  global.indexedDB = new IDBFactory();
  const s = {
    ...session(),
    languages: { partner: "ja", mine: "en" },
    recordingAnalysis: { ...draft(), review: example.review },
  };
  await store.putSession(s);
  const loaded = await store.getSession(s.id);
  assert.equal(await loaded.turns[0].clip.blob.text(), "test audio");
  assert.deepEqual(loaded.languages, s.languages);
  const replay = recording.recordingDrill(loaded, loaded.recordingAnalysis);
  assert.equal(replay.turns[0].text, example.segments[2].text);
  assert.equal(replay.turns[0].origin, "recording");
  assert.equal(replay.context.goal, s.recordingAnalysis.context.goal);
  assert.deepEqual(replay.languages, s.languages);
  assert.throws(() =>
    recording.recordingDrill(loaded, {
      ...loaded.recordingAnalysis,
      context: { ...loaded.recordingAnalysis.context, goal: "새 목표" },
    }),
  );
  const first = {
    ...draft(),
    segments: [example.segments[1], example.segments[0]],
  };
  const r = reviews.validateReview(
    {
      ...example.review,
      improvement: {
        ...example.review.improvement,
        turnId: example.segments[1].id,
        quote: example.segments[1].text,
      },
    },
    first.context,
    recording.recordingTurns(first.segments),
  );
  assert.throws(() => recording.recordingDrill(s, { ...first, review: r }));
});
test("language settings reach partner, candidate and companion prompts independently; foreign outage samples retain provenance", async () =>
  ai(async () => {
    const roleplay = require("../app/api/roleplay/route.ts"),
      companion = require("../app/api/companion/route.ts");
    const payload = {
      context: example.context,
      industry: "",
      messages: [],
      languages: { partner: "en", mine: "ja" },
      ...consent,
    };
    let prompts = [];
    gemini.geminiGenerate = async (system) => {
      prompts.push(system);
      return system.includes("후보 3개")
        ? { suggestions: ["一つ目", "二つ目", "三つ目"] }
        : { reply: "What would you like to discuss?", terms: [] };
    };
    assert.equal((await roleplay.POST(req(payload))).status, 200);
    assert(prompts.at(-1).includes("Output language: English"));
    assert.equal(
      (
        await roleplay.POST(
          req({
            ...payload,
            action: "suggest",
            messages: [{ role: "assistant", text: "Hello" }],
          }),
        )
      ).status,
      200,
    );
    assert(prompts.at(-1).includes("Output language: 日本語"));
    assert.equal(
      (await companion.POST(req({ ...payload, companion: schoolCompanion })))
        .status,
      200,
    );
    assert(prompts.at(-1).includes("가상 AI 역할"));
    assert.equal(
      (
        await roleplay.POST(
          req({ ...payload, languages: { partner: "injected", mine: "ko" } }),
        )
      ).status,
      400,
    );
    const resilient = require("../lib/resilient-ai.ts");
    const oldFetch = global.fetch;
    global.fetch = async () => {
      throw new Error("manual must not request");
    };
    try {
      for (const lang of ["en", "ja"]) {
        const r = await resilient.sampledRequest({
          manual: true,
          language: lang,
          operation: "suggestions",
          context: "",
          previous: [],
          url: "/api/roleplay",
          init: {},
        });
        assert.equal(r.source, "sample");
        assert.equal(r.suggestions.length, 3);
        assert(r.sample.sampleId.startsWith("language-" + lang));
      }
    } finally {
      global.fetch = oldFetch;
    }
  }));
test("all glossary examples are valid, not verified user facts; saving and sharing preserve provenance", async () => {
  assert.equal(Object.keys(termGroups).length, 17);
  assert.equal(termCatalogue.length, 55);
  assert.equal(new Set(termCatalogue.map((r) => r.note.id)).size, 55);
  for (const { note, group } of termCatalogue) {
    assert(termGroups[group]);
    assert.equal(store.parseTerm(note).isSample, true);
    assert.equal(note.reviewed, false);
    assert(note.caution);
  }
  assert(schoolCompanion.persona.includes("실제 학생"));
  assert(schoolCompanion.persona.includes("특정 세대"));
});
test("recording UI keeps confirmed text after quota error and persists a later grounded review", async () => {
  const Component = require("../components/RecordingAnalysis.tsx").default;
  let current = session();
  let saves = 0;
  function Wrapper() {
    const [s, setS] = React.useState(current);
    return React.createElement(Component, {
      session: s,
      config,
      disabled: false,
      onBusy: () => {},
      onPractice: async () => {},
      onSave: async (d) => {
        current = { ...current, recordingAnalysis: d };
        saves++;
        await store.putSession(current);
        setS(current);
      },
    });
  }
  const ui = await mount(Wrapper);
  try {
    const check = [...document.querySelectorAll("label")]
      .find((l) => l.textContent.includes("만 18세 이상"))
      .querySelector("input");
    await click(check);
    global.fetch = async () =>
      Response.json(
        { quotaKind: "daily", code: "provider_rate_limit" },
        { status: 429 },
      );
    await click(button("확인한 대화 코칭받기"));
    await settle();
    assert(saves > 0);
    assert(document.body.textContent.includes("녹음과 확인한 문자는 보관돼요"));
    assert(!current.recordingAnalysis.review);
    assert.equal(
      (await store.getSession(current.id)).recordingAnalysis.segments[1].role,
      "user",
    );
    window.sessionStorage.clear();
    global.fetch = async () =>
      Response.json({ review: example.review, source: "ai" });
    await click(button("확인한 대화 코칭받기"));
    await settle();
    assert(document.body.textContent.includes(example.review.focus));
    assert(current.recordingAnalysis.review);
    assert(button("이 장면 다시 연습"));
  } finally {
    await ui.cleanup();
  }
});
test("editing a recording transcript resets speaker assignments and cannot submit without reconfirmation", async () => {
  const Component = require("../components/RecordingAnalysis.tsx").default;
  let saved;
  const s = { ...session(), recordingAnalysis: undefined };
  const ui = await mount(Component, {
    session: s,
    config,
    disabled: false,
    onBusy: () => {},
    onPractice: async () => {},
    onSave: async (d) => {
      saved = d;
    },
  });
  try {
    await click(button("수정 문자 저장 · 화자 확인"));
    assert(saved.segments.every((s) => s.role === "unknown"));
    assert(button("확인한 대화 코칭받기").disabled);
    await change(document.querySelector(".learn-segments select"), "assistant");
    await click(button("화자·목표 저장"));
    assert.equal(saved.segments[0].role, "assistant");
    await click(button("문자 다시 수정"));
    await change(
      document.querySelector("textarea"),
      source.text + "\n새로 확인한 말",
    );
    await click(button("수정 문자 저장 · 화자 확인"));
    assert.equal(saved.segments.length, 5);
    assert(saved.segments.every((s) => s.role === "unknown"));
    assert.equal(saved.confirmed, false);
  } finally {
    await ui.cleanup();
  }
});
test("community prototype stays local, clearly labels fictional visitors, and resets chosen reply on close", async () => {
  const C = require("../components/CommunityPreview.tsx").default;
  const ui = await mount(C);
  let calls = 0;
  global.fetch = async () => {
    calls++;
    throw new Error("No network");
  };
  try {
    await click(button("샘플 공간 둘러보기"));
    assert(document.querySelector("dialog").open);
    assert(
      document.body.textContent.includes(
        "실제 접속자·메시지 전송 기능은 아직 없어요",
      ),
    );
    await click(button("검토할 부분을 작게 나눠서 부탁해보면 어떨까요?"));
    assert(document.body.textContent.includes("내가 고른 답변"));
    assert.equal(calls, 0);
    await click(button("라운지 미리보기 닫기"));
    await click(button("샘플 공간 둘러보기"));
    assert(!document.body.textContent.includes("내가 고른 답변"));
    assert.equal(window.localStorage.length, 0);
  } finally {
    await ui.cleanup();
  }
});
test("glossary catalogue filters by school and teen context and opens an explicitly fictional AI role", async () => {
  const C = require("../components/TermCatalogue.tsx").default;
  let asked, selected;
  const ui = await mount(C, {
    onAsk: (c) => (asked = c),
    onSelect: (n) => (selected = n),
  });
  try {
    await change(document.querySelector("select"), "teen");
    assert.equal(document.querySelectorAll(".learn-term").length, 4);
    await click(button("중학생 AI 역할에게 물어보기"));
    assert.equal(asked.id, schoolCompanion.id);
    await click(document.querySelector(".learn-term"));
    assert.equal(selected.term, "ㅇㅈ");
  } finally {
    await ui.cleanup();
  }
});
test("free setup remains selectable after a guided answer and preserves entered context on mode change", async () => {
  const id = require.resolve("next/navigation"),
    prior = require.cache[id];
  require.cache[id] = {
    id,
    filename: id,
    loaded: true,
    exports: { useSearchParams: () => new URLSearchParams() },
  };
  const C = require("../components/ConversationWorkspace.tsx").default;
  const ui = await mount(C, {}, () =>
    window.localStorage.setItem("ddeundeun-spotlight-guide-v2", "done"),
  );
  try {
    await settle();
    await click(button("내 대화"));
    await click(button("새 대화"));
    await click(button("하나씩 정리"));
    await change(
      document.querySelector("#setup-message"),
      "팀장님과 일정을 조율하고 싶어요.",
    );
    await act(async () =>
      Simulate.submit(document.querySelector("form.dc-composer")),
    );
    assert(!button("자유롭게 이야기").disabled);
    await click(button("자유롭게 이야기"));
    assert.equal(
      button("자유롭게 이야기").getAttribute("aria-pressed"),
      "true",
    );
    await change(
      document.querySelector("#setup-message"),
      "아직 보내지 않은 추가 맥락",
    );
    await click(button("하나씩 정리"));
    assert(
      document
        .querySelector("#profile-situation")
        .value.includes("팀장님과 일정을"),
    );
    assert(
      document
        .querySelector("#profile-situation")
        .value.includes("아직 보내지 않은"),
    );
  } finally {
    await ui.cleanup();
    if (prior) require.cache[id] = prior;
    else delete require.cache[id];
  }
});
test("free setup with unavailable AI accepts a local draft and clearly routes to manual confirmation", async () => {
  const C = require("../components/ConversationWorkspace.tsx").default;
  const ui = await mount(C, {}, () => {
    window.localStorage.setItem("ddeundeun-spotlight-guide-v2", "done");
    global.fetch = async () =>
      Response.json({ ...config, available: false, voiceAvailable: false });
  });
  try {
    await settle();
    await click(button("내 대화"));
    await click(button("새 대화"));
    assert(!button("자유롭게 이야기").disabled);
    await click(button("자유롭게 이야기"));
    await change(
      document.querySelector("#setup-message"),
      "친구에게 도움이 필요한 이유를 설명하고 싶어요.",
    );
    assert(!button("이야기 보내기").disabled);
    await act(async () =>
      Simulate.submit(document.querySelector("form.dc-composer")),
    );
    assert(
      document
        .querySelector("#profile-situation")
        .value.includes("도움이 필요한 이유"),
    );
    assert(document.body.textContent.includes("AI 연결 전이라"));
  } finally {
    await ui.cleanup();
  }
});

const trends = require("../lib/trend-search.ts");
const scenes = require("../lib/practical-scenes.ts");
const observer = require("../lib/persona-observer.ts");
function grounded() {
  return {
    candidates: [
      {
        finishReason: "STOP",
        content: {
          parts: [
            { text: "1. 예시말: 검증용 표현입니다.\n예문은 직접 작성했어요." },
          ],
        },
        groundingMetadata: {
          webSearchQueries: ["검증용 공개 용어 검색"],
          searchEntryPoint: { renderedContent: "<div>Google Search</div>" },
          groundingChunks: [
            {
              web: { uri: "https://example.org/evidence", title: "검증 출처" },
            },
          ],
          groundingSupports: [
            {
              segment: {
                text: "검증용 표현입니다.",
                startIndex: 100,
                endIndex: 500,
              },
              groundingChunkIndices: [0],
            },
          ],
        },
      },
    ],
  };
}
test("live trends require actual search evidence, safe source URLs, full output and search suggestions", () => {
  const r = trends.parseTrendResult(grounded(), "ko", new Date().toISOString());
  assert.equal(
    trends
      .citedParts(r)
      .map((p) => p.text)
      .join(""),
    r.text,
  );
  assert.equal(
    trends.citedParts(r)[0].sources[0].url,
    "https://example.org/evidence",
  );
  for (const edit of [
    (v) => (v.candidates[0].groundingMetadata.webSearchQueries = []),
    (v) => (v.candidates[0].groundingMetadata.groundingSupports = []),
    (v) => (v.candidates[0].groundingMetadata.searchEntryPoint = {}),
    (v) => (v.candidates[0].finishReason = "MAX_TOKENS"),
    (v) =>
      (v.candidates[0].groundingMetadata.groundingChunks[0].web.uri =
        "javascript:alert(1)"),
    (v) =>
      (v.candidates[0].groundingMetadata.groundingSupports[0].segment.text =
        "not in answer"),
  ]) {
    const v = grounded();
    edit(v);
    assert.throws(
      () => trends.parseTrendResult(v, "ko", "2026-09-16"),
      /ungrounded_output/,
    );
  }
  const weak = grounded();
  weak.candidates[0].groundingMetadata.groundingChunks[0].web.title =
    "tistory.com";
  assert.throws(
    () => trends.parseTrendResult(weak, "ko", "2026-09-16"),
    /weak_search_sources/,
  );
  assert.match(trends.trendPrompt("ja", new Date("2026-09-16")), /2026-06-18/);
  assert.match(trends.trendPrompt("en", new Date("2026-09-16")), /영어/);
  assert.match(termGroups.teen, /온라인/);
  assert(!termGroups.teen.includes("10대"));
});
test("trend endpoint sends only a fixed public-language prompt, never private extra fields, and preserves provider rate limits", async () => {
  const route = require("../app/api/term-trends/route.ts");
  const oldFetch = global.fetch,
    oldKey = process.env.GEMINI_API_KEY,
    oldConfig = gemini.geminiConfig;
  process.env.GEMINI_API_KEY = "test-only";
  gemini.geminiConfig = () => ({ ...config, model: "gemini-2.5-flash" });
  try {
    let sent;
    global.fetch = async (url, init) => {
      sent = JSON.parse(init.body);
      return Response.json(grounded());
    };
    const r = await route.POST(
      req({
        ...consent,
        language: "ko",
        text: "PRIVATE_RECORDING_DO_NOT_SEND",
      }),
    );
    assert.equal(r.status, 200);
    assert.match(JSON.stringify(sent), /google_search/);
    assert(!JSON.stringify(sent).includes("PRIVATE_RECORDING"));
    assert.equal(sent.generationConfig.responseMimeType, undefined);
    assert.equal((await route.POST(req({ language: "ko" }))).status, 400);
    assert.equal(
      (await route.POST(req({ ...consent, language: "unknown" }))).status,
      400,
    );
    global.fetch = async () => Response.json({ candidates: [] });
    const noEvidence = await route.POST(req({ ...consent, language: "ko" }));
    assert.equal(noEvidence.status, 502);
    assert.equal((await noEvidence.json()).code, "search_not_grounded");
    global.fetch = async () => Response.json({}, { status: 403 });
    assert.equal(
      (await (await route.POST(req({ ...consent, language: "ko" }))).json())
        .code,
      "search_unavailable",
    );
    global.fetch = async () =>
      Response.json({ error: { message: "rate limit" } }, { status: 429 });
    assert.equal(
      (await route.POST(req({ ...consent, language: "ko" }))).status,
      429,
    );
  } finally {
    global.fetch = oldFetch;
    gemini.geminiConfig = oldConfig;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
  }
});
test("new response scenarios migrate once after older samples were deleted, preserve edits and attach usable personas", async () => {
  const C = () => null;
  const ui = await mount(C);
  const cards = require("../lib/conversation-cards.ts"),
    starter = require("../lib/starter-data.ts"),
    chars = require("../lib/companions.ts");
  try {
    localStorage.setItem(
      cards.CARD_KEY,
      JSON.stringify({
        version: 1,
        samplesInitialized: true,
        requestSamplesInitialized: true,
        cards: [],
      }),
    );
    await store.seedNotebook([], [], false);
    await store.seedNotebook([], [], false, "request-samples-v1");
    await starter.seedStarterData();
    assert.equal(cards.readCards().length, 3);
    assert.equal((await store.listSessions()).length, 3);
    for (const c of scenes.responseFriends)
      assert.equal(chars.parseCompanion(c).id, c.id);
    for (const s of scenes.practicalSessions) {
      assert.equal((await store.getSession(s.id)).turns.length, 6);
      assert.equal(s.isSample, true);
    }
    cards.writeCards(cards.readCards().slice(1));
    await store.deleteSession(scenes.practicalSessions[0].id);
    await starter.seedStarterData();
    assert.equal(cards.readCards().length, 2);
    assert.equal((await store.listSessions()).length, 2);
  } finally {
    await ui.cleanup();
  }
});
test("observer validates two distinct personas and six alternating turns; route rejects malformed AI output", async () =>
  ai(async () => {
    const chars = scenes.responseFriends.slice(0, 2),
      topic = "밤에 연락을 재촉하는 상황";
    const route = require("../app/api/observe/route.ts");
    assert.throws(
      () => observer.observerInput({ characters: [chars[0], chars[0]], topic }),
      /다른 두/,
    );
    assert.throws(() =>
      observer.observerInput({ characters: chars, topic: "a".repeat(401) }),
    );
    const turns = scenes.practicalScenes[0].lines.map((text, i) => ({
      speaker: i % 2,
      text,
    }));
    let system, input;
    gemini.geminiGenerate = async (s, parts) => {
      system = s;
      input = JSON.parse(parts[0].text);
      return { turns };
    };
    const r = await route.POST(req({ ...consent, characters: chars, topic }));
    assert.equal(r.status, 200);
    assert.equal((await r.json()).source, "ai");
    assert.equal(input.characters[1].persona, chars[1].persona);
    assert.match(system, /여섯|6차례/);
    assert.equal(
      (await route.POST(req({ characters: chars, topic }))).status,
      400,
    );
    gemini.geminiGenerate = async () => ({
      turns: [{ speaker: 1, text: "invalid" }],
    });
    assert.equal(
      (await route.POST(req({ ...consent, characters: chars, topic }))).status,
      500,
    );
  }));
test("observer sample controls work without AI calls and changing persona clears the old script", async () => {
  const C = require("../components/PersonaObserver.tsx").default;
  let calls = 0;
  const ui = await mount(C, { characters: scenes.responseFriends, config });
  global.fetch = async () => {
    calls++;
    throw new Error("must not call");
  };
  try {
    await click(
      [...document.querySelectorAll("button")].find((b) =>
        b.textContent.includes("친구들 대화 지켜보기"),
      ),
    );
    await click(button("이 장면의 작성 샘플 보기"));
    assert.equal(document.querySelectorAll(".dc-observer-lines li").length, 1);
    await click(button("다음 말"));
    assert.equal(document.querySelectorAll(".dc-observer-lines li").length, 2);
    await click(button("자동 넘기기"));
    assert(button("일시정지"));
    await click(button("일시정지"));
    await change(
      document.querySelectorAll("select")[1],
      scenes.responseFriends[2].id,
    );
    assert.equal(document.querySelectorAll(".dc-observer-lines li").length, 0);
    assert.equal(calls, 0);
    await click(button("대화 관찰 닫기"));
    assert.equal(document.querySelector("dialog"), null);
  } finally {
    await ui.cleanup();
  }
});
test("search-specific failure is shown honestly and does not put working conversation APIs on hold", async () => {
  const C = require("../components/TrendSearch.tsx").default;
  let calls = 0;
  const ui = await mount(C, { config });
  try {
    global.fetch = async () => {
      calls++;
      return Response.json(
        { code: "search_not_grounded", error: "출처를 확보하지 못했어요." },
        { status: 502 },
      );
    };
    await click(
      [...document.querySelectorAll("button")].find((b) =>
        b.textContent.includes("지금 유행하는 용어 알아보기"),
      ),
    );
    await click(document.querySelector("input[type=checkbox]"));
    await click(button("지금 검색하기"));
    assert.match(document.body.textContent, /출처를 확보하지 못/);
    assert.equal(document.querySelector(".dc-grounded-text"), null);
    assert.equal(require("../lib/ai-client.ts").readAIHold(), null);
    global.fetch = async () => {
      calls++;
      return Response.json(
        trends.parseTrendResult(grounded(), "ko", new Date().toISOString()),
      );
    };
    await click(button("지금 검색하기"));
    assert.equal(calls, 2);
    assert.match(
      document.querySelector(".dc-grounded-text").textContent,
      /검증용 표현/,
    );
    assert.equal(
      document.querySelector("iframe").getAttribute("sandbox"),
      "allow-popups allow-popups-to-escape-sandbox",
    );
    assert.equal((await store.listTerms()).length, 0);
  } finally {
    await ui.cleanup();
  }
});
