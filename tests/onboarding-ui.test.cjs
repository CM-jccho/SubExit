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
const {
  SearchParamsContext,
} = require("next/dist/shared/lib/hooks-client-context.shared-runtime");
const Workspace = require("../components/ConversationWorkspace.tsx").default;
const { TOUR_KEY } = require("../components/FirstConversation.tsx");
test("first-run spotlight navigates actual screens, finishes without AI calls, and stays dismissed on revisit", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://test.local" });
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = window.localStorage;
  global.indexedDB = new IDBFactory();
  global.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(global, "navigator", {
    value: window.navigator,
    configurable: true,
  });
  global.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  global.cancelAnimationFrame = clearTimeout;
  window.scrollTo = () => {};
  window.matchMedia = () => ({ matches: true });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLElement.prototype.getBoundingClientRect = () => ({
    left: 20,
    top: 100,
    width: 300,
    height: 100,
    bottom: 200,
    right: 320,
  });
  window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  const calls = [];
  global.fetch = async (...args) => {
    calls.push(args);
    return Response.json({
      available: false,
      voiceAvailable: false,
      sampleOnly: true,
    });
  };
  const render = async () => {
    const root = createRoot(document.getElementById("root"));
    await act(async () =>
      root.render(
        React.createElement(
          SearchParamsContext.Provider,
          { value: new URLSearchParams() },
          React.createElement(Workspace),
        ),
      ),
    );
    await settle();
    return root;
  };
  const settle = async () => {
    for (let i = 0; i < 3; i++)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 8));
      });
  };
  const click = async (selector) => {
    const el = document.querySelector(selector);
    assert(el, "missing " + selector);
    assert(!el.disabled);
    await act(async () => el.click());
    await settle();
  };
  let root = await render();
  assert.equal(document.querySelector("dialog[open]"), null);
  assert.equal(document.querySelectorAll(".dc-saved-card").length, 0);
  await click('button[data-purpose="library"]');
  await click('button[data-focus="work"]');
  assert(document.querySelector("dialog[open]"));
  assert.equal(
    document.querySelectorAll(".dc-starter-section .dc-saved-card").length,
    1,
  );
  await click(".dc-spotlight-hit");
  assert(document.querySelector('[data-tour="conversation-goal"]'));
  assert(document.body.textContent.includes("팀장님과 마감 조율"));
  await click(".dc-spotlight-controls .dd-primary");
  assert(document.querySelector('[data-tour="practice-button"]'));
  await click(".dc-spotlight-hit");
  assert(document.querySelector('[data-tour="practice-settings"]'));
  await click(".dc-spotlight-controls .dd-primary");
  assert.equal(document.querySelector("dialog[open]"), null);
  assert.equal(localStorage.getItem(TOUR_KEY), "seen");
  assert(
    calls.every(([url, options]) => url === "/api/coach" && !options.method),
  );
  await act(async () => root.unmount());
  root = await render();
  assert.equal(document.querySelector("dialog[open]"), null);
  assert.equal(window.location.search, "?view=records");
  assert.equal(document.querySelector("h1").textContent, "내 기록");
  await click('button[aria-label="곁말 홈"]');
  assert.equal(document.querySelectorAll("[data-purpose]").length, 3);
  assert.equal(document.querySelector('[aria-label="대화 맥락 선택"]'), null);
  await click('button[aria-label="첫 사용 가이드 다시 보기"]');
  assert(document.querySelector("dialog[open]"));
  await act(async () =>
    document
      .querySelector("dialog")
      .dispatchEvent(new window.Event("cancel", { cancelable: true })),
  );
  assert.equal(document.querySelector("dialog[open]"), null);
  assert.equal(document.body.style.overflow, "");
  await act(async () => root.unmount());
  dom.window.close();
});
