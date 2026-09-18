"use client";
import { useEffect, useRef, useState } from "react";
import { aiFetch } from "@/lib/ai-client";
import {
  LatestCoachQueue,
  SpeechStream,
  speechConstructor,
} from "@/lib/live-speech";
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
}: {
  profile?: ContextProfile;
  scenario: string;
  tone: Tone;
  consent: boolean;
  adult: boolean;
  sample: boolean;
  onActiveChange: (active: boolean) => void;
}) {
  const [state, setState] = useState<"idle" | "connecting" | "listening">(
    "idle",
  );
  const [caption, setCaption] = useState({ final: "", interim: "" });
  const [reply, setReply] = useState<{ data: CoachResponse; text: string }>();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [speechConsent, setSpeechConsent] = useState(false);
  const speech = useRef<SpeechStream>();
  const queue = useRef<LatestCoachQueue<CoachResponse>>();
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
  function stop() {
    generation.current++;
    speech.current?.stop();
    queue.current?.cancel();
    setState("idle");
    setWorking(false);
    activeCallback.current(false);
  }
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        stop();
        setNotice("화면을 벗어나 듣기를 멈췄어요. 다시 시작해 주세요.");
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      generation.current++;
      speech.current?.stop();
      queue.current?.cancel();
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  useEffect(() => {
    if (!consent || !adult) stop();
  }, [consent, adult]);
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
  function start() {
    const Engine = speechConstructor();
    if (!Engine || !speechConsent || !consent || !adult) return;
    stop();
    const id = ++generation.current;
    setError("");
    setNotice("");
    setReply(undefined);
    setCaption({ final: "", interim: "" });
    finalText.current = "";
    followCaption.current = true;
    activeCallback.current(true);
    makeQueue(id);
    speech.current = new SpeechStream(Engine, {
      state: (s) => {
        if (id === generation.current) setState(s);
      },
      caption: (final, interim) => {
        if (id !== generation.current) return;
        finalText.current = final;
        setCaption({ final, interim });
        queue.current?.update(final);
      },
      error: (message) => {
        if (id !== generation.current) return;
        stop();
        setError(message);
      },
    });
    speech.current.start();
  }
  const active = state !== "idle";
  return (
    <section className="live-stream" aria-label="실시간 자막과 코칭">
      <div className="live-stream-toolbar">
        <div role="status">
          <strong
            className={
              "mic-status " + (state === "listening" ? "is-listening" : "")
            }
          >
            <i aria-hidden="true" />
            {state === "listening"
              ? "계속 듣고 있어요"
              : state === "connecting"
                ? "음성 인식 연결 중"
                : "실시간 자막 · 자동 코칭"}
          </strong>
          <span>
            {active
              ? "코칭을 준비하는 동안에도 말을 받아요"
              : "상대의 말을 자막으로 보며 다음 말을 준비하세요"}
          </span>
        </div>
        <button
          className={active ? "dd-secondary" : "dd-primary"}
          onClick={
            active
              ? () => {
                  stop();
                  setNotice(
                    "듣기를 멈췄어요. 인식된 말과 마지막 제안은 이 화면에 남아 있어요.",
                  );
                }
              : start
          }
          disabled={!active && !speechConsent}
        >
          <Icon name={active ? "pause" : "mic"} size={20} />
          {active ? "듣기 멈춤" : "실시간 듣기 시작"}
        </button>
      </div>
      {!speechConsent && (
        <p className="action-reason">
          아래 음성 인식 전송에 동의하면 듣기를 시작할 수 있어요.
        </p>
      )}
      {!speechConsent && (
        <label className="dd-check live-speech-consent">
          <input
            type="checkbox"
            checked={speechConsent}
            onChange={(e) => setSpeechConsent(e.target.checked)}
          />
          <span>
            브라우저 음성 인식 서비스로 음성을 보내 자막을 만들고, 인식된 문장을
            Gemini로 보내 코칭받는 데 동의해요.
          </span>
        </label>
      )}
      <div className="live-caption" aria-label="인식 중인 상대 말">
        <span className="live-stream-label">
          {active ? "들리는 말" : "인식한 말"}
        </span>
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
        <small>
          흐린 글자는 인식 중이며 바뀔 수 있어요. 최근 1,000자를 보여줘요.
        </small>
      </div>
      <aside
        className="live-stream-reply"
        aria-label="다음 한마디"
        aria-live="polite"
        aria-busy={working}
      >
        <div className="live-stream-reply-heading">
          <strong>이렇게 말해볼까요?</strong>
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
          <p>
            자막을 확인하면서 계속 대화하세요. 다음 한마디는 이곳에서 갱신돼요.
          </p>
        )}
      </aside>
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
      <p className="live-stream-note">
        자막은 바로 표시하고, 코칭은 인식이 확정된 말을 모아 갱신해요. 반복
        요청은 최소 3초 간격이며 응답 시간은 연결 상태에 따라 달라요.
      </p>
      <p className="live-stream-note">
        상대 목소리가 잘 들리는 곳에서 사용하세요. 내 목소리와 상대를 자동
        구분하지 않으므로 내가 말할 때는 듣기를 멈춰주세요.
      </p>
    </section>
  );
}
