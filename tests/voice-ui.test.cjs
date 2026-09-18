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
  { JSDOM, VirtualConsole } = require("jsdom"),
  React = require("react");
let createRoot;
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
// Timing is exercised with the real delay in learning-hub's conversation test.
require("../lib/chat-timing.ts").waitForPartnerBeat = async () => {};
async function mount(Component, props = {}, setup = () => {}) {
  const browserErrors = [],
    virtualConsole = new VirtualConsole();
  virtualConsole.sendTo(console);
  virtualConsole.on("jsdomError", (error) => browserErrors.push(error));
  const dom = new JSDOM('<div id="test-root"></div>', {
    url: "https://test.local",
    virtualConsole,
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
  ({ createRoot } = require("react-dom/client"));
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
  window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  global.fetch = async () => Response.json(config);
  setup();
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
      assert.deepEqual(
        browserErrors,
        [],
        "Unhandled DOM errors must fail the test",
      );
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
    await click(button("상대 말 4초 듣기"));
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
    assert(button("답변 코칭받기"));
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
    assert(
      document.body.textContent.includes("베타테스트 AI 이용 한도에 도달"),
    );
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
test("one consent covers mounted tools and page changes, revokes everywhere, and is never persisted", async () => {
  const {
    ConsentSessionProvider,
    useAIConsent,
    ConsentSettings,
  } = require("../components/ConsentSession.tsx");
  const Consent = require("../components/VoiceComposer.tsx").AIConsent;
  function Tool({ label, priority }) {
    const [checked, setChecked] = useAIConsent();
    return React.createElement(
      "section",
      null,
      React.createElement(
        "span",
        { "data-permission": label },
        String(checked),
      ),
      React.createElement(Consent, {
        config,
        checked,
        onChange: setChecked,
        priority,
      }),
    );
  }
  function Page() {
    const [next, setNext] = React.useState(false);
    return React.createElement(
      ConsentSessionProvider,
      null,
      React.createElement(ConsentSettings),
      React.createElement(
        "button",
        { onClick: () => setNext(!next) },
        "다른 기능으로",
      ),
      React.createElement(Tool, {
        key: String(next),
        label: next ? "review" : "recording",
        priority: 0,
      }),
      React.createElement(Tool, { label: "terms", priority: 1 }),
    );
  }
  let ui = await mount(Page);
  try {
    assert.equal(document.querySelectorAll(".vn-consent input").length, 1);
    await click(document.querySelector(".vn-consent input"));
    assert.equal(document.querySelectorAll(".vn-consent input").length, 0);
    assert(
      [...document.querySelectorAll("[data-permission]")].every(
        (el) => el.textContent === "true",
      ),
    );
    await click(button("다른 기능으로"));
    assert.equal(
      document.querySelector("[data-permission=review]").textContent,
      "true",
    );
    assert.equal(document.querySelectorAll(".vn-consent input").length, 0);
    assert.equal(window.localStorage.length, 0);
    assert.equal(window.sessionStorage.length, 0);
    await click(button("AI 전송 동의 설정"));
    await click(button("동의 철회"));
    assert(
      [...document.querySelectorAll("[data-permission]")].every(
        (el) => el.textContent === "false",
      ),
    );
    assert.equal(document.querySelectorAll(".vn-consent input").length, 1);
  } finally {
    await ui.cleanup();
  }
  ui = await mount(Page);
  try {
    assert.equal(
      document.querySelector("[data-permission=recording]").textContent,
      "false",
    );
  } finally {
    await ui.cleanup();
  }
});

test("candidate edit remains optional and never sends until the edited draft is submitted", async () => {
  let sent;
  const ui = await mount(Composer, {
    config,
    consent: true,
    textFirst: true,
    replyTo: { id: "partner-1", text: "마감을 언제로 조정할까요?" },
    goal: "다음 주까지 일정 조율",
    candidates: [
      "다음 주까지 가능할까요?",
      "범위를 먼저 정해볼까요?",
      "우선순위를 확인하고 싶어요.",
    ],
    onRequestCandidates: async () => {},
    onUse: async (draft) => {
      sent = draft;
    },
    submitLabel: "내 답변 보내기",
  });
  try {
    await click(button("답변 후보 다시 보기"));
    await click(button("후보 1 고쳐 쓰기"));
    const input = document.querySelector("textarea");
    assert.equal(input.value, "다음 주까지 가능할까요?");
    assert.equal(sent, undefined);
    assert.equal(document.querySelector("dialog"), null);
    assert.equal(document.querySelector(".vn-choice-list"), null);
    assert(document.body.textContent.includes("아직 보내지 않았어요"));
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      ).set.call(input, "자료 확인 후 다음 주까지 가능할까요?");
      input.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    await click(button("내 답변 보내기"));
    assert.equal(sent.text, "자료 확인 후 다음 주까지 가능할까요?");
    assert.equal(input.value, "");
  } finally {
    await ui.cleanup();
  }
});

test("candidate tap sends once, keeps a failed draft, and respects unsent-text cancellation", async () => {
  let calls = 0,
    rejectSave;
  const ui = await mount(Composer, {
    config,
    consent: true,
    textFirst: true,
    candidates: ["일정을 확인해도 될까요?"],
    onRequestCandidates: async () => {},
    onUse: () => {
      calls++;
      return new Promise((_, reject) => {
        rejectSave = reject;
      });
    },
    submitLabel: "내 답변 보내기",
  });
  try {
    await click(button("답변 후보 다시 보기"));
    const send = document.querySelector(".vn-choice-send");
    await click(send);
    await click(send);
    assert.equal(calls, 1);
    assert(send.disabled);
    await act(async () => rejectSave(new Error("저장 공간을 확인해 주세요.")));
    assert.equal(
      document.querySelector("textarea").value,
      "일정을 확인해도 될까요?",
    );
    assert(document.body.textContent.includes("저장 공간을 확인"));
    window.confirm = () => false;
    await click(document.querySelector(".vn-choice-send"));
    assert.equal(
      calls,
      1,
      "cancelled replacement must not send or discard the draft",
    );
    assert.equal(
      document.querySelector("textarea").value,
      "일정을 확인해도 될까요?",
    );
  } finally {
    await ui.cleanup();
  }
});

test("quota failure saves the session without fabricating assistant turns, including after reopening", async () => {
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
    onChooseCard() {},
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
    assert.match(document.body.textContent, /베타테스트 AI 이용량을 모두 사용/);
    assert.equal(document.querySelector(".vn-turn.assistant"), null);
    const saved = (await store.listSessions())[0];
    savedId = saved.id;
    assert.equal(saved.turns.length, 0);
    assert.equal(saved.sampleMode, false);
    assert.equal(calls, 1);
  } finally {
    await ui.cleanup();
  }
  ui = await mount(Workspace, {
    initialSessionId: savedId,
    config,
    onChooseCard() {},
  });
  try {
    await settleNotebook();
    assert.equal((await store.getSession(savedId)).turns.length, 0);
    assert.equal(document.querySelector(".vn-turn.assistant"), null);
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
    await settleNotebook();
    await click(button("내 기록으로"));
    await act(async () =>
      finish(Response.json({ code: "provider_error" }, { status: 502 })),
    );
    await settleNotebook();
    const records = await store.listSessions();
    assert.equal(
      records.length,
      1,
      "The chosen context is saved before requesting AI",
    );
    assert.equal(
      records[0].turns.length,
      0,
      "A late failure must not invent any assistant turn",
    );
    assert.equal(document.querySelector(".vn-turn"), null);
  } finally {
    await ui.cleanup();
  }
});

test("prepared samples open without consent or connectivity and do not grant AI consent", async () => {
  const ui = await mount(LiveCoach, { onBack() {}, onDemo() {} }, () => {
    global.fetch = async () =>
      Response.json({
        available: false,
        voiceAvailable: false,
        sampleOnly: true,
      });
  });
  try {
    assert(button("이 설정으로 시작").disabled);
    let calls = 0;
    global.fetch = async () => {
      calls++;
      throw new Error("No AI calls in samples");
    };
    await click(button("준비된 샘플 체험하기"));
    await quickChange("dialog[open] select", "friend-schedule");
    assert.match(
      document.querySelector("dialog[open]").textContent,
      /친구와 약속 조정/,
    );
    await click(button("내 대화로 돌아가기"));
    assert(button("이 설정으로 시작").disabled);
    assert.equal(calls, 0);
    assert.equal(document.querySelector(".dc-answer-panel"), null);
  } finally {
    await ui.cleanup();
  }
});

test("sample preview preserves the transcribed input and cannot become its recommendation", async () => {
  const ui = await mount(LiveCoach, { onBack() {}, onDemo() {} });
  try {
    for (const c of document.querySelectorAll(
      ".vn-consent input, .dc-permissions input",
    ))
      await click(c);
    await click(button("이 설정으로 시작"));
    let calls = 0;
    global.fetch = async () => {
      calls++;
      return Response.json({ text: "돈을 빌려줄 수 있어?" });
    };
    await click(button("상대 말 4초 듣기"));
    await click(button("녹음 끝내고 음성 인식"));
    assert.equal(calls, 1);
    await click(document.querySelector(".dc-sample-switch input"));
    await quickChange("dialog[open] select", "friend-schedule");
    await click(button("내 대화로 돌아가기"));
    assert.equal(
      document.querySelector("#live-text").value,
      "돈을 빌려줄 수 있어?",
    );
    assert.equal(document.querySelector(".dc-answer-panel blockquote"), null);
    assert.equal(calls, 1);
  } finally {
    await ui.cleanup();
  }
});

test("a failed next recommendation keeps two recent successful cues without appending a sample", async () => {
  const ui = await mount(LiveCoach, {
    directEntry: true,
    onBack() {},
    onDemo() {},
  });
  try {
    await click(document.querySelector(".vn-consent input"));
    global.fetch = async () =>
      Response.json({
        suggestion: "미안하지만 돈을 빌려주기는 어려워.",
        reason: "거절하기",
        terms: [],
      });
    for (const text of [
      "돈을 빌려줄래?",
      "다음 주에는 가능해?",
      "조금만 빌려줄래?",
    ]) {
      await quickChange("#live-text", text);
      await click(button("답변 코칭받기"));
      await click(button("다음 말 준비"));
    }
    const previous = document.querySelector(".live-recent-cues").textContent;
    assert.equal(
      document.querySelectorAll(".live-recent-cues article").length,
      2,
    );
    await quickChange("#live-text", "정말 안 되는 거야?");
    global.fetch = async () =>
      Response.json({ quotaKind: "daily" }, { status: 429 });
    await click(button("답변 코칭받기"));
    assert.equal(
      document.querySelector("#live-text").value,
      "정말 안 되는 거야?",
    );
    assert.equal(
      document.querySelector(".live-recent-cues").textContent,
      previous,
    );
    assert.equal(document.querySelector(".dc-answer-panel blockquote"), null);
    assert.match(document.body.textContent, /베타테스트 AI 이용량을 모두 사용/);
  } finally {
    await ui.cleanup();
  }
});

class StreamingRecognizer {
  static instances = [];
  constructor() {
    this.aborted = false;
    StreamingRecognizer.instances.push(this);
  }
  start() {
    this.onstart?.();
  }
  abort() {
    this.aborted = true;
    this.onend?.();
  }
  result(final, interim = "") {
    this.onresult?.({
      results: [
        ...(final ? [{ isFinal: true, 0: { transcript: final } }] : []),
        ...(interim ? [{ isFinal: false, 0: { transcript: interim } }] : []),
      ],
    });
  }
}
const setupSpeech = () => {
  StreamingRecognizer.instances = [];
  window.webkitSpeechRecognition = StreamingRecognizer;
};
const StreamPanel = require("../components/LiveSpeechPanel.tsx").default;
const liveProps = {
  scenario: "sales",
  tone: "firm_polite",
  consent: true,
  adult: true,
  sample: true,
  onActiveChange: () => {},
};

test("continuous speech requires its own consent, renders interim words immediately and keeps listening during AI requests", async () => {
  const ui = await mount(StreamPanel, liveProps, setupSpeech);
  try {
    assert(button("실시간 듣기 시작").disabled);
    await click(document.querySelector(".live-speech-consent input"));
    let resolveCoach,
      calls = 0;
    global.fetch = async (url, init) => {
      assert.equal(url, "/api/coach");
      assert.equal(JSON.parse(init.body).opponent, "마감은 금요일입니다.");
      calls++;
      return new Promise((r) => {
        resolveCoach = r;
      });
    };
    await click(button("실시간 듣기 시작"));
    const engine = StreamingRecognizer.instances[0];
    assert.equal(engine.continuous, true);
    assert.equal(engine.interimResults, true);
    await act(async () => engine.result("", "마감은 금"));
    assert.equal(
      document.querySelector(".live-caption-interim").textContent,
      " 마감은 금",
    );
    assert.equal(calls, 0, "partial words must not trigger AI requests");
    await act(async () => engine.result("마감은 금요일입니다."));
    await act(async () => new Promise((r) => setTimeout(r, 720)));
    assert.equal(calls, 1);
    assert.equal(
      engine.aborted,
      false,
      "AI generation must not stop the microphone",
    );
    await act(async () =>
      engine.result("마감은 금요일입니다.", "다음 문장도 듣고 있어요"),
    );
    assert(
      document
        .querySelector(".live-caption")
        .textContent.includes("다음 문장도 듣고 있어요"),
    );
    await act(async () =>
      resolveCoach(
        Response.json({
          source: "ai",
          suggestion: "다음 주로 조정 가능할까요?",
          evidence: "마감은 금요일입니다.",
          reason: "일정 조율",
        }),
      ),
    );
    assert(
      document
        .querySelector(".live-stream-reply")
        .textContent.includes("다음 주로 조정"),
    );
    await click(button("듣기 멈춤"));
    assert.equal(engine.aborted, true);
    assert(
      document
        .querySelector(".live-caption")
        .textContent.includes("마감은 금요일"),
    );
  } finally {
    await ui.cleanup();
  }
});

test("stopping streaming aborts pending coaching and ignores delayed results", async () => {
  const ui = await mount(StreamPanel, liveProps, setupSpeech);
  try {
    await click(document.querySelector(".live-speech-consent input"));
    let resolveCoach, signal;
    global.fetch = async (url, init) => {
      signal = init.signal;
      return new Promise((r) => {
        resolveCoach = r;
      });
    };
    await click(button("실시간 듣기 시작"));
    await act(async () =>
      StreamingRecognizer.instances[0].result("테스트 일정 조율 문장"),
    );
    await act(async () => new Promise((r) => setTimeout(r, 720)));
    await click(button("듣기 멈춤"));
    assert(signal.aborted);
    await act(async () =>
      resolveCoach(
        Response.json({ source: "ai", suggestion: "늦게 도착한 제안" }),
      ),
    );
    assert(!document.body.textContent.includes("늦게 도착한 제안"));
  } finally {
    await ui.cleanup();
  }
});

test("live speech denial and backgrounding stop recognition with recovery guidance", async () => {
  const ui = await mount(StreamPanel, liveProps, setupSpeech);
  try {
    await click(document.querySelector(".live-speech-consent input"));
    await click(button("실시간 듣기 시작"));
    const first = StreamingRecognizer.instances[0];
    await act(async () => first.onerror({ error: "not-allowed" }));
    assert(first.aborted);
    assert(document.body.textContent.includes("권한이 필요"));
    await click(button("실시간 듣기 시작"));
    const second = StreamingRecognizer.instances[1];
    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    });
    await act(async () =>
      document.dispatchEvent(new window.Event("visibilitychange")),
    );
    assert(second.aborted);
    assert(document.body.textContent.includes("화면을 벗어나 듣기를 멈췄어요"));
  } finally {
    await ui.cleanup();
  }
});

