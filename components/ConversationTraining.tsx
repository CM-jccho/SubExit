"use client";
import { useEffect, useRef, useState } from "react";
import {
  trainingSkills,
  trainingExercises,
  findTraining,
  validTrainingAnswers,
  validateTrainingFeedback,
  suggestTraining,
  trainingReplay,
  type TrainingSkill,
  type TrainingOrigin,
  type TrainingRecord,
} from "@/lib/conversation-training";
import {
  deleteSession,
  listSessions,
  putSession,
  getSession,
  type VoiceSession,
} from "@/lib/voice-notebook";
import { dailyTurn } from "@/lib/daily-talk";
import { aiFetch, AIServiceError, outageMessage } from "@/lib/ai-client";
import { AIConsent, type AIConfig } from "./VoiceComposer";
import { Companion } from "./CompanionUI";
import { useCompanion } from "./CompanionTheme";
export default function ConversationTraining({
  config,
  initialSession,
  origin,
  onRecords,
  onSession,
}: {
  config: AIConfig;
  initialSession?: VoiceSession;
  origin?: TrainingOrigin;
  onRecords: () => void;
  onSession: (session: VoiceSession) => void;
}) {
  const friend = useCompanion();
  const [session, setSession] = useState(initialSession),
    [selected, setSelected] = useState<TrainingSkill>(
      findTraining(initialSession?.training?.exerciseId)?.skill ||
        (origin ? suggestTraining(origin.focus) : "associate"),
    ),
    [exerciseId, setExerciseId] = useState(
      initialSession?.training?.exerciseId || "",
    ),
    [answers, setAnswers] = useState(
      initialSession?.training?.answers || ["", "", ""],
    ),
    [revised, setRevised] = useState(
      initialSession?.training?.revised ||
        initialSession?.training?.answers || ["", "", ""],
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [consent, setConsent] = useState(false),
    [recent, setRecent] = useState<VoiceSession[]>([]),
    [editing, setEditing] = useState(false);
  const alive = useRef(true),
    lock = useRef(false),
    abort = useRef<AbortController | null>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const record = session?.training,
    exercise = findTraining(exerciseId),
    skill = trainingSkills.find((s) => s.id === (exercise?.skill || selected))!,
    source = record?.origin || origin;
  const stage =
    record && !editing ? (record.completedAt ? "done" : "review") : "write";
  useEffect(() => {
    alive.current = true;
    listSessions()
      .then((rows) => {
        if (alive.current)
          setRecent(
            rows
              .filter((s) => s.training)
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
          );
      })
      .catch(() => {
        if (alive.current) setError("훈련 기록을 불러오지 못했어요.");
      });
    return () => {
      alive.current = false;
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    heading.current?.focus();
  }, [exerciseId, stage]);
  async function action(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error
            ? e.message
            : "저장하지 못했어요. 입력은 유지돼요.",
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function persist(data: TrainingRecord) {
    if (!exercise) throw Error("훈련을 다시 골라 주세요.");
    const now = new Date().toISOString();
    const next: VoiceSession = {
      id: session?.id || "session-" + crypto.randomUUID(),
      title: "기초 훈련 · " + exercise.title,
      kind: "chat",
      industry: "대화 트레이닝",
      companion: session?.companion || friend,
      createdAt: session?.createdAt || now,
      updatedAt: now,
      training: data,
      turns: [
        dailyTurn(exercise.context, "assistant"),
        dailyTurn(
          data.answers.map((a, i) => exercise.labels[i] + ": " + a).join("\n"),
          "user",
        ),
        ...(data.revised
          ? [
              dailyTurn(
                data.revised
                  .map((a, i) => exercise.labels[i] + ": " + a)
                  .join("\n"),
                "user",
              ),
            ]
          : []),
      ],
    };
    await putSession(next);
    if (alive.current) {
      setSession(next);
      setRecent((rows) => [next, ...rows.filter((r) => r.id !== next.id)]);
    }
    return next;
  }
  function choose(id: string) {
    setExerciseId(id);
    setSession(undefined);
    setAnswers(["", "", ""]);
    setRevised(["", "", ""]);
    setEditing(false);
    setError("");
    setNotice("");
  }
  async function saveFirst() {
    if (!validTrainingAnswers(answers) || !exercise) return;
    await action(async () => {
      const clean = answers.map((s) => s.trim());
      await persist({
        version: 1,
        exerciseId: exercise.id,
        answers: clean,
        ...(source ? { origin: source } : {}),
      });
      if (alive.current) {
        setRevised(clean);
        setEditing(false);
        setNotice(
          "첫 표현을 저장했어요. 아래 기준으로 한 부분을 다듬어 보세요.",
        );
      }
    });
  }
  async function feedback() {
    if (!record || !consent || !config.available || record.feedback) return;
    await action(async () => {
      const c = new AbortController();
      abort.current = c;
      const timer = setTimeout(() => c.abort(), 25000);
      try {
        const r = await aiFetch("/api/training", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: c.signal,
          body: JSON.stringify({
            exerciseId: record.exerciseId,
            answers: record.answers,
            consent,
            adultConsent: consent,
            sampleConsent: consent,
          }),
        });
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "피드백을 받지 못했어요.");
        const f = validateTrainingFeedback(d.feedback, record.answers);
        if (alive.current) {
          await persist({ ...record, feedback: f });
          setNotice(
            "실제 작성한 표현을 바탕으로 한 AI 제안이에요. 의도와 맞는지 확인해 주세요.",
          );
        }
      } catch (e) {
        if (!alive.current) return;
        setError(
          (e instanceof AIServiceError
            ? outageMessage(e.outage)
            : e instanceof Error && e.name === "AbortError"
              ? "응답을 기다리다 중단했어요."
              : e instanceof Error
                ? e.message
                : "피드백을 받지 못했어요.") +
            " 저장한 답은 유지돼요. 준비된 확인 기준으로 계속할 수 있어요.",
        );
      } finally {
        clearTimeout(timer);
        abort.current = null;
      }
    });
  }
  async function complete() {
    if (!record || !validTrainingAnswers(revised)) return;
    await action(async () => {
      await persist({
        ...record,
        revised: revised.map((s) => s.trim()),
        completedAt: new Date().toISOString(),
      });
      if (alive.current)
        setNotice(
          "훈련을 마쳤어요. 처음 표현과 마무리 표현이 함께 저장됐어요.",
        );
    });
  }
  async function replay() {
    if (!source) return;
    await action(async () => {
      const original = await getSession(source.sessionId);
      const next = trainingReplay(source, original);
      if (!alive.current) return;
      await putSession(next);
      if (alive.current) onSession(next);
    });
  }
  function fields(
    values: string[],
    setter: (v: string[]) => void,
    prefix: string,
  ) {
    return exercise?.labels.map((label, i) => (
      <label className="training-field" key={label}>
        <span>
          <b>{i + 1}</b>
          {label}
        </span>
        <textarea
          aria-label={prefix + label}
          value={values[i]}
          rows={2}
          minLength={2}
          maxLength={600}
          disabled={busy}
          onChange={(e) =>
            setter(values.map((v, n) => (n === i ? e.target.value : v)))
          }
        />
        <small>{exercise.hints[i]}</small>
      </label>
    ));
  }
  return (
    <section
      className="conversation-training"
      aria-label="영역별 대화 트레이닝"
    >
      <div className="dc-page-top">
        <div>
          <p className="dc-overline">한 번에 기술 하나, 1~3분</p>
          <h1>기초 훈련</h1>
        </div>
        <button className="dd-link" disabled={busy} onClick={onRecords}>
          훈련 기록 보기
        </button>
      </div>
      {error && (
        <p role="alert" className="dc-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="dc-toast">
          {notice}
        </p>
      )}
      {source && (
        <aside className="training-origin">
          <strong>복기한 대화와 이어지는 훈련</strong>
          <blockquote>{source.quote}</blockquote>
          <p>연습 목표: {source.focus}</p>
          <small>
            복기의 키워드로 영역을 제안했어요. 원하는 영역으로 바꿔도 돼요. 원래
            대화는 AI 훈련 요청에 자동으로 보내지 않아요.
          </small>
        </aside>
      )}
      {!exercise ? (
        <>
          <p>상황 전체가 어렵다면, 필요한 기술부터 짧게 연습해 보세요.</p>
          <div className="daily-topic-grid">
            {trainingSkills.map((s) => {
              const count = new Set(
                recent
                  .filter(
                    (r) =>
                      r.training?.completedAt &&
                      findTraining(r.training.exerciseId)?.skill === s.id,
                  )
                  .map((r) => r.training!.exerciseId),
              ).size;
              return (
                <button
                  key={s.id}
                  aria-pressed={selected === s.id}
                  onClick={() => setSelected(s.id)}
                >
                  <small>
                    {count ? `${count}/3 소재 연습함` : "처음이어도 괜찮아요"}
                  </small>
                  <strong>{s.title}</strong>
                  <span>{s.description}</span>
                </button>
              );
            })}
          </div>
          <div className="training-method">
            <Companion small character={session?.companion || friend} />
            <div>
              <h2>{skill.title}</h2>
              <p>{skill.method}</p>
            </div>
          </div>
          <div className="training-exercises">
            {trainingExercises
              .filter((e) => e.skill === selected)
              .map((e) => (
                <button
                  className="training-exercise"
                  key={e.id}
                  onClick={() => choose(e.id)}
                >
                  <small>{e.level}</small>
                  <strong>{e.title}</strong>
                  <span>이 소재로 연습 →</span>
                </button>
              ))}
          </div>
          {!!recent.length && (
            <details className="dc-guide-faq">
              <summary>최근 훈련 이어보기</summary>
              {recent.slice(0, 6).map((s) => (
                <button
                  className="training-recent"
                  key={s.id}
                  onClick={() => {
                    setSession(s);
                    setExerciseId(s.training!.exerciseId);
                    setAnswers(s.training!.answers);
                    setRevised(s.training!.revised || s.training!.answers);
                    setEditing(false);
                    setError("");
                    setNotice("");
                  }}
                >
                  {s.title} · {s.training!.completedAt ? "마침" : "다듬는 중"}
                </button>
              ))}
            </details>
          )}
          <p className="vn-caption">
            대화 능력 점수 대신 연습한 소재를 표시해요. 기록은 이 브라우저에
            저장되며, 계정·기기 사이에 동기화되지 않아요.
          </p>
        </>
      ) : (
        <>
          <div className="training-step">
            <span>
              {skill.title} · {exercise.level}
            </span>
            <span>
              {stage === "write"
                ? "1 / 3 직접 써보기"
                : stage === "review"
                  ? "2 / 3 한 부분 다듬기"
                  : "3 / 3 마무리"}
            </span>
          </div>
          <h2 ref={heading} tabIndex={-1}>
            {exercise.title}
          </h2>
          <div className="training-method">
            <Companion
              small
              character={session?.companion || friend}
              mood={stage === "done" ? "done" : busy ? "think" : undefined}
            />
            <div>
              <strong>오늘 연습할 방법</strong>
              <p>{skill.method}</p>
            </div>
          </div>
          <p className="training-context">{exercise.context}</p>
          <details className="dc-guide-faq">
            <summary>막힐 때만 · 작성된 예시 보기</summary>
            <p>
              정답이나 내 답변의 분석이 아닌, 방법을 보여주는 가상 예시예요.
            </p>
            {exercise.example.map((s, i) => (
              <p key={i}>
                <strong>{exercise.labels[i]}</strong> · {s}
              </p>
            ))}
          </details>
          {stage === "write" && (
            <>
              <p>각 칸에 짧게 적어 보세요. 소리 내어 읽어봐도 좋아요.</p>
              {fields(answers, setAnswers, "")}
              <p className="vn-caption">
                각 2~600자 · 다음 버튼을 누르면 저장돼요. 저장 전 입력은 화면을
                나가면 사라져요.
              </p>
              <button
                className="dd-primary"
                disabled={busy || !validTrainingAnswers(answers)}
                onClick={() => void saveFirst()}
              >
                저장하고 다듬기
              </button>
            </>
          )}
          {stage === "review" && (
            <>
              <h3>준비된 확인 기준 · AI 평가 아님</h3>
              <ul className="training-checks">
                {skill.checkpoints.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <details className="dc-guide-faq">
                <summary>선택 · AI에게 한 가지 피드백 받기</summary>
                <p>
                  이 훈련의 가상 상황과 첫 답변 세 개만 전송해요. 기록을 다시 열
                  때는 저장된 피드백을 보여줘요.
                </p>
                {!record?.feedback && (
                  <>
                    <AIConsent
                      config={config}
                      checked={consent}
                      onChange={setConsent}
                      disabled={busy}
                    />
                    <button
                      className="dd-secondary"
                      disabled={busy || !consent || !config.available}
                      onClick={() => void feedback()}
                    >
                      {busy
                        ? "피드백을 기다리는 중…"
                        : "내 표현으로 AI 피드백 받기"}
                    </button>
                    {!config.available && (
                      <p>AI 연결 전에도 위 기준으로 훈련을 마칠 수 있어요.</p>
                    )}
                  </>
                )}
              </details>
              {record?.feedback && (
                <aside className="training-feedback">
                  <strong>저장된 AI 제안 · 첫 표현 기준</strong>
                  <blockquote>{record.feedback.quote}</blockquote>
                  <p>{record.feedback.note}</p>
                  <p>
                    <strong>다음 행동</strong> · {record.feedback.nextAction}
                  </p>
                </aside>
              )}
              <h3>마무리 표현</h3>
              <p>
                한 부분을 다듬어 보세요. 이미 의도에 맞는다면 그대로 마쳐도
                돼요.
              </p>
              {fields(revised, setRevised, "마무리: ")}
              <div className="dc-inline-actions">
                <button
                  className="dd-primary"
                  disabled={busy || !validTrainingAnswers(revised)}
                  onClick={() => void complete()}
                >
                  마무리 표현 저장
                </button>
                <button
                  className="dd-link"
                  disabled={busy}
                  onClick={() => setEditing(true)}
                >
                  첫 표현 다시 작성
                </button>
              </div>
            </>
          )}
          {stage === "done" && (
            <>
              <h3>한 가지 기술을 연습했어요</h3>
              <p>
                실력이 점수로 측정된 것은 아니에요. 실제 대화에서 한 번 사용해
                보세요.
              </p>
              <div className="prompt-compare">
                <article>
                  <h3>처음 표현</h3>
                  {record?.answers.map((a, i) => (
                    <p key={i}>
                      <strong>{exercise.labels[i]}</strong>
                      <br />
                      {a}
                    </p>
                  ))}
                </article>
                <article>
                  <h3>
                    마무리 표현
                    {JSON.stringify(record?.answers) ===
                    JSON.stringify(record?.revised)
                      ? " · 원래 표현 유지"
                      : ""}
                  </h3>
                  {record?.revised?.map((a, i) => (
                    <p key={i}>
                      <strong>{exercise.labels[i]}</strong>
                      <br />
                      {a}
                    </p>
                  ))}
                </article>
              </div>
              {record?.feedback && (
                <details className="dc-guide-faq">
                  <summary>저장된 AI 제안 다시 보기</summary>
                  <blockquote>{record.feedback.quote}</blockquote>
                  <p>{record.feedback.note}</p>
                  <p>{record.feedback.nextAction}</p>
                </details>
              )}
              {source && (
                <button
                  className="dd-primary"
                  disabled={busy}
                  onClick={() => void replay()}
                >
                  원래 장면에서 다시 연습
                </button>
              )}
              <div className="dc-inline-actions">
                <button
                  className="dd-secondary"
                  disabled={busy}
                  onClick={() => choose(exercise.id)}
                >
                  같은 소재로 새 훈련
                </button>
                <button className="dd-link" disabled={busy} onClick={onRecords}>
                  저장한 기록 보기
                </button>
              </div>
            </>
          )}
          {busy && <p role="status">처리 중이에요. 잠시만 기다려 주세요.</p>}
          <button
            className="dd-link training-back"
            disabled={busy}
            onClick={() => {
              setExerciseId("");
              setSession(undefined);
              setEditing(false);
              setError("");
              setNotice("");
            }}
          >
            다른 훈련 고르기
          </button>
        </>
      )}
      {session && (
        <button
          className="dd-link training-back"
          disabled={busy}
          onClick={() => {
            if (window.confirm("이 훈련의 첫 표현과 마무리 기록을 삭제할까요?"))
              void action(async () => {
                await deleteSession(session.id);
                if (alive.current) {
                  setRecent((rows) => rows.filter((r) => r.id !== session.id));
                  setSession(undefined);
                  setExerciseId("");
                  setNotice("훈련 기록을 삭제했어요.");
                }
              });
          }}
        >
          이 훈련 기록 삭제
        </button>
      )}
    </section>
  );
}
