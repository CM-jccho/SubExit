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
import { Icon, Companion } from "./CompanionUI";
import { useCompanion } from "./CompanionTheme";
import QuotaHelp from "./QuotaHelp";

export default function LiveSpeechPanel({
  profile,
  scenario,
  tone,
  consent,
  adult,
  sample,
  onActiveChange,
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
}) {
  const character = useCompanion();
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
        if (id === generation.current) setReply({ data, text });
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
          ? "마이크 권한이 필요해요. Safari 주소창의 사이트 설정에서 마이크를 허용한 뒤 다시 시작해 주세요."
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

          <section className={"live-primary-action" + (active ? " is-active" : "")}>
            <div>
              <span className="live-primary-kicker">실시간 대화 도움</span>
              <h2>
                {active
                  ? "상대 말을 듣고 있어요"
                  : "상대 말을 들으면서 다음 한마디를 받아보세요"}
              </h2>
              <p>
                {active
                  ? "자막과 AI 제안이 대화 흐름에 맞춰 계속 갱신돼요."
                  : "버튼을 누르고 상대의 말을 들려주면 자막과 다음 한마디를 바로 이어서 보여드려요."}
              </p>
            </div>
            <button
              type="button"
              className={active ? "dd-secondary live-primary-cta" : "dd-primary live-primary-cta"}
              onClick={handlePrimaryAction}
            >
              <Icon name={active ? "pause" : "mic"} size={22} />
              {active ? "듣기 멈춤" : "실시간 듣기 시작"}
            </button>
            <div className="live-primary-status" role="status">
              <strong
                className={
                  "mic-status " +
                  (state === "listening" ? "is-listening" : "")
                }
              >
                <i aria-hidden="true" />
                {state === "listening"
                  ? "계속 듣고 있어요"
                  : state === "connecting"
                    ? "마이크와 음성 인식을 연결하고 있어요"
                    : "준비 전"}
              </strong>
              <span>
                {state === "listening"
                  ? "확정된 말을 바탕으로 다음 한마디를 자동으로 갱신해요."
                  : "실시간 도움을 가장 먼저 시작하고, 필요한 설정은 아래에서 최소한으로 확인해요."}
              </span>
            </div>
          </section>

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
              {state === "listening" && (
                <button
                  className="dd-secondary"
                  onClick={() => {
                    setError("");
                    makeQueue(generation.current);
                    queue.current?.update(finalText.current);
                  }}
                >
                  코칭 다시 연결
                </button>
              )}
            </div>
          )}
          {notice && (
            <p role="status" className="live-stream-note">
              {notice}
            </p>
          )}

          <div className="live-caption" aria-label="인식 중인 상대 말">
            <div className="live-caption-head">
              <h2>지금 들리는 상대 말</h2>
              <span className="live-stream-label">
                {active ? "실시간 자막" : "듣기를 시작하면 여기에 보여요"}
              </span>
            </div>
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
              {!caption.final && !caption.interim && (
                <span className="live-caption-placeholder">
                  상대의 말이 여기에 자막처럼 나타나요.
                </span>
              )}
            </p>
          </div>

          {contextControl}

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
            <summary id="live-guide-heading">설정 · 개인정보 · 사용 방법</summary>
            {!contextControl && profile && (
              <dl className="live-context-summary">
                <div>
                  <dt>대화 상대</dt>
                  <dd>{profile.partner}</dd>
                </div>
                <div>
                  <dt>내 목표</dt>
                  <dd>{profile.goal}</dd>
                </div>
              </dl>
            )}
            <div className="live-guide-detail">
              <strong>실시간 자막은 이렇게 처리해요</strong>
              <p>
                브라우저 음성 인식 서비스가 음성을 글로 바꾸고, 확정된 문장을 Gemini에 보내 다음 한마디를 만들어요.
              </p>
              <p>
                내 목소리와 상대를 자동 구분하지 않아요. 내가 말할 때는 ‘듣기 멈춤’을 눌러주세요.
              </p>
              <p>
                자막은 인식되는 대로 보여주고, AI 제안 속도는 연결 상태에 따라 달라질 수 있어요.
              </p>
            </div>
          </details>
        </section>
        <aside
          className={
            "dc-answer-panel live-stream-reply " +
            (reply ? "is-ready" : "quick-answer-empty")
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
              <details>
                <summary>어떤 말을 바탕으로 제안했나요?</summary>
                <q>{reply.data.evidence}</q>
                <p>{reply.data.reason}</p>
              </details>
            </>
          ) : (
            <div className="dc-answer-wait">
              {profile && (
                <div className="live-goal-brief">
                  <h2>이번 대화에서 기억할 것</h2>
                  <p>
                    <strong>원하는 결과</strong>
                    {profile.goal}
                  </p>
                  {profile.boundaries && (
                    <p className="live-boundary">
                      <strong>지킬 선</strong>
                      {profile.boundaries}
                    </p>
                  )}
                </div>
              )}
              <Companion small mood={working ? "think" : "listen"} />
              <h2>
                {working
                  ? "내 목표에 맞게 생각 중이에요"
                  : "듣고 나서, 함께 생각해요"}
              </h2>
              <p>상대의 말이 인식되면 지금 필요한 다음 한마디를 여기에 제안해요.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
