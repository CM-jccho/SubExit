const ts = require("typescript"),
  Module = require("module"),
  path = require("path");
const root = path.resolve(__dirname, ".."),
  resolve = Module._resolveFilename;
Module._resolveFilename = function (id, ...args) {
  return resolve.call(
    this,
    id.startsWith("@/") ? path.join(root, id.slice(2)) : id,
    ...args,
  );
};
require.extensions[".ts"] = function (module, file) {
  module._compile(
    ts.transpileModule(require("fs").readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        resolveJsonModule: true,
      },
    }).outputText,
    file,
  );
};
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  roomClock,
  parseRoomWeather,
  weatherAppearance,
} = require("../lib/room-environment.ts");
const { GET } = require("../app/api/room-weather/route.ts");
test("room dayparts follow Korean time across midnight, noon and evening", () => {
  for (const [utc, period, text] of [
    ["2026-09-16T15:01:00Z", "night", "오전 12:01"],
    ["2026-09-16T21:00:00Z", "morning", "오전 6:00"],
    ["2026-09-16T03:00:00Z", "afternoon", "오후 12:00"],
    ["2026-09-16T08:00:00Z", "sunset", "오후 5:00"],
    ["2026-09-16T10:00:00Z", "night", "오후 7:00"],
  ]) {
    const clock = roomClock(new Date(utc));
    assert.equal(clock.period, period);
    assert.equal(clock.text, text);
  }
});
test("weather refuses missing, stale, future and invalid data instead of showing invented weather", () => {
  const now = Date.now();
  const current = { temperature_2m: 23.5, weather_code: 61, time: now / 1000 };
  assert.equal(parseRoomWeather({ current }, "seoul", now).time, now);
  assert.equal(weatherAppearance(61).kind, "rain");
  assert.equal(weatherAppearance(73).kind, "snow");
  assert.equal(weatherAppearance(999).kind, "unknown");
  for (const patch of [
    { time: now / 1000 - 5401 },
    { time: now / 1000 + 601 },
    { temperature_2m: "23" },
    { temperature_2m: 100 },
    { weather_code: 999 },
    { weather_code: null },
    { time: NaN },
  ])
    assert.throws(() =>
      parseRoomWeather({ current: { ...current, ...patch } }, "seoul", now),
    );
  assert.throws(() => parseRoomWeather(null, "seoul", now));
});
test("weather route restricts cities, parses current data and returns an explicit no-cache failure", async () => {
  const previousFetch = global.fetch;
  let calls = 0;
  try {
    global.fetch = async (url, options) => {
      calls++;
      assert.equal(new URL(url).hostname, "api.open-meteo.com");
      assert.equal(new URL(url).searchParams.get("latitude"), "35.1796");
      assert.equal(options.next.revalidate, 1800);
      return new Response(
        JSON.stringify({
          current: {
            temperature_2m: 19.2,
            weather_code: 3,
            time: Date.now() / 1000,
          },
        }),
      );
    };
    assert.equal(
      (await GET(new Request("https://test/api/room-weather?city=unknown")))
        .status,
      400,
    );
    assert.equal(calls, 0);
    const response = await GET(
      new Request("https://test/api/room-weather?city=busan"),
    );
    assert.equal(response.status, 200);
    const d = await response.json();
    assert.equal(d.city, "busan");
    assert.equal(d.code, 3);
    global.fetch = async () => {
      throw new Error("timeout");
    };
    const unavailable = await GET(new Request("https://test/api/room-weather"));
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.headers.get("cache-control"), "no-store");
    assert((await unavailable.json()).error.includes("시간에 맞는"));
  } finally {
    global.fetch = previousFetch;
  }
});
