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
const { IDBFactory } = require("fake-indexeddb");
const g = require("../lib/practice-garden.ts"),
  store = require("../lib/voice-notebook.ts"),
  { exampleProfile } = require("../lib/conversation-cards.ts");
function session(id = "session-garden") {
  return {
    id,
    kind: "practice",
    title: "부탁 연습",
    context: exampleProfile,
    industry: "",
    createdAt: "2026-09-16T00:00:00Z",
    updatedAt: "2026-09-16T00:00:00Z",
    turns: [
      { id: "a1", role: "assistant", text: "언제 필요하세요?", terms: [] },
      { id: "u1", role: "user", text: "내일까지 부탁합니다.", terms: [] },
      { id: "a2", role: "assistant", text: "어떤 부분인가요?", terms: [] },
      { id: "u2", role: "user", text: "전체를 봐 주세요.", terms: [] },
    ],
  };
}
function reflect(s) {
  return {
    ...s,
    gardenReflection: {
      turnId: "u2",
      original: s.turns[3].text,
      rewrite: "제안서의 일정 부분만 검토해 주실 수 있을까요?",
    },
  };
}
test("three quests earn six droplets, copied context and repeated writes earn nothing", async () => {
  global.indexedDB = new IDBFactory();
  const s = session();
  await store.putSession(s);
  assert.equal((await store.readGarden()).earned, 2);
  await Promise.all(Array.from({ length: 6 }, () => store.putSession(s)));
  assert.equal((await store.readGarden()).earned, 2);
  const r = reflect(s);
  await store.putSession(r);
  assert.equal((await store.readGarden()).earned, 3);
  const drill = g.reflectionDrill(r);
  await store.putSession(drill);
  assert.equal((await store.readGarden()).earned, 3);
  drill.turns.push({
    id: "new",
    role: "user",
    text: "이번에는 일정 부분만 확인 부탁드려요.",
    terms: [],
  });
  await store.putSession(drill);
  assert.equal((await store.readGarden()).earned, 6);
  const again = g.reflectionDrill(r);
  again.turns.push({
    id: "other",
    role: "user",
    text: "가능한 시간을 알려 주세요.",
    terms: [],
  });
  await store.putSession(again);
  assert.equal((await store.readGarden()).earned, 6);
});
test("samples, empty messages, unchanged rewrites and unchanged retries do not earn rewards", () => {
  const s = session();
  assert.equal(
    g.earnGarden(g.emptyGarden(), { ...s, isSample: true }).earned,
    0,
  );
  assert.equal(g.earnGarden(g.emptyGarden(), { ...s, kind: "chat" }).earned, 0);
  assert.equal(
    g.earnGarden(g.emptyGarden(), {
      ...s,
      turns: s.turns.map((t) => ({ ...t, text: " " })),
    }).earned,
    0,
  );
  const unchanged = {
    ...s,
    gardenReflection: {
      turnId: "u2",
      original: s.turns[3].text,
      rewrite: s.turns[3].text,
    },
  };
  assert.equal(g.validReflection(unchanged), false);
  const r = reflect(s),
    drill = g.reflectionDrill(r);
  drill.turns.push({
    id: "same",
    role: "user",
    text: r.gardenReflection.original,
    terms: [],
  });
  assert.equal(g.earnGarden(g.emptyGarden(), drill).earned, 0);
  const changed = reflect(s);
  changed.turns = changed.turns.map((t) =>
    t.id === "u2" ? { ...t, text: "変更" } : t,
  );
  assert.equal(g.validReflection(changed), false);
});
test("atomic purchases prevent overspending, ownership survives reload and growth never decreases", async () => {
  global.indexedDB = new IDBFactory();
  await store.putSession(session());
  const results = await Promise.allSettled([
    store.buyGardenItem("clay"),
    store.buyGardenItem("mug"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  let saved = await store.readGarden();
  assert.equal(saved.earned, 2);
  assert.equal(saved.spent, 2);
  const item = saved.owned[0];
  await store.buyGardenItem(item);
  saved = await store.readGarden();
  assert.deepEqual(saved.equipped, []);
  assert.equal(saved.spent, 2);
  await store.buyGardenItem(item);
  assert.deepEqual((await store.readGarden()).equipped, [item]);
  await store.deleteSession("session-garden");
  assert.equal((await store.readGarden()).earned, 2);
  assert.equal(g.gardenStage(24), "꽃 피운 화분");
});
test("sample answer partners do not block rewards for the user's own effort", () => {
  const s = session();
  s.turns[0].sample = { label: "사전 작성 샘플" };
  assert.equal(g.earnGarden(g.emptyGarden(), s).earned, 2);
  s.turns[1].sample = { label: "사전 작성 샘플" };
  assert.equal(g.earnGarden(g.emptyGarden(), s).earned, 0);
});
