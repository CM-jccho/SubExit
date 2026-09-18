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
test("help preserves the current screen; the walkthrough runs only when requested and makes no AI calls", async () => {
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
    await act(async () => {
      el.focus();
      el.click();
    });
    await settle();
  };
  let root = await render();
  assert.equal(document.querySelector("dialog[open]"), null);
  assert.equal(document.querySelectorAll(".dc-saved-card").length, 0);
  await click('button[data-purpose="library"]');
  await click('button[data-focus="work"]');
  assert.equal(
    document.querySelector("dialog[open]"),
    null,
    "choosing a focus must not force a walkthrough",
  );
  assert.equal(document.querySelector('[aria-label="대화 검색"]'), null);
  await click('.focus-list-filters button[aria-pressed="false"]');
  const libraryUrl = window.location.href;
  const search = document.querySelector('[aria-label="대화 검색"]');
  const { Simulate } = require("react-dom/test-utils");
  await act(async () => Simulate.change(search, { target: { value: "마감" } }));
  await click('button[aria-label="이 화면 사용법"]');
  assert.equal(window.location.href, libraryUrl);
  assert.equal(
    document.querySelector('[aria-label="대화 검색"]').value,
    "마감",
  );
  assert.match(
    document.querySelector(".screen-help").textContent,
    /연습할 상황을 골라주세요/,
  );
  assert.equal(document.querySelectorAll(".screen-help .dd-primary").length, 1);
  assert.equal(document.querySelector(".dc-spotlight-hit"), null);
  assert.equal(document.querySelectorAll(".screen-help button").length, 1);
  await click(".screen-help .dd-primary");
  assert.equal(document.querySelector("dialog[open]"), null);
  assert.equal(
    document.querySelector('[aria-label="대화 검색"]').value,
    "마감",
  );
  assert.equal(
    document.activeElement.getAttribute("aria-label"),
    "이 화면 사용법",
  );
  await click(".dc-nav button:last-child");
  const guide = [...document.querySelectorAll("button")].find((b) =>
    b.textContent.includes("사용·저장 안내"),
  );
  await act(async () => guide.click());
  await settle();
  await click(".dc-guide-tour");
  assert(document.querySelector(".practice-walkthrough[open]"));
  await click(".practice-walkthrough .dd-primary");
  assert(document.querySelector('[data-tour="conversation-goal"]'));
  assert(document.body.textContent.includes("팀장님과 마감 조율"));
  await click(".practice-walkthrough .dd-primary");
  assert(document.querySelector('[data-tour="practice-button"]'));
  await click(".practice-walkthrough .dd-primary");
  assert(document.querySelector('[data-tour="practice-settings"]'));
  await click(".practice-walkthrough .dd-primary");
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
  await click('button[aria-label="스픽코칭 홈"]');
  assert.equal(document.querySelectorAll("[data-purpose]").length, 3);
  assert.equal(document.querySelector('[aria-label="대화 맥락 선택"]'), null);
  const homeUrl = window.location.href;
  await click('button[aria-label="이 화면 사용법"]');
  assert.equal(window.location.href, homeUrl);
  assert.match(
    document.querySelector(".screen-help").textContent,
    /어떤 도움이 필요하세요/,
  );
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
