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
const chatTiming = require("../lib/chat-timing.ts");
const actualPartnerBeat = chatTiming.waitForPartnerBeat;
chatTiming.waitForPartnerBeat = async () => {};
const { JSDOM, VirtualConsole } = require("jsdom"),
  React = require("react"),
  { act } = React,
  { IDBFactory } = require("fake-indexeddb");
let createRoot, Simulate;
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
  const browserErrors = [],
    virtualConsole = new VirtualConsole();
  virtualConsole.sendTo(console);
  virtualConsole.on("jsdomError", (error) => browserErrors.push(error));
  const dom = new JSDOM('<div id="root"></div>', {
    url: "https://test.local",
    virtualConsole,
  });
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
  // React detects input-event support when imported. Import after the DOM exists
  // so focus uses modern events, rather than the legacy IE attachEvent path.
  ({ createRoot } = require("react-dom/client"));
  ({ Simulate } = require("react-dom/test-utils"));
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
      assert.deepEqual(
        browserErrors,
        [],
        "Unhandled JSDOM errors must fail the test",
      );
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
      segments: d.segments.map((s) => ({ ...s, text: "a".repeat(4001) })),
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
    await click(button("다음 · 누가 말했나요?"));
    assert(saved.segments.every((s) => s.role === "unknown"));
    assert(button("확인한 대화 코칭받기").disabled);
    await click(button("전부 내 말이에요"));
    assert(
      [...document.querySelectorAll(".learn-segments select")].every(
        (el) => el.value === "user",
      ),
    );
    assert(
      button("확인한 대화 코칭받기").disabled,
      "speaker shortcut still requires confirmation",
    );
    await change(document.querySelector(".learn-segments select"), "assistant");
    await click(button("말한 사람·목표 저장"));
    assert.equal(saved.segments[0].role, "assistant");
    await click(button("문자 다시 수정"));
    await change(
      document.querySelector("textarea"),
      source.text + "\n새로 확인한 말",
    );
    await click(button("다음 · 누가 말했나요?"));
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
    await click(button("세대 표현을 AI 역할에게 물어보기"));
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
  const ui = await mount(
    C,
    {},
    () => (
      window.localStorage.setItem("ddeundeun-spotlight-guide-v2", "done"),
      window.localStorage.setItem(
        "ddeundeun-conversation-focus-v1",
        JSON.stringify({ version: 1, focus: "all" }),
      )
    ),
  );
  try {
    await settle();
    await click(button("미리 연습하기"));
    await click(button("내 상황 만들기"));
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
    await click(button("어떤 상황인가요? · 필수 수정"));
    assert(
      document
        .querySelector('[aria-label="어떤 상황인가요? · 필수"]')
        .value.includes("팀장님과 일정을"),
    );
    assert(
      document
        .querySelector('[aria-label="어떤 상황인가요? · 필수"]')
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
    (window.localStorage.setItem("ddeundeun-spotlight-guide-v2", "done"),
      window.localStorage.setItem(
        "ddeundeun-conversation-focus-v1",
        JSON.stringify({ version: 1, focus: "all" }),
      ));
    global.fetch = async () =>
      Response.json({ ...config, available: false, voiceAvailable: false });
  });
  try {
    await settle();
    await click(button("미리 연습하기"));
    await click(button("내 상황 만들기"));
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
    await click(button("어떤 상황인가요? · 필수 수정"));
    assert(
      document
        .querySelector('[aria-label="어떤 상황인가요? · 필수"]')
        .value.includes("도움이 필요한 이유"),
    );
    assert(document.body.textContent.includes("AI 연결 전이라"));
  } finally {
    await ui.cleanup();
  }
});

test("workspace navigation preserves section across remount and browser back, and home scrolls to start", async () => {
  const C = require("../components/ConversationWorkspace.tsx").default;
  let scrolls = 0;
  const ui = await mount(C, {}, () => {
    (window.localStorage.setItem("ddeundeun-spotlight-guide-v2", "done"),
      window.localStorage.setItem(
        "ddeundeun-conversation-focus-v1",
        JSON.stringify({ version: 1, focus: "all" }),
      ));
    window.history.replaceState(null, "", "?view=records");
    window.scrollTo = ({ top }) => {
      if (top === 0) scrolls++;
    };
  });
  try {
    await settle();
    assert.equal(document.querySelector("h1").textContent, "내 기록");
    await click(button("스픽코칭 홈"));
    assert.equal(window.location.search, "");
    assert(scrolls > 0);
    await act(async () => ui.root.render(null));
    await act(async () => ui.root.render(React.createElement(C)));
    await settle();
    assert(
      document.querySelector("h1").textContent.includes("다음에 뭐라고 말할지"),
    );
    await act(async () => {
      window.history.back();
      await new Promise((r) => setTimeout(r, 20));
    });
    await settle();
    assert.equal(window.location.search, "?view=records");
    assert.equal(document.querySelector("h1").textContent, "내 기록");
    assert.equal(
      document.querySelector('[aria-current="page"]').textContent,
      "내 기록",
    );
  } finally {
    await ui.cleanup();
  }
});

test("home practice opens a context card and practice keeps a discoverable records destination", async () => {
  const C = require("../components/ConversationWorkspace.tsx").default;
  const ui = await mount(
    C,
    {},
    () => (
      window.localStorage.setItem("ddeundeun-spotlight-guide-v2", "done"),
      window.localStorage.setItem(
        "ddeundeun-conversation-focus-v1",
        JSON.stringify({ version: 1, focus: "all" }),
      )
    ),
  );
  try {
    await settle();
    await click(button("미리 연습하기"));
    assert.equal(window.location.search, "?view=library");
    const card = [...document.querySelectorAll(".dc-saved-card")].find((b) =>
      b.textContent.includes("동료에게 검토 부탁하기"),
    );
    await click(card);
    assert(
      document.body.textContent.includes(
        "검토할 부분과 가능한 시간을 정중하게 부탁하기",
      ),
    );
    assert.equal(document.querySelector(".dc-root").dataset.view, "detail");
    assert(document.querySelector(".dc-detail-compact .dc-detail-extra").open);
    assert(
      document
        .querySelector(".dc-boundary")
        .textContent.includes("당연히 도와줄 거라고"),
    );
    assert.equal(
      document.querySelectorAll('[data-tour="practice-button"]').length,
      1,
    );
    assert(button("다른 상황 선택"));
    await click(button("대화 연습 시작하기"));
    assert.equal(document.querySelector(".dc-preparation-actions"), null);
    assert.equal(window.location.search, "?view=records");
    assert.equal(document.querySelector('[aria-current="page"]'), null);
    assert(
      document
        .querySelector("h1")
        .textContent.includes("동료에게 검토 부탁하기"),
    );
    await click(button("연습 준비로"));
    assert.equal(document.querySelector(".dc-root").dataset.view, "detail");
    await click(button("내 기록"));
    assert.equal(document.querySelector("h1").textContent, "내 기록");
    assert(
      document
        .querySelector(".record-examples h2")
        .textContent.includes("어떤 코칭을 받을 수 있나요?"),
    );
    assert(button("녹음·파일 추가"));
  } finally {
    await ui.cleanup();
  }
});

test("first deep-linked visit stays in its section instead of being replaced by onboarding", async () => {
  const C = require("../components/ConversationWorkspace.tsx").default;
  const ui = await mount(C, {}, () =>
    window.history.replaceState(null, "", "?view=records"),
  );
  try {
    await settle();
    assert.equal(document.querySelector("h1").textContent, "내 기록");
    assert(!document.querySelector("dialog[open]"));
  } finally {
    await ui.cleanup();
  }
});

