"use client";
import { useEffect, useRef, useState } from "react";
import { emptyProfile } from "@/lib/conversation-cards";
import {
  aiFetch,
  AIServiceError,
  connectionOutage,
  outageMessage,
} from "@/lib/ai-client";
import {
  recordingExamples,
  recordingInputKey,
  recordingDrill,
  recordingTurns,
  splitRecordingTranscript,
  validateRecordingInput,
  type RecordingAnalysisDraft,
  type RecordingSegment,
} from "@/lib/recording-analysis";
import {
  reviewKey,
  validateReview,
  type PracticeReview,
} from "@/lib/practice-review";
import type { VoiceSession, VoiceTurn } from "@/lib/voice-notebook";
import { AIConsent, type AIConfig } from "./VoiceComposer";
import { Icon } from "./CompanionUI";
import CompanionNudge from "./CompanionNudge";
function ReviewContent({ review }: { review: PracticeReview }) {
  return (
    <div className="learn-review">
      <article>
        <h3>잘한 점</h3>
        <blockquote>{review.strength.quote}</blockquote>
        <p>{review.strength.note}</p>
      </article>
      <article>
        <h3>다음에는 이렇게</h3>
        <blockquote>{review.improvement.quote}</blockquote>
        <p>{review.improvement.note}</p>
        <strong>다시 말해보기</strong>
        <p className="dc-review-rewrite">{review.improvement.rewrite}</p>
      </article>
      <p>
        <strong>다음 연습의 목표</strong> · {review.focus}
      </p>
    </div>
  );
}
export function RecordingExamples() {
  const [example, setExample] = useState<
      (typeof recordingExamples)[number] | null
    >(null),
    dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (example) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [example]);
  return (
    <section className="learn-recording-examples">
      <div className="vn-toolbar">
        <h2>녹음 코칭, 먼저 체험해보세요</h2>
        <span className="dc-sample-badge">AI 호출 없는 예시</span>
      </div>
      <div className="learn-example-grid">
        {recordingExamples.map((e) => (
          <button
            className="learn-term"
            key={e.id}
            onClick={() => setExample(e)}
          >
            <small>가상 녹음의 문자 · 사전 작성 코칭</small>
            <strong>{e.title}</strong>
            <span>문자 확인 → 화자 확인 → 코칭 결과</span>
            <em>예시 열기 →</em>
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="vn-dialog"
        aria-labelledby="recording-example-title"
        onCancel={() => setExample(null)}
      >
        {example && (
          <>
            <div className="vn-dialog-head">
              <div>
                <span className="dc-sample-badge">사전 작성 샘플</span>
                <h2 id="recording-example-title">{example.title}</h2>
              </div>
              <button
                className="vn-icon"
                aria-label="녹음 예시 닫기"
                onClick={() => setExample(null)}
              >
                <Icon name="close" />
              </button>
            </div>
            <p>
              사용법을 보여주는 가상 대화와 코칭이에요. 실제 녹음 파일·실제
              사용자 기록·현재 AI 분석은 포함하지 않아요.
            </p>
            <ol className="learn-example-transcript">
              {example.segments.map((s) => (
                <li key={s.id}>
                  <strong>{s.role === "user" ? "내 말" : "상대 말"}</strong>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
            <p>
              <strong>내 목표</strong> · {example.context.goal}
            </p>
            <ReviewContent review={example.review} />
          </>
        )}
      </dialog>
    </section>
  );
}
function initialDraft(
  session: VoiceSession,
  source: VoiceTurn,
): RecordingAnalysisDraft {
  return {
    sourceTurnId: source.id,
    inputKey: recordingInputKey(source),
    transcript: source.text,
    segments: [],
    context: { ...emptyProfile(), title: session.title.slice(0, 60) },
    confirmed: false,
  };
}
export default function RecordingAnalysis({
  session,
  config,
  disabled,
  onSave,
  onPractice,
  onBusy,
}: {
  session: VoiceSession;
  config: AIConfig;
  disabled: boolean;
  onSave: (draft: RecordingAnalysisDraft) => Promise<void>;
  onPractice: (next: VoiceSession) => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  const sources = session.turns.filter((t) => t.role === "recording");
  const [sourceId, setSourceId] = useState(
    session.recordingAnalysis?.sourceTurnId || sources[0]?.id || "",
  );
  const source = sources.find((t) => t.id === sourceId) || sources[0];
  const [draft, setDraft] = useState<RecordingAnalysisDraft | null>(
    () =>
      session.recordingAnalysis ||
      (source ? initialDraft(session, source) : null),
  );
  const [step, setStep] = useState(
      session.recordingAnalysis?.review
        ? 3
        : session.recordingAnalysis?.segments.length
          ? 2
          : 1,
    ),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const abort = useRef<AbortController | null>(null),
    alive = useRef(true),
    flight = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (source && !draft) {
      setSourceId(source.id);
      setDraft(initialDraft(session, source));
    }
  }, [source, draft, session]);
  const locked = busy || disabled;
  const stale = !!(
    source &&
    draft &&
    draft.inputKey !== recordingInputKey(source)
  );
  const tooLong = !!(
    source?.clip &&
    (source.clip.duration > 120 || source.clip.blob.size > 2400000)
  );
  function edit(p: Partial<RecordingAnalysisDraft>) {
    setDraft((d) =>
      d ? { ...d, ...p, confirmed: false, review: undefined } : d,
    );
    setNotice("");
    setError("");
  }
  async function save(next: RecordingAnalysisDraft, nextStep: number) {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      await onSave(next);
      if (alive.current) {
        setDraft(next);
        setStep(nextStep);
        setNotice("확인한 내용을 이 기기에 저장했어요.");
      }
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "저장하지 못했어요.");
    } finally {
      flight.current = false;
      if (alive.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  }
  async function analyze() {
    if (!draft || !source || stale || tooLong || flight.current || !consent)
      return;
    try {
      validateRecordingInput(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "화자와 목표를 확인해 주세요.");
      return;
    }
    flight.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    setNotice("");
    const controller = new AbortController();
    abort.current = controller;
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      await onSave(draft);
      if (!alive.current) return;
      const response = await aiFetch("/api/recording-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          context: draft.context,
          segments: draft.segments,
          confirmed: draft.confirmed,
          consent,
          adultConsent: consent,
          sampleConsent: consent,
        }),
      });
      const result = await response.json();
      if (!alive.current) return;
      if (!response.ok)
        throw new Error(result.error || "코칭을 받지 못했어요.");
      const next = {
        ...draft,
        review: validateReview(
          result.review,
          draft.context,
          recordingTurns(draft.segments),
        ),
      };
      await onSave(next);
      if (alive.current) {
        setDraft(next);
        setStep(3);
        setNotice("내 말에 근거한 코칭을 저장했어요.");
      }
    } catch (e) {
      if (alive.current)
        setError(
          (e instanceof AIServiceError
            ? outageMessage(e.outage)
            : e instanceof Error && e.name === "AbortError"
              ? outageMessage(connectionOutage())
              : e instanceof Error
                ? e.message
                : "코칭을 받지 못했어요.") +
            " 녹음과 확인한 문자는 보관돼요. 음성 기록 목록에서 가상 예시를 별도로 볼 수 있어요.",
        );
    } finally {
      clearTimeout(timer);
      flight.current = false;
      if (alive.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  }
  const validReview =
    draft?.review &&
    !stale &&
    draft.review.sourceKey ===
      reviewKey(draft.context, recordingTurns(draft.segments))
      ? draft.review
      : null;
  return (
    <section className="learn-recording-analysis" aria-label="외부 녹음 코칭">
      <div className="vn-toolbar">
        <h2>
          {source?.clip
            ? "이 녹음으로 대화 돌아보기"
            : "이 문자로 대화 돌아보기"}
        </h2>
        <span>2분 · 2.4MB 이내</span>
      </div>
      <p>
        문자 변환 후 발화마다 줄을 나누고, 내 말과 상대 말을 직접 확인해 주세요.
        자동 화자 분리와 억양 분석은 제공하지 않아요.
      </p>
      {!source || !draft ? (
        <p className="learn-callout">
          먼저 아래에서 파일을 첨부하거나 녹음하고 ‘이 기록에 추가’를
          눌러주세요.
        </p>
      ) : (
        <>
          {sources.length > 1 && (
            <label className="vn-label">
              코칭할 음성 하나 선택
              <select
                value={source.id}
                disabled={locked}
                onChange={(e) => {
                  const t = sources.find((t) => t.id === e.target.value)!;
                  setSourceId(t.id);
                  setDraft(initialDraft(session, t));
                  setStep(1);
                  setError("");
                  setNotice("");
                }}
              >
                {sources.map((t, i) => (
                  <option key={t.id} value={t.id}>
                    {t.clip?.name || `문자 기록 ${i + 1}`}
                  </option>
                ))}
              </select>
              <small>
                이 기록에는 선택한 음성의 코칭 한 개를 저장해요. 다른 음성을
                저장하면 이전 코칭을 교체해요.
              </small>
            </label>
          )}
          <ol className="learn-steps">
            {["문자 수정", "화자·목표 확인", "코칭"].map((s, i) => (
              <li
                className={step === i + 1 ? "active" : ""}
                key={s}
                aria-current={step === i + 1 ? "step" : undefined}
              >
                {i + 1}. {s}
              </li>
            ))}
          </ol>
          {stale && (
            <div className="learn-callout">
              <p>
                원래 문자가 바뀌었어요. 최신 문자를 가져온 뒤 다시 확인해
                주세요.
              </p>
              <button
                className="dd-secondary"
                disabled={locked}
                onClick={() => {
                  setDraft(initialDraft(session, source));
                  setStep(1);
                }}
              >
                최신 문자 가져오기
              </button>
            </div>
          )}
          {tooLong && (
            <p className="dd-error" role="alert">
              2분·2.4MB 이내 음성으로 나누어 다시 첨부해 주세요.
            </p>
          )}
          {step === 1 && (
            <>
              <label className="vn-label">
                코칭할 문자 · 말하는 사람이 바뀔 때 줄바꿈
                <textarea
                  rows={7}
                  maxLength={4000}
                  value={draft.transcript}
                  disabled={locked}
                  onChange={(e) =>
                    edit({ transcript: e.target.value, segments: [] })
                  }
                  placeholder="상대가 한 말\n내가 한 말\n상대가 이어서 한 말"
                />
              </label>
              <small>
                원본 음성과 원래 변환 문자는 유지돼요. 이 수정본은 다음 버튼을
                눌러 저장해요. 3명 이상 대화라면 한 상대와 나눈 장면만
                남겨주세요.
              </small>
              <button
                className="dd-primary"
                disabled={
                  locked || stale || tooLong || !draft.transcript.trim()
                }
                onClick={() => {
                  const segments = splitRecordingTranscript(draft.transcript);
                  if (segments.length < 2 || segments.length > 40) {
                    setError(
                      "화자별로 줄을 나눠 2~40개의 발화로 정리해 주세요.",
                    );
                    return;
                  }
                  void save(
                    { ...draft, segments, confirmed: false, review: undefined },
                    2,
                  );
                }}
              >
                수정 문자 저장 · 화자 확인 <Icon name="arrow" size={16} />
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <div className="learn-segments">
                {draft.segments.map((segment, i) => (
                  <div key={segment.id}>
                    <label className="vn-label">
                      발화 {i + 1}의 화자
                      <select
                        disabled={locked}
                        value={segment.role}
                        onChange={(e) =>
                          edit({
                            segments: draft.segments.map((s) =>
                              s.id === segment.id
                                ? {
                                    ...s,
                                    role: e.target
                                      .value as RecordingSegment["role"],
                                  }
                                : s,
                            ),
                          })
                        }
                      >
                        <option value="unknown">선택해 주세요</option>
                        <option value="user">내 말</option>
                        <option value="assistant">상대 말</option>
                      </select>
                    </label>
                    <p>{segment.text}</p>
                  </div>
                ))}
              </div>
              <div className="learn-grid">
                {(
                  [
                    ["partner", "상대는 누구인가요?", 160],
                    ["situation", "어떤 상황이었나요?", 800],
                    ["goal", "원하는 결과", 400],
                    ["boundaries", "지킬 선 · 선택", 400],
                  ] as const
                ).map(([key, label, max]) => (
                  <label className="vn-label" key={key}>
                    {label}
                    <textarea
                      rows={2}
                      maxLength={max}
                      disabled={locked}
                      value={draft.context[key]}
                      onChange={(e) =>
                        edit({
                          context: { ...draft.context, [key]: e.target.value },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="dd-check">
                <input
                  type="checkbox"
                  disabled={locked}
                  checked={draft.confirmed}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      confirmed: e.target.checked,
                      review: undefined,
                    })
                  }
                />
                문자와 내 말·상대 말이 맞고, 상황과 목표를 확인했어요.
              </label>
              <AIConsent
                config={config}
                checked={consent}
                onChange={setConsent}
                disabled={locked}
              />
              <p className="vn-caption">
                이번 코칭에는 확인한 문자·화자·목표를 보내요. 음성 원본은 다시
                전송하지 않아요.
              </p>
              <div className="vn-toolbar">
                <button
                  className="dd-secondary"
                  disabled={locked}
                  onClick={() => setStep(1)}
                >
                  문자 다시 수정
                </button>
                <button
                  className="dd-secondary"
                  disabled={locked}
                  onClick={() => void save(draft, 2)}
                >
                  화자·목표 저장
                </button>
                <button
                  className="dd-primary"
                  disabled={
                    locked ||
                    stale ||
                    tooLong ||
                    !draft.confirmed ||
                    !consent ||
                    !config.available
                  }
                  onClick={() => void analyze()}
                >
                  확인한 대화 코칭받기
                </button>
              </div>
            </>
          )}
          {step === 3 && validReview && (
            <>
              <span className="dc-sample-badge">
                저장된 AI 코칭 · 직접 확인한 문자 기준
              </span>
              <ReviewContent review={validReview} />
              <div className="vn-toolbar">
                <button
                  className="dd-secondary"
                  disabled={locked}
                  onClick={() => setStep(2)}
                >
                  화자·목표 다시 확인
                </button>
                <button
                  className="dd-primary"
                  disabled={locked}
                  onClick={async () => {
                    try {
                      await onPractice(recordingDrill(session, draft));
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "재연습을 열지 못했어요.",
                      );
                    }
                  }}
                >
                  이 장면 다시 연습 <Icon name="arrow" size={16} />
                </button>
              </div>
              <small>
                인용한 원문과 내 목표가 맞는지 확인해 주세요. 재연습에서는 녹음
                속 상대의 직전 말을 가져와 AI가 역할을 이어가요.
              </small>
            </>
          )}
        </>
      )}
      {busy && (
        <CompanionNudge
          mood="think"
          text="확인한 말에서 다음 연습에 도움이 될 부분을 찾고 있어요."
        />
      )}
      {notice && (
        <p role="status" className="vn-caption">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="dd-error">
          {error}
        </p>
      )}
    </section>
  );
}
