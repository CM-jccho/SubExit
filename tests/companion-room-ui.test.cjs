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
const { JSDOM } = require("jsdom"),
  React = require("react"),
  { createRoot } = require("react-dom/client"),
  { IDBFactory } = require("fake-indexeddb");
const { act } = React;

const Room = require("../components/CompanionRoom.tsx").default;
const store = require("../lib/voice-notebook.ts"),
  { defaultCompanions } = require("../lib/companions.ts");
async function mountRoom() {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "https://test.local",
    pretendToBeVisual: true,
  });
  const previousFetch = global.fetch;
  global.fetch = async () =>
    new Response(JSON.stringify({ error: "weather_unavailable" }), {
      status: 503,
    });
  global.window = dom.window;
  global.document = window.document;
  global.localStorage = window.localStorage;
  global.indexedDB = new IDBFactory();
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  await store.putSession({
    id: "saved-tori",
    title: "이전 약속 이야기",
    kind: "chat",
    companion: defaultCompanions[2],
    createdAt: "2026-09-16",
    updatedAt: "2026-09-16",
    industry: "",
    turns: [],
  });
  const calls = [];
  const props = {
    saved: [],
    onSaved: () => {},
    onChat: (c) => calls.push(["chat", c.id]),
    onSession: (id) => calls.push(["session", id]),
    onCards: () => calls.push(["cards"]),
  };
  const root = createRoot(document.getElementById("root"));
  await act(async () => {
    root.render(React.createElement(Room, props));
  });
  for (let i = 0; i < 3; i++)
    await act(async () => new Promise((r) => setTimeout(r, 8)));
  return {
    calls,
    cleanup: async () => {
      await act(async () => root.unmount());
      global.fetch = previousFetch;
      dom.window.close();
    },
  };
}
const click = async (label) => {
  const el = [...document.querySelectorAll("button")].find(
    (b) =>
      b.getAttribute("aria-label") === label || b.textContent.trim() === label,
  );
  assert(el, `missing ${label}`);
  await act(async () => el.click());
};
test("selecting a friend immediately opens their card, switches friends in place and routes to the right record", async () => {
  const ui = await mountRoom();
  try {
    assert.equal(document.querySelector("dialog[open]"), null);
    await click("토리 선택");
    const dialog = document.querySelector("dialog[open]");
    assert(dialog);
    assert.equal(dialog.querySelector("h2").textContent, "토리");
    assert.equal(document.activeElement.id, "room-card-name");
    assert.equal(document.body.style.overflow, "hidden");
    const history = dialog.querySelector(".dc-room-history button");
    assert(history.textContent.includes("이전 약속 이야기"));
    await act(async () => history.click());
    assert.deepEqual(ui.calls.pop(), ["session", "saved-tori"]);
    await click("다음 친구");
    assert.equal(dialog.querySelector("h2").textContent, "코코");
    assert.equal(dialog.querySelector(".dc-room-history"), null);
    await click("지금 이야기하기");
    assert.deepEqual(ui.calls.pop(), ["chat", "coco"]);
    await click("AI 대화 상대로 돌아가기");
    assert.equal(document.querySelector("dialog[open]"), null);
    assert.equal(document.body.style.overflow, "");
    assert.equal(
      document.activeElement.getAttribute("aria-label"),
      "코코 선택",
    );
  } finally {
    await ui.cleanup();
  }
});
test("Escape closes the card and edit cancel returns to one open card without leaving scroll locked", async () => {
  const ui = await mountRoom();
  try {
    await click("두리 선택");
    await act(async () =>
      document
        .querySelector("dialog[open]")
        .dispatchEvent(
          new window.Event("cancel", { bubbles: true, cancelable: true }),
        ),
    );
    assert.equal(document.querySelector("dialog[open]"), null);
    assert.equal(document.body.style.overflow, "");
    await click("모아 선택");
    await click("모아 설정 바꾸기");
    assert.equal(document.querySelectorAll("dialog[open]").length, 1);
    assert(document.querySelector(".dc-character-editor[open]"));
    await click("캐릭터 설정 닫기");
    assert.equal(document.querySelectorAll("dialog[open]").length, 1);
    assert.equal(
      document.querySelector(".dc-room-dialog h2").textContent,
      "모아",
    );
    await click("AI 대화 상대로 돌아가기");
    assert.equal(document.body.style.overflow, "");
  } finally {
    await ui.cleanup();
  }
});

test("room shows weather failure honestly and preserves motion settings while preview stays temporary", async () => {
  const ui = await mountRoom();
  try {
    const stage = document.querySelector(".dc-room-environment");
    assert.equal(stage.dataset.weather, "unknown");
    assert(document.body.textContent.includes("날씨 연결이 잠시 어려워요"));
    const [city, preview] = document.querySelectorAll(
      ".dc-room-settings select",
    );
    await act(async () => {
      preview.value = "night";
      preview.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    assert.equal(stage.dataset.period, "night");
    assert(document.body.textContent.includes("밤 분위기 미리보기"));
    await act(async () =>
      document.querySelector(".dc-room-motion-toggle input").click(),
    );
    assert.equal(stage.dataset.motion, "off");
    await act(async () => {
      city.value = "busan";
      city.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    assert(document.body.textContent.includes("부산 기준"));
    assert.deepEqual(
      JSON.parse(localStorage.getItem("ddeundeun-room-settings-v1")),
      { version: 1, city: "busan", motion: false },
    );
  } finally {
    await ui.cleanup();
  }
});
