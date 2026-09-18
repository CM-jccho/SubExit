const ts = require("typescript"),
  Module = require("module"),
  path = require("path"),
  fs = require("fs"),
  assert = require("node:assert/strict");
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
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
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
const { sampledRequest } = require("../lib/resilient-ai.ts"),
  { demoCases } = require("../lib/demo-bank.ts");
const fixtures = require("../fixtures/ai-outages.json").cases;
async function simulate() {
  const original = global.fetch;
  let verified = 0;
  const counts = {};
  try {
    for (const row of demoCases)
      for (const operation of ["partner", "companion", "suggestions", "coach"])
        for (const fixture of fixtures) {
          global.fetch = async () => {
            if (fixture.throw === "TypeError")
              throw new TypeError("Simulated connection loss");
            if (fixture.throw === "AbortError")
              throw new DOMException("Simulated timeout", "AbortError");
            return fixture.text
              ? new Response(fixture.text, { status: fixture.status })
              : Response.json(fixture.body, { status: fixture.status });
          };
          const run = () =>
            sampledRequest({
              operation,
              context: row.keywords.join(" "),
              previous: [],
              url: "/api/simulation",
              init: { method: "POST" },
            });
          if (fixture.noFallback)
            await assert.rejects(run, { message: fixture.body.error });
          else if (fixture.throw === "AbortError")
            await assert.rejects(run, { name: "AbortError" });
          else
            await assert.rejects(run, (error) => {
              assert.equal(error.outage.reason, fixture.reason);
              return true;
            });
          verified++;
          counts[fixture.id] = (counts[fixture.id] || 0) + 1;
        }
  } finally {
    global.fetch = original;
  }
  return {
    generatedAt: new Date().toISOString(),
    method: "mocked_provider_responses",
    expectedBehavior: "Reject AI failures without automatically substituting authored responses; preserve cancellations and validation errors.",
    liveAICalls: 0,
    scenarios: demoCases.length,
    operations: 4,
    errorConditions: fixtures.length,
    verified,
    authoredResponses: demoCases.reduce(
      (n, c) =>
        n +
        ["openings", "replies", "suggestions", "hints", "companion"].reduce(
          (s, k) => s + c[k].length,
          0,
        ),
      0,
    ),
    authoredReviewExamples: demoCases.length,
    checks: counts,
    limitations: [
      "실제 Gemini 응답 품질이나 지연을 측정한 결과가 아닙니다.",
      "음성 인식과 현재 대화 복기 결과를 예비 문장으로 대체하지 않습니다.",
      "사용자 입력과 목표의 의미를 AI로 검증하지 않는 사전 작성 샘플입니다.",
    ],
    examples: demoCases.map((c) => ({
      topic: c.title,
      opening: c.openings[0],
      followup: c.replies[0],
      candidate: c.suggestions[0],
      hint: c.hints[0],
    })),
  };
}
module.exports = { simulate };
if (require.main === module)
  simulate()
    .then((report) => {
      const output = path.join(
        root,
        "docs/validation/ai-outage-simulation.json",
      );
      fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
      process.stdout.write(
        JSON.stringify({
          verified: report.verified,
          authoredResponses: report.authoredResponses,
          liveAICalls: report.liveAICalls,
          report: output,
        }) + "\n",
      );
    })
    .catch((e) => {
      process.stderr.write(String(e) + "\n");
      process.exitCode = 1;
    });