test("supported browser defaults to streaming while retaining short-recording and text fallback", async () => {
  const ui = await mount(
    LiveCoach,
    { onBack: () => {}, onDemo: () => {} },
    setupSpeech,
  );
  try {
    for (const c of document.querySelectorAll(
      ".vn-consent input, .dc-permissions input",
    ))
      await click(c);
    await click(button("이 설정으로 시작"));
    assert(button("실시간 듣기 시작"));
    await click(button("짧게 녹음 · 직접 입력"));
    assert(button("상대 말 4초 듣기"));
    await click(
      [
        ...document.querySelectorAll(".dc-listen-panel .dc-mode-switch button"),
      ].find((b) => b.textContent.trim() === "직접 입력"),
    );
    assert(document.querySelector("#live-text"));
  } finally {
    await ui.cleanup();
  }
});

test("recording in sample mode can switch to AI and consent inline without losing the clip", async () => {
  let calls = 0;
  function Example() {
    const [sample, setSample] = React.useState(true);
    const [consent, setConsent] = React.useState(false);
    return React.createElement(Composer, {
      config,
      consent,
      sampleMode: sample,
      onEnableAI: () => setSample(false),
      onConsentChange: setConsent,
      submitDisabled: !sample && !consent,
      textFirst: true,
      onUse() {},
    });
  }
  const ui = await mount(Example);
  try {
    global.fetch = async () => {
      calls++;
      return Response.json({ text: "검토 가능한 시간을 알려주세요." });
    };
    await click(button("눌러서 말하기"));
    await click(button("녹음 끝내기"));
    assert.equal(calls, 0);
    const audio = document.querySelector("audio"),
      source = audio.src;
    assert.equal(button("문자로 바꾸기"), undefined);
    assert(document.body.textContent.includes("샘플 모드에서는"));
    await click(button("AI 모드로 전환"));
    assert.equal(
      button("문자로 바꾸기"),
      undefined,
      "consent instruction replaces an ineffective retry button",
    );
    assert.equal(document.querySelector("audio").src, source);
    assert.equal(calls, 0);
    await click(
      document.querySelector(".vn-transcription-help .vn-consent input"),
    );
    await click(button("문자로 바꾸기"));
    assert.equal(calls, 1);
    assert.equal(
      document.querySelector("textarea").value,
      "검토 가능한 시간을 알려주세요.",
    );
    assert.equal(document.querySelector("audio").src, source);
  } finally {
    await ui.cleanup();
  }
});

