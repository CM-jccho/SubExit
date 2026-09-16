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
    for (const c of document.querySelectorAll("input[type=checkbox]"))
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
    assert(document.body.textContent.includes("요청 한도"));
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
    for (const c of document.querySelectorAll("input[type=checkbox]"))
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
