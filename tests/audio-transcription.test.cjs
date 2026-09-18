const test = require("node:test"),
  assert = require("node:assert/strict");
const ts = require("typescript"),
  fs = require("node:fs");
require.extensions[".ts"] = (m, f) =>
  m._compile(
    ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    f,
  );
const {
  encodeMonoWav,
  audioParts,
  transcribeAudio,
} = require("../lib/audio-transcription.ts");
const { importTranscript } = require("../lib/recording-limits.ts");
function setup(t, duration = 100) {
  const before = {
    AudioContext: global.AudioContext,
    OfflineAudioContext: global.OfflineAudioContext,
    fetch: global.fetch,
    now: Date.now,
  };
  const starts = [];
  let closed = 0,
    clock = 100000;
  global.AudioContext = class {
    async decodeAudioData() {
      return { duration };
    }
    async close() {
      closed++;
    }
  };
  global.OfflineAudioContext = class {
    constructor(ch, length, rate) {
      assert.equal(ch, 1);
      assert.equal(rate, 16000);
      this.length = length;
    }
    createBufferSource() {
      return {
        connect() {},
        start(...args) {
          starts.push(args);
        },
      };
    }
    async startRendering() {
      return { getChannelData: () => new Float32Array(this.length) };
    }
  };
  Date.now = () => {
    clock += 6000;
    return clock;
  };
  t.after(() => {
    global.AudioContext = before.AudioContext;
    global.OfflineAudioContext = before.OfflineAudioContext;
    global.fetch = before.fetch;
    Date.now = before.now;
  });
  return { starts, closed: () => closed };
}
const clip = {
  blob: new Blob([new Uint8Array(3000000)], { type: "audio/wav" }),
  duration: 100,
  name: "long.wav",
  peaks: [],
};
test("45-second mono WAV chunks have valid headers, cover full duration and fit the API body limit", async (t) => {
  const state = setup(t);
  const parts = [];
  for await (const p of audioParts(clip, new AbortController().signal))
    parts.push(p);
  assert.deepEqual(
    parts.map((p) => p.total),
    [3, 3, 3],
  );
  assert.deepEqual(state.starts, [
    [0, 0, 45],
    [0, 45, 45],
    [0, 90, 10],
  ]);
  assert(parts.every((p) => p.blob.size < 2400000));
  const bytes = await parts[0].blob.arrayBuffer(),
    d = new DataView(bytes);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "RIFF");
  assert.equal(d.getUint32(24, true), 16000);
  assert.equal(d.getUint16(22, true), 1);
  assert.equal(d.getUint32(40, true), 45 * 16000 * 2);
  assert.equal(state.closed(), 1);
  const pcm = new DataView(
    await encodeMonoWav(new Float32Array([-2, 0, 2])).arrayBuffer(),
  );
  assert.equal(pcm.getInt16(44, true), -32768);
  assert.equal(pcm.getInt16(48, true), 32767);
});
test("long transcription checkpoints partial text and resumes only unfinished audio segments", async (t) => {
  setup(t);
  let calls = 0,
    checkpoint,
    text = "";
  global.fetch = async () => {
    calls++;
    return calls === 2
      ? Response.json({ error: "temporary" }, { status: 400 })
      : Response.json({ text: "첫 구간 원문" });
  };
  const options = {
    signal: new AbortController().signal,
    sampleOnly: true,
    progress: (p, s) => {
      checkpoint = p;
      text = s;
    },
  };
  await assert.rejects(transcribeAudio(clip, options), /temporary/);
  assert.equal(checkpoint.parts.length, 1);
  assert.equal(checkpoint.complete, false);
  assert.equal(text, "첫 구간 원문");
  let resumed = 0;
  global.fetch = async () =>
    Response.json({
      text: ++resumed === 1 ? "둘째 구간 원문" : "마지막 구간 원문",
    });
  const done = await transcribeAudio(
    { ...clip, transcription: checkpoint },
    options,
  );
  assert.equal(resumed, 2);
  assert.equal(done.text, "첫 구간 원문\n둘째 구간 원문\n마지막 구간 원문");
  assert.equal(done.progress.complete, true);
});
test("cancelling a long conversion prevents further uploads and preserves completed text", async (t) => {
  setup(t);
  const controller = new AbortController();
  let calls = 0,
    partial;
  global.fetch = async () => {
    calls++;
    return Response.json({ text: "완료한 구간" });
  };
  await assert.rejects(
    transcribeAudio(clip, {
      signal: controller.signal,
      sampleOnly: true,
      progress: (p) => {
        partial = p;
        if (p.parts.length) controller.abort();
      },
    }),
    { name: "AbortError" },
  );
  assert.equal(calls, 1);
  assert.equal(partial.parts[0], "완료한 구간");
  assert.equal(partial.complete, false);
});
test("text and subtitle import preserve complete dialogue and reject excess length without truncation", () => {
  assert.equal(
    importTranscript(
      "1\n00:00:01,000 --> 00:00:03,000\n상대: 안녕하세요\n\n2\n00:00:03,000 --> 00:00:05,000\n나: 반갑습니다",
      "record.srt",
    ),
    "상대: 안녕하세요\n\n나: 반갑습니다",
  );
  assert.equal(
    importTranscript("가".repeat(50000), "record.txt").length,
    50000,
  );
  assert.throws(
    () => importTranscript("가".repeat(60001), "record.txt"),
    /60,000/,
  );
});