test("audio replay explicitly rewinds ended media and retains the source across metadata updates", async () => {
  const clip = {
    blob: new Blob(["fake-audio"], { type: "audio/mp4" }),
    duration: 4,
    peaks: [0.5],
    name: "recording",
  };
  const ui = await mount(player.default, { clip });
  try {
    const audio = document.querySelector("audio"),
      source = audio.src;
    let starts = [];
    Object.defineProperty(audio, "paused", {
      configurable: true,
      value: false,
    });
    Object.defineProperty(audio, "ended", { configurable: true, value: true });
    audio.currentTime = 4;
    audio.play = async () => {
      starts.push(audio.currentTime);
    };
    await click(button("음성 재생"));
    assert.deepEqual(starts, [0]);
    audio.currentTime = 4;
    await act(async () => audio.dispatchEvent(new window.Event("ended")));
    assert.equal(audio.currentTime, 0);
    assert(document.querySelector(".vn-time").textContent.startsWith("0:00"));
    await act(async () =>
      ui.root.render(
        React.createElement(player.default, {
          clip: {
            ...clip,
            transcription: {
              version: 1,
              parts: ["말"],
              total: 1,
              complete: true,
            },
          },
        }),
      ),
    );
    assert.equal(document.querySelector("audio").src, source);
    await click(button("기본 재생기 열기"));
    assert.equal(audio.controls, true);
  } finally {
    await ui.cleanup();
  }
});