test("reload destinations exclude transient drafts and old tutorial parameters", () => {
  const {
    workspaceUrl,
    workspaceView,
  } = require("../lib/workspace-navigation.ts");
  assert.equal(
    workspaceUrl("https://test.local/?tour=1&live=1#old", "home"),
    "/",
  );
  for (const view of ["setup", "detail", "live"])
    assert.equal(workspaceUrl("https://test.local", view), "/?view=library");
  for (const view of ["voicePractice", "friendChat"])
    assert.equal(workspaceUrl("https://test.local", view), "/?view=records");
  assert.equal(workspaceView("?view=invalid"), "home");
  assert.equal(workspaceView("?live=1"), "quick");
  assert.equal(workspaceView("?view=library&purpose=live"), "quick");
  assert.equal(workspaceView("?view=quick"), "quick");
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
    const unsafe = turns.map((t) => ({ ...t }));
    unsafe[1].text = "학교는 공식 업무 시간에만 상담이 가능합니다.";
    assert.throws(
      () => observer.validateObservedTurns(unsafe),
      /unsupported_policy_claim/,
    );
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

test("ajit souvenirs open saved reflection, create the same-scene rehearsal and explain missing records", async () => {
  const Ajit = require("../components/PracticeGarden.tsx").default;
  const garden = require("../lib/practice-garden.ts");
  const scenes = require("../lib/ajit-scenes.ts");
  const notebook = require("../lib/voice-notebook.ts");
  const original = {
    id: "session-ajit-ui",
    kind: "practice",
    title: "검증용 부탁",
    context: scenes.ajitScenes[0].context,
    industry: "",
    createdAt: "2026-09-16T00:00:00Z",
    updatedAt: "2026-09-16T00:00:00Z",
    turns: [
      { id: "a1", role: "assistant", text: "어떤 부탁인가요?", terms: [] },
      { id: "u1", role: "user", text: "검토 부탁드려요.", terms: [] },
      { id: "a2", role: "assistant", text: "언제 필요한가요?", terms: [] },
      { id: "u2", role: "user", text: "오늘 봐 주세요.", terms: [] },
    ],
    gardenReflection: {
      turnId: "u2",
      original: "오늘 봐 주세요.",
      rewrite: "가능하신 시간을 알려 주실 수 있을까요?",
    },
  };
  const replay = garden.reflectionDrill(original);
  replay.turns.push({
    id: "u3",
    role: "user",
    text: "가능한 시간을 먼저 확인하고 부탁드릴게요.",
    terms: [],
  });
  const earned = garden.earnGarden(
    garden.earnGarden(garden.emptyGarden(), original),
    replay,
  );
  const oldRead = notebook.readGarden;
  notebook.readGarden = async () => earned;
  let opened;
  const props = {
    sessions: [original, replay],
    onSession: (id) => {
      opened = id;
    },
    onPractice: () => {},
  };
  let ui;
  try {
    ui = await mount(Ajit, props);
    await settle();
    await click(button("마주 앉는 테이블 · 내 기록 열기"));
    assert(document.querySelector("dialog[open]"));
    assert(
      document
        .querySelector("dialog blockquote")
        .textContent.includes(original.gardenReflection.rewrite),
    );
    await click(button("복기 기록 열기"));
    assert.equal(opened, original.id);
    await click(button("같은 장면 다시 연습"));
    await settle();
    const created = await notebook.getSession(opened);
    assert.equal(created.practicePlan.sourceSessionId, original.id);
    assert.equal(created.context.goal, original.context.goal);
    assert.equal(document.querySelectorAll("dialog").length, 1);
    await ui.cleanup();
    ui = null;
    ui = await mount(Ajit, { ...props, sessions: [] });
    await settle();
    await click(button("마주 앉는 테이블 · 내 기록 열기"));
    assert(
      document
        .querySelector("dialog")
        .textContent.includes("삭제되었거나 이 기기에 없어요"),
    );
    assert.equal(button("복기 기록 열기"), undefined);
    assert(button("조건을 바꿔 새 연습"));
  } finally {
    if (ui) await ui.cleanup();
    notebook.readGarden = oldRead;
  }
});

const daily = require("../lib/daily-talk.ts");
const prompts = require("../lib/prompt-practice.ts");
test("daily topics rotate without scores, respect local dayparts and remember only explicit interests", async () => {
  assert.equal(daily.dailyTopics.length, 15);
  assert.equal(new Set(daily.dailyTopics.map((t) => t.id)).size, 15);
  const date = new Date(2026, 8, 16, 8);
  assert(daily.dailyGreeting(date).includes("아침"));
  assert(daily.dailyGreeting(new Date(2026, 8, 16, 20)).includes("하루"));
  const first = daily.dailySelection("everyday", date),
    next = daily.dailySelection("everyday", date, 1);
  assert.notDeepEqual(
    first.map((t) => t.id),
    next.map((t) => t.id),
  );
  assert(
    daily
      .dailySelection("everyday", date, 0, ["lunch"])
      .some((t) => t.id === "lunch"),
  );
  for (const t of daily.dailyTopics) {
    assert.equal(t.choices.length, 3);
    assert.equal(t.followups.length, 2);
    assert(t.bridge);
  }
  const ui = await mount(() => null);
  try {
    assert.deepEqual(daily.readDailyFavorites(), []);
    daily.saveDailyFavorites(["lunch", "lunch", "invented"]);
    assert.deepEqual(daily.readDailyFavorites(), ["lunch"]);
    daily.saveDailyFavorites([]);
    assert.deepEqual(daily.readDailyFavorites(), []);
  } finally {
    await ui.cleanup();
  }
});
test("daily AI accepts at most three replies, keeps unrelated history out and validates consent", async () =>
  ai(async () => {
    const route = require("../app/api/daily-talk/route.ts");
    const chars = require("../lib/companions.ts");
    const companion = chars.resolveCompanion("dundi");
    let calls = 0;
    gemini.geminiGenerate = async (system, parts) => {
      calls++;
      const payload = JSON.parse(parts[0].text);
      assert(!("otherHistory" in payload));
      assert(!("searchContext" in payload));
      assert(system.includes("점수"));
      return {
        reply: "좋아요. 어떤 점이 편한가요?",
        choices: ["익숙해서요", "가까워서요", "생각 중이에요"],
      };
    };
    const body = {
      topicId: "lunch",
      companion,
      messages: [
        { role: "assistant", text: "어떤 메뉴가 좋아요?" },
        { role: "user", text: "익숙한 메뉴요" },
      ],
      otherHistory: "절대 보내지 않을 메모",
      ...consent,
    };
    assert.equal(
      (await route.POST(req({ ...body, consent: false }))).status,
      400,
    );
    assert.equal(
      (
        await route.POST(
          req({
            ...body,
            messages: [
              ...body.messages,
              ...body.messages,
              ...body.messages,
              ...body.messages,
            ],
          }),
        )
      ).status,
      400,
    );
    assert.equal(calls, 0);
    const r = await route.POST(req(body));
    assert.equal(r.status, 200);
    assert.equal((await r.json()).choices.length, 3);
    gemini.geminiGenerate = async () => ({
      reply: "오늘은 여기까지 이야기해요.",
      choices: [],
    });
    const last = await route.POST(
      req({
        ...body,
        messages: [...body.messages, ...body.messages, ...body.messages],
      }),
    );
    assert.equal((await last.json()).completed, true);
  }));
test("three prepared daily replies persist and reopen without AI, automatic preference inference or practice rewards", async () => {
  const C = require("../components/DailyTalk.tsx").default;
  let calls = 0;
  const ui = await mount(C, { config, onRecords: () => {} }, () => {
    global.fetch = async () => {
      calls++;
      return Response.json(config);
    };
  });
  try {
    await settle();
    await click(document.querySelector(".daily-topic-grid button"));
    await settle();
    for (let i = 0; i < 3; i++) {
      const choice = document.querySelector(".daily-choices button");
      assert(choice);
      const text = choice.textContent;
      await click(choice);
      const input = document.querySelector(
        'textarea[aria-label="인식한 말 또는 직접 입력"]',
      );
      assert.equal(input.value, text);
      await change(input, "내가 쓴 일상 답변 " + i);
      await click(button("한마디 보내기"));
      await settle();
    }
    assert(document.body.textContent.includes("오늘은 이만큼 이야기했어요"));
    assert(!button("한마디 보내기"));
    assert.equal(calls, 0);
    const rows = await store.listSessions();
    assert.equal(rows.length, 1);
    assert(rows[0].daily.completed);
    assert.equal(daily.dailyCount(rows[0]), 3);
    assert.equal(rows[0].turns.length, 7);
    assert(
      rows[0].turns
        .slice(1)
        .filter((t) => t.role === "assistant")
        .every((t) => t.sample),
    );
    assert.equal((await store.readGarden()).earned, 0);
    assert.deepEqual(daily.readDailyFavorites(), []);
    await click(button("이 주제 다음에도 추천하기"));
    assert.deepEqual(daily.readDailyFavorites(), [rows[0].daily.topicId]);
    await act(async () => ui.root.render(null));
    await act(async () =>
      ui.root.render(
        React.createElement(C, {
          config,
          initialSession: rows[0],
          onRecords: () => {},
        }),
      ),
    );
    await settle();
    assert(document.body.textContent.includes("내가 쓴 일상 답변 2"));
    assert.equal(calls, 0);
  } finally {
    await ui.cleanup();
  }
});
test("daily quota fallback preserves the user's turn and shows a prepared reply with retry information", async () => {
  const C = require("../components/DailyTalk.tsx").default,
    chars = require("../lib/companions.ts");
  const s = daily.createDailySession(
    daily.dailyTopics[0],
    chars.resolveCompanion("dundi"),
  );
  const ui = await mount(
    C,
    { config, initialSession: s, onRecords: () => {} },
    () => {
      global.fetch = async () =>
        Response.json({ quotaKind: "daily", retryAfter: 120 }, { status: 429 });
    },
  );
  try {
    const checks = [...document.querySelectorAll('input[type="checkbox"]')];
    await click(checks[0]);
    await click(document.querySelector(".vn-consent input"));
    await click(document.querySelector(".daily-choices button"));
    await click(button("한마디 보내기"));
    await settle();
    const saved = (await store.listSessions())[0];
    assert.equal(saved.turns[1].role, "user");
    assert.equal(saved.turns[2].sample.outage.reason, "daily");
    assert(document.body.textContent.includes("일일 한도 초과"));
    assert(document.body.textContent.includes("사전 작성 샘플"));
    assert.equal(daily.readDailyFavorites().length, 0);
  } finally {
    await ui.cleanup();
  }
});
test("prompt execution uses fixed task facts and checks only evidence present in actual output", async () =>
  ai(async () => {
    const route = require("../app/api/prompt-practice/route.ts");
    let calls = 0;
    gemini.geminiGenerate = async (system, parts) => {
      calls++;
      const payload = JSON.parse(parts[0].text);
      assert.equal(payload.facts, prompts.promptTasks[0].facts);
      assert(!payload.facts.includes("유출할 비밀"));
      return {
        output: "모아: 금요일 초안. 토리: 수요일 오류 공유. 출시일 미정.",
      };
    };
    const body = {
      taskId: "meeting",
      prompt: "회의록을 정리해 주세요.",
      facts: "유출할 비밀",
      ...consent,
    };
    assert.equal(
      (await route.POST(req({ ...body, consent: false }))).status,
      400,
    );
    assert.equal(calls, 0);
    const r = await route.POST(req(body));
    assert.equal(r.status, 200);
    const d = await r.json();
    assert(d.checks.every((c) => c.found && d.output.includes(c.evidence)));
    assert(
      prompts
        .inspectPromptOutput(prompts.promptTasks[0], "일을 준비합니다.")
        .every((c) => !c.found && !c.evidence),
    );
  }));
test("prompt examples never execute or save as AI; chosen conditions require an explicit run and versions survive reopening", async () => {
  const C = require("../components/PromptPractice.tsx").default;
  let calls = 0;
  const ui = await mount(C, { config, onRecords: () => {} }, () => {
    global.fetch = async (url, init) => {
      calls++;
      const d = JSON.parse(init.body);
      assert.equal(d.taskId, "meeting");
      return Response.json({
        output:
          calls === 1 ? "일을 준비합니다." : prompts.promptTasks[0].sampleAfter,
        model: "test-model",
      });
    };
  });
  try {
    await click(document.querySelector(".daily-topic-grid button"));
    await click(button("작성된 전후 예시 보기"));
    assert(
      document.body.textContent.includes("내 입력을 실행한 결과가 아니에요"),
    );
    assert.equal(calls, 0);
    assert.equal((await store.listSessions()).length, 0);
    await click(document.querySelector(".vn-consent input"));
    await click(button("이 요청으로 AI 실행"));
    await settle();
    assert.equal(calls, 1);
    await click(document.querySelector(".daily-choices button"));
    assert.equal(calls, 1);
    assert(
      document.querySelector("textarea").value.includes("담당자·할 일·기한"),
    );
    await click(button("수정한 요청 실행"));
    await settle();
    const s = (await store.listSessions())[0];
    assert.equal(s.promptPractice.attempts.length, 2);
    assert.equal(s.promptPractice.attempts[0].output, "일을 준비합니다.");
    assert.equal(s.promptPractice.attempts[1].model, "test-model");
    assert.equal((await store.readGarden()).earned, 0);
    await act(async () => ui.root.render(null));
    await act(async () =>
      ui.root.render(
        React.createElement(C, {
          config,
          initialSession: s,
          onRecords: () => {},
        }),
      ),
    );
    assert(document.body.textContent.includes("처음 요청의 결과"));
    assert(document.body.textContent.includes("수정한 요청의 결과"));
    assert.equal(calls, 2);
  } finally {
    await ui.cleanup();
  }
});
test("daily and prompt deep links round-trip while retaining their parent navigation", () => {
  const nav = require("../lib/workspace-navigation.ts");
  for (const v of ["daily", "prompts"]) {
    assert.equal(
      nav.workspaceView(
        nav.workspaceUrl("https://test.local", v).split("?")[1],
      ),
      v,
    );
  }
  assert.equal(nav.workspaceSection("daily"), "more");
  assert.equal(nav.workspaceSection("prompts"), "home");
});

const training = require("../lib/conversation-training.ts");
const trainingC = require("../components/ConversationTraining.tsx").default;
function reviewedTrainingSource() {
  const s = structuredClone(require("../lib/starter-data.ts").starterSession);
  s.id = "training-source";
  s.isSample = false;
  const users = s.turns.filter((t) => t.role === "user");
  s.review = reviews.validateReview(
    {
      strength: {
        turnId: users[0].id,
        quote: users[0].text,
        note: "범위를 확인했어요.",
      },
      improvement: {
        turnId: users[1].id,
        quote: users[1].text,
        note: "가능한 시간을 먼저 물어봐요.",
        rewrite: "가능한 시간을 알려주실 수 있나요?",
      },
      focus: "가능한 시간을 확인하는 질문",
    },
    s.context,
    s.turns,
  );
  return s;
}
test("training feedback is grounded in actual answers and task requests exclude unrelated history", async () =>
  ai(async () => {
    const route = require("../app/api/training/route.ts"),
      exercise = training.findTraining("q-work");
    let calls = 0;
    gemini.geminiGenerate = async (system, parts) => {
      calls++;
      const input = JSON.parse(parts[0].text);
      assert.equal(input.exercise.context, exercise.context);
      assert(!parts[0].text.includes("PRIVATE"));
      assert(system.includes("점수"));
      return {
        quote: exercise.example[0],
        note: "모호한 표현을 골랐어요.",
        nextAction: "질문을 한 가지로 좁혀봐요.",
      };
    };
    const body = {
      ...consent,
      exerciseId: exercise.id,
      answers: exercise.example,
      origin: { quote: "PRIVATE" },
      context: "PRIVATE",
    };
    assert.equal(
      (await route.POST(req({ ...body, consent: false }))).status,
      400,
    );
    assert.equal(
      (await route.POST(req({ ...body, answers: ["한 줄"] }))).status,
      400,
    );
    assert.equal(
      (await route.POST(req({ ...body, exerciseId: "fake" }))).status,
      400,
    );
    assert.equal(calls, 0);
    const r = await route.POST(req(body));
    assert.equal(r.status, 200);
    assert.equal((await r.json()).feedback.quote, exercise.example[0]);
    gemini.geminiGenerate = async () => ({
      quote: "존재하지 않는 말",
      note: "설명",
      nextAction: "다음 행동",
    });
    const bad = await route.POST(req(body));
    assert.equal(bad.status, 500);
    assert.equal((await bad.json()).code, "ungrounded_output");
  }));
test("training completes without AI, keeps first and final expressions, reopens and gives no practice currency", async () => {
  let ui = await mount(trainingC, {
    config: { ...config, available: false },
    onRecords() {},
    onSession() {},
  });
  try {
    let calls = 0;
    global.fetch = async () => {
      calls++;
      throw Error("AI must not run");
    };
    await settle();
    const e = training.findTraining("a-lunch");
    await click(
      [...document.querySelectorAll(".training-exercise")].find((b) =>
        b.textContent.includes(e.title),
      ),
    );
    assert.equal(button("저장하고 다듬기").disabled, true);
    for (let i = 0; i < 3; i++)
      await change(document.querySelectorAll("textarea")[i], e.example[i]);
    await click(button("저장하고 다듬기"));
    await settle();
    let rows = await store.listSessions();
    assert.equal(rows.length, 1);
    assert(!rows[0].training.completedAt);
    assert.deepEqual(rows[0].training.answers, e.example);
    await change(
      document.querySelectorAll("textarea")[2],
      "최근에 추천하고 싶은 점심 메뉴가 있어요?",
    );
    await click(button("마무리 표현 저장"));
    await settle();
    rows = await store.listSessions();
    const saved = rows[0];
    assert(saved.training.completedAt);
    assert.deepEqual(saved.training.answers, e.example);
    assert.notEqual(saved.training.revised[2], saved.training.answers[2]);
    assert.equal(calls, 0);
    assert.equal((await store.readGarden()).earned, 0);
    await act(async () => ui.root.render(null));
    await act(async () =>
      ui.root.render(
        React.createElement(trainingC, {
          config,
          initialSession: saved,
          onRecords() {},
          onSession() {},
        }),
      ),
    );
    await settle();
    assert(document.body.textContent.includes("마무리 표현"));
    assert(document.body.textContent.includes(saved.training.revised[2]));
    assert.equal(calls, 0);
    window.confirm = () => true;
    await click(button("이 훈련 기록 삭제"));
    await settle();
    assert.equal((await store.listSessions()).length, 0);
  } finally {
    await ui.cleanup();
  }
});
test("training quota keeps saved answers and allows finishing with authored guidance", async () => {
  const e = training.findTraining("c-request");
  const saved = {
    id: "training-quota",
    kind: "chat",
    title: "훈련",
    industry: "대화 트레이닝",
    turns: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    training: { version: 1, exerciseId: e.id, answers: e.example },
  };
  const ui = await mount(trainingC, {
    config,
    initialSession: saved,
    onRecords() {},
    onSession() {},
  });
  try {
    await act(async () => store.putSession(saved));
    global.fetch = async () =>
      Response.json(
        { code: "rate_limit", quotaKind: "daily", retryAfter: 60 },
        { status: 429 },
      );
    await click(document.querySelector("input[type=checkbox]"));
    await click(button("내 표현으로 AI 피드백 받기"));
    await settle();
    assert(document.body.textContent.includes("일일 한도"));
    assert(document.body.textContent.includes("준비된 확인 기준"));
    let stored = await store.getSession(saved.id);
    assert.deepEqual(stored.training.answers, e.example);
    assert(!stored.training.feedback);
    await click(button("마무리 표현 저장"));
    await settle();
    stored = await store.getSession(saved.id);
    assert(stored.training.completedAt);
    assert(!stored.training.feedback);
    assert.deepEqual(stored.training.revised, e.example);
  } finally {
    await ui.cleanup();
  }
});
test("editing first training answers invalidates old feedback and completion without extra AI calls", async () => {
  const e = training.findTraining("q-work");
  const saved = {
    id: "training-edit",
    kind: "chat",
    title: "훈련",
    industry: "대화 트레이닝",
    turns: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    training: {
      version: 1,
      exerciseId: e.id,
      answers: e.example,
      feedback: training.validateTrainingFeedback(
        {
          quote: e.example[0],
          note: "모호한 단서를 찾았어요.",
          nextAction: "범위를 확인해요.",
        },
        e.example,
      ),
    },
  };
  const ui = await mount(trainingC, {
    config,
    initialSession: saved,
    onRecords() {},
    onSession() {},
  });
  try {
    await act(async () => store.putSession(saved));
    await click(button("첫 표현 다시 작성"));
    await change(
      document.querySelectorAll("textarea")[2],
      "어떤 페이지를 먼저 바꿀까요?",
    );
    await click(button("저장하고 다듬기"));
    await settle();
    const row = await store.getSession(saved.id);
    assert(!row.training.feedback);
    assert(!row.training.completedAt);
    assert.equal(row.training.answers[2], "어떤 페이지를 먼저 바꿀까요?");
    assert.equal((await store.listSessions()).length, 1);
  } finally {
    await ui.cleanup();
  }
});
test("training origin preserves same-scene context and refuses changed or deleted source reviews", () => {
  const s = reviewedTrainingSource(),
    origin = training.trainingOrigin(s);
  assert.equal(training.suggestTraining(origin.focus), "followup");
  const retry = training.trainingReplay(origin, s);
  assert.deepEqual(retry.context, s.context);
  assert.equal(retry.practicePlan.sourceSessionId, s.id);
  assert.equal(retry.gardenRetryOriginal, s.turns[3].text);
  assert.throws(() => training.trainingReplay(origin, undefined), /삭제/);
  const edited = structuredClone(s);
  edited.turns[1].text += " 추가 발화";
  assert.throws(() => training.trainingReplay(origin, edited), /복기/);
  edited.review.sourceKey = "changed";
  assert.throws(() => training.trainingReplay(origin, edited), /달라졌어요/);
});
test("saved review opens targeted foundation training and completed training returns to the same scene", async () => {
  const s = reviewedTrainingSource();
  const C = require("../components/VoiceWorkspace.tsx").default;
  const ui = await mount(C, { config, mode: "records", onChooseCard() {} });
  try {
    await act(async () => store.putSession(s));
    await act(async () => ui.root.render(null));
    await act(async () =>
      ui.root.render(
        React.createElement(C, {
          config,
          mode: "records",
          initialSessionId: s.id,
          onChooseCard() {},
        }),
      ),
    );
    await settle();
    await click(button("이 복기에서 기초 훈련 시작"));
    await settle();
    assert(
      document
        .querySelector('[aria-pressed="true"]')
        .textContent.includes("질문 이어가기"),
    );
    const e = training.findTraining("q-work");
    await click(
      [...document.querySelectorAll(".training-exercise")].find((b) =>
        b.textContent.includes(e.title),
      ),
    );
    for (let i = 0; i < 3; i++)
      await change(document.querySelectorAll("textarea")[i], e.example[i]);
    await click(button("저장하고 다듬기"));
    await settle();
    await click(button("마무리 표현 저장"));
    await settle();
    await click(button("원래 장면에서 다시 연습"));
    await settle();
    const rows = await store.listSessions(),
      retry = rows.find((r) => r.practicePlan?.sourceSessionId === s.id);
    assert(retry);
    assert.deepEqual(retry.context, s.context);
    assert(rows.some((r) => r.training?.origin?.sessionId === s.id));
    assert(document.body.textContent.includes(s.review.focus));
  } finally {
    await ui.cleanup();
  }
});
test("foundation training deep links do not mark Home as the current page and restore on reload", async () => {
  const nav = require("../lib/workspace-navigation.ts");
  assert.equal(nav.workspaceView("?view=training"), "training");
  assert.equal(nav.workspaceSection("training"), "home");
  assert.equal(
    nav.workspaceUrl("https://test.local/?view=records", "training"),
    "/?view=training",
  );
  const C = require("../components/ConversationWorkspace.tsx").default;
  const ui = await mount(C, {}, () => {
    window.history.replaceState(null, "", "?view=training");
    (window.localStorage.setItem("ddeundeun-spotlight-guide-v2", "done"),
      window.localStorage.setItem(
        "ddeundeun-conversation-focus-v1",
        JSON.stringify({ version: 1, focus: "all" }),
      ));
  });
  try {
    await settle();
    assert.equal(document.querySelector("h1").textContent, "대화 기초 훈련");
    assert.equal(document.querySelector('[aria-current="page"]'), null);
  } finally {
    await ui.cleanup();
  }
});
test("training feedback saves once, reopens without generation and ignores a response after leaving", async () => {
  const e = training.findTraining("a-lunch"),
    original = {
      id: "training-feedback",
      kind: "chat",
      title: "훈련",
      industry: "대화 트레이닝",
      turns: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      training: { version: 1, exerciseId: e.id, answers: e.example },
    };
  const ui = await mount(trainingC, {
    config,
    initialSession: original,
    onRecords() {},
    onSession() {},
  });
  try {
    await act(async () => store.putSession(original));
    let calls = 0;
    global.fetch = async () => {
      calls++;
      return Response.json({
        feedback: {
          quote: e.example[0],
          note: "취향에서 소재를 넓혔어요.",
          nextAction: "상대 취향을 물어보세요.",
        },
      });
    };
    await click(document.querySelector("input[type=checkbox]"));
    await click(button("내 표현으로 AI 피드백 받기"));
    await settle();
    let saved = await store.getSession(original.id);
    assert.equal(calls, 1);
    assert.equal(saved.training.feedback.quote, e.example[0]);
    assert(!button("내 표현으로 AI 피드백 받기"));
    await act(async () => ui.root.render(null));
    await act(async () =>
      ui.root.render(
        React.createElement(trainingC, {
          config,
          initialSession: saved,
          onRecords() {},
          onSession() {},
        }),
      ),
    );
    await settle();
    assert.equal(calls, 1);
    assert(document.body.textContent.includes("취향에서 소재를 넓혔어요."));
    await click(button("첫 표현 다시 작성"));
    await change(
      document.querySelectorAll("textarea")[0],
      "오늘은 새 메뉴가 궁금해요.",
    );
    await click(button("저장하고 다듬기"));
    await settle();
    let release;
    global.fetch = () =>
      new Promise((r) => {
        release = r;
      });
    await click(document.querySelector("input[type=checkbox]"));
    await click(button("내 표현으로 AI 피드백 받기"));
    assert(release);
    await act(async () => ui.root.render(null));
    await act(async () =>
      release(
        Response.json({
          feedback: {
            quote: "오늘은 새 메뉴가 궁금해요.",
            note: "설명",
            nextAction: "질문해요.",
          },
        }),
      ),
    );
    await settle();
    saved = await store.getSession(original.id);
    assert(!saved.training.feedback);
  } finally {
    await ui.cleanup();
  }
});
test("failed training storage keeps editable input and retry creates only one record", async () => {
  const ui = await mount(trainingC, { config, onRecords() {}, onSession() {} }),
    oldPut = store.putSession;
  try {
    const e = training.findTraining("a-lunch");
    await click(
      [...document.querySelectorAll(".training-exercise")].find((b) =>
        b.textContent.includes(e.title),
      ),
    );
    for (let i = 0; i < 3; i++)
      await change(document.querySelectorAll("textarea")[i], e.example[i]);
    store.putSession = async () => {
      throw Error("저장 공간을 확인해 주세요.");
    };
    await click(button("저장하고 다듬기"));
    await settle();
    assert.equal(document.querySelector("textarea").value, e.example[0]);
    assert(button("저장하고 다듬기"));
    assert.equal((await store.listSessions()).length, 0);
    store.putSession = oldPut;
    await click(button("저장하고 다듬기"));
    await settle();
    assert.equal((await store.listSessions()).length, 1);
    assert(button("마무리 표현 저장"));
  } finally {
    store.putSession = oldPut;
    await ui.cleanup();
  }
});

const messenger = require("../lib/messenger.ts");
const Messenger = require("../components/MessengerPractice.tsx").default;
const msgExample = messenger.messengerExamples[0];
async function fillMessenger(input = msgExample.input) {
  await click(button("메시지 입력") || button("메시지 입력 이어쓰기"));
  for (const [label, key] of [
    ["상대가 보낸 메시지", "message"],
    ["내가 전하고 싶은 것", "goal"],
    ["지킬 선 · 선택", "boundary"],
  ]) {
    if (key !== "message")
      await click(button(label + " 입력") || button(label + " 수정"));
    await change(
      document.querySelector(`textarea[aria-label="${label}"]`),
      input[key],
    );
    if (key !== "message") await click(button("입력 완료"));
  }
}
test("messenger API validates three tones and sends only the chosen message and constraints", async () =>
  ai(async () => {
    const route = require("../app/api/messenger/route.ts");
    let calls = 0;
    gemini.geminiGenerate = async (system, parts) => {
      calls++;
      const sent = JSON.parse(parts[0].text);
      assert.equal(sent.input.goal, msgExample.input.goal);
      assert(!parts[0].text.includes("PRIVATE"));
      assert(system.includes("약속"));
      return { candidates: msgExample.candidates };
    };
    const body = {
      ...consent,
      input: { ...msgExample.input, otherChats: "PRIVATE" },
      otherChats: "PRIVATE",
    };
    assert.equal(
      (await route.POST(req({ ...body, consent: false }))).status,
      400,
    );
    assert.equal(
      (
        await route.POST(
          req({ ...body, input: { ...body.input, message: "a".repeat(4001) } }),
        )
      ).status,
      400,
    );
    assert.equal(calls, 0);
    const r = await route.POST(req(body));
    assert.equal(r.status, 200);
    assert.equal((await r.json()).candidates.length, 3);
    gemini.geminiGenerate = async () => ({
      candidates: [
        msgExample.candidates[0],
        msgExample.candidates[0],
        msgExample.candidates[2],
      ],
    });
    assert.equal((await route.POST(req(body))).status, 500);
  }));
test("messenger authored example never calls AI; candidate edits, clipboard and saved provenance survive reopening", async () => {
  const ui = await mount(Messenger, { config, onRecords() {} });
  let calls = 0,
    copied;
  try {
    global.fetch = async () => {
      calls++;
      throw Error("must not run");
    };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          copied = text;
        },
      },
    });
    await click(
      [...document.querySelectorAll(".daily-topic-grid button")].find((b) =>
        b.textContent.includes(msgExample.title),
      ),
    );
    await settle();
    assert.equal(calls, 0);
    assert(document.body.textContent.includes("사전 작성 샘플"));
    assert.equal(document.querySelector('[aria-label="보낼 답장"]').value, "");
    await click(button("간결하게 후보 고르기"));
    assert.equal(
      document.querySelector('[aria-label="보낼 답장"]').value,
      msgExample.candidates[1].text,
    );
    assert.equal((await store.listSessions())[0].messenger.draft, "");
    await change(
      document.querySelector('[aria-label="보낼 답장"]'),
      "가능한 일정을 먼저 확인하겠습니다.",
    );
    await click(button("답장 복사"));
    assert.equal(copied, "가능한 일정을 먼저 확인하겠습니다.");
    assert.equal((await store.listSessions())[0].messenger.draft, "");
    await click(button("답장 저장"));
    await settle();
    let saved = (await store.listSessions())[0];
    assert.equal(saved.messenger.draft, copied);
    assert.equal(saved.messenger.draftSource, "sample");
    assert.equal((await store.readGarden()).earned, 0);
    await act(async () => ui.root.render(null));
    await act(async () =>
      ui.root.render(
        React.createElement(Messenger, {
          config,
          initialSession: saved,
          onRecords() {},
        }),
      ),
    );
    await settle();
    assert(!document.querySelector('[aria-label="보낼 답장"]'));
    assert.equal(
      document.querySelector('[aria-label="저장한 답장"] p').textContent,
      copied,
    );
    await click(button("답장 수정"));
    assert.equal(
      document.querySelector('[aria-label="보낼 답장"]').value,
      copied,
    );
    assert.equal(calls, 0);
    window.confirm = () => true;
    await click(button("이 답장 기록 삭제"));
    await settle();
    assert.equal((await store.listSessions()).length, 0);
  } finally {
    await ui.cleanup();
  }
});
test("messenger input remains saved after quota and can finish manually without fabricated candidates", async () => {
  const ui = await mount(Messenger, { config, onRecords() {} });
  try {
    await fillMessenger();
    await click(button("저장하고 답장 준비"));
    await settle();
    if (button("답장 쓰기")) await click(button("답장 쓰기"));
    global.fetch = async () =>
      Response.json({ quotaKind: "daily", retryAfter: 60 }, { status: 429 });
    await click(document.querySelector("input[type=checkbox]"));
    await click(button("말투별 AI 후보 받기"));
    await settle();
    let rows = await store.listSessions();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].messenger.input.message, msgExample.input.message);
    assert.equal(rows[0].messenger.candidates.length, 0);
    assert(document.body.textContent.includes("일일 한도"));
    await change(
      document.querySelector('[aria-label="보낼 답장"]'),
      "일정을 확인한 뒤 답변드리겠습니다.",
    );
    await click(button("답장 저장"));
    await settle();
    rows = await store.listSessions();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].messenger.draftSource, "manual");
    assert.equal(rows[0].messenger.source, "manual");
  } finally {
    await ui.cleanup();
  }
});
test("messenger AI updates one record, edited conditions create a separate record and old drafts stay intact", async () => {
  const ui = await mount(Messenger, { config, onRecords() {} });
  try {
    await fillMessenger();
    await click(button("저장하고 답장 준비"));
    await settle();
    if (button("답장 쓰기")) await click(button("답장 쓰기"));
    global.fetch = async () =>
      Response.json({ candidates: msgExample.candidates });
    await click(document.querySelector("input[type=checkbox]"));
    await click(button("말투별 AI 후보 받기"));
    await settle();
    let rows = await store.listSessions();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].messenger.source, "ai");
    await click(button("부드럽게 후보 고르기"));
    await click(button("답장 저장"));
    await settle();
    const first = (await store.listSessions())[0];
    await click(button("메시지·조건 수정"));
    await click(button("내가 전하고 싶은 것 수정"));
    await change(
      document.querySelector('[aria-label="내가 전하고 싶은 것"]'),
      "새 업무의 범위를 먼저 확인하기",
    );
    await click(button("입력 완료"));
    await click(button("저장하고 답장 준비"));
    await settle();
    if (button("답장 쓰기")) await click(button("답장 쓰기"));
    await click(button("말투별 AI 후보 받기"));
    await settle();
    rows = await store.listSessions();
    assert.equal(rows.length, 2);
    assert.equal(
      rows.find((r) => r.id === first.id).messenger.draft,
      first.messenger.draft,
    );
    assert(
      rows.some(
        (r) =>
          r.messenger.input.goal === "새 업무의 범위를 먼저 확인하기" &&
          r.messenger.source === "ai",
      ),
    );
  } finally {
    await ui.cleanup();
  }
});
test("messenger refuses late AI writes after leaving and clipboard failure keeps selectable draft", async () => {
  const ui = await mount(Messenger, { config, onRecords() {} });
  try {
    await fillMessenger();
    await click(button("저장하고 답장 준비"));
    await settle();
    if (button("답장 쓰기")) await click(button("답장 쓰기"));
    await change(
      document.querySelector('[aria-label="보낼 답장"]'),
      "검토 후 답장하겠습니다.",
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw Error("blocked");
        },
      },
    });
    await click(button("답장 복사"));
    assert(document.body.textContent.includes("자동 복사가 차단"));
    assert.equal(
      document.querySelector('[aria-label="보낼 답장"]').value,
      "검토 후 답장하겠습니다.",
    );
    let release;
    global.fetch = () => new Promise((r) => (release = r));
    await click(document.querySelector("input[type=checkbox]"));
    await click(button("말투별 AI 후보 받기"));
    await settle();
    assert(release);
    await act(async () => ui.root.render(null));
    await act(async () =>
      release(Response.json({ candidates: msgExample.candidates })),
    );
    await settle();
    const rows = await store.listSessions();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].messenger.candidates.length, 0);
  } finally {
    await ui.cleanup();
  }
});
test("messenger storage failure preserves input and does not start generation", async () => {
  const old = store.putSession,
    ui = await mount(Messenger, { config, onRecords() {} });
  try {
    await fillMessenger();
    store.putSession = async () => {
      throw Error("저장 실패");
    };
    await click(button("저장하고 답장 준비"));
    await settle();
    if (button("답장 쓰기")) await click(button("답장 쓰기"));
    assert.equal(
      document.querySelector('[aria-label="상대가 보낸 메시지"]').value,
      msgExample.input.message,
    );
    assert.equal((await store.listSessions()).length, 0);
    store.putSession = old;
    await click(button("저장하고 답장 준비"));
    await settle();
    if (button("답장 쓰기")) await click(button("답장 쓰기"));
    assert.equal((await store.listSessions()).length, 1);
  } finally {
    store.putSession = old;
    await ui.cleanup();
  }
});
test("upcoming features have explicit unavailable labels, no launch actions and distinguish existing recording support", async () => {
  const C = require("../components/UpcomingFeatures.tsx").default,
    ui = await mount(C);
  try {
    assert(document.body.textContent.includes("아직 사용할 수 없으며"));
    assert(document.body.textContent.includes("30분·50MB"));
    assert(document.body.textContent.includes("지원 브라우저에서는 계속 듣고"));
    assert(document.body.textContent.includes("한 번에 생성한 대본"));
    assert.equal(document.querySelectorAll("button,a,input").length, 0);
    assert.equal(document.querySelectorAll(".upcoming-list article").length, 7);
  } finally {
    await ui.cleanup();
  }
});
test("messenger has a dedicated home action and restores by URL", async () => {
  const nav = require("../lib/workspace-navigation.ts");
  assert.equal(nav.workspaceView("?view=messenger"), "messenger");
  assert.equal(nav.workspaceSection("messenger"), "more");
  assert.equal(
    nav.workspaceUrl("https://test.local", "messenger"),
    "/?view=messenger",
  );
  const C = require("../components/ConversationWorkspace.tsx").default,
    ui = await mount(
      C,
      {},
      () => (
        window.localStorage.setItem("ddeundeun-spotlight-guide-v2", "done"),
        window.localStorage.setItem(
          "ddeundeun-conversation-focus-v1",
          JSON.stringify({ version: 1, focus: "all" }),
        )
      ),
    );
  try {
    await settle();
    await click(button("더보기"));
    await click(button("메시지 답장"));
    await settle();
    assert.equal(document.querySelector("h1").textContent, "메시지 답장");
    assert.equal(window.location.search, "?view=messenger");
    assert.equal(document.querySelector('[aria-current="page"]'), null);
  } finally {
    await ui.cleanup();
  }
});
test("opening an authored messenger example never overwrites a saved reply to the same message", async () => {
  const now = new Date().toISOString(),
    saved = {
      id: "saved-messenger-example",
      kind: "chat",
      title: "내 답장",
      industry: "메신저",
      turns: [],
      createdAt: now,
      updatedAt: now,
      messenger: {
        version: 1,
        input: msgExample.input,
        candidates: msgExample.candidates,
        source: "ai",
        draft: "저장한 내 표현",
        draftSource: "manual",
        updatedAt: now,
      },
    };
  const ui = await mount(Messenger, {
    config,
    initialSession: saved,
    onRecords() {},
  });
  try {
    await act(async () => store.putSession(saved));
    await click(button("메시지·조건 수정"));
    await click(
      [...document.querySelectorAll(".daily-topic-grid button")].find((b) =>
        b.textContent.includes(msgExample.title),
      ),
    );
    await settle();
    const rows = await store.listSessions();
    assert.equal(rows.length, 2);
    assert.equal(
      (await store.getSession(saved.id)).messenger.draft,
      "저장한 내 표현",
    );
  } finally {
    await ui.cleanup();
  }
});

