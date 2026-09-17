"use client";
import { AIConsent } from "./VoiceComposer";
import { useAIConsent } from "./ConsentSession";
import LiveSpeechPanel from "./LiveSpeechPanel";
import { speechConstructor } from "@/lib/live-speech";
import SampleNotice, { SampleSwitch } from "./SampleNotice";
import { sampledRequest } from "@/lib/resilient-ai";
import { aiFetch } from "@/lib/ai-client";
import QuotaHelp from "./QuotaHelp";
import { useEffect, useRef, useState } from "react";
import AudioPlayer, { inspectAudio } from "./AudioPlayer";
import { useCompanion } from "./CompanionTheme";
import CompanionNudge from "./CompanionNudge";
import type { AudioClip } from "@/lib/voice-notebook";
import { scenarios, tones, type Tone } from "@/lib/scenarios";
import type { ContextProfile } from "@/lib/conversation-cards";
import type { CoachResponse } from "@/lib/coach-contract";
import { Companion, HelpTip, Icon, Waveform } from "./CompanionUI";
type Phase = "idle" | "permission" | "listening" | "transcribing" | "coaching";
export default function LiveCoach({
  onBack,
  onDemo,
  onPractice,
  profile,
}: {
  onBack: () => void;
  onDemo: () => void;
  onPractice?: () => void;
  profile?: ContextProfile;
}) {
  const character = useCompanion();
  const [supportsLive, setSupportsLive] = useState(false);
  const [voiceStyle, setVoiceStyle] = useState<"continuous" | "short">(
    "continuous",
  );
  const [liveActive, setLiveActive] = useState(false);
  const [scenario, setScenario] = useState("sales"),
    [tone, setTone] = useState<Tone>(profile?.tone || "firm_polite");
  const [config, setConfig] = useState({
    available: false,
    voiceAvailable: false,
    sampleOnly: true,
  });
  const [consent, setConsent] = useAIConsent();
  const adult = consent,
    sample = consent;
  const [automatic, setAutomatic] = useState(false),
    [sampleMode, setSampleMode] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle"),
    [seconds, setSeconds] = useState(0),
    [input, setInput] = useState(""),
    [result, setResult] = useState<CoachResponse | null>(null),
    [error, setError] = useState("");
  const [clip, setClip] = useState<AudioClip | null>(null),
    [notice, setNotice] = useState("");
  const [prepared, setPrepared] = useState(false),
    [inputMode, setInputMode] = useState<"voice" | "text">("voice"),
    [copied, setCopied] = useState(false);
  const sampleHistory = useRef<string[]>([]);
  const version = useRef(0),
    busy = useRef(false),
    recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    ticker = useRef<ReturnType<typeof setInterval> | null>(null),
    request = useRef<AbortController | null>(null),
    panel = useRef<HTMLElement | null>(null);
  const allowed = consent && adult && (!config.sampleOnly || sample);
  useEffect(() => {
    if (!consent && prepared) {
      cancel();
      setLiveActive(false);
      setPrepared(false);
    }
  }, [consent, prepared]);
  function release() {
    if (timer.current) clearTimeout(timer.current);
    if (ticker.current) clearInterval(ticker.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }
  function cancel() {
    setNotice("작업을 취소했어요. 다시 녹음하거나 직접 입력할 수 있어요.");
    version.current++;
    request.current?.abort();
    if (recorder.current) {
      recorder.current.onstop = null;
      if (recorder.current.state !== "inactive") recorder.current.stop();
    }
    release();
    busy.current = false;
    setPhase("idle");
  }
  useEffect(() => {
    setSupportsLive(!!speechConstructor());
    const abort = new AbortController();
    fetch("/api/coach", { signal: abort.signal })
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});
    const hide = () => {
      if (document.hidden) {
        cancel();
        setError("화면이 비활성화되어 마이크와 요청을 중단했어요.");
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      abort.abort();
      version.current++;
      request.current?.abort();
      if (recorder.current) {
        recorder.current.onstop = null;
        if (recorder.current.state !== "inactive") recorder.current.stop();
      }
      release();
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  useEffect(() => {
    if (result && window.matchMedia("(max-width: 850px)").matches)
      panel.current?.scrollIntoView({ block: "start" });
  }, [result]);
  async function call(
    url: string,
    body: BodyInit,
    id: number,
    headers?: HeadersInit,
  ) {
    const abort = new AbortController();
    request.current = abort;
    const timeout = setTimeout(() => abort.abort(), 25000);
    try {
      const r = await aiFetch(url, {
        method: "POST",
        headers,
        body,
        signal: abort.signal,
      });
      const data = await r.json();
      if (version.current !== id) throw new Error("cancelled");
      if (!r.ok) throw new Error(data.error || "요청을 완료하지 못했어요.");
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }
  async function coach(text: string, id = ++version.current) {
    if (
      (!sampleMode && (!allowed || !config.available)) ||
      text.trim().length < 2
    )
      return;
    busy.current = true;
    setPhase("coaching");
    setNotice("인식한 말을 바탕으로 답변 힌트를 준비하고 있어요.");
    setError("");
    setResult(null);
    setCopied(false);
    try {
      const abort = new AbortController();
      request.current = abort;
      const timeout = setTimeout(() => abort.abort(), 25000);
      let data;
      try {
        data = await sampledRequest({
          operation: "coach",
          context:
            profile?.situation ||
            scenarios.find((s) => s.id === scenario)?.title ||
            text,
          previous: sampleHistory.current,
          manual: sampleMode,
          url: "/api/coach",
          init: {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: abort.signal,
            body: JSON.stringify({
              mode: "ai",
              quick: true,
              scenario,
              context: profile,
              tone,
              opponent: text,
              reply: "",
              consent,
              adultConsent: adult,
              sampleConsent: sample,
            }),
          },
        });
      } finally {
        clearTimeout(timeout);
      }
      if (version.current === id) {
        setResult(data);
        if (data.sample)
          sampleHistory.current = [
            ...sampleHistory.current.slice(-11),
            data.suggestion,
          ];
        setNotice(
          data.sample
            ? "사전 작성한 샘플 문장을 보여드려요. 현재 상황에 맞게 고쳐보세요."
            : "답변 힌트가 준비됐어요. 내 상황에 맞게 활용해 보세요.",
        );
      }
    } catch (e) {
      if (version.current === id)
        setError(
          e instanceof Error && e.name === "AbortError"
            ? "응답이 늦어 요청을 중단했어요. 다시 시도해 주세요."
            : e instanceof Error
              ? e.message
              : "연결을 확인해 주세요.",
        );
    } finally {
      if (version.current === id) {
        busy.current = false;
        setPhase("idle");
      }
    }
  }
  async function listen() {
    if (busy.current || sampleMode || !allowed || !config.voiceAvailable)
      return;
    const id = ++version.current;
    busy.current = true;
    setPhase("permission");
    setError("");
    setResult(null);
    setInput("");
    setSeconds(0);
    setNotice("");
    setClip(null);
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "이 브라우저에서는 마이크 입력을 지원하지 않아요. 직접 입력해 주세요.",
        );
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (version.current !== id) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const mime = [
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
      ].find((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(
        media,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = rec;
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onerror = () => {
        if (version.current === id) {
          cancel();
          setError("마이크 입력이 중단됐어요. 다시 시작해 주세요.");
        }
      };
      rec.onstop = async () => {
        release();
        if (version.current !== id) return;
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 100) {
          busy.current = false;
          setPhase("idle");
          setError(
            "녹음된 음성이 없거나 너무 짧아요. 한 문장을 말한 뒤 녹음 끝내기를 눌러주세요.",
          );
          return;
        }
        const captured: AudioClip = {
          blob,
          duration: 0,
          peaks: [],
          name: "상대의 말",
        };
        setClip(captured);
        void inspectAudio(blob)
          .then((c) => {
            if (version.current === id) setClip(c);
          })
          .catch(() => {});
        await transcribeBlob(blob, id);
      };
      rec.start();
      setPhase("listening");
      const started = Date.now();
      ticker.current = setInterval(
        () =>
          setSeconds(Math.min(8, Math.floor((Date.now() - started) / 1000))),
        200,
      );
      timer.current = setTimeout(() => {
        if (rec.state === "recording") rec.stop();
      }, 4000);
    } catch (e) {
      release();
      if (version.current === id) {
        busy.current = false;
        setPhase("idle");
        setError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "마이크 권한이 필요해요. 주소창의 권한 설정을 확인해 주세요."
            : e instanceof Error
              ? e.message
              : "마이크를 시작하지 못했어요.",
        );
      }
    }
  }
  function finishRecording() {
    if (recorder.current?.state === "recording") {
      setPhase("transcribing");
      setNotice("녹음을 마쳤어요. 음성을 글로 바꾸고 있어요.");
      recorder.current.stop();
    }
  }
  async function transcribeBlob(blob: Blob, id = ++version.current) {
    if (sampleMode || !allowed || !config.voiceAvailable) return;
    busy.current = true;
    setPhase("transcribing");
    setError("");
    setNotice("녹음 완료 · 음성 인식 중이에요. 잠시 기다려 주세요.");
    try {
      const form = new FormData();
      form.append("audio", blob, "conversation");
      form.append("consent", String(consent));
      form.append("adultConsent", String(adult));
      form.append("sampleConsent", String(sample));
      const data = await call("/api/transcribe", form, id);
      if (version.current !== id) return;
      if (typeof data.text !== "string" || !data.text.trim())
        throw new Error(
          "음성에서 말을 인식하지 못했어요. 아래에서 녹음을 재생해 확인하고 다시 시도해 주세요.",
        );
      setInput(data.text.slice(0, 1000));
      setNotice(
        "음성 인식이 끝났어요. 아래 문장을 확인하고 ‘답변 힌트 받기’를 눌러주세요.",
      );
      if (automatic) await coach(data.text.slice(0, 1000), id);
    } catch (e) {
      if (version.current === id) {
        setNotice("");
        setError(
          e instanceof Error && e.name === "AbortError"
            ? "음성 인식이 지연되어 중단했어요. 녹음은 아래에 남아 있으니 ‘음성 인식 다시 시도’를 눌러주세요."
            : e instanceof Error
              ? e.message
              : "음성을 인식하지 못했어요. 다시 시도해 주세요.",
        );
      }
    } finally {
      if (version.current === id) {
        busy.current = false;
        setPhase("idle");
      }
    }
  }
  const status = {
    idle: input
      ? "상대 말을 확인해 주세요 · 마이크 꺼짐"
      : clip
        ? "녹음 완료 · 아래에서 확인해 주세요"
        : "마이크 꺼짐",
    permission: "마이크 권한 확인 중",
    listening: `듣는 중 · ${seconds}/4초`,
    transcribing: "들린 말을 글로 바꾸는 중 · 마이크 꺼짐",
    coaching: "다음 한 문장을 준비 중 · 마이크 꺼짐",
  }[phase];
  return (
    <div
      className="dd-live dc-live-app"
      data-coach-phase={liveActive ? "listening" : phase}
    >
      <button
        className="dd-back"
        onClick={() => {
          cancel();
          onBack();
        }}
      >
        <Icon name="back" size={18} />
        대화 카드로
      </button>
      <header className="dc-live-heading">
        <div>
          <p className="dc-overline">
            {prepared ? "내 옆의 대화 코치" : "시작하기 전에"}
          </p>
          <h1>지금 대화 도움받기</h1>
        </div>
        <HelpTip label="코칭은 어떻게 쓰나요?">
          대면 대화나 다른 기기의 스피커폰 옆에서 사용해요. 지원 브라우저에서는
          계속 들으며 자막과 코칭을 보여줘요. 같은 휴대폰의 통화 음성을 직접
          가져오거나 화자를 자동으로 구분하지는 않아요.
        </HelpTip>
      </header>
      <div className="coach-live-presence" aria-label="코치 상태" role="status">
        <Companion
          small
          mood={
            liveActive || phase === "listening"
              ? "listen"
              : phase === "coaching" || phase === "transcribing"
                ? "think"
                : result
                  ? "done"
                  : "rest"
          }
        />
        <div>
          <strong>
            {liveActive || phase === "listening"
              ? "상대 말을 듣고 있어요"
              : phase === "coaching"
                ? "내 목표에 맞는 말을 찾고 있어요"
                : phase === "transcribing"
                  ? "들린 말을 확인하고 있어요"
                  : result
                    ? "다음 한마디가 도착했어요"
                    : "필요한 순간, 함께 준비해요"}
          </strong>
          <span>
            {liveActive ? "실시간 자막 · 다음 한마디 자동 갱신" : status}
          </span>
        </div>
      </div>
      {!prepared ? (
        <section className="dc-preflight">
          <div className="dc-preflight-intro">
            <Companion small mood="listen" />
            <div>
              <h2>{character.name}와 함께 준비해요.</h2>
              <p>상대 말을 듣고, 내 목표에 맞는 문장을 준비해요.</p>
            </div>
          </div>
          {profile ? (
            <div className="dc-context-brief">
              <span>
                <Icon name="cards" size={17} />
                {profile.title}
              </span>
              <p>{profile.goal}</p>
            </div>
          ) : (
            <label>
              상황
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
              >
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="dc-tone-label">
            내 말투
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
            >
              {tones.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <div className="dc-use-hint">
            <Icon name="mic" size={18} />
            <p>
              대면 또는 <strong>다른 기기의 스피커폰 옆</strong>에서 사용해요.
              {supportsLive
                ? " 자막을 보며 계속 듣고, 말이 정리되면 코칭받아요."
                : " 이 브라우저에서는 최대 4초씩 녹음해요. 이 방식은 처리 중에는 마이크가 꺼져요. 직접 입력도 가능해요."}
            </p>
          </div>
          <AIConsent
            config={config}
            checked={consent}
            onChange={setConsent}
            disabled={phase !== "idle" || liveActive}
          />
          {!config.available && (
            <p className="dd-notice">
              AI 연결을 확인하고 있어요. 연결이 안 되면{" "}
              <button className="dd-link" onClick={onDemo}>
                예시를 볼 수 있어요.
              </button>
            </p>
          )}
          <button
            className="dd-primary dd-full"
            disabled={!allowed || !config.available}
            onClick={() => setPrepared(true)}
          >
            이 설정으로 시작
            <Icon name="arrow" size={19} />
          </button>
        </section>
      ) : (
        <>
          <div className="dc-session-bar">
            <span>
              <Icon name="cards" size={17} />
              {profile?.title ||
                scenarios.find((s) => s.id === scenario)?.title}
            </span>
            <button
              className="dd-link"
              disabled={phase !== "idle" || liveActive}
              onClick={() => {
                setPrepared(false);
                setResult(null);
              }}
            >
              설정
            </button>
          </div>
          <SampleSwitch
            checked={sampleMode}
            disabled={phase !== "idle" || liveActive}
            onChange={(v) => {
              setSampleMode(v);
              setResult(null);
              setError("");
              if (v) {
                setInputMode("text");
                setAutomatic(false);
              }
            }}
          />
          {supportsLive && !sampleMode && (
            <div
              className="dc-mode-switch live-style-switch"
              aria-label="음성 처리 방식"
            >
              <button
                aria-pressed={voiceStyle === "continuous"}
                className={voiceStyle === "continuous" ? "active" : ""}
                disabled={phase !== "idle" || liveActive}
                onClick={() => setVoiceStyle("continuous")}
              >
                실시간 자막 · 코칭
              </button>
              <button
                aria-pressed={voiceStyle === "short"}
                className={voiceStyle === "short" ? "active" : ""}
                disabled={phase !== "idle" || liveActive}
                onClick={() => setVoiceStyle("short")}
              >
                짧게 녹음 · 직접 입력
              </button>
            </div>
          )}
          {!supportsLive && !sampleMode && (
            <p className="live-stream-note">
              이 브라우저는 실시간 자막을 지원하지 않아요. 짧게 녹음하거나 직접
              입력해 주세요.
            </p>
          )}
          {supportsLive && voiceStyle === "continuous" && !sampleMode ? (
            <LiveSpeechPanel
              profile={profile}
              scenario={scenario}
              tone={tone}
              consent={consent}
              adult={adult}
              sample={sample}
              onActiveChange={setLiveActive}
            />
          ) : (
            <div className={"dc-coaching-grid " + (result ? "has-result" : "")}>
              <section className="dc-listen-panel">
                <div className="dc-mode-switch" aria-label="입력 방식">
                  <button
                    className={inputMode === "voice" ? "active" : ""}
                    aria-pressed={inputMode === "voice"}
                    disabled={phase !== "idle" || sampleMode}
                    onClick={() => setInputMode("voice")}
                  >
                    <Icon name="mic" size={18} />
                    들려주기
                  </button>
                  <button
                    className={inputMode === "text" ? "active" : ""}
                    aria-pressed={inputMode === "text"}
                    disabled={phase !== "idle"}
                    onClick={() => setInputMode("text")}
                  >
                    <Icon name="keyboard" size={18} />
                    직접 입력
                  </button>
                </div>
                {inputMode === "voice" && (
                  <div
                    className={
                      "dc-mic-stage " +
                      (phase === "listening" ? "is-listening" : "")
                    }
                  >
                    <Waveform active={phase === "listening"} />
                    <p role="status">{status}</p>
                    <button
                      className="dc-mic-button"
                      aria-label={
                        phase === "listening"
                          ? "여기까지 듣기"
                          : "상대 말 4초 듣기"
                      }
                      disabled={
                        phase !== "listening" &&
                        (!allowed || !config.voiceAvailable || phase !== "idle")
                      }
                      onClick={phase === "listening" ? finishRecording : listen}
                    >
                      <Icon
                        name={phase === "listening" ? "pause" : "mic"}
                        size={34}
                      />
                    </button>
                    <strong>
                      {phase === "listening"
                        ? "다 들었다면 눌러주세요"
                        : "눌러서 상대 말 듣기"}
                    </strong>
                    <span>
                      한 번에 최대 4초
                      <HelpTip label="마이크 사용 안내">
                        상대 말이 끝나면 버튼을 다시 눌러도 돼요. 인식된 문장을
                        확인한 뒤 코칭을 요청하세요. 자동 화자 구분은 지원하지
                        않아요.
                      </HelpTip>
                    </span>
                    {!config.voiceAvailable && (
                      <p className="dd-small">
                        현재는 직접 입력으로 코칭받을 수 있어요.
                      </p>
                    )}
                  </div>
                )}
                {phase !== "idle" && (
                  <button
                    className="dd-secondary dd-full"
                    onClick={phase === "listening" ? finishRecording : cancel}
                  >
                    {phase === "listening"
                      ? "녹음 끝내고 음성 인식"
                      : "처리 취소"}
                  </button>
                )}
                <CompanionNudge
                  mood={
                    phase === "listening"
                      ? "listen"
                      : phase === "transcribing" || phase === "coaching"
                        ? "think"
                        : input
                          ? "done"
                          : "hello"
                  }
                  text={
                    phase === "listening"
                      ? "다 말했으면 녹음 끝내기를 눌러주세요."
                      : phase === "coaching"
                        ? "내 목표와 지킬 선을 보고 답변을 준비하고 있어요."
                        : notice || "마이크를 누르고 한 문장을 들려주세요."
                  }
                />
                {clip && (
                  <div className="vn-live-clip">
                    <AudioPlayer clip={clip} />
                    {error && phase === "idle" && (
                      <button
                        className="dd-secondary"
                        disabled={sampleMode}
                        onClick={() => void transcribeBlob(clip.blob)}
                      >
                        음성 인식 다시 시도
                      </button>
                    )}
                  </div>
                )}

                {(inputMode === "text" || !!input) && (
                  <div className="dc-transcript">
                    <label htmlFor="live-text">
                      {inputMode === "text"
                        ? "상대가 어떤 말을 했나요?"
                        : "들린 말이 맞는지 확인해요"}
                    </label>
                    <textarea
                      id="live-text"
                      maxLength={1000}
                      value={input}
                      disabled={phase !== "idle"}
                      onChange={(e) => {
                        setInput(e.target.value);
                        setResult(null);
                      }}
                      placeholder="상대가 방금 한 말을 적어주세요."
                      rows={3}
                    />
                    <button
                      className="dd-primary dd-full"
                      disabled={
                        (!sampleMode && (!allowed || !config.available)) ||
                        phase !== "idle" ||
                        input.trim().length < 2
                      }
                      onClick={() => void coach(input)}
                    >
                      {phase === "coaching"
                        ? "한마디를 준비하는 중"
                        : "답변 힌트 받기"}
                      <Icon name="arrow" size={18} />
                    </button>
                  </div>
                )}
                {inputMode === "voice" && (
                  <details className="dc-auto-option">
                    <summary>더 빠르게 코칭받고 싶다면</summary>
                    <label className="dd-check">
                      <input
                        type="checkbox"
                        checked={automatic}
                        disabled={phase !== "idle"}
                        onChange={(e) => setAutomatic(e.target.checked)}
                      />
                      인식된 말 확인 없이 바로 코칭받기
                    </label>
                    <p className="dd-small">
                      내 목소리도 상대 말로 처리될 수 있어요.
                    </p>
                  </details>
                )}
                {error && (
                  <>
                    <p className="dd-error" role="alert">
                      {error}
                    </p>
                    <QuotaHelp error={error} />
                  </>
                )}
              </section>
              <aside
                className={"dc-answer-panel " + (result ? "is-ready" : "")}
                ref={panel}
                aria-live="polite"
                aria-busy={phase === "coaching"}
              >
                <div className="dc-answer-heading">
                  <Icon name="chat" size={20} />
                  <span>{character.name}의 한마디</span>
                  {result && (
                    <span className="dc-ai-label">
                      {result.sample ? "사전 작성 샘플" : "AI 제안"}
                    </span>
                  )}
                </div>
                {result ? (
                  <>
                    {result.sample && <SampleNotice sample={result.sample} />}
                    <p className="dc-answer-label">이렇게 말해볼까요?</p>
                    {profile && (
                      <p className="dc-answer-goal">
                        <Icon name="target" size={14} />
                        <span>내 목표 · {profile.goal}</span>
                      </p>
                    )}
                    <blockquote
                      className="coach-reply-arrival"
                      key={result.suggestion}
                    >
                      {result.suggestion}
                    </blockquote>
                    <div className="dc-answer-actions">
                      <button
                        className="dd-secondary"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              result.suggestion,
                            );
                            setCopied(true);
                          } catch {
                            setError(
                              "복사하지 못했어요. 문장을 길게 눌러 복사해 주세요.",
                            );
                          }
                        }}
                      >
                        <Icon name={copied ? "check" : "cards"} size={17} />
                        {copied ? "복사했어요" : "문장 복사"}
                      </button>
                      <button
                        className="dd-link"
                        disabled={phase !== "idle"}
                        onClick={() => {
                          setResult(null);
                          setInput("");
                          setCopied(false);
                        }}
                      >
                        다음 말 준비
                        <Icon name="arrow" size={16} />
                      </button>
                    </div>
                    {!result.sample && (
                      <details className="dc-evidence">
                        <summary>왜 이 문장을 제안했나요?</summary>
                        <p>
                          <strong>상대 말에서 확인한 표현</strong>
                        </p>
                        <q>{result.evidence}</q>
                        <p>
                          <strong>AI의 제안 이유</strong> · {result.reason}
                        </p>
                        <small>
                          {result.provider} · {result.model} · 코칭{" "}
                          {(result.latencyMs / 1000).toFixed(1)}초
                        </small>
                      </details>
                    )}
                    <p className="dc-answer-footnote">
                      상황에 맞는지 확인하고, 내 말로 전하세요.
                    </p>
                  </>
                ) : (
                  <div className="dc-answer-wait">
                    <Companion
                      mood={
                        phase === "coaching" || phase === "transcribing"
                          ? "think"
                          : "listen"
                      }
                    />
                    <h2>
                      {phase === "coaching"
                        ? "내 목표에 맞게 생각 중이에요"
                        : "듣고 나서, 함께 생각해요"}
                    </h2>
                    <p>
                      {phase === "coaching"
                        ? "잠시만 기다려 주세요."
                        : "상대의 말을 전달하면\n이곳에 다음 한마디가 나타나요."}
                    </p>
                  </div>
                )}
              </aside>
            </div>
          )}
          <details className="dc-pause-guide">
            <summary>
              <Icon name="pause" size={17} />
              지금 당장 말문이 막혔다면
            </summary>
            <blockquote>“잠시만요. 생각해 보고 말씀드릴게요.”</blockquote>
            <small>
              잠깐 여유를 만드는 기본 문장입니다. AI 분석 결과가 아니에요.
            </small>
          </details>
        </>
      )}
      {onPractice && (
        <button
          className="dd-link"
          disabled={phase !== "idle"}
          onClick={() => {
            cancel();
            onPractice();
          }}
        >
          이 상황 미리 연습하기 <Icon name="chat" size={18} />
        </button>
      )}
    </div>
  );
}