async function quickChange(selector, value) {
  const element = document.querySelector(selector);
  assert(element, selector);
  await act(async () => {
    require("react-dom/test-utils").Simulate.change(element, {
      target: { value },
    });
  });
}

test("immediate help shows text before consent and sends a neutral grounded context without a sales assumption", async () => {
  const ui = await mount(LiveCoach, {
    directEntry: true,
    onBack() {},
    onDemo() {},
  });
  try {
    assert(document.querySelector("#live-text"));
    assert(!document.querySelector(".dc-preflight"));
    assert(button("답변 코칭받기").disabled);
    assert(!document.body.textContent.includes("작업을 취소"));
    await quickChange("#live-text", "왜 약속을 변경하자는 거야?");
    assert(button("답변 코칭받기").disabled);
    await click(document.querySelector(".vn-consent input"));
    let payload;
    global.fetch = async (url, init) => {
      assert.equal(url, "/api/coach");
      payload = JSON.parse(init.body);
      return Response.json({
        suggestion: "가능한 시간을 함께 정해볼까?",
        evidence: "왜 약속을 변경하자는 거야?",
        reason: "일정 확인",
        source: "ai",
        latencyMs: 1,
      });
    };
    await click(button("답변 코칭받기"));
    assert.equal(payload.opponent, "왜 약속을 변경하자는 거야?");
    assert.equal(payload.context.situation, payload.opponent);
    assert.equal(payload.context.partner, "대화 상대");
    assert.equal(
      payload.context.goal,
      "상대의 뜻을 확인하고 내 입장을 차분히 전달하기",
    );
    assert.equal(payload.consent, true);
    assert.doesNotMatch(JSON.stringify(payload.context), /영업|업무|보고서/);
    require("../lib/conversation-cards.ts").parseProfile(payload.context);
    assert(
      document
        .querySelector(".dc-answer-panel")
        .textContent.includes("가능한 시간을"),
    );
    await click(button("다음 말 준비"));
    assert.equal(document.querySelector("#live-text").value, "");
    assert(
      document
        .querySelector(".live-recent-cues")
        .textContent.includes("가능한 시간을"),
    );
  } finally {
    await ui.cleanup();
  }
});

