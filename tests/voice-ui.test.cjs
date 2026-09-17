const ts = require("typescript"),
  Module = require("module"),
  path = require("path"),
  fs = require("fs");
const rootPath = path.resolve(__dirname, ".."),
  resolve = Module._resolveFilename;
Module._resolveFilename = function (id, ...args) {
  return resolve.call(
    this,
    id.startsWith("@/") ? path.join(rootPath, id.slice(2)) : id,
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
  assert = require("node:assert/strict"),
  { JSDOM } = require("jsdom"),
  React = require("react"),
  { createRoot } = require("react-dom/client");
const { act } = React;
let instances = [];
class Recorder {
  static isTypeSupported() {
    return true;
  }
  constructor() {
    this.state = "inactive";
    this.mimeType = "audio/webm";
    instances.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob([new Uint8Array(1000)], { type: "audio/webm" }),
    });
    this.onstop?.();
  }
}
const player = require("../components/AudioPlayer.tsx");
player.inspectAudio = async (blob) => ({
  blob,
  peaks: [0.1, 0.9, 0.4],
  duration: 2,
  name: "test",
});
const LiveCoach = require("../components/LiveCoach.tsx").default,
  Composer = require("../components/VoiceComposer.tsx").default;
const config = { available: true, voiceAvailable: true, sampleOnly: true };
async function mount(Component, props = {}) {
  const dom = new JSDOM('<div id="test-root"></div>', {
    url: "https://test.local",
  });
  const originals = {
    window: global.window,
    document: global.document,
    navigator: Object.getOwnPropertyDescriptor(global, "navigator"),
    MediaRecorder: global.MediaRecorder,
    fetch: global.fetch,
  };
  global.window = dom.window;
  global.document = dom.window.document;
  Object.defineProperty(global, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  global.MediaRecorder = Recorder;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  instances = [];
  let stopped = 0;
  Object.defineProperty(navigator, "mediaDevices", {
    value: {
      getUserMedia: async () => ({
        getTracks: () => [{ stop: () => stopped++ }],
      }),
    },
    configurable: true,
  });
  window.matchMedia = () => ({ matches: false });
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  global.fetch = async () => Response.json(config);
  const root = createRoot(document.getElementById("test-root"));
  await act(async () => {
    root.render(React.createElement(Component, props));
  });
  return {
    root,
    stopped: () => stopped,
    cleanup: async () => {
      await act(async () => root.unmount());
      dom.window.close();
      global.window = originals.window;
      global.document = originals.document;
      Object.defineProperty(global, "navigator", originals.navigator);
      global.MediaRecorder = originals.MediaRecorder;
      global.fetch = originals.fetch;
    },
  };
}
const button = (text) =>
  [...document.querySelectorAll("button")].find(
    (b) =>
      b.textContent.includes(text) || b.getAttribute("aria-label") === text,
  );
const click = async (b) => {
  assert(b, "button missing");
  await act(async () => {
    b.click();
  });
};
test("finishing a live recording transcribes it instead of discarding it, with completion guidance", async () => {
  const ui = await mount(LiveCoach, { onBack: () => {}, onDemo: () => {} });
  try {
    for (const c of document.querySelectorAll(
      ".vn-consent input, .dc-permissions input",
    ))
      await click(c);
    await click(button("이 설정으로 시작"));
    let requested = 0,
      resolveVoice;
    global.fetch = async (url) => {
      assert.equal(url, "/api/transcribe");
      requested++;
      return new Promise((r) => (resolveVoice = r));
    };
    await click(button("상대 말 8초 듣기"));
    assert(document.body.textContent.includes("듣는 중"));
    await click(button("녹음 끝내고 음성 인식"));
    assert.equal(requested, 1);
    assert(ui.stopped() > 0);
    assert(document.body.textContent.includes("음성 인식 중"));
    await act(async () => {
      resolveVoice(
        Response.json({ text: "마감 일정을 다음 주로 조율하고 싶어요." }),
      );
    });
    assert.equal(
      document.querySelector("#live-text").value,
      "마감 일정을 다음 주로 조율하고 싶어요.",
    );
    assert(document.body.textContent.includes("음성 인식이 끝났어요"));
    assert(button("음성 재생"));
    assert(button("답변 힌트 받기"));
  } finally {
    await ui.cleanup();
  }
});
test("voice recognition failure preserves captured audio and provides retry guidance", async () => {
  const ui = await mount(Composer, {
    config,
    consent: true,
    onUse: async () => {},
  });
  try {
    global.fetch = async () =>
      Response.json({ error: "요청 한도에 도달했어요." }, { status: 429 });
    await click(button("눌러서 말하기"));
    await click(button("녹음 끝내기"));
    assert(document.body.textContent.includes("한도 초과"));
    require("../lib/ai-client.ts").readAIHold(Date.now() + 61000);
    assert(button("음성 재생"));
    assert(button("문자로 바꾸기"));
    assert(document.body.textContent.includes("녹음은 남아 있어요"));
    global.fetch = async () =>
      Response.json({ text: "SLA를 확인하고 일정부터 맞추죠." });
    await click(button("문자로 바꾸기"));
    assert.equal(
      document.querySelector("textarea").value,
      "SLA를 확인하고 일정부터 맞추죠.",
    );
    assert(document.body.textContent.includes("문자 변환 완료"));
  } finally {
    await ui.cleanup();
  }
});
test("permission rejection gives a visible recovery action", async () => {
  const ui = await mount(Composer, {
    config,
    consent: true,
    onUse: async () => {},
  });
  try {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("denied", "NotAllowedError");
    };
    await click(button("눌러서 말하기"));
    assert(document.body.textContent.includes("마이크 권한이 거절"));
    assert(button("파일 올리기"));
    assert(button("눌러서 말하기").disabled === false);
  } finally {
    await ui.cleanup();
  }
});
test("choosing a candidate populates editable input and never automatically submits it", async () => {
  let submitted = 0;
  const ui = await mount(Composer, {
    config,
    consent: true,
    onUse: async () => {
      submitted++;
    },
    suggestion: { id: 1, text: "우선순위를 먼저 정해볼까요?" },
  });
  try {
    assert.equal(
      document.querySelector("textarea").value,
      "우선순위를 먼저 정해볼까요?",
    );
    assert.equal(submitted, 0);
    assert(document.body.textContent.includes("고른 후보를 넣었어요"));
  } finally {
    await ui.cleanup();
  }
});

