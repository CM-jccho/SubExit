"use client";
import { useEffect, useRef, useState } from "react";
import { scenarios, tones, type Tone } from "@/lib/scenarios";
import type { CoachResponse } from "@/lib/coach-contract";
type Phase = "idle" | "permission" | "listening" | "transcribing" | "coaching";
export default function LiveCoach({
  onBack,
  onDemo,
}: {
  onBack: () => void;
  onDemo: () => void;
}) {
  const [scenario, setScenario] = useState("sales"),
    [tone, setTone] = useState<Tone>("firm_polite");
  const [config, setConfig] = useState({
    available: false,
    voiceAvailable: false,
    sampleOnly: true,
  });
  const [consent, setConsent] = useState(false),
    [adult, setAdult] = useState(false),
    [sample, setSample] = useState(false),
    [automatic, setAutomatic] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle"),
    [seconds, setSeconds] = useState(0),
    [input, setInput] = useState(""),
    [result, setResult] = useState<CoachResponse | null>(null),
    [error, setError] = useState("");
  const version = useRef(0),
    busy = useRef(false),
    recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    ticker = useRef<ReturnType<typeof setInterval> | null>(null),
    request = useRef<AbortController | null>(null),
    panel = useRef<HTMLElement | null>(null);
  const allowed = consent && adult && (!config.sampleOnly || sample);
  function release() {
    if (timer.current) clearTimeout(timer.current);
    if (ticker.current) clearInterval(ticker.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }
  function cancel() {
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
      const r = await fetch(url, {
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
    if (!allowed || !config.available || text.trim().length < 2) return;
    busy.current = true;
    setPhase("coaching");
    setError("");
    setResult(null);
    try {
      const data = await call(
        "/api/coach",
        JSON.stringify({
          mode: "ai",
          scenario,
          tone,
          opponent: text,
          reply: "",
          consent,
          adultConsent: adult,
          sampleConsent: sample,
        }),
        id,
        { "Content-Type": "application/json" },
      );
      if (version.current === id) setResult(data);
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
    if (busy.current || !allowed || !config.voiceAvailable) return;
    const id = ++version.current;
    busy.current = true;
    setPhase("permission");
    setError("");
    setResult(null);
    setInput("");
    setSeconds(0);
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
        "audio/webm;codecs=opus",
        "audio/mp4",
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
        setPhase("transcribing");
        try {
          const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
          if (blob.size < 100)
            throw new Error("음성이 너무 짧아요. 한 문장을 들려주세요.");
          const form = new FormData();
          form.append("audio", blob, "conversation");
          form.append("consent", String(consent));
          form.append("adultConsent", String(adult));
          form.append("sampleConsent", String(sample));
          const data = await call("/api/transcribe", form, id);
          if (version.current !== id) return;
          setInput(data.text);
          if (!data.text.trim())
            throw new Error("들린 말이 없어요. 마이크 위치를 확인해 주세요.");
          if (automatic) {
            await coach(data.text, id);
          } else {
            busy.current = false;
            setPhase("idle");
          }
        } catch (e) {
          if (version.current === id) {
            busy.current = false;
            setPhase("idle");
            setError(
              e instanceof Error && e.name === "AbortError"
                ? "음성 인식 시간이 초과됐어요."
                : e instanceof Error
                  ? e.message
                  : "음성을 인식하지 못했어요.",
            );
          }
        }
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
      }, 8000);
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
  const status = {
    idle: "마이크 꺼짐",
    permission: "마이크 권한 확인 중",
    listening: `듣는 중 · ${seconds}/8초`,
    transcribing: "들린 말을 글로 바꾸는 중 · 마이크 꺼짐",
    coaching: "다음 한 문장을 준비 중 · 마이크 꺼짐",
  }[phase];
  return (
    <div className="dd-live">
      <button
        className="dd-back"
        onClick={() => {
          cancel();
          onBack();
        }}
      >
        ← 홈으로
      </button>
      <header className="dd-heading">
        <p className="dd-eyebrow">지금 대화</p>
        <h1>
          대화는 내가,
          <br />
          다음 한마디는 옆에서.
        </h1>
        <p>상대의 말이 끝날 때 짧게 듣고, 내 문장을 확인해요.</p>
      </header>
      <p className="dd-notice">
        대면 또는 <strong>다른 기기의 스피커폰 옆</strong>에서 사용하세요. 같은
        휴대폰의 통화 음성을 직접 가져오지는 않아요. 최대 8초 입력 후 처리하며,
        처리 중에는 듣지 않아요.
      </p>
      <div className="dd-two">
        <section className="dd-card dd-input">
          <details open={!allowed} className="dd-setup">
            <summary>
              대화 준비 <span>{allowed ? "설정 확인" : "상황·전송 안내"}</span>
            </summary>
            <fieldset disabled={phase !== "idle"}>
              <label>
                상황
                <select
                  value={scenario}
                  onChange={(e) => {
                    setScenario(e.target.value);
                    setResult(null);
                  }}
                >
                  {scenarios.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                말투
                <select
                  value={tone}
                  onChange={(e) => {
                    setTone(e.target.value as Tone);
                    setResult(null);
                  }}
                >
                  {tones.map((t) => (
                    <option value={t.id} key={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="dd-small">
                음성과 문장을 Google Gemini로 전송해요. 앱 서버는 대화 내용을
                저장하지 않으며, 제공사의 데이터 처리 정책이 적용돼요.
              </p>
              <label className="dd-check">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                대화 참여자에게 알리고 전송 동의를 받았어요.
              </label>
              <label className="dd-check">
                <input
                  type="checkbox"
                  checked={adult}
                  onChange={(e) => setAdult(e.target.checked)}
                />
                만 18세 이상입니다.
              </label>
              {config.sampleOnly && (
                <label className="dd-check">
                  <input
                    type="checkbox"
                    checked={sample}
                    onChange={(e) => setSample(e.target.checked)}
                  />
                  개인정보·기밀 없는 자작·샘플 대화예요. 무료 API 입력은
                  Google의 제품 개선에 사용될 수 있음을 확인했어요.
                </label>
              )}
              <label className="dd-check">
                <input
                  type="checkbox"
                  checked={automatic}
                  onChange={(e) => setAutomatic(e.target.checked)}
                />
                인식된 말 확인 없이 바로 코칭받기
              </label>
              <p className="dd-small">
                기본은 상대 말을 확인한 뒤 요청해요. 자동 코칭은 내 목소리도
                상대 말로 처리할 수 있어요.
              </p>
            </fieldset>
          </details>
          <div className="dd-mic">
            <span
              className={phase === "listening" ? "dd-recording" : ""}
              role="status"
            >
              {status}
            </span>
            <div className="dd-actions">
              {phase === "listening" ? (
                <button
                  className="dd-primary"
                  onClick={() => recorder.current?.stop()}
                >
                  여기까지 듣기
                </button>
              ) : (
                <button
                  className="dd-primary"
                  disabled={
                    !allowed || !config.voiceAvailable || phase !== "idle"
                  }
                  onClick={listen}
                >
                  상대 말 8초 듣기
                </button>
              )}
              {phase !== "idle" && (
                <button className="dd-secondary" onClick={cancel}>
                  중단
                </button>
              )}
            </div>
          </div>
          {!config.available && (
            <p className="dd-notice">
              AI가 아직 연결되지 않았어요.{" "}
              <button className="dd-link" onClick={onDemo}>
                샘플로 흐름 보기 →
              </button>
            </p>
          )}
          <label htmlFor="live-text">들린 말 확인 · 직접 입력도 가능해요</label>
          <textarea
            id="live-text"
            maxLength={1000}
            value={input}
            disabled={phase !== "idle"}
            onChange={(e) => {
              setInput(e.target.value);
              setResult(null);
            }}
            placeholder="예: 지금 가입해야 혜택을 받을 수 있어요. 딱 1분이면 됩니다."
          />
          <p className="dd-small">
            상대의 말만 남겨 주세요. 자동 화자 구분은 지원하지 않아요.
          </p>
          <button
            className="dd-primary dd-full"
            disabled={
              !allowed ||
              !config.available ||
              phase !== "idle" ||
              input.trim().length < 2
            }
            onClick={() => void coach(input)}
          >
            이 말에 대한 코칭받기
          </button>
          {error && (
            <p className="dd-error" role="alert">
              {error}
            </p>
          )}
        </section>
        <aside className="dd-cue" ref={panel}>
          <div className="dd-cue-top">
            <span className="dd-face" aria-hidden="true">
              ··
            </span>
            <span>옆자리 코치</span>
          </div>
          <p className="dd-eyebrow">지금 이렇게 말해보세요</p>
          {result ? (
            <>
              <span className="dd-source">
                AI 생성 ·{" "}
                {new Date().toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                갱신
              </span>
              <blockquote>{result.suggestion}</blockquote>
              <details>
                <summary>어떤 말을 보고 제안했나요?</summary>
                <p>
                  {result.pattern} · {result.reason}
                </p>
                <q>{result.evidence}</q>
              </details>
              <p className="dd-small">
                {result.provider} · {result.model} · 코칭{" "}
                {(result.latencyMs / 1000).toFixed(1)}초
              </p>
              <button
                className="dd-secondary"
                onClick={listen}
                disabled={
                  !allowed || !config.voiceAvailable || phase !== "idle"
                }
              >
                다음 말 듣기
              </button>
            </>
          ) : (
            <div className="dd-wait">
              <span aria-hidden="true">“</span>
              <p>
                {phase === "coaching"
                  ? "상대 말에 맞는 한 문장을 준비하고 있어요."
                  : "상대의 말을 들려주거나 적어주세요."}
              </p>
            </div>
          )}
          <div className="dd-fallback">
            <p>지금 말문이 막혔다면</p>
            <q>잠시만요. 말씀하신 내용을 생각해 보고 답하겠습니다.</q>
            <small>AI 분석과 무관한 기본 대기 문장</small>
          </div>
          <p className="dd-small">
            제안이 상황에 맞는지 판단하고 내 말로 전하세요.
          </p>
        </aside>
      </div>
    </div>
  );
}