test("loading a saved situation and changing a goal preserves typed words; offline sample is explicit and makes no AI request", async () => {
  const card = {
    ...require("../lib/starter-data.ts").requestCards[1],
    isSample: false,
  };
  const ui = await mount(
    LiveCoach,
    { directEntry: true, savedProfiles: [card], onBack() {}, onDemo() {} },
    () => {
      global.fetch = async () =>
        Response.json({
          available: false,
          voiceAvailable: false,
          sampleOnly: true,
        });
    },
  );
  try {
    const text = "왜 약속을 변경하자는 건데?";
    await quickChange("#live-text", text);
    await quickChange(".quick-context select", card.id);
    assert.equal(document.querySelector("#live-text").value, text);
    assert(
      document.querySelector(".quick-context").textContent.includes(card.title),
    );
    await click(button("시간을 조율하고 싶어요"));
    assert.equal(document.querySelector("#live-text").value, text);
    let calls = 0;
    global.fetch = async () => {
      calls++;
      throw new Error("must not call AI");
    };
    const sampleToggle = document.querySelector(".quick-sample-option input");
    assert.equal(sampleToggle.closest("details"), null);
    assert.match(
      sampleToggle.closest("label").textContent,
      /AI 없이 샘플 체험하기/,
    );
    await click(sampleToggle);
    const dialog = document.querySelector("dialog[open]");
    assert(dialog);
    assert.match(dialog.textContent, /입력하신 대화에 대한 추천이 아니/);
    await quickChange("dialog[open] select", "friend-schedule");
    assert.match(dialog.textContent, /친구와 약속 조정/);
    assert.equal(calls, 0);
    assert.equal(document.querySelector("#live-text").value, text);
    assert.equal(
      document.querySelector(".dc-answer-panel .dc-sample-notice"),
      null,
    );
    await click(button("내 대화로 돌아가기"));
    assert.equal(sampleToggle.checked, false);
    await click(button("기본 목표로 되돌리기"));
    assert.equal(document.querySelector("#live-text").value, text);
    assert(!document.querySelector(".dc-answer-panel.is-ready"));
    assert.equal(
      document.querySelector(".live-recent-cues"),
      null,
      "Viewing a sample must not add a recommendation to my history",
    );
    assert(button("답변 코칭받기").disabled);
  } finally {
    await ui.cleanup();
  }
});

