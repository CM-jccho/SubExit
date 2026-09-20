import { test, expect } from "@playwright/test";

const OPPONENT =
  "왜 미리 말 안 했어요? 금요일까지 꼭 끝내 주세요.";
const SUGGESTION =
  "제가 먼저 공유했어야 했어요. 금요일은 어렵고, 다음 주 화요일 일정으로 다시 조율하고 싶습니다.";

function watchPageErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push("pageerror: " + error.message));
  page.on("console", (message) => {
    if (message.type() === "error")
      errors.push("console: " + message.text());
  });
  return errors;
}

async function mockCoach(page) {
  await page.route("**/api/coach", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          available: true,
          voiceAvailable: true,
          configurationStatus: "configured",
          provider: "Google Gemini",
          model: "gemini-2.5-flash",
          sampleOnly: false,
        }),
      });
      return;
    }
    const payload = request.postDataJSON();
    const opponent =
      typeof payload?.opponent === "string" && payload.opponent.trim()
        ? payload.opponent.trim()
        : OPPONENT;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        pattern: "일정 압박과 이유 확인",
        evidence: opponent,
        reason: "사용자의 일정 조율 목표를 반영한 제안입니다.",
        suggestion: SUGGESTION,
        feedback: "상대 요구를 인정한 뒤 가능한 일정을 분명히 제안하세요.",
        source: "ai",
        provider: "Google Gemini",
        model: "gemini-2.5-flash",
        latencyMs: 120,
      }),
    });
  });
}

async function installFakeRealtimeSpeech(page, transcript = OPPONENT) {
  await page.addInitScript((fakeTranscript) => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop() {} }],
        }),
      },
    });

    class FakeSpeechRecognition {
      continuous = true;
      interimResults = true;
      lang = "ko-KR";
      onstart = null;
      onend = null;
      onerror = null;
      onresult = null;

      start() {
        setTimeout(() => this.onstart?.(), 25);
        setTimeout(
          () =>
            this.onresult?.({
              results: [
                {
                  isFinal: true,
                  0: { transcript: fakeTranscript },
                },
              ],
            }),
          90,
        );
      }

      abort() {}
    }

    window.SpeechRecognition = FakeSpeechRecognition;
    window.webkitSpeechRecognition = FakeSpeechRecognition;
  }, transcript);
}

async function installDeniedMicrophone(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        },
      },
    });

    class FakeSpeechRecognition {
      continuous = true;
      interimResults = true;
      lang = "ko-KR";
      onstart = null;
      onend = null;
      onerror = null;
      onresult = null;
      start() {}
      abort() {}
    }
    window.SpeechRecognition = FakeSpeechRecognition;
    window.webkitSpeechRecognition = FakeSpeechRecognition;
  });
}

async function openQuickHelp(page) {
  await page.goto("/?view=quick&purpose=live", {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("heading", { name: "실시간 대화 도움" }),
  ).toBeVisible();
}

async function choosePartnerGoal(page) {
  await page
    .getByLabel("이번 대화 설정 요약")
    .getByRole("button", { name: "상대·목표", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("group", { name: "대화 상대 빠른 선택" })
    .getByRole("button", { name: "동료", exact: true })
    .click();
  await dialog
    .getByRole("group", { name: "대화 목표 빠른 선택" })
    .getByRole("button", { name: "일정 조율", exact: true })
    .click();
  await page.getByRole("button", { name: "대화 설정 닫기" }).click();
}

async function grantAIConsent(page) {
  const checkbox = page.getByRole("checkbox").first();
  if (await checkbox.isVisible()) await checkbox.click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        sessionStorage.getItem("speakcoaching-ai-consent-session-v1"),
      ),
    )
    .toBe("allowed");
}

async function readLiveSessions(page) {
  return await page.evaluate(async () => {
    return await new Promise((resolve, reject) => {
      const request = indexedDB.open("ddeundeun-voice-notebook-v1", 2);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("sessions", "readonly");
        const rows = tx.objectStore("sessions").getAll();
        rows.onerror = () => reject(rows.error);
        rows.onsuccess = () => {
          resolve(
            rows.result
              .filter((row) => row?.liveMeta?.source === "live-help")
              .map((row) => ({
                title: row.title,
                partner: row.liveMeta.partner,
                suggestions: row.turns.flatMap((turn) => turn.suggestions || []),
                turns: row.turns.map((turn) => turn.text),
                commitments: row.liveMeta.signals.commitments || [],
              })),
          );
          db.close();
        };
      };
    });
  });
}

test("production AI configuration is available", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "chrome-mobile");
  const response = await request.get("/api/coach");
  expect(response.ok()).toBeTruthy();
  const config = await response.json();
  expect(config.available).toBe(true);
  expect(config.voiceAvailable).toBe(true);
  expect(config.configurationStatus).toBe("configured");
  expect(config.provider).toContain("Gemini");
});

