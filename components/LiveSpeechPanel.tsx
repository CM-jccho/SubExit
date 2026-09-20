"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { aiFetch } from "@/lib/ai-client";
import {
  LatestCoachQueue,
  SpeechStream,
  speechConstructor,
} from "@/lib/live-speech";
import { requestMicrophone } from "@/lib/microphone";
import type { CoachResponse } from "@/lib/coach-contract";
import type { ContextProfile } from "@/lib/conversation-cards";
import type { Tone } from "@/lib/scenarios";
import { Icon } from "./CompanionUI";
import QuotaHelp from "./QuotaHelp";

export default function LiveSpeechPanel({
  profile,
  scenario,
  tone,
  consent,
  adult,
  sample,
  onActiveChange,
  readyToStart = true,
  onCue,
  rememberItems = [],
  rememberGoal,
  rememberBoundary,
  consentControl,
  available = true,
  unavailableMessage,
  onUseText,
  inputTabs,
  contextControl,
}: {
  inputTabs?: ReactNode;
  contextControl?: ReactNode;
  onUseText?: (text: string) => void;
  available?: boolean;
  unavailableMessage?: string;
  consentControl?: ReactNode;
  profile?: ContextProfile;
  scenario: string;
  tone: Tone;
  consent: boolean;
  adult: boolean;
  sample: boolean;
  onActiveChange: (active: boolean) => void;
  readyToStart?: boolean;
  onCue?: (cue: { opponent: string; response: CoachResponse }) => void;
  rememberItems?: string[];
  rememberGoal?: string;
  rememberBoundary?: string;
}) {
  const [state, setState] = useState<"idle" | "connecting" | "listening">(
    "idle",
  );
  const [caption, setCaption] = useState({ final: "", interim: "" });
  const [reply, setReply] = useState<{ data: CoachResponse; text: string }>();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const speech = useRef<SpeechStream>();
  const queue = useRef<LatestCoachQueue<CoachResponse>>();
  const permission = useRef<AbortController>();
  const stateRef = useRef<"idle" | "connecting" | "listening">("idle");
  const finalText = useRef("");
  const captionArea = useRef<HTMLParagraphElement>(null);
  const followCaption = useRef(true);
  const generation = useRef(0);
  const activeCallback = useRef(onActiveChange);
  activeCallback.current = onActiveChange;
  useEffect(() => {
    if (captionArea.current && followCaption.current)
      captionArea.current.scrollTop = captionArea.current.scrollHeight;
  }, [caption]);
  function setRecognitionState(next: "idle" | "connecting" | "listening") {
    stateRef.current = next;
    setState(next);
  }
  function stop() {
    generation.current++;
    permission.current?.abort();
    speech.current?.stop();
    queue.current?.cancel();
    setRecognitionState("idle");
    setWorking(false);
    activeCallback.current(false);
  }
  useEffect(() => {
    const hide = () => {
      if (!document.hidden) return;
      // iOS Safari can briefly hide the page while native microphone/speech
      // permission UI is open. Keep the permission/connection attempt alive
      // and stop only after recognition has actually begun listening.
      if (stateRef.current === "listening") {
        stop();
        setNotice("화면을 벗어나 듣기를 멈췄어요. 다시 시작해 주세요.");
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      generation.current++;
      permission.current?.abort();
      speech.current?.stop();
      queue.current?.cancel();
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  useEffect(() => {
    if (!available || !consent || !adult) stop();
  }, [available, consent, adult]);
  const contextKey = JSON.stringify({ profile, scenario, tone });
  const previousContext = useRef(contextKey);
  useEffect(() => {
    if (previousContext.current === contextKey) return;
    previousContext.current = contextKey;
    stop();
    setReply(undefined);
    setError("");
    setNotice("상대와 목표를 바꿨어요. 듣기를 시작하면 새 목표로 코칭해요.");
  }, [contextKey]);
  function makeQueue(id: number) {
    queue.current?.cancel();
    queue.current = new LatestCoachQueue<CoachResponse>({
      generate: async (opponent, signal) => {
        const response = await aiFetch("/api/coach", {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "ai",
            quick: true,
            scenario,
            context: profile,
            tone,
            opponent,
            reply: "",
            consent,
            adultConsent: adult,
            sampleConsent: sample,
          }),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "코칭을 불러오지 못했어요.");
        if (data.source !== "ai" || typeof data.suggestion !== "string")
          throw new Error("코칭 응답을 확인하지 못했어요.");
        return data;
      },
      result: (data, text) => {
        if (id === generation.current) {
          setReply({ data, text });
          onCue?.({ opponent: text, response: data });
        }
      },
      busy: (busy) => {
        if (id === generation.current) setWorking(busy);
      },
      error: (e) => {
        if (id === generation.current)
          setError(
            e instanceof Error && e.name === "AbortError"
              ? "코칭 응답이 늦어 멈췄어요. 자막은 계속 받아요."
              : e instanceof Error
                ? e.message
                : "코칭 연결을 확인해 주세요.",
          );
      },
    });
  }
  async function start() {
    const Engine = speechConstructor();
    if (!Engine || !available || !consent || !adult) return;
    stop();
    const id = ++generation.current;
    setError("");
    setNotice("마이크 권한을 확인하고 있어요.");
    setReply(undefined);
    setCaption({ final: "", interim: "" });
    finalText.current = "";
    followCaption.current = true;
    activeCallback.current(true);
    setRecognitionState("connecting");

    const controller = new AbortController();
    permission.current = controller;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "이 브라우저에서는 마이크를 사용할 수 없어요. 들려주기나 직접 입력을 이용해 주세요.",
        );
      const media = await requestMicrophone(
        { audio: { echoCancellation: true, noiseSuppression: true } },
        controller.signal,
      );
      media.getTracks().forEach((track) => track.stop());
      if (id !== generation.current) return;

      setNotice("마이크 권한을 확인했어요. 실시간 음성 인식을 연결하고 있어요.");
      makeQueue(id);
      speech.current = new SpeechStream(Engine, {
        state: (s) => {
          if (id === generation.current) setRecognitionState(s);
        },
        caption: (final, interim) => {
          if (id !== generation.current) return;
          finalText.current = final;
          setCaption({ final, interim });
          queue.current?.update(final);
        },
        notice: (message) => {
          if (id === generation.current) setNotice(message);
        },
        error: (message) => {
          if (id !== generation.current) return;
          stop();
          setError(message);
        },
      });
      speech.current.start();
    } catch (e) {
      if (id !== generation.current) return;
      setRecognitionState("idle");
      activeCallback.current(false);
      setNotice("");
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "마이크 권한이 필요해요. 브라우저의 사이트 설정에서 마이크를 허용한 뒤 다시 시작해 주세요."
          : e instanceof Error && e.name === "AbortError"
            ? "마이크 연결을 취소했어요."
            : e instanceof Error
              ? e.message
              : "마이크를 시작하지 못했어요.",
      );
    } finally {
      if (permission.current === controller) permission.current = undefined;
    }
  }
  const active = state !== "idle";
  function handlePrimaryAction() {
    if (active) {
      stop();
      setNotice(
        "듣기를 멈췄어요. 인식된 말과 마지막 제안은 이 화면에 남아 있어요.",
      );
      return;
    }
    if (!readyToStart) {
      setNotice("먼저 위에서 대화 상대와 이번 대화 목표를 선택해 주세요.");
      document
        .querySelector(".live-context-setup")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!available) {
      setError(
        unavailableMessage ||
          "AI 연결을 확인하지 못해 지금은 듣기를 시작할 수 없어요.",
      );
      return;
    }
    if (!consent || !adult) {
      setNotice("AI 전송 동의를 확인하면 바로 실시간 듣기를 시작할 수 있어요.");
      return;
    }
    void start();
  }
  return (
    <section className="live-stream" aria-label="실시간 자막과 코칭">
      <div
        className={
          "dc-coaching-grid live-stream-workspace" + (reply ? " has-result" : "")
        }
      >
        <section className="dc-listen-panel">
          {inputTabs}

          {(active || caption.final || caption.interim || reply) && (
            <details className="live-caption live-caption-secondary">
              <summary>
                <span>
                  <strong>상대 말 확인</strong>
                  <small>{active ? "실시간 인식 중" : "마지막으로 인식한 말"}</small>
                </span>
                <em>
                  {(caption.interim || caption.final).slice(-56) ||
                    "말을 인식하면 여기에 짧게 보여요"}
                </em>
              </summary>
              <p
                ref={captionArea}
                onScroll={(event) => {
                  const el = event.currentTarget;
                  followCaption.current =
                    el.scrollHeight - el.scrollTop - el.clientHeight < 40;
                }}
              >
                {caption.final}
                <span className="live-caption-interim">
                  {caption.interim ? " " + caption.interim : ""}
                </span>
              </p>
            </details>
          )}

          {onUseText && (
            <button
              className="dd-secondary live-caption-to-text"
              onClick={() => {
                stop();
                onUseText(
                  [caption.final, caption.interim].filter(Boolean).join(" "),
                );
              }}
            >
              자막을 직접 입력으로 이어가기
            </button>
          )}

          <details className="live-stream-guide" aria-labelledby="live-guide-heading">
            <summary id="live-guide-heading">음성 인식 · 개인정보 · 사용 방법</summary>
            <div className="live-guide-detail">
              <strong>실시간 듣기는 이렇게 사용해요</strong>
              <p>
                브라우저 음성 인식 서비스가 상대 말을 글로 바꾸고, 확정된 문장을
                Gemini에 보내 다음 한마디를 만들어요.
              </p>
              <p>
                내가 말할 때는 상단의 ‘내가 말할게요’를 눌러 잠시 멈추고,
                말한 뒤 다시 상대 말 듣기를 시작하면 돼요.
              </p>
            </div>
          </details>
        </section>
        <aside
          className={
            "dc-answer-panel live-stream-reply " +
            (reply ? "is-ready" : "is-waiting")
          }
          aria-label="답변 코칭"
          aria-live="polite"
          aria-busy={working}
        >
          <div className="dc-answer-heading">
            <Icon name="chat" size={20} />
            <span>지금 필요한 한마디</span>
          </div>
          {reply && (
            <div className="live-stream-reply-heading">
              <strong>다음 한마디</strong>
              <span>
                {working
                  ? "새 말로 갱신 중"
                  : reply && reply.text !== caption.final
                    ? "이전 말 기준 제안"
                    : reply
                      ? "AI 제안"
                      : "말이 정리되면 자동으로 제안해요"}
              </span>
            </div>
          )}
          {reply ? (
            <>
              <blockquote>{reply.data.suggestion}</blockquote>
              <details className="live-answer-evidence">
                <summary>왜 이 말을 제안했나요?</summary>
                <q>{reply.data.evidence}</q>
                <p>{reply.data.reason}</p>
              </details>
            </>
          ) : (
            <div className="live-answer-placeholder">
              <strong>
                {working
                  ? "다음 한마디를 준비하고 있어요…"
                  : "상대 말을 들으면 여기에 바로 보여드려요."}
              </strong>
              <span>실제 대화 중에는 이 영역만 보고 말해도 돼요.</span>
            </div>
          )}

          <section className="live-core-controls" aria-label="실시간 대화 제어">
            <button
              type="button"
              className={
                active
                  ? "dd-secondary live-core-primary"
                  : "dd-primary live-core-primary"
              }
              onClick={handlePrimaryAction}
            >
              <Icon name={active ? "pause" : "mic"} size={21} />
              {active
                ? "내가 말할게요"
                : reply || caption.final
                  ? "다시 상대 말 듣기"
                  : "대화 도움 시작"}
            </button>

            {contextControl}

            <div className="live-core-state" role="status">
              <strong
                className={
                  "mic-status " +
                  (state === "listening" ? "is-listening" : "")
                }
              >
                <i aria-hidden="true" />
                {state === "listening"
                  ? "상대 말을 듣고 있어요"
                  : state === "connecting"
                    ? "마이크 연결 중"
                    : "듣기 전"}
              </strong>
              <span>
                {state === "listening"
                  ? "새 말이 들어오면 위의 한마디가 자동으로 갱신돼요."
                  : "설정 없이 바로 시작할 수 있어요."}
              </span>
            </div>

            {!available && (
              <p role="status" className="live-stream-note">
                {unavailableMessage ||
                  "AI 연결을 확인하지 못해 듣기를 시작할 수 없어요. 잠시 후 다시 열어 주세요."}
              </p>
            )}
            {error && (
              <div>
                <p className="dd-error" role="alert">
                  {error}
                </p>
                <QuotaHelp error={error} />
              </div>
            )}
            {notice && (
              <p role="status" className="live-stream-note">
                {notice}
              </p>
            )}
          </section>

          <section className="live-remember-card" aria-label="이번 대화에서 꼭 기억할 것">
            <div className="live-remember-heading">
              <Icon name="book" size={17} />
              <strong>꼭 기억할 것</strong>
            </div>
            <ul>
              {rememberGoal && (
                <li>
                  <span>목표</span>
                  {rememberGoal}
                </li>
              )}
              {rememberBoundary && (
                <li>
                  <span>지킬 선</span>
                  {rememberBoundary}
                </li>
              )}
              {rememberItems.slice(0, 5).map((item, index) => (
                <li key={index} className="live-remember-detected">
                  <span>{index === 0 ? "대화에서" : "기억"}</span>
                  {item}
                </li>
              ))}
              {!rememberGoal && !rememberBoundary && rememberItems.length === 0 && (
                <li className="live-remember-empty">
                  상대가 약속한 일정·해야 할 일·중요한 숫자가 잡히면 여기에 남겨요.
                </li>
              )}
            </ul>
          </section>
        </aside>
      </div>
    </section>
  );
}