test("chat composer opens typing immediately and remains ready for the next reply after saving", async () => {
  const C = require("../components/VoiceComposer.tsx").default;
  const sent = [];
  const ui = await mount(C, {
    config,
    consent: false,
    requireText: true,
    textFirst: true,
    submitLabel: "내 답변 보내기",
    onUse: async (draft) => sent.push(draft.text),
  });
  try {
    const input = document.querySelector("textarea");
    assert(input);
    await change(input, "오늘은 어렵지만 내일 오전에는 도울 수 있어요.");
    await click(button("내 답변 보내기"));
    assert.deepEqual(sent, ["오늘은 어렵지만 내일 오전에는 도울 수 있어요."]);
    assert(document.querySelector("textarea"));
    assert.equal(document.querySelector("textarea").value, "");
    await change(
      document.querySelector("textarea"),
      "10시에 다시 이야기할까요?",
    );
    await click(button("내 답변 보내기"));
    assert.equal(sent.length, 2);
  } finally {
    await ui.cleanup();
  }
});

test("opening the glossary with a conversation focus still shows saved personal notes first", async () => {
  const C = require("../components/TermNotebook.tsx").default;
  const ui = await mount(C, { config, focus: "work" });
  try {
    await settle();
    assert.equal(button("내 노트").getAttribute("aria-pressed"), "true");
    await click(button("용어 추가"));
    await change(
      document.querySelector(
        'input[placeholder="저장할 단어나 표현을 입력해 주세요"]',
      ),
      "우선순위를 함께 정하다",
    );
    await click(button("이 표현 바로 저장"));
    await settle();
    assert.equal((await store.listTerms()).length, 1);
    assert.match(
      document.querySelector("main")?.textContent || document.body.textContent,
      /우선순위를 함께 정하다/,
    );
    assert.equal(button("내 노트").getAttribute("aria-pressed"), "true");
  } finally {
    await ui.cleanup();
  }
});

