const test = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("node:fs");
require.extensions[".ts"] = (m, file) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    file,
  );
const { SpeechStream, LatestCoachQueue } = require("../lib/live-speech.ts");
const tick = async (t, ms) => {
  t.mock.timers.tick(ms);
  await Promise.resolve();
  await Promise.resolve();
};

test("coaching serializes requests, coalesces new speech and respects the six-second interval", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 100000 });
  const calls = [],
    results = [];
  let resolve;
  const q = new LatestCoachQueue({
    generate: (text) => {
      calls.push(text);
      return new Promise((r) => {
        resolve = r;
      });
    },
    result: (r, text) => results.push(text),
    busy: () => {},
    error: assert.fail,
  });
  q.update("첫 문장");
  await tick(t, 650);
  assert.deepEqual(calls, ["첫 문장"]);
  q.update("첫 문장 둘째 문장");
  q.update("첫 문장 둘째 문장 셋째 문장");
  await tick(t, 1000);
  assert.equal(calls.length, 1);
  resolve({});
  await tick(t, 0);
  await tick(t, 1999);
  assert.equal(calls.length, 1);
  await tick(t, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[1], "첫 문장 둘째 문장 셋째 문장");
  q.cancel();
  resolve({});
  await tick(t, 0);
  assert.deepEqual(results, ["첫 문장"]);
});

test("quota or provider errors halt automatic retries without inventing a coaching result", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 100000 });
  let calls = 0,
    errors = 0;
  const q = new LatestCoachQueue({
    generate: async () => {
      calls++;
      throw new Error("quota");
    },
    result: assert.fail,
    busy: () => {},
    error: () => errors++,
  });
  q.update("상대의 말");
  await tick(t, 650);
  q.update("새로 인식된 말");
  await tick(t, 60000);
  assert.equal(calls, 1);
  assert.equal(errors, 1);
  q.cancel();
});

test("speech final revisions are not duplicated and restarting keeps the confirmed context", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const engines = [],
    captions = [],
    errors = [];
  class Engine {
    constructor() {
      engines.push(this);
    }
    start() {
      this.onstart();
    }
    abort() {
      this.aborted = true;
    }
  }
  const speech = new SpeechStream(Engine, {
    caption: (f, i) => captions.push([f, i]),
    state: () => {},
    error: (e) => errors.push(e),
  });
  speech.start();
  const results = [
    { isFinal: true, 0: { transcript: "첫 문장" } },
    { isFinal: false, 0: { transcript: "새 말" } },
  ];
  engines[0].onresult({ results });
  engines[0].onresult({ results });
  assert.deepEqual(captions.at(-1), ["첫 문장", "새 말"]);
  engines[0].onend();
  await tick(t, 300);
  engines[1].onresult({
    results: [{ isFinal: true, 0: { transcript: "둘째 문장" } }],
  });
  assert.deepEqual(captions.at(-1), ["첫 문장 둘째 문장", ""]);
  speech.stop();
  await tick(t, 60000);
  assert.equal(engines.length, 2);
  assert(engines[1].aborted);
  assert.deepEqual(errors, []);
});

test("repeated recognition disconnects stop instead of creating an endless restart loop", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const engines = [],
    errors = [];
  class Engine {
    constructor() {
      engines.push(this);
    }
    start() {
      this.onstart();
    }
    abort() {}
  }
  const speech = new SpeechStream(Engine, {
    caption: () => {},
    state: () => {},
    error: (e) => errors.push(e),
  });
  speech.start();
  for (let i = 0; i < 4; i++) {
    engines[i].onend();
    await tick(t, 300);
  }
  await tick(t, 60000);
  assert.equal(engines.length, 4);
  assert.equal(errors.length, 1);
  speech.stop();
});