test("failed configuration can be retried without losing direct input or bypassing consent", async () => {
  const ui = await mount(
    LiveCoach,
    { directEntry: true, onBack() {}, onDemo() {} },
    () => {
      global.fetch = async () => {
        throw new Error("offline");
      };
    },
  );
  try {
    await quickChange("#live-text", "이 말을 어떻게 답할까요?");
    assert(button("연결 다시 확인"));
    global.fetch = async () => Response.json(config);
    await click(button("연결 다시 확인"));
    assert.equal(
      document.querySelector("#live-text").value,
      "이 말을 어떻게 답할까요?",
    );
    assert(button("답변 코칭받기").disabled);
    await click(document.querySelector(".vn-consent input"));
    assert(!button("답변 코칭받기").disabled);
    await click(button("동의 철회"));
    assert(document.querySelector("#live-text"));
    assert.equal(
      document.querySelector("#live-text").value,
      "이 말을 어떻게 답할까요?",
    );
    assert(button("답변 코칭받기").disabled);
  } finally {
    await ui.cleanup();
  }
});

test("microphone denial retains typed words and direct input remains available", async () => {
  const ui = await mount(LiveCoach, {
    directEntry: true,
    onBack() {},
    onDemo() {},
  });
  try {
    await quickChange("#live-text", "내가 입력한 상대의 말");
    await click(document.querySelector(".vn-consent input"));
    navigator.mediaDevices.getUserMedia = async () => {
      throw new Error("마이크 권한을 확인해 주세요.");
    };
    await click(button("들려주기"));
    await click(button("상대 말 4초 듣기"));
    assert.equal(
      document.querySelector("#live-text").value,
      "내가 입력한 상대의 말",
    );
    assert(
      document
        .querySelector("[role=alert]")
        .textContent.includes("마이크 권한"),
    );
    await click(button("직접 입력"));
    assert(!button("답변 코칭받기").disabled);
  } finally {
    await ui.cleanup();
  }
});