test("communication tips are private editable drafts and reopening a tip preserves the user's note", async () => {
  const C = require("../components/TermNotebook.tsx").default;
  const ui = await mount(C, { config });
  try {
    await settle();
    assert(
      document
        .querySelector('[aria-label="용어 노트 공개 범위"]')
        .textContent.includes("다른 이용자에게 공개되지 않아요"),
    );
    await click(button("소통 팁"));
    await click(button("내 노트에 담기"));
    assert.equal((await store.listTerms()).length, 0);
    await click(document.querySelector(".term-personal-memo summary"));
    await click(document.querySelector('[aria-label="내 메모 입력"]'));
    await change(
      document.querySelector('textarea[aria-label="내 메모"]'),
      "우리 팀은 마감 전에 먼저 일정을 확인한다.",
    );
    await click(button("내 노트에 추가"));
    await settle();
    assert.equal((await store.listTerms()).length, 1);
    await click(button("내 노트에 담기"));
    assert(
      document
        .querySelector(".term-personal-memo summary")
        .textContent.includes("작성됨"),
    );
    await click(document.querySelector(".term-personal-memo summary"));
    await click(document.querySelector('[aria-label="내 메모 수정"]'));
    assert.equal(
      document.querySelector('textarea[aria-label="내 메모"]').value,
      "우리 팀은 마감 전에 먼저 일정을 확인한다.",
    );
    await click(button("변경 내용 저장"));
    await settle();
    assert.equal((await store.listTerms()).length, 1);
  } finally {
    await ui.cleanup();
  }
});

test("curation starts after choosing practice, keeps personal cards and preserves interest across all-fields browsing", async () => {
  const C = require("../components/ConversationWorkspace.tsx").default;
  const focus = require("../lib/conversation-focus.ts");
  const cards = require("../lib/conversation-cards.ts");
  const ui = await mount(C, {}, () =>
    localStorage.setItem("ddeundeun-spotlight-guide-v2", "done"),
  );
  try {
    await settle();
    assert.equal(document.querySelector('[aria-label="대화 맥락 선택"]'), null);
    assert.equal(document.querySelectorAll(".dc-saved-card").length, 0);
    await click(button("미리 연습하기"));
    assert(document.querySelector('[aria-label="대화 맥락 선택"]'));
    await click(document.querySelector('[data-focus="education"]'));
    assert.equal(document.querySelectorAll(".dc-saved-card").length, 1);
    assert(
      document.querySelector(".dc-card-grid").textContent.includes("상담 시간"),
    );
    assert(
      !document.querySelector(".dc-card-grid").textContent.includes("환불"),
    );
    const personal = {
      ...require("../lib/starter-data.ts").requestCards[1],
      id: "card-my-unrelated",
      isSample: false,
      title: "내가 만든 약속 대화",
    };
    cards.writeCards([...cards.readCards(), personal]);
    await click(button("홈"));
    await click(button("미리 연습하기"));
    assert.equal(document.querySelectorAll(".dc-saved-card").length, 2);
    assert(document.body.textContent.includes(personal.title));
    await click(button("모든 분야 예시 7"));
    assert.equal(document.querySelectorAll(".dc-saved-card").length, 8);
    assert.equal(
      document.querySelectorAll(".focus-card-group[data-category]").length,
      4,
    );
    assert(document.querySelector("h1").textContent.includes("모든 연습 상황"));
    assert.equal(
      focus.parseFocus(localStorage.getItem(focus.FOCUS_KEY)),
      "education",
    );
    await click(button("학부모 상담 예시 1"));
    await act(async () => ui.root.render(null));
    await act(async () => ui.root.render(React.createElement(C)));
    await settle();
    assert.equal(document.querySelectorAll(".dc-saved-card").length, 2);
    cards.writeCards(
      cards.readCards().filter((c) => c.id !== "card-scene-parent-hours"),
    );
    await click(button("홈"));
    await click(button("미리 연습하기"));
    assert.equal(document.querySelectorAll(".dc-saved-card").length, 1);
    assert(!cards.readCards().some((c) => c.id === "card-scene-parent-hours"));
  } finally {
    await ui.cleanup();
  }
});

test("editing practice interest hides only its list and preserves search when cancelled", async () => {
  const C = require("../components/ConversationWorkspace.tsx").default;
  const ui = await mount(C, {}, () => {
    localStorage.setItem("ddeundeun-spotlight-guide-v2", "done");
    localStorage.setItem(
      "ddeundeun-conversation-focus-v1",
      JSON.stringify({ version: 1, focus: "education" }),
    );
  });
  try {
    await settle();
    assert.equal(
      document.querySelector('[aria-label="선택한 대화 맥락"]'),
      null,
    );
    await click(button("미리 연습하기"));
    assert.equal(
      document.querySelector("#card-search"),
      null,
      "Small curated lists do not need search",
    );
    await click(
      [...document.querySelectorAll(".focus-list-filters button")].find((b) =>
        b.textContent.includes("모든 분야 예시"),
      ),
    );
    await change(document.querySelector("#card-search"), "상담 시간");
    await click(button("선택 바꾸기"));
    assert(document.querySelector('[aria-label="대화 맥락 선택"]'));
    assert.equal(
      document.querySelector(".focus-workspace-content").hidden,
      true,
    );
    await click(button("선택 유지하기"));
    assert.equal(document.querySelector("#card-search").value, "상담 시간");
    await click(button("선택 바꾸기"));
    await click(document.querySelector('[data-focus="work"]'));
    assert.equal(
      document.querySelector(".focus-workspace-content").hidden,
      false,
    );
    assert.equal(document.querySelector("#card-search"), null);
    await click(button("홈"));
    assert.equal(document.querySelectorAll("[data-purpose]").length, 3);
    assert.equal(document.querySelector('[aria-label="대화 맥락 선택"]'), null);
  } finally {
    await ui.cleanup();
  }
});

test("curated glossary starts with the chosen field and still permits browsing every field", async () => {
  const C = require("../components/TermCatalogue.tsx").default;
  const ui = await mount(C, { focus: "education", onSelect() {} });
  try {
    assert.equal(document.querySelector("select").value, "recommended");
    const recommended = [...document.querySelectorAll(".learn-term small")].map(
      (x) => x.textContent,
    );
    assert(recommended.length > 0);
    assert(recommended.every((t) => /학교생활|교육/.test(t)));
    await change(document.querySelector("select"), "");
    assert(
      document.querySelectorAll(".learn-term").length > recommended.length,
    );
  } finally {
    await ui.cleanup();
  }
});

test("curation values validate stored versions and never hide personally authored cards", () => {
  const { parseFocus, curatedCards } = require("../lib/conversation-focus.ts");
  assert.equal(parseFocus("{broken"), null);
  assert.equal(parseFocus(JSON.stringify({ version: 2, focus: "work" })), null);
  assert.equal(
    parseFocus(JSON.stringify({ version: 1, focus: "unknown" })),
    null,
  );
  const data = [
    ...require("../lib/starter-data.ts").starterCards,
    {
      ...require("../lib/starter-data.ts").requestCards[0],
      id: "mine",
      isSample: false,
    },
  ];
  assert.deepEqual(
    curatedCards(data, null).map((x) => x.id),
    ["mine"],
  );
  assert.deepEqual(
    curatedCards(data, "education").map((x) => x.id),
    ["mine"],
  );
  assert.equal(curatedCards(data, "all").length, data.length);
});

test("writing a custom situation bypasses fixed categories and never opens an unrelated sample tutorial", async () => {
  const C = require("../components/ConversationWorkspace.tsx").default;
  const ui = await mount(C);
  try {
    await settle();
    await click(button("미리 연습하기"));
    await click(button("내 상황 직접 설명하기"));
    assert.equal(document.querySelector("dialog[open]"), null);
    assert.equal(
      require("../lib/conversation-focus.ts").parseFocus(
        localStorage.getItem("ddeundeun-conversation-focus-v1"),
      ),
      "custom",
    );
    assert(document.querySelector(".dc-question"));
  } finally {
    await ui.cleanup();
  }
});

test("home prioritizes live assistance, offers rehearsal second and separates supporting destinations", async () => {
  const C = require("../components/ConversationWorkspace.tsx").default;
  const ui = await mount(C, {}, () =>
    localStorage.setItem("ddeundeun-spotlight-guide-v2", "done"),
  );
  try {
    await settle();
    assert.deepEqual(
      [...document.querySelectorAll(".dc-nav button")].map((b) =>
        b.textContent.trim(),
      ),
      ["홈", "내 기록", "더보기"],
    );
    assert.equal(document.querySelectorAll("[data-purpose]").length, 3);
    assert.equal(document.querySelectorAll(".practice-loop li").length, 3);
    assert(!button("AI 요청 연습"));
    assert(!button("대화 기초 훈련"));
    await click(button("미리 연습하기"));
    assert.equal(window.location.search, "?view=library");
    assert(document.querySelector("h1").textContent.includes("어떤 상황"));
    await click(button("홈으로"));
    await click(button("더보기"));
    assert.deepEqual(
      [...document.querySelectorAll(".focus-tool-grid strong")].map(
        (s) => s.textContent,
      ),
      ["메시지 답장", "용어 노트", "AI 대화 상대", "사용·저장 안내"],
    );
    for (const [label, id] of [
      ["메시지 답장", "messenger"],
      ["용어 노트", "terms"],
      ["AI 대화 상대", "room"],
      ["사용·저장 안내", "guide"],
    ]) {
      await click(button(label));
      await settle();
      assert.equal(window.location.search, `?view=${id}`);
      assert(document.querySelector("h1").textContent.includes(label));
      assert.equal(document.querySelector(".dc-nav [aria-current=page]"), null);
      assert.equal(
        document.querySelector(".purpose-breadcrumb [aria-current=location]")
          .textContent,
        label,
      );
      assert.equal(
        document.querySelector('[aria-label="대화 맥락 선택"]'),
        null,
      );
      if (id === "room") {
        assert(!document.body.textContent.includes("라운지 미리보기"));
        assert(!document.body.textContent.includes("친구들 대화 관찰"));
      }
      await act(async () => ui.root.render(null));
      await act(async () => ui.root.render(React.createElement(C)));
      await settle();
      assert(document.querySelector("h1").textContent.includes(label));
      await click(button("더보기로"));
      assert.equal(window.location.search, "?view=more");
    }
  } finally {
    await ui.cleanup();
  }
});

test("reply copy reports pending once, and late clipboard success never marks an edited reply copied", async () => {
  const ui = await mount(Messenger, { config, onRecords() {} });
  let resolveCopy,
    copied,
    calls = 0;
  try {
    await fillMessenger();
    await click(button("저장하고 답장 준비"));
    await settle();
    if (button("답장 쓰기")) await click(button("답장 쓰기"));
    await change(
      document.querySelector('[aria-label="보낼 답장"]'),
      "복사 요청한 문장",
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText(text) {
          copied = text;
          calls++;
          return new Promise((resolve) => {
            resolveCopy = resolve;
          });
        },
      },
    });
    const copy = button("답장 복사");
    await act(async () => {
      copy.click();
      copy.click();
    });
    assert.equal(calls, 1);
    assert(button("복사 중…").disabled);
    assert(
      document
        .querySelector(".messenger-reply-actions [role=status]")
        .textContent.includes("복사하고"),
    );
    await change(
      document.querySelector('[aria-label="보낼 답장"]'),
      "복사 요청 뒤 새로 고친 문장",
    );
    await act(async () => resolveCopy());
    assert.equal(copied, "복사 요청한 문장");
    assert(button("답장 복사"));
    assert(!button("복사 완료"));
    assert.equal((await store.listSessions())[0].messenger.draft, "");
    assert.equal(
      document.querySelector('[aria-label="보낼 답장"]').value,
      "복사 요청 뒤 새로 고친 문장",
    );
  } finally {
    await ui.cleanup();
  }
});

test("unavailable clipboard keeps the reply selected with a local recovery message and does not claim success", async () => {
  const ui = await mount(Messenger, { config, onRecords() {} });
  try {
    await fillMessenger();
    await click(button("저장하고 답장 준비"));
    await settle();
    if (button("답장 쓰기")) await click(button("답장 쓰기"));
    const editor = document.querySelector('[aria-label="보낼 답장"]');
    await change(editor, "직접 복사할 답장입니다.");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    await click(button("답장 복사"));
    assert.equal(document.activeElement, editor);
    assert.equal(editor.selectionStart, 0);
    assert.equal(editor.selectionEnd, editor.value.length);
    assert(
      document
        .querySelector(".messenger-reply-actions [role=alert]")
        .textContent.includes("Ctrl/Cmd+C"),
    );
    assert(!button("복사 완료"));
    assert(
      !document.body.textContent.includes("AI 없이 작성된 답장 예시 보기"),
    );
    assert.equal((await store.listSessions())[0].messenger.draft, "");
  } finally {
    await ui.cleanup();
  }
});

