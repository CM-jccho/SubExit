"use client";
import { useAIConsent } from "./ConsentSession";
import { useEffect, useRef, useState } from "react";
import {
  promptTasks,
  findPromptTask,
  promptVersion,
  type PromptTask,
  type PromptVersion,
} from "@/lib/prompt-practice";
import { aiFetch, AIServiceError, outageMessage } from "@/lib/ai-client";
import {
  deleteSession,
  putSession,
  type VoiceSession,
} from "@/lib/voice-notebook";
import { dailyTurn } from "@/lib/daily-talk";
import { AIConsent, type AIConfig } from "./VoiceComposer";
import { Companion, Icon } from "./CompanionUI";
import { useCompanion } from "./CompanionTheme";
export default function PromptPractice({
  config,
  initialSession,
  onRecords,
}: {
  config: AIConfig;
  initialSession?: VoiceSession;
  onRecords: () => void;
}) {
  const friend = useCompanion();
  const [session, setSession] = useState<VoiceSession | null>(
      initialSession || null,
    ),
    [task, setTask] = useState<PromptTask | undefined>(
      initialSession
        ? findPromptTask(initialSession.promptPractice!.taskId)
        : undefined,
    ),
    [prompt, setPrompt] = useState(
      initialSession?.promptPractice?.attempts.at(-1)?.prompt || "",
    ),
    [consent, setConsent] = useAIConsent(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [examples, setExamples] = useState(false);
  const alive = useRef(true),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  function choose(next: PromptTask) {
    setTask(next);
    setPrompt(next.initial);
    setSession(null);
    setExamples(false);
    setError("");
    setNotice("");
  }
  async function run() {
    if (!task || controller.current || !consent || !config.available) return;
    const c = new AbortController();
    controller.current = c;
    const timer = setTimeout(() => c.abort(), 25000);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await aiFetch("/api/prompt-practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: c.signal,
        body: JSON.stringify({
          taskId: task.id,
          prompt,
          consent,
          adultConsent: consent,
          sampleConsent: consent,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "요청을 실행하지 못했어요.");
      if (typeof d.output !== "string" || !d.output.trim())
        throw new Error("출력 형식을 확인하지 못했어요.");
      if (!alive.current) return;
      const now = new Date().toISOString(),
        attempt = {
          ...promptVersion(task, prompt, d.output, "ai"),
          model:
            typeof d.model === "string" ? d.model.slice(0, 100) : undefined,
        },
        old = session?.promptPractice?.attempts || [],
        attempts =
          old.length >= 5
            ? [old[0], ...old.slice(-3), attempt]
            : [...old, attempt];
      const next: VoiceSession = {
        id: session?.id || "session-" + crypto.randomUUID(),
        title: "AI 요청 연습 · " + task.title,
        kind: "chat",
        industry: "AI 활용",
        companion: session?.companion || friend,
        createdAt: session?.createdAt || now,
        updatedAt: now,
        turns: attempts.flatMap((a) => [
          dailyTurn(a.prompt, "user"),
          dailyTurn(a.output, "assistant"),
        ]),
        promptPractice: { version: 1, taskId: task.id, attempts },
      };
      await putSession(next);
      if (alive.current) {
        setSession(next);
        setNotice("요청과 실제 결과를 대화 기록에 저장했어요.");
      }
    } catch (e) {
      if (alive.current)
        setError(
          (e instanceof AIServiceError
            ? outageMessage(e.outage)
            : e instanceof Error && e.name === "AbortError"
              ? "응답을 기다리다 중단했어요."
              : e instanceof Error
                ? e.message
                : "요청을 실행하지 못했어요.") +
            " 입력과 이전 결과는 유지돼요. ‘작성된 전후 예시 보기’로 사용법을 살펴볼 수 있어요.",
        );
    } finally {
      clearTimeout(timer);
      controller.current = null;
      if (alive.current) setBusy(false);
    }
  }
  const versions = session?.promptPractice?.attempts || [];
  function result(a: PromptVersion, index: number) {
    return (
      <article className="prompt-result" key={a.id}>
        <small>
          {index === 0 ? "처음 요청의 결과" : "수정한 요청의 결과"} · 실제 AI
          출력{a.model ? " · " + a.model : ""}
        </small>
        <details>
          <summary>사용한 요청 보기</summary>
          <p>{a.prompt}</p>
          <button
            className="dd-link"
            disabled={busy}
            onClick={() => setPrompt(a.prompt)}
          >
            이 요청 다시 쓰기
          </button>
        </details>
        <pre>{a.output}</pre>
        <ul>
          {a.checks.map((c) => (
            <li key={c.id}>
              <strong>
                {c.found ? "표현 찾음" : "직접 확인 필요"} · {c.label}
              </strong>
              {c.evidence && <blockquote>{c.evidence}</blockquote>}
            </li>
          ))}
        </ul>
      </article>
    );
  }
  return (
    <section className="prompt-practice" aria-label="AI 요청 연습">
      <div className="dc-page-top">
        <div>
          <p className="dc-overline">
            요청 → 결과 확인 → 조건 보완 → 다시 실행
          </p>
          <h1>AI 요청 연습</h1>
        </div>
        <button className="dd-link" disabled={busy} onClick={onRecords}>
          저장한 결과 보기
        </button>
      </div>
      <p>같은 자료로 요청을 바꿔보고, 결과에서 무엇이 달라지는지 확인해요.</p>
      <div className="daily-topic-grid">
        {promptTasks.map((t) => (
          <button
            key={t.id}
            aria-pressed={task?.id === t.id}
            disabled={busy}
            onClick={() => choose(t)}
          >
            <small>가상 업무 자료</small>
            <strong>{t.title}</strong>
            <span>{t.description}</span>
            <Icon name="arrow" size={18} />
          </button>
        ))}
      </div>
      {!task && (
        <div className="daily-welcome">
          <Companion />
          <p>
            과제를 고르면 자료가 준비되어 있어요. 짧은 요청부터 시작해도
            괜찮아요.
          </p>
        </div>
      )}
      {task && (
        <>
          <div className="prompt-source">
            <h2>이번에 사용할 자료</h2>
            <p>{task.facts}</p>
            <small>
              서버에 준비된 동일한 가상 자료를 매번 사용해요. 실제 회사 자료를
              붙일 필요가 없어요.
            </small>
          </div>
          <label className="vn-label">
            AI에게 할 요청
            <textarea
              rows={4}
              maxLength={3000}
              value={prompt}
              disabled={busy}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          <div
            className="daily-choices"
            role="group"
            aria-label="요청에 더할 조건"
          >
            {task.conditions.map((c) => (
              <button
                key={c}
                disabled={busy || prompt.includes(c)}
                onClick={() => setPrompt((p) => (p + "\n" + c).slice(0, 3000))}
              >
                {c}
              </button>
            ))}
          </div>
          <p className="vn-caption">
            조건을 고르면 요청에 추가돼요. 실행은 직접 눌러요. 모든 조건을
            처음부터 넣을 필요는 없어요.
          </p>
          <AIConsent
            config={config}
            checked={consent}
            onChange={setConsent}
            disabled={busy}
          />
          <div className="dc-inline-actions">
            <button
              className="dd-primary"
              disabled={
                busy ||
                !consent ||
                !config.available ||
                prompt.trim().length < 2
              }
              onClick={() => void run()}
            >
              {busy
                ? "요청을 실행하고 있어요…"
                : versions.length
                  ? "수정한 요청 실행"
                  : "이 요청으로 AI 실행"}
            </button>
            <button
              className="dd-secondary"
              disabled={busy}
              onClick={() => setExamples((v) => !v)}
            >
              {examples ? "예시 접기" : "작성된 전후 예시 보기"}
            </button>
          </div>
          {!config.available && (
            <p>AI 연결 전에도 작성된 예시로 비교 방법을 살펴볼 수 있어요.</p>
          )}
          {error && (
            <p className="dd-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="dc-toast" role="status">
              {notice}
            </p>
          )}
          {examples && (
            <aside className="prompt-examples">
              <h2>사전 작성 비교 예시 · AI 호출 없음</h2>
              <p>
                내 입력을 실행한 결과가 아니에요. 조건을 구체적으로 전달하는
                방법을 보여주는 예시예요.
              </p>
              <div className="prompt-compare">
                <article>
                  <h3>간단히 요청했을 때의 예시</h3>
                  <pre>{task.sampleBefore}</pre>
                </article>
                <article>
                  <h3>조건을 보완했을 때의 예시</h3>
                  <pre>{task.sampleAfter}</pre>
                </article>
              </div>
            </aside>
          )}
          {!!versions.length && (
            <>
              <h2>실제 결과 비교</h2>
              <p className="vn-caption">
                아래 표시는 특정 표현을 찾은 결과이며 정답 점수나 사실 검증이
                아니에요. 자료 밖의 내용, 약속, 빠진 조건을 직접 확인해 주세요.
                첫 요청도 이미 조건을 충족하면 수정 효과가 작을 수 있어요.
              </p>
              <div className="prompt-compare">
                {result(versions[0], 0)}
                {versions.length > 1 && result(versions.at(-1)!, 1)}
              </div>
              {versions.length > 2 && (
                <details className="dc-guide-faq">
                  <summary>중간 요청 {versions.length - 2}개 보기</summary>
                  {versions.slice(1, -1).map((a, i) => result(a, i + 1))}
                </details>
              )}
              <p className="vn-caption">
                이 기록에는 첫 결과와 최근 결과를 합쳐 최대 5회 남겨요. 대화
                기록에서 다시 열거나 삭제할 수 있어요.
              </p>
            </>
          )}
        </>
      )}
      <details className="dc-guide-faq">
        <summary>AI에게 요청할 때 도움이 되는 순서</summary>
        <ol>
          <li>결과를 어디에 쓸지와 성공 기준을 정해요.</li>
          <li>필요한 자료와 미정인 사실을 구분해 전달해요.</li>
          <li>길이·형식·지켜야 할 범위를 알려줘요.</li>
          <li>복잡한 일은 초안·확인·수정으로 나눠요.</li>
          <li>실제 출력에서 빠진 조건을 찾아 다시 요청해요.</li>
          <li>잘 된 요청도 다른 자료에서 다시 확인한 뒤 재사용해요.</li>
        </ol>
        <p>
          에이전트에 일을 맡길 때는 참고 자료와 도구의 범위, 실행 전 확인할
          행동도 정해야 해요. 이 연습은 외부 도구를 실행하지 않아요.
        </p>
        <p>참고 자료 확인: 2026-09-16. 모델에 따라 적용 결과가 달라요.</p>
        <ul>
          <li>
            <a
              href="https://ai.google.dev/gemini-api/docs/prompting-strategies"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google 프롬프트 설계 가이드 · English
            </a>
          </li>
          <li>
            <a
              href="https://platform.claude.com/docs/ja/build-with-claude/prompt-engineering/overview"
              target="_blank"
              rel="noopener noreferrer"
            >
              Anthropic 성공 기준과 평가 · 日本語
            </a>
          </li>
          <li>
            <a
              href="https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents"
              target="_blank"
              rel="noopener noreferrer"
            >
              Anthropic 에이전트의 맥락 설계 · English
            </a>
          </li>
        </ul>
      </details>
      {session && (
        <button
          className="dd-link"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm("이 요청 연습과 비교 결과를 삭제할까요?"))
              return;
            try {
              await deleteSession(session.id);
              setSession(null);
              setNotice("연습 기록을 삭제했어요.");
            } catch {
              setError("기록을 삭제하지 못했어요.");
            }
          }}
        >
          이 요청 연습 삭제
        </button>
      )}
    </section>
  );
}