test("QA P05 keeps opponent, partner, goal, situation and boundaries independent through request and history", async () => {
  const ui = await mount(LiveCoach, {
    directEntry: true,
    onBack() {},
    onDemo() {},
  });
  try {
    const opponent = "왜 이제 약속을 바꾸자는 거야?";
    const fields = {
      partner: "친구",
      goal: "가능한 시간을 물어보고 약속을 다시 정하기",
      situation: "주말에 만나기로 했지만 일정을 바꿔야 하는 가상 상황",
      boundaries: "확정하지 않은 날짜는 약속하지 않기",
    };
    await quickChange("#live-text", opponent);
    document.querySelector(".quick-context").open = true;
    for (const [key, value] of Object.entries(fields)) {
      const field = document.querySelector(`[name="${key}"]`);
      field.focus();
      await quickChange(`[name="${key}"]`, value);
      assert.equal(document.activeElement, field, `focus stays in ${key}`);
      assert.equal(document.querySelector("#live-text").value, opponent);
    }
    for (const [key, value] of Object.entries(fields))
      assert.equal(document.querySelector(`[name="${key}"]`).value, value);
    await click(document.querySelector(".vn-consent input"));
    let payload;
    global.fetch = async (url, init) => {
      payload = JSON.parse(init.body);
      return Response.json({
        suggestion: "미안해, 언제가 괜찮을까?",
        evidence: opponent,
        reason: "시간 조율",
        source: "ai",
        latencyMs: 1,
      });
    };
    await click(button("답변 코칭받기"));
    assert.equal(payload.opponent, opponent);
    for (const [key, value] of Object.entries(fields))
      assert.equal(payload.context[key], value);
    assert.equal(document.querySelector("#live-text").value, opponent);
    await click(button("다음 말 준비"));
    const history = document.querySelector(".live-recent-cues").textContent;
    assert(history.includes(opponent));
    assert(!history.includes(opponent + fields.partner));
  } finally {
    await ui.cleanup();
  }
});

test("QA microphone waiting can be cancelled into typing and late permission cannot start recording", async () => {
  let resolveMedia,
    stopped = 0;
  const ui = await mount(
    Composer,
    { config, consent: true, textFirst: true, onUse() {} },
    () => {
      navigator.mediaDevices.getUserMedia = () =>
        new Promise((resolve) => {
          resolveMedia = resolve;
        });
    },
  );
  try {
    await quickChange("textarea", "보존할 초안");
    await click(button("눌러서 말하기"));
    assert(button("기다리지 않고 직접 입력"));
    await click(button("기다리지 않고 직접 입력"));
    assert.equal(document.querySelector("textarea").disabled, false);
    assert.equal(document.querySelector("textarea").value, "보존할 초안");
    await act(async () =>
      resolveMedia({
        getTracks: () => [
          {
            stop() {
              stopped++;
            },
          },
        ],
      }),
    );
    assert.equal(instances.length, 0);
    assert.equal(stopped, 1);
    assert.equal(button("눌러서 말하기").disabled, false);
  } finally {
    await ui.cleanup();
  }
});

