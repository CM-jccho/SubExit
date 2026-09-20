"use client";
import InputDialog from "./InputDialog";
import CompactField, { fieldExamples } from "./CompactField";
import { useAIConsent } from "./ConsentSession";
import { useEffect, useRef, useState } from "react";
import { emptyProfile } from "@/lib/conversation-cards";
import {
  RECORDING_MAX_TEXT,
  RECORDING_MAX_SEGMENTS,
} from "@/lib/recording-limits";
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
export function RecordingExamples({ onStart }: { onStart: () => void }) {
  const [example, setExample] = useState<
    (typeof recordingExamples)[number] | null
  >(null);
  return (
    <section className="learn-recording-examples">
      <div className="vn-toolbar">
        <h2>코칭 결과 미리보기</h2>
        <span className="dc-sample-badge">AI 호출 없는 예시</span>
      </div>
      <div className="learn-example-grid">
        {recordingExamples.map((e) => (
          <button
            className="learn-term"
            key={e.id}
            onClick={() => setExample(e)}
          >
            <small>가상 대화 · 코칭 결과 예시</small>
            <strong>{e.title}</strong>
            <span>잘한 점과 다음에 바꿔 말할 표현을 살펴보세요.</span>
            <em>대화와 코칭 결과 보기 →</em>
          </button>
        ))}
      </div>
      <InputDialog
        open={!!example}
        title="코칭 결과 미리보기"
        className="recording-example-preview"
        closeLabel="녹음 예시 닫기"
        onClose={() => setExample(null)}
        footer={
          <div className="recording-example-actions">
            <button className="dd-secondary" onClick={() => setExample(null)}>
              목록으로 돌아가기
            </button>
            <button
              className="dd-primary"
              onClick={() => {
                setExample(null);
                onStart();
              }}
            >
              내 대화로 시작하기 <Icon name="arrow" size={18} />
            </button>
          </div>
        }
      >
        {example && (
          <>
            <span className="dc-sample-badge">
              읽어보는 예시 · AI 호출 없음
            </span>
            <h3 className="recording-example-title">{example.title}</h3>
            <p className="recording-example-intro">
              아래로 내려 대화와 코칭 결과를 읽어보세요. 내 대화를 돌아보려면
              ‘내 대화로 시작하기’를 누르세요.
            </p>
            <section aria-labelledby="recording-example-conversation">
              <h3 id="recording-example-conversation">대화 예시</h3>
              <p className="vn-caption">
                말한 사람이 미리 표시된 가상 대화예요.
              </p>
              <ol className="learn-example-transcript">
                {example.segments.map((s) => (
                  <li key={s.id}>
                    <strong>{s.role === "user" ? "내 말" : "상대 말"}</strong>
                    <p>{s.text}</p>
                  </li>
                ))}
              </ol>
              <p className="recording-example-goal">
                <strong>이 대화의 목표</strong> · {example.context.goal}
              </p>
            </section>
            <section aria-labelledby="recording-example-result">
              <h3 id="recording-example-result">코칭 결과 예시</h3>
              <p className="vn-caption">
                이 대화를 바탕으로 미리 작성한 코칭이에요.
              </p>
              <ReviewContent review={example.review} />
            </section>
          </>
        )}
      </InputDialog>
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
  const [segmentPage, setSegmentPage] = useState(0);
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
    [consent, setConsent] = useAIConsent(),
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
  const tooLong = (draft?.transcript.length || 0) > RECORDING_MAX_TEXT;
  const speakerCheck = useRef<HTMLDivElement>(null);
  const hasMySpeech = !!draft?.segments.some((s) => s.role === "user");
  const unknownSpeakers =
    draft?.segments.filter((s) => s.role === "unknown").length || 0;
  function markAllMine() {
    if (!draft) return;
    edit({
      segments: draft.segments.map((s) => ({ ...s, role: "user" })),
      context: {
        ...draft.context,
        partner: draft.context.partner || "혼자 말하기",
      },
    });
  }
  function markAlternating(first: "user" | "assistant") {
    if (!draft) return;
    edit({
      segments: draft.segments.map((segment, index) => ({
        ...segment,
        role:
          index % 2 === 0
            ? first
            : first === "user"
              ? "assistant"
              : "user",
      })),
    });
    setNotice(
      first === "user"
        ? "내가 먼저 말한 대화로 초안을 지정했어요. 틀린 부분만 눌러 바꿔주세요."
        : "상대가 먼저 말한 대화로 초안을 지정했어요. 틀린 부분만 눌러 바꿔주세요.",
    );
  }
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
        <span>녹음·문자 코칭</span>
      </div>
      <p>
        녹음한 내용이나 대화 문자를 그대로 넣어 주세요. 다음 화면에서 누가
        말했는지만 확인하면 돼요. 혼자 말한 녹음도 코칭할 수 있어요.
      </p>
      {source?.clip?.transcription && !source.clip.transcription.complete && (
        <p className="learn-callout">
          전체 {source.clip.transcription.total}구간 중{" "}
          {source.clip.transcription.parts.length}구간만 변환됐어요. 현재 문자만
          코칭하거나, 위의 ‘문자 변환 이어서’로 나머지를 완료하세요.
        </p>
      )}
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
            {["문자 수정", "말한 사람·목표 확인", "코칭"].map((s, i) => (
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
              코칭할 문자를 60,000자 이내로 나눠 주세요. 원본 음성 크기와 별도로
              문자를 분석할 수 있어요.
            </p>
          )}
          {step === 1 && (
            <>
              <label className="vn-label">
                코칭받을 내용
                <textarea
                  rows={7}
                  maxLength={RECORDING_MAX_TEXT}
                  value={draft.transcript}
                  disabled={locked}
                  onChange={(e) =>
                    edit({ transcript: e.target.value, segments: [] })
                  }
                  placeholder="녹음한 내용이나 대화를 그대로 넣어 주세요."
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
                  if (
                    segments.length < 1 ||
                    segments.length > RECORDING_MAX_SEGMENTS
                  ) {
                    setError(
                      "내용이 너무 많아요. 코칭받고 싶은 장면만 남겨 주세요.",
                    );
                    return;
                  }
                  setSegmentPage(0);
                  void save(
                    { ...draft, segments, confirmed: false, review: undefined },
                    2,
                  );
                }}
              >
                다음 · 누가 말했나요? <Icon name="arrow" size={16} />
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <div
                ref={speakerCheck}
                className="learn-speaker-check"
                tabIndex={-1}
              >
                <div className="learn-speaker-quick">
                  <strong>누가 먼저 말했나요?</strong>
                  <p className="vn-caption">
                    가장 가까운 패턴을 한 번 선택한 뒤, 틀린 부분만 아래에서
                    바꿔주세요. 앱이 음성만으로 화자를 확정하지는 않아요.
                  </p>
                  <div className="learn-speaker-quick-actions">
                    <button
                      type="button"
                      className="dd-secondary"
                      disabled={locked}
                      onClick={markAllMine}
                    >
                      혼자 녹음 · 전부 내 말
                    </button>
                    <button
                      type="button"
                      className="dd-secondary"
                      disabled={locked}
                      onClick={() => markAlternating("assistant")}
                    >
                      상대가 먼저
                    </button>
                    <button
                      type="button"
                      className="dd-secondary"
                      disabled={locked}
                      onClick={() => markAlternating("user")}
                    >
                      내가 먼저
                    </button>
                  </div>
                </div>
                {draft.segments.length > 20 && (
                  <nav
                    className="vn-toolbar"
                    aria-label="말한 사람 확인 페이지"
                  >
                    <button
                      className="dd-secondary"
                      disabled={locked || segmentPage === 0}
                      onClick={() => setSegmentPage((p) => p - 1)}
                    >
                      이전 20개
                    </button>
                    <span>
                      {segmentPage + 1} /{" "}
                      {Math.ceil(draft.segments.length / 20)}
                    </span>
                    <button
                      className="dd-secondary"
                      disabled={
                        locked ||
                        (segmentPage + 1) * 20 >= draft.segments.length
                      }
                      onClick={() => setSegmentPage((p) => p + 1)}
                    >
                      다음 20개
                    </button>
                  </nav>
                )}
                <div className="learn-segments">
                  {draft.segments
                    .slice(segmentPage * 20, (segmentPage + 1) * 20)
                    .map((segment, i) => (
                      <div key={segment.id}>
                        <div className="learn-segment-head">
                          <span>내용 {segmentPage * 20 + i + 1}</span>
                          <div
                            className="learn-speaker-toggle"
                            role="group"
                            aria-label={`내용 ${segmentPage * 20 + i + 1} 화자 선택`}
                          >
                            <button
                              type="button"
                              className={segment.role === "user" ? "active" : ""}
                              aria-pressed={segment.role === "user"}
                              disabled={locked}
                              onClick={() =>
                                edit({
                                  segments: draft.segments.map((s) =>
                                    s.id === segment.id
                                      ? { ...s, role: "user" }
                                      : s,
                                  ),
                                })
                              }
                            >
                              내 말
                            </button>
                            <button
                              type="button"
                              className={
                                segment.role === "assistant" ? "active" : ""
                              }
                              aria-pressed={segment.role === "assistant"}
                              disabled={locked}
                              onClick={() =>
                                edit({
                                  segments: draft.segments.map((s) =>
                                    s.id === segment.id
                                      ? { ...s, role: "assistant" }
                                      : s,
                                  ),
                                })
                              }
                            >
                              상대 말
                            </button>
                          </div>
                        </div>
                        <p>{segment.text}</p>
                      </div>
                    ))}
                </div>
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
                  <CompactField
                    key={key}
                    label={label}
                    maxLength={max}
                    disabled={locked}
                    value={draft.context[key]}
                    examples={fieldExamples[key]}
                    onChange={(value) =>
                      edit({ context: { ...draft.context, [key]: value } })
                    }
                  />
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
                이번 코칭에는 확인한 문자·말한 사람·목표를 보내요. 음성 원본은
                다시 전송하지 않아요.
              </p>
              {(!hasMySpeech || unknownSpeakers > 0) && (
                <aside
                  className="learn-speaker-help"
                  aria-label="말한 사람 확인 필요"
                >
                  <strong>
                    {!hasMySpeech
                      ? "코칭할 내 말을 골라주세요"
                      : `${unknownSpeakers}개 내용의 말한 사람을 확인해 주세요`}
                  </strong>
                  <p>
                    위의 빠른 지정을 먼저 사용한 뒤, 잘못 지정된 내용만
                    수정하면 돼요.
                  </p>
                  <button
                    className="dd-secondary"
                    disabled={locked}
                    onClick={markAllMine}
                  >
                    혼자 녹음했어요 · 전부 내 말로
                  </button>
                  <button
                    className="dd-link"
                    disabled={locked}
                    onClick={() => {
                      const firstUnknown = draft.segments.findIndex(
                        (s) => s.role === "unknown",
                      );
                      setSegmentPage(
                        Math.max(0, Math.floor(firstUnknown / 20)),
                      );
                      speakerCheck.current?.scrollIntoView({
                        block: "start",
                        behavior: "smooth",
                      });
                      speakerCheck.current?.focus({ preventScroll: true });
                    }}
                  >
                    대화 녹음이에요 · 말한 사람 확인
                  </button>
                </aside>
              )}
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
                  말한 사람·목표 저장
                </button>
                <button
                  className="dd-primary"
                  disabled={
                    locked ||
                    stale ||
                    tooLong ||
                    !hasMySpeech ||
                    unknownSpeakers > 0 ||
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
                  말한 사람·목표 다시 확인
                </button>
                {draft.segments[
                  draft.segments.findIndex(
                    (s) => s.id === validReview.improvement.turnId,
                  ) - 1
                ]?.role === "assistant" && (
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
                )}
              </div>
              <small>
                인용한 원문과 내 목표가 맞는지 확인해 주세요. 상대의 직전 말이
                있는 장면은 이어서 대화 연습도 할 수 있어요.
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