test("onboarding finishes at the actual realtime-help screen", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "iphone-chrome-fallback");
  const errors = watchPageErrors(page);
  await mockCoach(page);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "상대 말을 듣고, 다음 한마디" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "시작 전에 두 가지만 정해요" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "끝난 대화는 다음 대화로 이어져요",
    }),
  ).toBeVisible();

  await page
    .getByRole("dialog")
    .getByRole("button", { name: "실시간 대화 도움 시작" })
    .click();

  await expect(page).toHaveURL(/view=quick/);
  await expect(page).toHaveURL(/purpose=live/);
  await expect(
    page.getByRole("heading", { name: "실시간 대화 도움" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("next-line guidance is above listening controls and settings are optional", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "iphone-chrome-fallback");
  const errors = watchPageErrors(page);

  await installFakeRealtimeSpeech(page);
  await mockCoach(page);
  await openQuickHelp(page);
  await grantAIConsent(page);

  const answer = page.locator(".live-stream-reply");
  const listen = page.locator(".live-primary-action");
  await expect(answer).toBeVisible();
  await expect(page.getByText("꼭 기억할 것").first()).toBeVisible();
  await expect(page.getByLabel("이번 대화 설정 요약")).toBeVisible();
  await expect(
    page
      .getByLabel("이번 대화 설정 요약")
      .getByRole("button", { name: "설정", exact: true }),
  ).toBeVisible();

  const answerBox = await answer.boundingBox();
  const listenBox = await listen.boundingBox();
  expect(answerBox).not.toBeNull();
  expect(listenBox).not.toBeNull();
  expect(answerBox.y).toBeLessThan(listenBox.y);

  const start = page.getByRole("button", { name: "대화 도움 시작" });
  await expect(start).toBeEnabled();
  await start.click();

  await expect(page.getByText(SUGGESTION).first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    page.locator(".live-remember-card").getByText(/금요일까지 꼭 끝내 주세요/),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("realtime core flow listens, suggests, saves, and opens records", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "iphone-chrome-fallback");
  const errors = watchPageErrors(page);
  const unexpectedDialogs = [];
  page.on("dialog", async (dialog) => {
    unexpectedDialogs.push(dialog.message());
    await dialog.accept();
  });

  await installFakeRealtimeSpeech(page);
  await mockCoach(page);
  await openQuickHelp(page);
  await choosePartnerGoal(page);
  await grantAIConsent(page);

  await expect(
    page.getByRole("button", { name: "대화 도움 시작" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "대화 도움 시작" }).click();

  await expect(page.getByText("상대 말을 듣고 있어요").first()).toBeVisible();
  await expect(page.getByText("상대 말 확인")).toBeVisible();
  await expect(page.locator(".live-caption-secondary")).toBeVisible();
  await expect(page.getByText(SUGGESTION).first()).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole("button", { name: "내가 말할게요" }).click();
  await expect(page.getByRole("button", { name: "이번 대화 저장" })).toBeVisible();
  await page.getByRole("button", { name: "이번 대화 저장" }).click();
  await expect(page.getByText(/내 기록에 저장했어요/)).toBeVisible();

  const sessions = await readLiveSessions(page);
  expect(sessions.length).toBeGreaterThan(0);
  expect(sessions.at(-1).partner).toBe("동료");
  expect(sessions.at(-1).turns).toContain(OPPONENT);
  expect(sessions.at(-1).suggestions).toContain(SUGGESTION);
  expect(sessions.at(-1).commitments.length).toBeGreaterThan(0);
  await expect(page.getByText("꼭 기억").first()).toBeVisible();

  await page.getByRole("button", { name: "내 기록", exact: true }).click();
  await expect(page).toHaveURL(/view=records/);
  await expect(page.getByText("실시간 대화").first()).toBeVisible();
  const record = page.locator(".vn-session-card").filter({ hasText: "동료" }).first();
  await record.click();
  await expect(page.getByText("꼭 기억").first()).toBeVisible();
  expect(unexpectedDialogs).toEqual([]);
  expect(errors).toEqual([]);
});

test("direct text input is visible without opening another disclosure", async ({
  page,
}) => {
  const errors = watchPageErrors(page);
  await mockCoach(page);
  await openQuickHelp(page);

  const fallback = page.locator(".coaching-fallback-modes");
  await expect(fallback.getByText("다른 방식으로 입력")).toBeVisible();
  const textButton = fallback.getByRole("button", { name: "직접 입력" });
  await expect(textButton).toBeVisible();
  await textButton.click();

  await expect(page.locator("#live-text")).toBeVisible();

  const quickPadding = await page.locator(".dc-quick-help").evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).paddingBottom),
  );
  expect(quickPadding).toBeGreaterThanOrEqual(100);

  const navBox = await page.locator(".dc-nav").boundingBox();
  expect(navBox).not.toBeNull();
  expect(navBox.x).toBeGreaterThan(0);
  expect(navBox.width).toBeLessThan(390);
  expect(errors).toEqual([]);
});

test("AI consent survives a refresh in the same tab", async ({ page }) => {
  await mockCoach(page);
  await openQuickHelp(page);
  await grantAIConsent(page);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect
    .poll(() =>
      page.evaluate(() =>
        sessionStorage.getItem("speakcoaching-ai-consent-session-v1"),
      ),
    )
    .toBe("allowed");
  await expect(page.getByText("처음 한 번만 확인해요")).toHaveCount(0);
});

test("microphone denial never looks like a dead button", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "iphone-chrome-fallback");
  await installDeniedMicrophone(page);
  await mockCoach(page);
  await openQuickHelp(page);
  await choosePartnerGoal(page);
  await grantAIConsent(page);

  await page.getByRole("button", { name: "대화 도움 시작" }).click();
  await expect(page.locator(".dd-error")).toContainText(
    "브라우저의 사이트 설정에서 마이크를 허용",
  );
});

test("iPhone Chrome clearly falls back instead of pretending realtime works", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "iphone-chrome-fallback");
  await installFakeRealtimeSpeech(page);
  await mockCoach(page);
  await openQuickHelp(page);

  await expect(
    page.getByText(/iPhone에서는 Safari에서 실시간 자막을 사용해 주세요/),
  ).toBeVisible();
  await expect(
    page.locator(".coaching-fallback-modes").getByRole("button", {
      name: "직접 입력",
    }),
  ).toBeVisible();
});