test("reply save stays pending until storage commits, preserves draft on failure, and retries once without duplicate records", async () => {
  const ui = await mount(Messenger, { config, onRecords() {} });
  const original = store.putSession;
  let failSave,
    writes = 0;
  try {
    await fillMessenger();
    await click(button("저장하고 답장 준비"));
    await settle();
    if (button("답장 쓰기")) await click(button("답장 쓰기"));
    const id = (await store.listSessions())[0].id;
    await change(
      document.querySelector('[aria-label="보낼 답장"]'),
      "오류가 나도 남아야 하는 답장",
    );
    store.putSession = () => {
      writes++;
      return new Promise((_, reject) => {
        failSave = reject;
      });
    };
    const save = button("답장 저장");
    await act(async () => {
      save.click();
      save.click();
    });
    assert.equal(writes, 1);
    assert(button("저장 중…").disabled);
    assert(!button("저장됨"));
    assert.equal((await store.getSession(id)).messenger.draft, "");
    await act(async () => failSave(Error("저장 공간 부족")));
    assert(
      document
        .querySelector(".messenger-reply-actions [role=alert]")
        .textContent.includes("저장 공간 부족"),
    );
    assert.equal(
      document.querySelector('[aria-label="보낼 답장"]').value,
      "오류가 나도 남아야 하는 답장",
    );
    assert(!button("답장 저장").disabled);
    store.putSession = original;
    await click(button("답장 저장"));
    await settle();
    assert.equal((await store.listSessions()).length, 1);
    assert.equal(
      (await store.getSession(id)).messenger.draft,
      "오류가 나도 남아야 하는 답장",
    );
    assert(!document.querySelector("dialog[open]"));
    assert(!document.querySelector('[aria-label="보낼 답장"]'));
    assert(
      document
        .querySelector(".messenger-reply-actions [role=status]")
        .textContent.includes("저장했어요"),
    );
    await click(button("답장 수정"));
    assert(button("저장됨").disabled);
    await change(
      document.querySelector('[aria-label="보낼 답장"]'),
      "다시 수정한 답장",
    );
    assert(!button("답장 저장").disabled);
    assert(
      !document
        .querySelector(".messenger-reply-actions")
        .textContent.includes("저장했어요"),
    );
  } finally {
    store.putSession = original;
    await ui.cleanup();
  }
});

test("workspace messenger protects dirty navigation, saves, searches, reopens, edits and deletes the same reply", async () => {
  const Workspace = require("../components/ConversationWorkspace.tsx").default;
  const ui = await mount(Workspace, {}, () => {
    window.history.replaceState(null, "", "?view=messenger");
    localStorage.setItem("ddeundeun-spotlight-guide-v2", "done");
  });
  try {
    await settle();
    await fillMessenger();
    await click(button("저장하고 답장 준비"));
    await settle();
    if (button("답장 쓰기")) await click(button("답장 쓰기"));
    await change(
      document.querySelector('[aria-label="보낼 답장"]'),
      "통합검증 전용 답장 0917",
    );
    let prompts = 0;
    window.confirm = () => {
      prompts++;
      return false;
    };
    await click(button("답장 작성 닫기"));
    await click(button("홈"));
    assert.equal(prompts, 1);
    assert.equal(window.location.search, "?view=messenger");
    await click(button("답장 수정"));
    assert.equal(
      document.querySelector('[aria-label="보낼 답장"]').value,
      "통합검증 전용 답장 0917",
    );
    await click(button("답장 작성 닫기"));
    await act(async () => {
      window.history.replaceState(null, "", "?view=library");
      window.dispatchEvent(new window.PopStateEvent("popstate"));
    });
    assert.equal(prompts, 2);
    assert.equal(window.location.search, "?view=messenger");
    await click(button("답장 수정"));
    assert(document.querySelector('[aria-label="보낼 답장"]'));
    await click(button("답장 저장"));
    await settle();
    assert(!document.querySelector("dialog[open]"));
    await click(button("저장한 답장 보기"));
    await settle();
    assert.equal(prompts, 2);
    assert.equal(document.querySelector("h1").textContent, "내 기록");
    const search = document.querySelector("input[type=search]");
    await change(search, "통합검증 전용 답장 0917");
    assert.equal(document.querySelectorAll(".vn-session-card").length, 1);
    await click(document.querySelector(".vn-session-card"));
    await settle();
    assert(!document.querySelector('[aria-label="보낼 답장"]'));
    await click(button("답장 수정"));
    assert.equal(
      document.querySelector('[aria-label="보낼 답장"]').value,
      "통합검증 전용 답장 0917",
    );
    assert(button("저장됨").disabled);
    await change(
      document.querySelector('[aria-label="보낼 답장"]'),
      "재진입 후 수정 답장 0917",
    );
    await click(button("답장 저장"));
    await settle();
    let records = (await store.listSessions()).filter((s) => s.messenger);
    assert.equal(records.length, 1);
    assert.equal(records[0].messenger.draft, "재진입 후 수정 답장 0917");
    await click(button("이 답장 기록 삭제"));
    assert.equal(
      (await store.listSessions()).filter((s) => s.messenger).length,
      1,
    );
    window.confirm = () => true;
    await click(button("이 답장 기록 삭제"));
    await settle();
    assert.equal(
      (await store.listSessions()).filter((s) => s.messenger).length,
      0,
    );
    assert(!document.querySelector("dialog[open]"));
    assert(button("메시지 입력"));
  } finally {
    await ui.cleanup();
  }
});

test("clearing a saved message is still unsaved work, and accepted in-app navigation asks only once", async () => {
  const Workspace = require("../components/ConversationWorkspace.tsx").default;
  const ui = await mount(Workspace, {}, () =>
    window.history.replaceState(null, "", "?view=messenger"),
  );
  try {
    await settle();
    await fillMessenger();
    await click(button("저장하고 답장 준비"));
    await settle();
    await click(button("메시지·조건 수정"));
    await change(
      document.querySelector('[aria-label="상대가 보낸 메시지"]'),
      "",
    );
    let prompts = 0;
    window.confirm = () => {
      prompts++;
      return false;
    };
    await click(button("메시지와 목표 입력 닫기"));
    await click(button("홈"));
    assert.equal(prompts, 1);
    assert.equal(window.location.search, "?view=messenger");
    await click(button("메시지·조건 수정"));
    assert.equal(
      document.querySelector('[aria-label="상대가 보낸 메시지"]').value,
      "",
    );
    window.confirm = () => {
      prompts++;
      return true;
    };
    await click(button("메시지와 목표 입력 닫기"));
    await click(button("저장한 답장 보기"));
    await settle();
    assert.equal(prompts, 2);
    assert.equal(document.querySelector("h1").textContent, "내 기록");
    assert.equal(
      (await store.listSessions()).filter((s) => s.messenger).length,
      1,
    );
  } finally {
    await ui.cleanup();
  }
});

test("input dialog keeps the same focused input across typing and viewport changes, then restores focus and scroll lock", async () => {
  const Dialog = require("../components/InputDialog.tsx").default;
  function Harness() {
    const [open, setOpen] = React.useState(false),
      [text, setText] = React.useState("");
    const field = React.useRef(null);
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        "button",
        { onClick: () => setOpen(true) },
        "입력 열기",
      ),
      React.createElement(
        Dialog,
        {
          open,
          title: "안정성 확인",
          onClose: () => setOpen(false),
          focusTarget: field,
        },
        React.createElement(
          "label",
          null,
          "입력 라벨",
          React.createElement("textarea", {
            ref: field,
            value: text,
            onChange: (e) => setText(e.target.value),
          }),
        ),
      ),
    );
  }
  const ui = await mount(Harness);
  try {
    let opens = 0,
      closes = 0,
      scrolls = 0;
    window.HTMLDialogElement.prototype.showModal = function () {
      opens++;
      this.open = true;
    };
    window.HTMLDialogElement.prototype.close = function () {
      closes++;
      this.open = false;
    };
    window.scrollTo = () => scrolls++;
    const viewport = new window.EventTarget();
    viewport.height = 700;
    viewport.offsetTop = 0;
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
    const trigger = button("입력 열기");
    trigger.focus();
    await click(trigger);
    const input = document.querySelector("textarea"),
      dialog = document.querySelector("dialog");
    assert.equal(document.activeElement, input);
    for (const text of ["안", "안녕", "안녕하세요"]) {
      await change(input, text);
      assert.equal(document.querySelector("textarea"), input);
      assert.equal(document.activeElement, input);
    }
    const pane = dialog.querySelector(".input-dialog-body");
    assert(!pane.contains(dialog.querySelector(".input-dialog-head")));
    pane.getBoundingClientRect = () => ({ top: 100, bottom: 320 });
    input.getBoundingClientRect = () => ({ top: 420, bottom: 600 });
    input.closest("label").getBoundingClientRect = () => ({
      top: 388,
      bottom: 600,
    });
    viewport.height = 360;
    viewport.offsetTop = 40;
    viewport.dispatchEvent(new window.Event("resize"));
    assert.equal(dialog.style.getPropertyValue("--input-height"), "360px");
    assert.equal(dialog.style.getPropertyValue("--input-top"), "40px");
    assert.equal(
      pane.scrollTop,
      280,
      "the label stays above the focused field",
    );
    assert.equal(document.activeElement, input);
    assert.equal(opens, 1);
    assert.equal(closes, 0);
    assert.equal(scrolls, 0);
    assert.equal(document.body.style.overflow, "hidden");
    await act(async () =>
      dialog.dispatchEvent(new window.Event("cancel", { cancelable: true })),
    );
    assert(!dialog.open);
    assert(!document.querySelector("textarea"));
    assert.equal(document.activeElement, trigger);
    assert.equal(document.body.style.overflow, "");
    const matchMedia = window.matchMedia;
    window.matchMedia = () => ({ matches: true });
    await click(trigger);
    assert.equal(document.querySelector("textarea").value, "안녕하세요");
    assert.equal(document.activeElement, dialog.querySelector("h2"));
    // Keyboard is requested only after an explicit tap into the editor.
    document.querySelector("textarea").focus();
    assert.equal(document.activeElement, document.querySelector("textarea"));
    window.matchMedia = matchMedia;
  } finally {
    await ui.cleanup();
  }
});

test("voice input dialog preserves a closed draft, blocks duplicate save and escape while pending, and closes only after success", async () => {
  const Composer = require("../components/VoiceComposer.tsx").default;
  let resolve,
    reject,
    calls = 0;
  const ui = await mount(Composer, {
    config,
    consent: false,
    textFirst: true,
    inDialog: true,
    onUse: () => {
      calls++;
      return new Promise((yes, no) => {
        resolve = yes;
        reject = no;
      });
    },
  });
  try {
    assert(!document.querySelector("textarea"));
    await click(button("답변 쓰기"));
    assert(
      button("기록 저장").disabled,
      "Empty input retains a disabled save action",
    );
    assert(button("기록 저장").closest(".input-dialog-footer"));
    assert.equal(button("기록 저장").closest(".input-dialog-body"), null);
    await change(
      document.querySelector("textarea"),
      "내일 오전에 답변드릴게요.",
    );
    await click(button("답변 작성 닫기"));
    assert(!document.querySelector("textarea"));
    assert(button("입력 이어쓰기"));
    assert.equal((await store.listSessions()).length, 0);
    await click(button("입력 이어쓰기"));
    assert.equal(
      document.querySelector("textarea").value,
      "내일 오전에 답변드릴게요.",
    );
    const save = button("기록 저장");
    await act(async () => {
      save.click();
      save.click();
    });
    assert.equal(calls, 1);
    const dialog = document.querySelector("dialog");
    await act(async () =>
      dialog.dispatchEvent(new window.Event("cancel", { cancelable: true })),
    );
    assert(dialog.open);
    await act(async () => reject(Error("저장 공간 부족")));
    assert(dialog.open);
    assert(
      document
        .querySelector('[role="alert"]')
        .textContent.includes("저장 공간 부족"),
    );
    assert.equal(
      document.querySelector("textarea").value,
      "내일 오전에 답변드릴게요.",
    );
    await click(button("기록 저장"));
    await act(async () => resolve());
    assert.equal(calls, 2);
    assert(!dialog.open);
    assert(!document.querySelector("textarea"));
    assert(
      document
        .querySelector(".input-dialog-status")
        .textContent.includes("기록했어요"),
    );
    await click(button("답변 쓰기"));
    assert.equal(document.querySelector("textarea").value, "");
  } finally {
    await ui.cleanup();
  }
});