test("AI review persists, reopens without another generation, and starts a drill with original goals", async () => {
  const { IDBFactory } = require("fake-indexeddb");
  global.indexedDB = new IDBFactory();
  const store = require("../lib/voice-notebook.ts"),
    samples = require("../lib/starter-data.ts"),
    reviews = require("../lib/practice-review.ts"),
    chars = require("../lib/companions.ts");
  const session = {
    ...samples.starterSession,
    id: "review-ui-personal",
    isSample: false,
    context: { ...samples.starterCards[0] },
    companion: chars.defaultCompanions[0],
  };
  await store.putSession(session);
  const VoiceWorkspace = require("../components/VoiceWorkspace.tsx").default;
  const settle = async () => {
    for (let i = 0; i < 4; i++)
      await act(async () => new Promise((r) => setTimeout(r, 10)));
  };
  let ui = await mount(VoiceWorkspace, {
      initialSessionId: session.id,
      config,
      onChooseCard: () => {},
    }),
    calls = 0;
  try {
    await settle();
    for (const c of document.querySelectorAll(
      ".vn-consent input, .dc-permissions input",
    ))
      await click(c);
    global.fetch = async (url) => {
      calls++;
      assert.equal(url, "/api/review");
      return Response.json({
        review: reviews.validateReview(
          {
            strength: {
              turnId: "turn-sample-1",
              quote: "스코프를 먼저 정하고",
              note: "범위를 확인했어요.",
            },
            improvement: {
              turnId: "turn-sample-3",
              quote: "다음 주 월요일에 공유하겠습니다.",
              note: "가능한 날짜부터 확인해요.",
              rewrite: "일정을 확인한 뒤 말씀드릴게요.",
            },
            focus: "확인하고 약속하기",
          },
          session.context,
          session.turns,
        ),
      });
    };
    await click(button("AI로 이 대화 복기하기"));
    await settle();
    assert.equal(calls, 1);
    assert(document.body.textContent.includes("확인하고 약속하기"));
    const evidence = document.querySelector("[data-review-evidence]");
    assert(evidence && !evidence.open);
    assert(!document.querySelector(".dc-review-rewrite").closest("details"));
    await click(evidence.querySelector("summary"));
    assert(evidence.open);
    assert(evidence.textContent.includes("다음 주 월요일에 공유하겠습니다."));
    assert(evidence.textContent.includes("가능한 날짜부터 확인해요."));

    assert((await store.getSession(session.id)).review);
  } finally {
    await ui.cleanup();
  }
  ui = await mount(VoiceWorkspace, {
    initialSessionId: session.id,
    config,
    onChooseCard: () => {},
  });
  try {
    await settle();
    global.fetch = async () => {
      throw new Error("Must use cached review");
    };
    assert(button("이 장면부터 다시 연습"));
    await click(button("이 장면부터 다시 연습"));
    await settle();
    const drill = (await store.listSessions()).find((s) => s.practicePlan);
    assert(drill);
    assert.equal(drill.context.goal, session.context.goal);
    assert.equal(drill.context.boundaries, session.context.boundaries);
    assert.equal(drill.turns.at(-1).text, session.turns[2].text);
    assert(document.body.textContent.includes("이번에 해볼 한 가지"));
  } finally {
    await ui.cleanup();
  }
});

