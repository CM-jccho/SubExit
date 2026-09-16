"use client";
import QuotaHelp from "./QuotaHelp";
import { useEffect, useRef, useState } from "react";
import AudioPlayer, { inspectAudio, audioTime } from "./AudioPlayer";
import { Icon } from "./CompanionUI";
import CompanionNudge from "./CompanionNudge";
import {
  MAX_AUDIO_BYTES,
  normalizeAudioMime,
  type AudioClip,
} from "@/lib/voice-notebook";
export type VoiceDraft = { text: string; clip?: AudioClip };
export type AIConfig = {
  available: boolean;
  voiceAvailable?: boolean;
  sampleOnly: boolean;
};
export function AIConsent({
  config,
  checked,
  onChange,
  disabled = false,
}: {
  config: AIConfig;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="dd-check vn-consent">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        만 18세 이상이며 음성·문장의 Gemini 전송에 동의해요.
        {config.sampleOnly && (
          <small>
            개인정보·기밀 없는 자작 연습만 보내요. 무료 API 입력은 Google 제품
            개선에 사용될 수 있어요.
          </small>
        )}
      </span>
    </label>
  );
}
export default function VoiceComposer({
  onUse,
  submitLabel = "기록 저장",
  config,
  consent,
  disabled = false,
  requireText = false,
  onActivity,
  suggestion,
}: {
  onUse: (draft: VoiceDraft) => Promise<void> | void;
  submitLabel?: string;
  config: AIConfig;
  consent: boolean;
  disabled?: boolean;
  requireText?: boolean;
  onActivity?: (active: boolean) => void;
  suggestion?: { text: string; id: number };
}) {
  const [clip, setClip] = useState<AudioClip>(),
    [text, setText] = useState(""),
    [phase, setPhase] = useState<
      | "idle"
      | "permission"
      | "recording"
      | "processing"
      | "transcribing"
      | "saving"
    >("idle"),
    [seconds, setSeconds] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [typing, setTyping] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setInterval> | null>(null),
    abort = useRef<AbortController | null>(null),
    epoch = useRef(0),
    file = useRef<HTMLInputElement>(null),
    busy = useRef(false),
    activity = useRef(onActivity);
  activity.current = onActivity;
  useEffect(() => {
    if (suggestion) {
      setText(suggestion.text);
      setTyping(true);
      setNotice(
        "고른 후보를 넣었어요. 내 말로 고치거나, 마이크로 직접 읽어봐도 좋아요.",
      );
    }
  }, [suggestion]);
  useEffect(() => {
    onActivity?.(phase !== "idle");
  }, [phase, onActivity]);
  function release() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }
  useEffect(() => {
    const hide = () => {
      if (document.hidden && recorder.current?.state === "recording") {
        setNotice("화면을 떠나 녹음을 마쳤어요. 녹음 내용을 확인해 주세요.");
        recorder.current.stop();
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      epoch.current++;
      abort.current?.abort();
      if (recorder.current) {
        recorder.current.onstop = null;
        if (recorder.current.state !== "inactive") recorder.current.stop();
      }
      release();
      activity.current?.(false);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  async function transcribe(c: AudioClip, id = epoch.current) {
    if (!consent || !config.voiceAvailable) {
      setNotice(
        "녹음 완료. 재생해서 확인하거나 기록으로 저장해 주세요. 문자 변환에는 AI 전송 동의가 필요해요.",
      );
      return;
    }
    setPhase("transcribing");
    setNotice("녹음 완료 · 음성을 글로 바꾸고 있어요.");
    setError("");
    const controller = new AbortController();
    abort.current = controller;
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const form = new FormData();
      form.append("audio", c.blob, c.name);
      form.append("consent", "true");
      form.append("adultConsent", "true");
      form.append("sampleConsent", String(config.sampleOnly));
      const r = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const d = await r.json();
      if (epoch.current !== id) return;
      if (!r.ok) throw new Error(d.error || "음성 인식에 실패했어요.");
      if (typeof d.text !== "string" || !d.text.trim())
        throw new Error(
          "음성에서 말을 찾지 못했어요. 녹음을 재생해 확인한 뒤 다시 시도해 주세요.",
        );
      setText(d.text.slice(0, 4000));
      setNotice("문자 변환 완료. 인식한 말을 확인하고 아래 버튼을 눌러주세요.");
    } catch (e) {
      if (epoch.current === id) {
        setNotice("녹음은 남아 있어요. 다시 변환하거나 직접 입력할 수 있어요.");
        setError(
          e instanceof Error && e.name === "AbortError"
            ? "음성 인식이 지연되었어요. 다시 시도해 주세요."
            : e instanceof Error
              ? e.message
              : "연결을 확인해 주세요.",
        );
      }
    } finally {
      clearTimeout(timeout);
      if (epoch.current === id) setPhase("idle");
    }
  }
  async function capture(blob: Blob, name: string, id: number) {
    if (epoch.current !== id) return;
    setPhase("processing");
    setNotice("녹음을 마쳤어요. 음성 재생을 준비하고 있어요.");
    try {
      if (blob.size < 100)
        throw new Error(
          "녹음이 비어 있거나 너무 짧아요. 한 문장을 말하고 끝내주세요.",
        );
      if (blob.size > MAX_AUDIO_BYTES)
        throw new Error("2.4MB 이하의 짧은 음성을 선택해 주세요.");
      if (!normalizeAudioMime(blob.type, name))
        throw new Error(
          "MP3, M4A, WAV, WebM, OGG, FLAC, AAC 음성을 선택해 주세요.",
        );
      const c = await inspectAudio(blob, name);
      if (epoch.current !== id) return;
      setClip(c);
      setText("");
      setError("");
      setPhase("idle");
      setNotice("녹음 완료. 파형의 재생 버튼으로 들어보세요.");
      await transcribe(c, id);
    } catch (e) {
      if (epoch.current === id) {
        setError(e instanceof Error ? e.message : "음성 파일을 열지 못했어요.");
        setNotice(
          "파일을 처리하지 못했어요. 다시 녹음하거나 다른 파일을 선택해 주세요.",
        );
        setPhase("idle");
      }
    } finally {
      if (epoch.current === id) busy.current = false;
    }
  }
  async function start() {
    if (busy.current || disabled) return;
    busy.current = true;
    const id = ++epoch.current;
    setError("");
    setNotice("브라우저의 마이크 권한을 확인해 주세요.");
    setPhase("permission");
    setSeconds(0);
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "이 브라우저는 녹음을 지원하지 않아요. 음성파일을 올리거나 직접 입력해 주세요.",
        );
      window.speechSynthesis?.cancel();
      document.querySelectorAll("audio").forEach((a) => a.pause());
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (epoch.current !== id) {
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
        mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined,
      );
      recorder.current = rec;
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onerror = () => {
        epoch.current++;
        rec.onstop = null;
        release();
        busy.current = false;
        setPhase("idle");
        setError("마이크가 중단됐어요. 권한을 확인하고 다시 녹음해 주세요.");
      };
      rec.onstop = () => {
        release();
        void capture(
          new Blob(chunks, { type: rec.mimeType || "audio/webm" }),
          "내 녹음",
          id,
        );
      };
      rec.start(250);
      setPhase("recording");
      setNotice("말을 마치면 ‘녹음 끝내기’를 눌러주세요.");
      const started = Date.now();
      timer.current = setInterval(() => {
        const elapsed = (Date.now() - started) / 1000;
        setSeconds(Math.min(60, elapsed));
        if (elapsed >= 60 && rec.state === "recording") {
          setPhase("processing");
          rec.stop();
        }
      }, 200);
    } catch (e) {
      release();
      if (epoch.current === id) {
        busy.current = false;
        setPhase("idle");
        setError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "마이크 권한이 거절됐어요. 주소창에서 허용하거나 파일 올리기를 이용해 주세요."
            : e instanceof Error
              ? e.message
              : "녹음을 시작하지 못했어요.",
        );
      }
    }
  }
  function finish() {
    if (recorder.current?.state === "recording") {
      setPhase("processing");
      setNotice("녹음 완료. 음성을 확인하고 있어요.");
      recorder.current.stop();
    }
  }
  function cancel() {
    epoch.current++;
    abort.current?.abort();
    if (recorder.current) {
      recorder.current.onstop = null;
      if (recorder.current.state !== "inactive") recorder.current.stop();
    }
    release();
    busy.current = false;
    setPhase("idle");
    setNotice("처리를 취소했어요. 기존 입력은 그대로 남아 있어요.");
  }
  async function use() {
    if (
      phase !== "idle" ||
      disabled ||
      (!clip && !text.trim()) ||
      (requireText && !text.trim())
    )
      return;
    setPhase("saving");
    setError("");
    try {
      await onUse({ clip, text: text.trim() });
      setText("");
      setClip(undefined);
      setTyping(false);
      setNotice("저장했어요. 이어서 다른 이야기를 남겨도 돼요.");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "저장하지 못했어요. 입력은 그대로 남겨뒀어요.",
      );
    } finally {
      setPhase("idle");
    }
  }
  const working = phase !== "idle";
  return (
    <section className="vn-composer" aria-label="음성 또는 문자 입력">
      <div className="vn-capture-row">
        <button
          type="button"
          className={"vn-record " + (phase === "recording" ? "recording" : "")}
          disabled={disabled || (working && phase !== "recording")}
          onClick={phase === "recording" ? finish : () => void start()}
        >
          <Icon name={phase === "recording" ? "pause" : "mic"} size={23} />
          {phase === "recording"
            ? `녹음 끝내기 · ${audioTime(seconds)}`
            : "눌러서 말하기"}
        </button>
        <button
          type="button"
          className="dd-secondary"
          disabled={working || disabled}
          onClick={() => file.current?.click()}
        >
          <Icon name="upload" size={18} />
          파일 올리기
        </button>
        <button
          type="button"
          className="vn-icon"
          aria-label="직접 입력 열기"
          disabled={working || disabled}
          onClick={() => setTyping((v) => !v)}
        >
          <Icon name="keyboard" />
        </button>
        <input
          ref={file}
          type="file"
          accept="audio/*,.m4a,.webm,.mp3,.wav"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) {
              busy.current = true;
              void capture(f, f.name, ++epoch.current);
            }
          }}
        />
      </div>
      <CompanionNudge
        mood={
          phase === "recording"
            ? "listen"
            : working
              ? "think"
              : clip || notice.includes("저장")
                ? "done"
                : "hello"
        }
        text={
          notice ||
          "마이크로 한 문장부터. 녹음은 1분, 파일은 2분·2.4MB까지 가능해요."
        }
      />
      {working && phase !== "recording" && phase !== "saving" && (
        <button type="button" className="dd-link" onClick={cancel}>
          처리 취소
        </button>
      )}
      {clip && (
        <>
          <AudioPlayer clip={clip} />
          <button
            type="button"
            className="dd-link"
            disabled={working || disabled || !consent || !config.voiceAvailable}
            onClick={() => void transcribe(clip)}
          >
            {text ? "음성 인식 다시 시도" : "문자로 바꾸기"}
          </button>
        </>
      )}
      {(typing || text || clip) && (
        <label className="vn-label">
          {clip ? "인식한 말 · 필요하면 고쳐주세요" : "직접 입력"}
          <textarea
            aria-label="인식한 말 또는 직접 입력"
            rows={3}
            maxLength={4000}
            value={text}
            disabled={working || disabled}
            onChange={(e) => setText(e.target.value)}
            placeholder="인식하지 못한 부분은 직접 적어도 돼요."
          />
        </label>
      )}
      {error && (
        <>
          <p className="dd-error" role="alert">
            {error}
          </p>
          <QuotaHelp error={error} />
        </>
      )}
      {(clip || text) && (
        <button
          type="button"
          className="dd-primary dd-full"
          disabled={working || disabled || (requireText && !text.trim())}
          onClick={() => void use()}
        >
          {phase === "saving" ? "저장 중" : submitLabel}
          <Icon name="send" size={17} />
        </button>
      )}
    </section>
  );
}