test("QA microphone unanswered permission expires and preserves typing, with late stream cleanup", async (t) => {
  let resolveMedia,
    stopped = 0;
  const ui = await mount(
    Composer,
    { config, consent: true, textFirst: true, onUse() {} },
    () => {
      navigator.mediaDevices.getUserMedia = () =>
        new Promise((resolve) => {
          resolveMedia = resolve;
        });
    },
  );
  try {
    await quickChange("textarea", "초안 유지");
    t.mock.timers.enable({ apis: ["setTimeout"] });
    await click(button("눌러서 말하기"));
    await act(async () => t.mock.timers.tick(15001));
    assert(
      document
        .querySelector('[role="alert"]')
        .textContent.includes("마이크 권한 응답을 기다리다 중단"),
    );
    assert.equal(document.querySelector("textarea").disabled, false);
    assert.equal(document.querySelector("textarea").value, "초안 유지");
    await act(async () =>
      resolveMedia({
        getTracks: () => [
          {
            stop() {
              stopped++;
            },
          },
        ],
      }),
    );
    assert.equal(instances.length, 0);
    assert.equal(stopped, 1);
  } finally {
    t.mock.timers.reset();
    await ui.cleanup();
  }
});

test("daily quota failure preserves the money request and never substitutes an authored refusal", async () => {
  const profile = {
    ...require("../lib/conversation-cards.ts").emptyProfile(),
    title: "친구의 부탁",
    partner: "친구",
    situation: "친구에게 부탁받은 상황",
    goal: "부탁을 정중하게 거절하기",
    boundaries: "나중에 도와주겠다고 약속하지 않기",
  };
  const ui = await mount(LiveCoach, { onBack() {}, onDemo() {}, profile });
  try {
    for (const c of document.querySelectorAll(
      ".vn-consent input, .dc-permissions input",
    ))
      await click(c);
    await click(button("이 설정으로 시작"));
    let calls = 0;
    global.fetch = async () => {
      calls++;
      return Response.json(
        { code: "provider_rate_limit", quotaKind: "daily", retryAfter: 60 },
        { status: 429 },
      );
    };
    await click(button("직접 입력"));
    const input = document.querySelector("#live-text");
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      ).set.call(input, "이번에 돈을 조금 빌려줄 수 있어?");
      input.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    await click(button("답변 코칭받기"));
    const answer = document.querySelector(".dc-answer-panel");
    assert.equal(answer.querySelector("blockquote"), null);
    assert.equal(answer.querySelector(".dc-sample-notice"), null);
    assert.match(document.body.textContent, /베타테스트 AI 이용량을 모두 사용/);
    assert.match(document.body.textContent, /샘플로 자동 전환하지 않아요/);
    assert.equal(input.value, "이번에 돈을 조금 빌려줄 수 있어?");
    assert.equal(calls, 1);
  } finally {
    await ui.cleanup();
  }
});

test("live settings cannot start with speech consent alone; the selected context and output regions stay distinct", async () => {
  const profile = require("../lib/starter-data.ts").requestCards[1];
  const ui = await mount(
    StreamPanel,
    { ...liveProps, profile, consent: false },
    setupSpeech,
  );
  try {
    assert(document.querySelector(".live-stream-guide"));
    assert.match(
      document.querySelector(".live-context-summary").textContent,
      /친구/,
    );
    await click(document.querySelector(".live-speech-consent input"));
    assert(button("실시간 듣기 시작").disabled);
    assert.equal(StreamingRecognizer.instances.length, 0);
    await act(async () =>
      ui.root.render(
        React.createElement(StreamPanel, { ...liveProps, profile }),
      ),
    );
    assert.equal(button("실시간 듣기 시작").disabled, false);
    await click(button("실시간 듣기 시작"));
    assert.equal(
      document.querySelector(".live-speech-consent input").disabled,
      true,
    );
    assert(document.querySelector(".live-stream-workspace .live-caption"));
    assert(
      document.querySelector('.live-stream-workspace [aria-label="답변 코칭"]'),
    );
    await click(button("듣기 멈춤"));
    assert.equal(
      document.querySelector(".live-speech-consent input").disabled,
      false,
    );
  } finally {
    await ui.cleanup();
  }
});