test("messenger saves to a read-only record, keeps closed edits and reopens selected text when record copy is blocked", async () => {
  const ui = await mount(Messenger, { config, onRecords() {} });
  try {
    assert(!document.querySelector("textarea"));
    await fillMessenger();
    await click(button("저장하고 답장 준비"));
    await settle();
    assert(!document.querySelector("dialog[open]"));
    assert(!document.querySelector("textarea"));
    await click(button("답장 쓰기"));
    await change(
      document.querySelector('[aria-label="보낼 답장"]'),
      "일정부터 확인하겠습니다.",
    );
    await click(button("답장 작성 닫기"));
    assert.equal((await store.listSessions())[0].messenger.draft, "");
    await click(button("답장 수정"));
    assert.equal(
      document.querySelector('[aria-label="보낼 답장"]').value,
      "일정부터 확인하겠습니다.",
    );
    await click(button("답장 저장"));
    await settle();
    assert(!document.querySelector("textarea"));
    assert.equal(
      document.querySelector('[aria-label="저장한 답장"] p').textContent,
      "일정부터 확인하겠습니다.",
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    await click(button("답장 복사"));
    const input = document.querySelector('[aria-label="보낼 답장"]');
    assert(document.querySelector("dialog[open]"));
    assert.equal(document.activeElement, input);
    assert.equal(input.selectionStart, 0);
    assert.equal(input.selectionEnd, input.value.length);
    assert(
      document
        .querySelector("dialog [role=alert]")
        .textContent.includes("자동 복사가 차단"),
    );
    assert.equal((await store.listSessions()).length, 1);
  } finally {
    await ui.cleanup();
  }
});

test("explicit sample practice preference survives leaving and reopening without granting AI consent", async () => {
  const Workspace = require("../components/VoiceWorkspace.tsx").default;
  const ui = await mount(Workspace, {
    config,
    mode: "practice",
    initialCard: require("../lib/starter-data.ts").requestCards[1],
    onChooseCard() {},
  });
  try {
    await click(document.querySelector(".dc-sample-switch input"));
    await settle();
    await click(button("상대와 연습 시작"));
    await settle();
    const saved = (await store.listSessions())[0];
    assert.equal(saved.sampleMode, true);
    assert.equal(saved.turns.length, 1);
    await act(async () => ui.root.render(null));
    await act(async () =>
      ui.root.render(
        React.createElement(Workspace, {
          config,
          mode: "records",
          initialSessionId: saved.id,
          onChooseCard() {},
        }),
      ),
    );
    await settle();
    assert.equal(document.querySelector(".dc-sample-switch input"), null);
    await click(button("설정·대화 목표"));
    assert.equal(
      document.querySelector(".dc-sample-switch input").checked,
      true,
    );
    await click(document.querySelector(".dc-sample-switch input"));
    await settle();
    assert.equal((await store.getSession(saved.id)).sampleMode, false);
    assert.equal(
      document.querySelector(".vn-consent input").checked,
      false,
      "Stored mode is not consent",
    );
  } finally {
    await ui.cleanup();
  }
});

test("inline chat keeps input mounted, saves before the partner responds, and guards unsent drafts", async () => {
  chatTiming.waitForPartnerBeat = actualPartnerBeat;
  const Workspace = require("../components/VoiceWorkspace.tsx").default;
  const original = structuredClone(
    require("../lib/starter-data.ts").starterSession,
  );
  original.id = "dialog-conversation";
  original.isSample = false;
  original.turns = [
    {
      id: "dialog-partner",
      role: "assistant",
      text: "어떤 일정이 괜찮으세요?",
      terms: [],
      createdAt: original.createdAt,
    },
  ];
  const ui = await mount(Workspace, { config, onChooseCard() {} });
  try {
    await act(async () => store.putSession(original));
    await act(async () => ui.root.render(null));
    await act(async () =>
      ui.root.render(
        React.createElement(Workspace, {
          config,
          initialSessionId: original.id,
          onChooseCard() {},
        }),
      ),
    );
    await settle();
    let release,
      calls = 0,
      scrolls = 0;
    global.fetch = async () => {
      calls++;
      return new Promise((resolve) => {
        release = resolve;
      });
    };
    window.HTMLElement.prototype.scrollIntoView = () => scrolls++;
    await click(document.querySelector(".vn-consent input"));
    const input = document.querySelector(
      'textarea[aria-label="인식한 말 또는 직접 입력"]',
    );
    await change(
      document.querySelector('textarea[aria-label="인식한 말 또는 직접 입력"]'),
      "내일 오전이면 가능합니다.",
    );
    await click(button("내 답변 보내기"));
    await settle();
    assert.equal(calls, 1);
    assert.equal(document.querySelector(".vn-chat-composer textarea"), input);
    assert.equal(input.value, "");
    assert.equal(document.querySelector(".input-dialog"), null);
    assert.equal((await store.getSession(original.id)).turns.length, 2);
    assert(input.disabled);
    assert.equal(scrolls, 1);
    assert(document.querySelector(".vn-partner-typing"));
    assert(document.querySelector(".vn-conversation").contains(input));
    assert.equal(
      document.activeElement.getAttribute("aria-label"),
      "내가 보낸 답변",
    );
    await act(async () =>
      release(
        Response.json({ reply: "그럼 내일 오전에 이야기해요.", terms: [] }),
      ),
    );
    assert.equal(
      (await store.getSession(original.id)).turns.length,
      2,
      "instant response waits for the sent bubble to register",
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 600)));
    await settle();
    assert.equal((await store.getSession(original.id)).turns.length, 3);
    assert.equal(document.querySelector(".vn-chat-composer textarea"), input);
    assert(!input.disabled);
    assert.equal(scrolls, 2);
    assert.equal(document.querySelector(".vn-partner-typing"), null);
    assert.equal(
      document.activeElement.getAttribute("aria-label"),
      "상대의 답변",
    );
    assert.equal(
      document.querySelector('textarea[aria-label="인식한 말 또는 직접 입력"]')
        .value,
      "",
    );
    await change(
      document.querySelector('textarea[aria-label="인식한 말 또는 직접 입력"]'),
      "아직 저장하지 않은 다음 말",
    );
    window.confirm = () => false;
    await click(button("내 기록으로"));
    assert.equal(document.querySelector(".vn-chat-composer textarea"), input);
    assert.equal((await store.getSession(original.id)).turns.length, 3);
    assert.equal(
      document.querySelector('textarea[aria-label="인식한 말 또는 직접 입력"]')
        .value,
      "아직 저장하지 않은 다음 말",
    );
    window.confirm = () => true;
    await click(button("내 기록으로"));
    assert(!document.querySelector(".vn-chat-composer"));
  } finally {
    chatTiming.waitForPartnerBeat = async () => {};
    await ui.cleanup();
  }
});

test("home resumes only the latest personal record, never a newer sample", async () => {
  const C = require("../components/ConversationWorkspace.tsx").default;
  const ui = await mount(C, {}, () =>
    localStorage.setItem("ddeundeun-spotlight-guide-v2", "done"),
  );
  try {
    await settle();
    await act(async () => {
      await store.putSession({
        ...session(),
        id: "resume-old",
        title: "이전 개인 기록",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      await store.putSession({
        ...session(),
        id: "resume-new",
        title: "최근 개인 기록",
        updatedAt: "2026-02-01T00:00:00Z",
      });
      await store.putSession({
        ...session(),
        id: "resume-sample",
        title: "최신 샘플",
        isSample: true,
        updatedAt: "2026-03-01T00:00:00Z",
      });
    });
    await click(button("내 기록"));
    await click(button("홈"));
    await settle();
    const recent = document.querySelector('[aria-label="최근 기록 이어하기"]');
    assert(recent.textContent.includes("최근 개인 기록"));
    assert(!recent.textContent.includes("최신 샘플"));
    assert.equal(recent.querySelectorAll("button").length, 1);
    await click(recent.querySelector("button"));
    await settle();
    assert.equal(window.location.search, "?view=records");
    assert.equal(document.querySelector("h1").textContent, "최근 개인 기록");
  } finally {
    await ui.cleanup();
  }
});

test("practice recording entry opens a new recording without requiring interest selection", async () => {
  const C = require("../components/ConversationWorkspace.tsx").default;
  const ui = await mount(C, {}, () =>
    localStorage.setItem("ddeundeun-spotlight-guide-v2", "done"),
  );
  try {
    await settle();
    await click(button("미리 연습하기"));
    await click(button("내 녹음으로 복기"));
    await settle();
    assert.equal(document.querySelector('[aria-label="대화 맥락 선택"]'), null);
    assert.equal(document.querySelector(".dc-nav [aria-current=page]"), null);
    assert(document.querySelector(".input-launcher"));
    assert.equal(
      (await store.listSessions()).filter((r) => !r.isSample).length,
      0,
    );
  } finally {
    await ui.cleanup();
  }
});

test("returning from active practice updates the record list, URL and primary navigation together", async () => {
  const C = require("../components/ConversationWorkspace.tsx").default;
  const ui = await mount(C, {}, () => {
    localStorage.setItem("ddeundeun-spotlight-guide-v2", "done");
    localStorage.setItem(
      "ddeundeun-conversation-focus-v1",
      JSON.stringify({ version: 1, focus: "all" }),
    );
  });
  try {
    await settle();
    await click(button("미리 연습하기"));
    await click(document.querySelector(".dc-saved-card"));
    await click(document.querySelector('[data-tour="practice-button"]'));
    await settle();
    assert.equal(document.querySelector(".dc-nav [aria-current=page]"), null);
    await click(document.querySelector(".vn-consent input"));
    global.fetch = async () =>
      Response.json({ reply: "어떤 부탁인가요?", terms: [] });
    await click(button("상대와 연습 시작"));
    await settle();
    // An unfinished editor must remain accessible if the user cancels leaving.
    await change(
      document.querySelector('textarea[aria-label="인식한 말 또는 직접 입력"]'),
      "아직 보내지 않은 말",
    );
    window.confirm = () => false;
    await click(button("내 기록"));
    assert.equal(
      document.querySelector(".vn-chat-composer textarea").value,
      "아직 보내지 않은 말",
    );
    assert.equal(document.querySelector(".dc-nav [aria-current=page]"), null);
    window.confirm = () => true;
    await click(button("내 기록"));
    await settle();
    assert.equal(document.querySelector("h1").textContent, "내 기록");
    assert.equal(window.location.search, "?view=records");
    assert.equal(
      document.querySelector(".dc-nav [aria-current=page]").textContent,
      "내 기록",
    );
    assert.equal(
      (await store.listSessions()).filter((s) => !s.isSample).length,
      1,
    );
    // Reopen from the records list: the parent view is already "records".
    // Going back must clear the inner selection, not navigate to the same view.
    await click(document.querySelector(".vn-session-list button"));
    await settle();
    assert(button("내 기록으로"));
    await click(button("내 기록으로"));
    await settle();
    assert.equal(document.querySelector("h1").textContent, "내 기록");
    await click(button("연습할 상황 고르기"));
    assert(document.querySelector(".dc-saved-card"));
    assert.equal(window.location.search, "?view=library");
  } finally {
    await ui.cleanup();
  }
});

test("speaker confirmation offers an inline solo correction before allowing coaching", async () => {
  const RecordingAnalysis =
    require("../components/RecordingAnalysis.tsx").default;
  const record = session();
  record.recordingAnalysis.segments = record.recordingAnalysis.segments.map(
    (s) => ({ ...s, role: "assistant" }),
  );
  let saved;
  const ui = await mount(RecordingAnalysis, {
    session: record,
    config,
    disabled: false,
    onSave: async (d) => {
      saved = d;
    },
    onBusy() {},
    onPractice() {},
  });
  try {
    assert(button("확인한 대화 코칭받기").disabled);
    assert(document.querySelector(".learn-speaker-help"));
    await click(button("혼자 녹음했어요 · 전부 내 말로"));
    assert.equal(document.querySelector(".learn-speaker-help"), null);
    assert(
      [...document.querySelectorAll(".learn-segments select")].every(
        (s) => s.value === "user",
      ),
    );
    assert.equal(document.querySelector(".dd-check input").checked, false);
    await click(document.querySelector(".dd-check input"));
    await click(button("말한 사람·목표 저장"));
    assert(saved.confirmed);
    assert(
      recording
        .validateRecordingInput(saved)
        .turns.every((t) => t.role === "user"),
    );
  } finally {
    await ui.cleanup();
  }
});

test("immediate assistance skips the catalogue, reloads safely and rehearsal remains a distinct flow", async () => {
  const C = require("../components/ConversationWorkspace.tsx").default;
  const ui = await mount(C);
  try {
    await settle();
    await click(button("지금 대화 도움받기"));
    assert.equal(window.location.search, "?view=quick");
    assert(document.querySelector("#live-text"));
    assert(!document.querySelector(".dc-saved-card"));
    assert(!document.querySelector(".dc-preflight"));
    assert(!document.querySelector("dialog[open]"));
    assert.notEqual(
      document.activeElement,
      document.querySelector("#live-text"),
    );
    assert(!document.body.textContent.includes("작업을 취소했어요"));
    await act(async () => ui.root.render(null));
    await act(async () => ui.root.render(React.createElement(C)));
    await settle();
    assert(document.querySelector("#live-text"));
    await change(
      document.querySelector("#live-text"),
      "약속을 다음 주로 바꿀 수 있어?",
    );
    window.confirm = () => false;
    await click(button("AI 상대와 미리 연습하기"));
    assert.equal(
      document.querySelector("#live-text").value,
      "약속을 다음 주로 바꿀 수 있어?",
    );
    await click(document.querySelector(".dc-nav button"));
    assert(document.querySelector("#live-text"));
    window.confirm = () => true;
    await click(button("AI 상대와 미리 연습하기"));
    assert.equal(window.location.search, "?view=library");
    assert(!document.querySelector("#live-text"));
    await click(document.querySelector('[data-focus="work"]'));
    assert(document.querySelector(".dc-saved-card"));
    await click(document.querySelector(".dc-saved-card"));
    assert(button("대화 연습 시작하기"));
    await click(button("대화 연습 시작하기"));
    assert(document.querySelector('[data-tour="practice-settings"]'));
    assert.equal(
      (await store.listSessions()).filter((s) => !s.isSample).length,
      0,
    );
  } finally {
    await ui.cleanup();
  }
});

test("the third core home entry opens recording analysis directly without a situation or an empty saved record", async () => {
  const C = require("../components/ConversationWorkspace.tsx").default;
  const ui = await mount(C);
  try {
    await settle();
    assert.deepEqual(
      [...document.querySelectorAll("[data-purpose]")].map(
        (b) => b.dataset.purpose,
      ),
      ["live", "library", "recording"],
    );
    await click(button("녹음 분석·코칭"));
    await settle();
    assert.equal(document.querySelector(".dc-nav [aria-current=page]"), null);
    assert(document.querySelector(".input-launcher"));
    assert(document.body.textContent.includes("녹음 분석·코칭"));
    assert(!document.querySelector('[aria-label="대화 맥락 선택"]'));
    assert.equal(
      (await store.listSessions()).filter((r) => !r.isSample).length,
      0,
    );
  } finally {
    await ui.cleanup();
  }
});

test("recording accepts 100 labeled utterances beyond the old 40-turn/4000-character cap with grounded review", () => {
  const text = Array.from(
    { length: 100 },
    (_, i) =>
      (i % 2 ? "나: " : "상대: ") + `발화${i} ` + "대화 내용 ".repeat(15),
  ).join("\n");
  const segments = recording.splitRecordingTranscript(text);
  assert.equal(segments[0].role, "assistant");
  assert.equal(segments[1].role, "user");
  const parsed = recording.validateRecordingInput({ ...draft(), segments });
  assert.equal(parsed.turns.length, 100);
  const last = segments[99];
  const review = reviews.validateReview(
    {
      strength: {
        turnId: last.id,
        quote: last.text.slice(0, 15),
        note: "확인한 표현",
      },
      improvement: {
        turnId: last.id,
        quote: last.text.slice(0, 15),
        note: "다음 행동",
        rewrite: "범위를 확인해 주세요.",
      },
      focus: "확인하기",
    },
    example.context,
    parsed.turns,
  );
  assert.equal(review.improvement.turnId, "segment-99");
  assert.throws(
    () =>
      recording.validateRecordingInput({
        ...draft(),
        segments: Array.from({ length: 100 }, (_, i) => ({
          id: `segment-${i}`,
          role: i % 2 ? "user" : "assistant",
          text: "가".repeat(610),
        })),
      }),
    /60,000/,
  );
});

test("manual expression scrap opens, saves without AI consent, and can be read back from the glossary", async () => {
  const { TermEditor } = require("../components/TermNotebook.tsx");
  let saved = 0,
    closed = 0;
  const ui = await mount(TermEditor, {
    seed: {
      term: "서비스 수준 협약",
      quote: "이 서비스 수준 협약을 확인해 주세요.",
      industry: "IT",
      sessionId: "session-test",
    },
    config,
    onSaved: () => saved++,
    onClose: () => closed++,
  });
  try {
    let requests = 0;
    global.fetch = async () => {
      requests++;
      throw new Error("must not call AI");
    };
    assert(document.querySelector("dialog").open);
    await click(button("이 표현 바로 저장"));
    await settle();
    const rows = await store.listTerms();
    assert.equal(saved, 1);
    assert.equal(closed, 1);
    assert.equal(requests, 0);
    assert.equal(rows[0].term, "서비스 수준 협약");
    assert(rows[0].quote.includes("서비스 수준 협약"));
    assert.equal(rows[0].source, "manual");
  } finally {
    await ui.cleanup();
  }
});

test("term extraction includes the end of long transcripts and renders selectable multi-word matches", async () =>
  ai(async () => {
    const route = require("../app/api/terms/route.ts");
    const text =
      "일반 대화입니다. ".repeat(900) +
      "Service Level Agreement를 확인해 주세요.";
    gemini.geminiGenerate = async (system, parts) => {
      assert(JSON.parse(parts[0].text).text.endsWith("확인해 주세요."));
      return { terms: ["Service Level Agreement", "없는 용어"] };
    };
    const response = await route.POST(
      req({ action: "extract", text, industry: "IT", ...consent }),
    );
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).terms, [
      "Service Level Agreement",
    ]);
    const { TermText } = require("../components/TermNotebook.tsx");
    let selected;
    const ui = await mount(TermText, {
      text: "Service Level Agreement를 확인해 주세요.",
      candidates: ["service level agreement"],
      onTerm: (t) => (selected = t),
    });
    try {
      assert.equal(
        document.querySelectorAll(".vn-transcript-text button").length,
        1,
      );
      await click(document.querySelector(".is-term"));
      assert.equal(selected, "Service Level Agreement");
    } finally {
      await ui.cleanup();
    }
  }));

