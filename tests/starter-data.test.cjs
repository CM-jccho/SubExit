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
const cards = require("../lib/conversation-cards.ts");
const store = require("../lib/voice-notebook.ts");
const starter = require("../lib/starter-data.ts");
function fresh() {
  global.indexedDB = new IDBFactory();
  const memory = new Map();
  global.localStorage = {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => memory.set(k, v),
    removeItem: (k) => memory.delete(k),
  };
  return memory;
}
test("first visit seeds once, preserves personal data, and does not resurrect deleted samples", async () => {
  fresh();
  const personal = {
    ...starter.starterCards[0],
    id: "card-my-existing",
    isSample: undefined,
    title: "내가 저장한 카드",
  };
  localStorage.setItem(
    cards.CARD_KEY,
    JSON.stringify({ version: 1, cards: [personal] }),
  );
  await Promise.all([starter.seedStarterData(), starter.seedStarterData()]);
  assert.equal(cards.readCards().length, 8);
  assert.equal((await store.listSessions()).length, 6);
  assert.equal((await store.listTerms()).length, 3);
  const edited = cards
    .readCards()
    .map((c) => (c.id === personal.id ? { ...c, goal: "내 목표 그대로" } : c));
  cards.writeCards(edited.filter((c) => c.id !== starter.starterCards[0].id));
  await store.deleteSession(starter.starterSession.id);
  await store.deleteTerm(starter.starterTerms[0].id);
  await starter.seedStarterData();
  assert.equal(cards.readCards().length, 7);
  assert.equal(
    cards.readCards().find((c) => c.id === personal.id).goal,
    "내 목표 그대로",
  );
  assert.equal((await store.listSessions()).length, 5);
  assert.equal((await store.listTerms()).length, 2);
});
test("explicit sample restore only fills missing IDs and preserves edited samples and personal records", async () => {
  fresh();
  await starter.seedStarterData();
  cards.saveCard(
    { ...starter.starterCards[0], title: "내가 고친 샘플" },
    "manual",
    starter.starterCards[0].id,
  );
  await store.putTerm({
    ...starter.starterTerms[0],
    memo: "우리 팀에서 고친 내용",
  });
  await store.deleteTerm(starter.starterTerms[1].id);
  await store.putSession({
    ...starter.starterSession,
    id: "session-personal",
    isSample: false,
    title: "내 녹음",
  });
  await starter.seedStarterData(true);
  assert.equal(
    cards.readCards().find((c) => c.id === starter.starterCards[0].id).title,
    "내가 고친 샘플",
  );
  assert.equal(
    (await store.listTerms()).find((t) => t.id === starter.starterTerms[0].id)
      .memo,
    "우리 팀에서 고친 내용",
  );
  assert.equal((await store.listTerms()).length, 3);
  assert.equal(
    (await store.listSessions()).find((s) => !s.isSample).title,
    "내 녹음",
  );
});
test("upgrading the existing audio database preserves original Blob and text", async () => {
  fresh();
  const original = {
    ...starter.starterSession,
    id: "session-existing",
    isSample: false,
    turns: [
      {
        id: "old-turn",
        role: "recording",
        text: "기존 음성 문자",
        createdAt: "2026-01-01",
        terms: [],
        clip: {
          blob: new Blob(["original-audio"], { type: "audio/wav" }),
          duration: 2,
          peaks: [0.1, 0.7],
          name: "original.wav",
        },
      },
    ],
  };
  await new Promise((resolve, reject) => {
    const r = indexedDB.open("ddeundeun-voice-notebook-v1", 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("sessions", { keyPath: "id" });
      r.result.createObjectStore("terms", { keyPath: "id" });
    };
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const db = r.result,
        tx = db.transaction("sessions", "readwrite");
      tx.objectStore("sessions").put(original);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    };
  });
  await starter.seedStarterData();
  const kept = await store.getSession("session-existing");
  assert.equal(kept.turns[0].text, "기존 음성 문자");
  assert.equal(await kept.turns[0].clip.blob.text(), "original-audio");
  assert.deepEqual(kept.turns[0].clip.peaks, [0.1, 0.7]);
});
test("sample initialization never overwrites malformed or newer-version card data", async () => {
  fresh();
  for (const raw of [
    "{broken",
    JSON.stringify({ version: 2, cards: [] }),
    JSON.stringify({ version: 1, cards: [{ id: "unreadable" }] }),
  ]) {
    localStorage.setItem(cards.CARD_KEY, raw);
    await assert.rejects(starter.seedStarterData());
    assert.equal(localStorage.getItem(cards.CARD_KEY), raw);
  }
});
test("full card storage keeps all 100 personal cards without sample eviction", () => {
  fresh();
  const full = Array.from({ length: 100 }, (_, i) => ({
    ...starter.starterCards[0],
    id: "card-user-" + i,
    isSample: false,
  }));
  localStorage.setItem(
    cards.CARD_KEY,
    JSON.stringify({ version: 1, cards: full }),
  );
  starter.seedCards();
  assert.equal(cards.readCards().length, 100);
  assert(cards.readCards().every((c) => !c.isSample));
});
test("failed initial write remains retryable, and copied sample becomes a personal card", async () => {
  fresh();
  const write = localStorage.setItem;
  localStorage.setItem = () => {
    throw new Error("quota");
  };
  await assert.rejects(starter.seedStarterData(), /quota/);
  localStorage.setItem = write;
  await starter.seedStarterData();
  const saved = cards.saveCard(
    { ...starter.starterCards[0], title: "내 대화로 복사" },
    "manual",
  );
  assert.equal(saved.length, 8);
  assert.equal(saved[0].isSample, undefined);
});