test("consent collapses after checking, can be reopened and revoked without persisting authorization", async () => {
  const Consent = require("../components/VoiceComposer.tsx").AIConsent;
  function Example() {
    const [checked, setChecked] = React.useState(false);
    return React.createElement(Consent, {
      config,
      checked,
      onChange: setChecked,
    });
  }
  let ui = await mount(Example);
  try {
    await click(document.querySelector(".vn-consent input"));
    assert.equal(document.querySelector(".vn-consent input"), null);
    assert(document.body.textContent.includes("AI 전송 동의 완료"));
    await click(button("내용 보기"));
    assert.equal(document.querySelector(".vn-consent input").checked, true);
    await click(button("동의 철회"));
    assert.equal(document.querySelector(".vn-consent input").checked, false);
  } finally {
    await ui.cleanup();
  }
  ui = await mount(Example);
  try {
    assert.equal(document.querySelector(".vn-consent input").checked, false);
  } finally {
    await ui.cleanup();
  }
});

const settleNotebook = async () => {
  for (let i = 0; i < 4; i++)
    await act(async () => new Promise((r) => setTimeout(r, 10)));
};
test("quota fallback preserves labels and candidate provenance after continuing and reopening a conversation", async () => {
  global.indexedDB = new (require("fake-indexeddb").IDBFactory)();
  const store = require("../lib/voice-notebook.ts");
  const card = require("../lib/starter-data.ts").starterCards[0];
  const Workspace = require("../components/VoiceWorkspace.tsx").default;
  let calls = 0,
    savedId;
  let ui = await mount(Workspace, {
    mode: "practice",
    initialCard: card,
    config,
    onChooseCard: () => {},
  });
  try {
    await click(document.querySelector(".vn-consent input"));
    global.fetch = async () => {
      calls++;
      return Response.json(
        { code: "provider_rate_limit", quotaKind: "daily", retryAfter: 30 },
        { status: 429 },
      );
    };
    await click(button("상대와 연습 시작"));
    await settleNotebook();
    assert(
      document.body.textContent.includes("사전 작성 샘플 · 일일 한도 초과"),
    );
    assert(document.body.textContent.includes("초기화 예정"));
    let saved = (await store.listSessions())[0];
    savedId = saved.id;
    assert.equal(saved.turns[0].sample.outage.reason, "daily");
    await click(button("내 목표에 맞는 답변 후보 3개 보기"));
    await settleNotebook();
    assert.equal(document.querySelectorAll(".vn-choice-list button").length, 3);
    await click(document.querySelector(".vn-choice-list button"));
    assert(document.querySelector("textarea").value.trim());
    await click(button("내 답변 보내기"));
    await settleNotebook();
    saved = await store.getSession(savedId);
    assert.equal(saved.turns.length, 3);
    assert.equal(saved.turns[0].suggestionsSample.source, "sample");
    assert.equal(saved.turns[1].role, "user");
    assert.equal(saved.turns[2].sample.source, "sample");
    assert.equal(calls, 1);
    assert.equal(document.querySelectorAll(".garden-practice").length, 1);
    assert(
      document
        .querySelector(".vn-composer")
        .compareDocumentPosition(document.querySelector(".garden-practice")) &
        4,
    );
    assert.equal(saved.turns[1].unchangedSuggestion, true);
    assert.equal((await store.readGarden()).earned, 0);
  } finally {
    await ui.cleanup();
  }
  ui = await mount(Workspace, {
    initialSessionId: savedId,
    config,
    onChooseCard: () => {},
  });
  try {
    await settleNotebook();
    assert.equal(
      document.querySelectorAll(".vn-turn.assistant .dc-sample-notice").length,
      2,
    );
    assert(document.body.textContent.includes("일일 한도 초과"));
    assert((await store.getSession(savedId)).turns[2].sample.sampleId);
  } finally {
    await ui.cleanup();
  }
});
test("review outage offers a separate fictional example without saving fabricated review results", async () => {
  global.indexedDB = new (require("fake-indexeddb").IDBFactory)();
  const store = require("../lib/voice-notebook.ts"),
    samples = require("../lib/starter-data.ts");
  const current = {
    ...samples.starterSession,
    id: "outage-review",
    isSample: false,
  };
  await store.putSession(current);
  const Workspace = require("../components/VoiceWorkspace.tsx").default;
  const ui = await mount(Workspace, {
    initialSessionId: current.id,
    config,
    onChooseCard: () => {},
  });
  try {
    await settleNotebook();
    await click(document.querySelector(".vn-consent input"));
    global.fetch = async () =>
      Response.json(
        { code: "provider_rate_limit", quotaKind: "daily" },
        { status: 429 },
      );
    await click(button("AI로 이 대화 복기하기"));
    await settleNotebook();
    assert(document.body.textContent.includes("가상 대화의 복기 예시 보기"));
    assert.equal((await store.getSession(current.id)).review, undefined);
    assert.equal(button("이 장면부터 다시 연습"), undefined);
    assert.deepEqual((await store.getSession(current.id)).turns, current.turns);
  } finally {
    await ui.cleanup();
  }
});
test("leaving a conversation during a failed request never saves a fallback into another record", async () => {
  global.indexedDB = new (require("fake-indexeddb").IDBFactory)();
  const store = require("../lib/voice-notebook.ts"),
    card = require("../lib/starter-data.ts").starterCards[0];
  const Workspace = require("../components/VoiceWorkspace.tsx").default;
  const ui = await mount(Workspace, {
    mode: "practice",
    initialCard: card,
    config,
    onChooseCard: () => {},
  });
  let finish;
  try {
    await click(document.querySelector(".vn-consent input"));
    global.fetch = () => new Promise((r) => (finish = r));
    await click(button("상대와 연습 시작"));
    await click(button("대화 기록 목록"));
    await act(async () =>
      finish(Response.json({ code: "provider_error" }, { status: 502 })),
    );
    await settleNotebook();
    assert.equal((await store.listSessions()).length, 0);
    assert.equal(document.querySelector(".vn-turn"), null);
  } finally {
    await ui.cleanup();
  }
});

test("live hint sample mode uses the existing transcript without another AI call or invented evidence", async () => {
  const ui = await mount(LiveCoach, { onBack: () => {}, onDemo: () => {} });
  let calls = 0;
  try {
    for (const c of document.querySelectorAll(".dc-permissions input"))
      await click(c);
    await click(button("이 설정으로 시작"));
    global.fetch = async () => {
      calls++;
      return Response.json({ text: "가능한 조건부터 확인하고 싶어요." });
    };
    await click(button("상대 말 8초 듣기"));
    await click(button("녹음 끝내고 음성 인식"));
    assert.equal(calls, 1);
    await click(document.querySelector(".dc-sample-switch input"));
    await click(button("답변 힌트 받기"));
    assert.equal(calls, 1);
    assert(document.querySelector(".dc-answer-panel .dc-sample-notice"));
    assert.equal(document.querySelector(".dc-evidence"), null);
    assert(document.body.textContent.includes("샘플 모드"));
  } finally {
    await ui.cleanup();
  }
});