test("term finding offers consent at the clicked record, saves results and reports empty, invalid and quota responses inline", async () => {
  const Workspace = require("../components/VoiceWorkspace.tsx").default;
  const {
    ConsentSessionProvider,
  } = require("../components/ConsentSession.tsx");
  const saved = session();
  saved.turns = [
    {
      ...source,
      clip: undefined,
      text: "SLA와 API를 확인해 주세요.",
      terms: [],
    },
  ];
  delete saved.recordingAnalysis;
  const ui = await mount(() => null);
  try {
    await act(async () => store.putSession(saved));
    await act(async () =>
      ui.root.render(
        React.createElement(
          ConsentSessionProvider,
          null,
          React.createElement(Workspace, {
            config,
            mode: "records",
            initialSessionId: saved.id,
            onChooseCard() {},
          }),
        ),
      ),
    );
    await settle();
    let requests = 0;
    let response = { terms: ["SLA", "API"] };
    let status = 200;
    global.fetch = async (url, init) => {
      requests++;
      assert.equal(url, "/api/terms");
      const sent = JSON.parse(init.body);
      assert.equal(sent.text, saved.turns[0].text);
      assert.equal(sent.consent, true);
      return Response.json(response, { status });
    };
    assert(
      !document
        .querySelector(".vn-turn-actions")
        .textContent.includes("AI 동의 필요"),
    );
    await click(button("중요 용어 찾기"));
    assert.equal(requests, 0);
    assert(document.querySelector(".vn-turn .vn-term-help"));
    assert.equal(document.querySelectorAll(".vn-consent input").length, 1);
    assert(button("용어 찾기 시작").disabled);
    await click(document.querySelector(".vn-term-help input"));
    assert.equal(requests, 0, "consenting alone must not send data");
    await click(button("용어 찾기 시작"));
    await settle();
    assert.equal(requests, 1);
    assert.equal(
      document.querySelectorAll(".vn-term-results button").length,
      2,
    );
    assert.deepEqual(
      (await store.listSessions()).find((s) => s.id === saved.id).turns[0]
        .terms,
      ["SLA", "API"],
    );
    response = { terms: null };
    await click(button("중요 용어 찾기"));
    assert.match(
      document.querySelector(".vn-turn [role=alert]").textContent,
      /응답을 확인하지 못/,
    );
    assert.equal(
      document.querySelectorAll(".vn-term-results button").length,
      2,
    );
    response = { terms: [] };
    await click(button("중요 용어 찾기"));
    await settle();
    assert.match(
      document.querySelector(".vn-term-status").textContent,
      /찾은 용어가 없어요/,
    );
    response = { code: "provider_rate_limit", quotaKind: "daily" };
    status = 429;
    await click(button("중요 용어 찾기"));
    assert.match(
      document.querySelector(".vn-turn [role=alert]").textContent,
      /일일 한도/,
    );
    const before = requests;
    await click(button("표현 직접 스크랩"));
    await settle();
    assert(document.querySelector("dialog[open]"));
    assert.equal(
      requests,
      before,
      "manual scrap remains available during an AI outage",
    );
  } finally {
    await ui.cleanup();
  }
});

test("unavailable term extraction explains the problem beside the record without sending a request", async () => {
  const Workspace = require("../components/VoiceWorkspace.tsx").default;
  const saved = session();
  const ui = await mount(() => null);
  try {
    await act(async () => store.putSession(saved));
    await act(async () =>
      ui.root.render(
        React.createElement(Workspace, {
          config: { ...config, available: false },
          mode: "records",
          initialSessionId: saved.id,
          onChooseCard() {},
        }),
      ),
    );
    await settle();
    global.fetch = async () => {
      throw new Error("must not call unavailable AI");
    };
    await click(button("중요 용어 찾기"));
    assert.match(
      document.querySelector(".vn-term-help").textContent,
      /AI 연결이 준비되지 않아/,
    );
    assert.equal(button("용어 찾기 시작"), undefined);
  } finally {
    await ui.cleanup();
  }
});

test("mobile keyboard guard reveals page editors, restores navigation on close and ignores hardware keyboards and pinch zoom", async () => {
  const Guard = require("../components/MobileKeyboardViewport.tsx").default;
  let viewport,
    pending,
    scrolls = [];
  function Harness() {
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(Guard),
      React.createElement("textarea", { "aria-label": "페이지 입력" }),
      React.createElement("button", null, "완료"),
    );
  }
  const ui = await mount(Harness, {}, () => {
    window.matchMedia = () => ({ matches: true });
    window.innerHeight = 800;
    window.requestAnimationFrame = (fn) => {
      pending = fn;
      return 1;
    };
    window.cancelAnimationFrame = () => {};
    window.scrollBy = (options) => scrolls.push(options.top);
    viewport = new window.EventTarget();
    Object.assign(viewport, { height: 800, offsetTop: 0, scale: 1 });
    Object.defineProperty(window, "visualViewport", { value: viewport });
  });
  try {
    const root = document.documentElement,
      input = document.querySelector("textarea");
    input.getBoundingClientRect = () => ({ top: 600, bottom: 680, height: 80 });
    input.focus();
    pending();
    assert(
      !root.hasAttribute("data-keyboard-open"),
      "hardware focus keeps navigation",
    );
    viewport.height = 350;
    viewport.dispatchEvent(new window.Event("resize"));
    pending();
    assert(root.hasAttribute("data-keyboard-open"));
    assert.equal(scrolls.pop(), 342);
    assert.equal(root.style.getPropertyValue("--visible-height"), "350px");
    input.value = "작성 내용은 유지";
    document.querySelector("button").focus();
    pending();
    assert(
      root.hasAttribute("data-keyboard-open"),
      "wait for keyboard closing animation",
    );
    viewport.height = 800;
    viewport.dispatchEvent(new window.Event("resize"));
    pending();
    assert(!root.hasAttribute("data-keyboard-open"));
    assert.equal(input.value, "작성 내용은 유지");
    input.focus();
    viewport.height = 350;
    viewport.scale = 2;
    viewport.dispatchEvent(new window.Event("resize"));
    pending();
    assert(
      !root.hasAttribute("data-keyboard-open"),
      "pinch zoom is not a keyboard",
    );
    await act(async () => ui.root.render(null));
    assert.equal(root.style.getPropertyValue("--visible-height"), "");
    assert(!root.hasAttribute("data-keyboard-open"));
  } finally {
    await ui.cleanup();
  }
});

test("a single unformatted solo recording can be coached without inventing a partner", () => {
  const segments = recording.splitRecordingTranscript(
    "오늘은 일정 변경을 차분하게 요청하는 연습을 해볼게요.",
  );
  assert.equal(segments.length, 1);
  assert.equal(segments[0].role, "unknown");
  const input = recording.validateRecordingInput({
    ...draft(),
    segments: segments.map((s) => ({ ...s, role: "user" })),
  });
  assert.equal(input.turns.length, 1);
  assert.equal(input.turns[0].role, "user");
  assert.throws(() =>
    recording.validateRecordingInput({ ...draft(), segments }),
  );
  const long = recording.splitRecordingTranscript("가".repeat(9000));
  assert.equal(long.map((s) => s.text).join(""), "가".repeat(9000));
  assert(long.every((s) => s.text.length <= 4000));
});

test("quick coaching requests a smaller grounded response and still rejects invented evidence", async () =>
  ai(async () => {
    const route = require("../app/api/coach/route.ts");
    const { scenarios } = require("../lib/scenarios.ts");
    const body = {
      mode: "ai",
      quick: true,
      scenario: scenarios[0].id,
      tone: "warm",
      opponent: "오늘 완료해 주세요",
      reply: "",
      ...consent,
    };
    gemini.geminiGenerate = async (system, parts, schema, signal, options) => {
      assert.equal(options.maxOutputTokens, 500);
      assert.deepEqual(schema.required, ["suggestion", "evidence", "reason"]);
      return {
        suggestion: "우선순위를 확인해도 될까요?",
        evidence: "오늘 완료해 주세요",
        reason: "일정을 확인하는 질문이에요.",
      };
    };
    const response = await route.POST(req(body));
    assert.equal(response.status, 200);
    assert.equal(
      (await response.json()).suggestion,
      "우선순위를 확인해도 될까요?",
    );
    gemini.geminiGenerate = async () => ({
      suggestion: "확인하겠습니다.",
      evidence: "없는 말",
      reason: "확인",
    });
    assert.notEqual((await route.POST(req(body))).status, 200);
  }));

test("compact fields start small, allow editable examples, preserve completed values and cancel edits", async () => {
  const Field = require("../components/CompactField.tsx").default;
  function Harness() {
    const [value, setValue] = React.useState("");
    return React.createElement(Field, {
      label: "원하는 결과",
      value,
      onChange: setValue,
      maxLength: 100,
      examples: ["정중하게 거절하고 싶어요."],
    });
  }
  const ui = await mount(Harness);
  try {
    assert(!document.querySelector("textarea"));
    await click(button("원하는 결과 입력"));
    assert.equal(document.activeElement, document.querySelector("textarea"));
    await click(button("정중하게 거절하고 싶어요."));
    assert.equal(
      document.querySelector("textarea").value,
      "정중하게 거절하고 싶어요.",
    );
    await change(
      document.querySelector("textarea"),
      "가능한 시간을 정하고 싶어요.",
    );
    await click(button("입력 완료"));
    assert(!document.querySelector("textarea"));
    assert(button("원하는 결과 수정").textContent.includes("가능한 시간을"));
    assert.equal(document.activeElement, button("원하는 결과 수정"));
    await click(button("원하는 결과 수정"));
    await change(document.querySelector("textarea"), "취소할 수정");
    await click(button("취소"));
    await click(button("원하는 결과 수정"));
    assert.equal(
      document.querySelector("textarea").value,
      "가능한 시간을 정하고 싶어요.",
    );
    await change(document.querySelector("textarea"), "Escape로 취소할 수정");
    await act(async () =>
      Simulate.keyDown(document.querySelector("textarea"), {
        key: "Escape",
        nativeEvent: { isComposing: false },
      }),
    );
    assert.equal(document.activeElement, button("원하는 결과 수정"));
    assert(button("원하는 결과 수정").textContent.includes("가능한 시간을"));
    await click(button("원하는 결과 수정"));
    await click(button("말해서 입력"));
    assert(document.body.textContent.includes("키보드의 마이크"));
  } finally {
    await ui.cleanup();
  }
});

test("first launch intro is dismissible and does not return on a later visit", async () => {
  const Intro = require("../components/LaunchIntro.tsx").default;
  const ui = await mount(Intro, {}, () => {
    global.location = window.location;
  });
  try {
    assert(document.querySelector("dialog[open]"));
    assert(document.body.textContent.includes("하고 싶은 말을 삼킨 당신에게"));
    await click(button("다음"));
    assert(document.body.textContent.includes("정답 대신, 나다운 한마디"));
    await click(button("다음"));
    assert(document.body.textContent.includes("후회보다, 다음을 위한 연습"));
    await click(button("내 대화 시작하기"));
    assert(!document.querySelector("dialog[open]"));
    assert.equal(localStorage.getItem("speakcoaching-intro-v1"), "seen");
    await act(async () => ui.root.render(null));
    await act(async () => ui.root.render(React.createElement(Intro)));
    assert(!document.querySelector("dialog[open]"));
  } finally {
    delete global.location;
    await ui.cleanup();
  }
});

async function swipeOn(node, from, to, move = to) {
  const touch = ([clientX, clientY]) => ({ clientX, clientY });
  await act(async () => {
    Simulate.touchStart(node, { touches: [touch(from)] });
    Simulate.touchMove(node, { touches: [touch(move)] });
    Simulate.touchEnd(node, { touches: [], changedTouches: [touch(to)] });
  });
}

test("onboarding distinguishes next from start and supports safe bidirectional swipes", async () => {
  const Intro = require("../components/LaunchIntro.tsx").default;
  const ui = await mount(Intro, {}, () => {
    window.innerWidth = 390;
  });
  try {
    assert(button("다음").classList.contains("dd-secondary"));
    assert(button("건너뛰고 시작하기"));
    assert(button("다음").closest(".input-dialog-footer"));
    assert.equal(button("다음").closest(".input-dialog-body"), null);
    assert(!button("내 대화 시작하기"));
    const panel = document.querySelector(".launch-swipe");
    await swipeOn(panel, [250, 150], [80, 155]);
    assert(document.body.textContent.includes("정답 대신, 나다운 한마디"));
    await swipeOn(panel, [80, 150], [250, 155]);
    assert(document.body.textContent.includes("하고 싶은 말을 삼킨 당신에게"));
    await swipeOn(panel, [250, 150], [80, 400]);
    await swipeOn(panel, [10, 150], [250, 150]);
    await swipeOn(panel, [250, 150], [220, 150]);
    assert(document.body.textContent.includes("하고 싶은 말을 삼킨 당신에게"));
    await swipeOn(panel, [250, 150], [80, 150]);
    await swipeOn(panel, [250, 150], [80, 150]);
    assert(button("내 대화 시작하기").classList.contains("dd-primary"));
    assert(!button("다음"));
    await swipeOn(panel, [250, 150], [80, 150]);
    assert(
      document.querySelector("dialog[open]"),
      "last swipe must not dismiss the intro",
    );
  } finally {
    await ui.cleanup();
  }
});

for (const width of [320, 375, 390, 430, 768])
  test(`main screens never swipe between tabs at simulated ${width}px; explicit navigation remains usable`, async () => {
    const Workspace =
      require("../components/ConversationWorkspace.tsx").default;
    const ui = await mount(Workspace, {}, () => {
      window.innerWidth = width;
      localStorage.setItem("ddeundeun-spotlight-guide-v2", "done");
    });
    try {
      await settle();
      const homeUrl = window.location.href;
      await swipeOn(document.querySelector("main"), [280, 200], [100, 200]);
      assert.equal(window.location.href, homeUrl);
      await click(button("내 기록"));
      assert(window.location.search.includes("records"));
      const input = document.querySelector('input[type="search"]');
      assert(input);
      await swipeOn(input, [280, 200], [100, 200]);
      assert(window.location.search.includes("records"));
      await swipeOn(document.querySelector("main"), [280, 200], [100, 450]);
      assert(window.location.search.includes("records"));
      await swipeOn(document.querySelector("main"), [280, 200], [100, 200]);
      assert(window.location.search.includes("records"));
      await click(button("더보기"));
      await swipeOn(document.querySelector("main"), [100, 200], [280, 200]);
      assert(window.location.search.includes("more"));
      await click(button("내 기록"));
      const dialog = document.createElement("dialog");
      dialog.open = true;
      document.body.appendChild(dialog);
      await swipeOn(document.querySelector("main"), [280, 200], [100, 200]);
      assert(window.location.search.includes("records"));
      dialog.remove();
    } finally {
      await ui.cleanup();
    }
  });

test("swipe cards follow the finger, snap back and navigate only after the exit animation", async () => {
  const Intro = require("../components/LaunchIntro.tsx").default;
  let animation, frames;
  const ui = await mount(Intro, {}, () => {
    window.innerWidth = 390;
    window.HTMLElement.prototype.animate = function (keyframes) {
      frames = keyframes;
      animation = { cancel() {}, onfinish: null };
      return animation;
    };
  });
  try {
    const panel = document.querySelector(".launch-swipe");
    await act(async () => {
      Simulate.touchStart(panel, { touches: [{ clientX: 250, clientY: 150 }] });
      Simulate.touchMove(panel, { touches: [{ clientX: 210, clientY: 150 }] });
    });
    assert(panel.style.transform.includes("-28px"));
    assert.equal(panel.dataset.swiping, "true");
    await act(async () =>
      Simulate.touchEnd(panel, {
        touches: [],
        changedTouches: [{ clientX: 210, clientY: 150 }],
      }),
    );
    assert.equal(frames[1].transform, "translateX(0) rotate(0deg)");
    await act(async () => animation.onfinish());
    assert.equal(panel.style.transform, "");
    assert(document.body.textContent.includes("하고 싶은 말을 삼킨 당신에게"));
    await swipeOn(panel, [250, 150], [80, 150]);
    assert(frames[1].transform.includes("-110%"));
    assert(document.body.textContent.includes("하고 싶은 말을 삼킨 당신에게"));
    await act(async () => animation.onfinish());
    assert(document.body.textContent.includes("정답 대신, 나다운 한마디"));
    assert.equal(panel.style.transform, "");
  } finally {
    await ui.cleanup();
  }
});

test("compact dictation distinguishes connection, permission error and consent withdrawal", async () => {
  const Field = require("../components/CompactField.tsx").default;
  let engine;
  class Engine {
    constructor() {
      engine = this;
    }
    start() {}
    abort() {
      this.aborted = true;
    }
  }
  const ui = await mount(
    Field,
    { label: "상황", value: "기존 내용", maxLength: 100, onChange() {} },
    () => {
      window.SpeechRecognition = Engine;
    },
  );
  try {
    await click(button("상황 수정"));
    await click(button("말해서 입력"));
    await click(button("직접 입력할게요"));
    assert.equal(engine, undefined);
    assert.equal(document.activeElement.tagName, "TEXTAREA");
    await click(button("말해서 입력"));
    await click(button("동의하고 음성 입력 시작"));
    assert(button("연결 취소"));
    assert(!document.body.textContent.includes("듣고 있어요"));
    await act(async () => engine.onerror({ error: "not-allowed" }));
    assert(engine.aborted);
    assert(button("키보드로 입력하기"));
    assert(button("말해서 입력"));
    await click(button("말해서 입력"));
    assert(button("연결 취소"));
    await act(async () => engine.onstart());
    assert(button("음성 입력 마치기"));
    await click(button("음성 입력 동의 철회"));
    assert(engine.aborted);
    assert.equal(document.querySelector("textarea").value, "기존 내용");
    await click(button("말해서 입력"));
    assert(button("동의하고 음성 입력 시작"));
  } finally {
    await ui.cleanup();
  }
});

test("compact dictation requires opt-in, appends recognized words and stops the microphone on completion", async () => {
  const Field = require("../components/CompactField.tsx").default;
  let engine, saved;
  class Engine {
    constructor() {
      engine = this;
    }
    start() {
      this.onstart();
    }
    abort() {
      this.aborted = true;
    }
  }
  const ui = await mount(
    Field,
    {
      label: "상황",
      value: "기존 내용",
      maxLength: 100,
      onChange: (text) => {
        saved = text;
      },
    },
    () => {
      window.SpeechRecognition = Engine;
    },
  );
  try {
    await click(button("상황 수정"));
    await click(button("말해서 입력"));
    assert.equal(engine, undefined);
    assert(document.querySelector('[aria-label="음성 입력 시작 안내"]'));
    await click(button("동의하고 음성 입력 시작"));
    assert(document.body.textContent.includes("듣고 있어요"));
    await act(async () =>
      engine.onresult({
        results: [{ isFinal: true, 0: { transcript: "새로 인식한 말" } }],
      }),
    );
    assert.equal(
      document.querySelector("textarea").value,
      "기존 내용 새로 인식한 말",
    );
    await click(button("입력 완료"));
    assert.equal(saved, "기존 내용 새로 인식한 말");
    assert(engine.aborted);
  } finally {
    await ui.cleanup();
  }
});

test("catalogue save confirms the named expression in the current tab and links to its persisted note", async () => {
  const C = require("../components/TermNotebook.tsx").default;
  const ui = await mount(C, { config });
  try {
    await settle();
    await click(button("분야별 표현 찾기 · 17개 분야"));
    await click(
      [...document.querySelectorAll(".learn-term")].find(
        (el) => el.querySelector("strong").textContent === "핫픽스",
      ),
    );
    assert.equal(document.querySelectorAll(".term-editor textarea").length, 0);
    assert.equal(document.querySelector(".term-personal-memo").open, false);
    await click(button("내 노트에 추가"));
    await settle();
    assert.equal(document.querySelector(".term-editor"), null);
    assert.equal(
      button("분야별 표현 찾기 · 17개 분야").getAttribute("aria-pressed"),
      "true",
    );
    assert.match(
      document.querySelector(".vn-save-receipt").textContent,
      /핫픽스.*저장했어요/,
    );
    assert.equal(
      document.activeElement,
      document.querySelector(".vn-save-receipt"),
    );
    assert.equal((await store.listTerms()).length, 1);
    await click(button("내 노트에서 보기"));
    assert.equal(button("내 노트").getAttribute("aria-pressed"), "true");
    assert.match(document.querySelector(".vn-term-card").textContent, /핫픽스/);
    await click(document.querySelector(".vn-term-open"));
    assert(button("변경 내용 저장"));
  } finally {
    await ui.cleanup();
  }
});

test("term save blocks double clicks and keeps the draft open on storage failure", async () => {
  const C = require("../components/TermNotebook.tsx").TermEditor;
  const original = store.putTerm;
  let saves = 0,
    saved = 0,
    closed = 0;
  const ui = await mount(C, {
    config,
    seed: { term: "테스트 표현", industry: "", quote: "", sessionId: "" },
    onSaved: () => saved++,
    onClose: () => closed++,
  });
  try {
    store.putTerm = async () => {
      saves++;
      throw new Error("저장 공간을 확인해 주세요.");
    };
    const save = button("이 표현 바로 저장");
    await act(async () => {
      save.click();
      save.click();
    });
    await settle();
    assert.equal(saves, 1);
    assert.equal(saved, 0);
    assert.equal(closed, 0);
    assert.match(
      document.querySelector('[role="alert"]').textContent,
      /저장 공간/,
    );
    assert.equal(
      document.querySelector(".term-editor input").value,
      "테스트 표현",
    );
    store.putTerm = original;
    await click(button("이 표현 바로 저장"));
    await settle();
    assert.equal(saved, 1);
    assert.equal(closed, 1);
    assert.equal((await store.listTerms()).length, 1);
  } finally {
    store.putTerm = original;
    await ui.cleanup();
  }
});

test("unfinished context protects tab and browser navigation, shows missing fields, and saves without a leave prompt", async () => {
  const C = require("../components/ConversationWorkspace.tsx").default;
  const ui = await mount(C, {}, () =>
    window.localStorage.setItem(
      "ddeundeun-conversation-focus-v1",
      JSON.stringify({ version: 1, focus: "all" }),
    ),
  );
  let asks = 0;
  try {
    await settle();
    await click(button("미리 연습하기"));
    await click(button("내 상황 만들기"));
    await click(button("직접 작성"));
    assert.match(
      document.getElementById("profile-save-hint").textContent,
      /카드 이름.*대화 상대.*어떤 상황.*원하는 결과/,
    );
    await click(button("카드 이름 · 필수 입력"));
    await change(document.querySelector("textarea"), "친구 약속 점검");
    await click(button("입력 완료"));
    window.confirm = () => {
      asks++;
      return false;
    };
    await click(button("홈"));
    assert.equal(asks, 1);
    assert.equal(document.querySelector(".dc-root").dataset.view, "setup");
    assert(
      button("카드 이름 · 필수 수정").textContent.includes("친구 약속 점검"),
    );
    const leaving = new window.Event("beforeunload", { cancelable: true });
    window.dispatchEvent(leaving);
    assert(leaving.defaultPrevented);
    for (const [label, value] of [
      ["대화 상대", "친구"],
      ["어떤 상황인가요?", "약속 시간을 변경하려고 해요."],
      ["내가 원하는 결과", "서로 가능한 새 시간을 정하기"],
    ]) {
      await click(button(label + " · 필수 입력"));
      await change(document.querySelector("textarea"), value);
      await click(button("입력 완료"));
    }
    assert.equal(document.getElementById("profile-save-hint"), null);
    await click(button("내 대화로 저장"));
    assert.equal(asks, 1);
    assert.equal(document.querySelector(".dc-root").dataset.view, "detail");
    const saved = new window.Event("beforeunload", { cancelable: true });
    window.dispatchEvent(saved);
    assert.equal(saved.defaultPrevented, false);
    await click(button("다른 상황 선택"));
    await click(button("내 상황 만들기"));
    await change(
      document.querySelector("#setup-message"),
      "전송하지 않은 이야기",
    );
    window.confirm = () => {
      asks++;
      return true;
    };
    await click(button("홈"));
    assert.equal(asks, 2);
    assert.equal(document.querySelector(".dc-root").dataset.view, "home");
    await settle();
  } finally {
    await ui.cleanup();
  }
});

test("ordinary transcript prose has no word buttons and retains its exact text", async () => {
  const { TermText } = require("../components/TermNotebook.tsx");
  const text = "함께 확인할 업무를 정하고 시간을 알려주세요.";
  const ui = await mount(TermText, { text, onTerm() {} });
  try {
    assert.equal(
      document.querySelector(".vn-transcript-text").textContent,
      text,
    );
    assert.equal(
      document.querySelectorAll(".vn-transcript-text button").length,
      0,
    );
  } finally {
    await ui.cleanup();
  }
});

test("records combine source filters, name sorting and search without mutating saved rows", async () => {
  const Workspace = require("../components/VoiceWorkspace.tsx").default;
  const ui = await mount(Workspace, { config, onChooseCard() {} });
  try {
    await settle();
    await act(async () => {
      for (const [id, title, isSample, updatedAt] of [
        ["filter-z", "하루 기록", false, "2026-09-18T01:00:00.000Z"],
        ["filter-a", "가족 기록", false, "2026-09-17T01:00:00.000Z"],
        ["filter-s", "샘플 기록", true, "2026-09-16T01:00:00.000Z"],
      ])
        await store.putSession({
          ...session(),
          id,
          title,
          isSample,
          updatedAt,
        });
      ui.root.render(null);
    });
    await act(async () =>
      ui.root.render(
        React.createElement(Workspace, { config, onChooseCard() {} }),
      ),
    );
    await settle();
    const titles = () =>
      [...document.querySelectorAll(".vn-session-card strong")].map(
        (x) => x.textContent,
      );
    await click(button("내 기록"));
    assert.deepEqual(titles(), ["하루 기록", "가족 기록"]);
    assert.equal(document.querySelector(".record-examples"), null);
    await change(document.querySelector('[aria-label="기록 정렬"]'), "name");
    assert.deepEqual(titles(), ["가족 기록", "하루 기록"]);
    await change(
      document.querySelector('[aria-label="대화 기록 검색"]'),
      "가족",
    );
    assert.deepEqual(titles(), ["가족 기록"]);
    await click(button("샘플"));
    assert.deepEqual(titles(), []);
    await change(document.querySelector('[aria-label="대화 기록 검색"]'), "");
    assert.deepEqual(titles(), ["샘플 기록"]);
    assert(document.querySelector(".record-examples"));
    assert.equal((await store.getSession("filter-z")).title, "하루 기록");
  } finally {
    await ui.cleanup();
  }
});

test("home distinguishes detected speech capability from permissions and offers a text fallback", async () => {
  const Home = require("../components/HomeActions.tsx").default;
  for (const supported of [false, true]) {
    const ui = await mount(
      Home,
      { onLive() {}, onNavigate() {}, onResume() {} },
      () => {
        if (supported) window.SpeechRecognition = class {};
      },
    );
    try {
      const message = document.querySelector("#live-input-limit").textContent;
      assert(
        message.includes(
          supported ? "권한과 연결 상태" : "직접 입력하거나 짧게 녹음",
        ),
      );
      assert.equal(document.querySelectorAll("[data-purpose]").length, 3);
    } finally {
      await ui.cleanup();
    }
  }
});

test("QA E11 help dialog cycles Tab and Shift+Tab within its single action and restores opener", async () => {
  const Help = require("../components/ScreenHelp.tsx").default;
  function Harness() {
    const [open, setOpen] = React.useState(false);
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        "button",
        { onClick: () => setOpen(true) },
        "도움 열기",
      ),
      open &&
        React.createElement(Help, {
          view: "quick",
          purpose: "live",
          choosingFocus: false,
          onClose: () => setOpen(false),
        }),
    );
  }
  const ui = await mount(Harness);
  try {
    const trigger = button("도움 열기");
    trigger.focus();
    await click(trigger);
    const action = button("입력 이어하기");
    const tab = async (shiftKey = false) => {
      const event = new window.KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey,
        bubbles: true,
        cancelable: true,
      });
      await act(async () => document.activeElement.dispatchEvent(event));
      assert(event.defaultPrevented);
    };
    await tab();
    assert.equal(document.activeElement, action);
    await tab();
    assert.equal(document.activeElement, action);
    await tab(true);
    assert.equal(document.activeElement, action);
    await click(action);
    assert.equal(document.activeElement, trigger);
  } finally {
    await ui.cleanup();
  }
});

test("recording preview is read-only, restores its opener and starts an empty recording", async () => {
  const Workspace = require("../components/VoiceWorkspace.tsx").default;
  const ui = await mount(Workspace, { config, onChooseCard() {} });
  try {
    await settle();
    let requests = 0;
    global.fetch = async () => {
      requests++;
      throw new Error("No AI in preview");
    };
    const opener = document.querySelector(".learn-example-grid button");
    opener.focus();
    await click(opener);
    const modal = document.querySelector("dialog[open]");
    assert(modal);
    assert(modal.textContent.includes("읽어보는 예시"));
    assert.equal(
      modal.querySelectorAll(".learn-example-transcript li").length,
      example.segments.length,
    );
    assert.equal(modal.querySelectorAll("input, textarea, select").length, 0);
    assert.equal(
      modal.querySelectorAll(".learn-example-transcript button").length,
      0,
    );
    const footer = modal.querySelector(".input-dialog-footer");
    assert(footer.contains(button("내 대화로 시작하기")));
    await click(button("목록으로 돌아가기"));
    assert.equal(document.querySelector("dialog[open]"), null);
    assert.equal(document.activeElement, opener);
    assert.equal((await store.listSessions()).length, 0);
    await click(opener);
    await click(button("내 대화로 시작하기"));
    assert.equal(document.querySelector("dialog[open]"), null);
    assert.equal(document.querySelector("h1").textContent, "새 음성 기록");
    assert(button("문자로 기록하기"));
    assert(button("녹음·파일 추가"));
    assert.equal(document.querySelectorAll(".vn-turn").length, 0);
    assert(!document.body.textContent.includes(example.segments[0].text));
    assert.equal(requests, 0);
  } finally {
    await ui.cleanup();
  }
});
