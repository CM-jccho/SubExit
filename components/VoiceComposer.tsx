"use client";
import InputDialog from "./InputDialog";
import SampleNotice from "./SampleNotice";
import type { SampleMeta } from "@/lib/demo-bank";
import { WORKSPACE_LEAVE_EVENT } from "@/lib/navigation-guard";
import ConsentDisclosure from "./ConsentDisclosure";
import { useConsentPrompt } from "./ConsentSession";
import { aiFetch } from "@/lib/ai-client";
import QuotaHelp from "./QuotaHelp";
import { transcribeAudio } from "@/lib/audio-transcription";
import {
  RECORDING_MAX_BYTES,
  RECORDING_MAX_SECONDS,
  RECORDING_MAX_TEXT,
  importTranscript,
} from "@/lib/recording-limits";
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
  priority = 1,
}: {
  config: AIConfig;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  priority?: number;
}) {
  const show = useConsentPrompt(checked, disabled, priority);
  if (!show) return null;
  return (
    <ConsentDisclosure
      complete={checked}
      disabled={disabled}
      onRevoke={() => onChange(false)}
    >
      <label className="dd-check vn-consent">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>
          만 18세 이상이며 음성·문장의 Gemini 전송에 동의해요.
          <small>
            문자 변환·코칭·복기·용어 설명에 필요한 입력을 보내요. 다른 사람의
            말은 참여자의 동의를 받은 뒤 보내요. 이번 이용 중 한 번만 확인해요.
          </small>
          {config.sampleOnly && (
            <small>
              개인정보·기밀 없는 자작 연습만 보내요. 무료 API 입력은 Google 제품
              개선에 사용될 수 있어요.
            </small>
          )}
        </span>
      </label>
    </ConsentDisclosure>
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
  textFirst = false,
  inDialog = false,
  longRecording = false,
  replyTo,
  goal,
  candidates = [],
  candidatesSample,
  onRequestCandidates,
  sampleMode = false,
  onEnableAI,
  onConsentChange,
  submitDisabled = false,
}: {
  onUse: (draft: VoiceDraft) => Promise<void> | void;
  submitLabel?: string;
  config: AIConfig;
  consent: boolean;
  sampleMode?: boolean;
  onEnableAI?: () => void;
  onConsentChange?: (value: boolean) => void;
  submitDisabled?: boolean;
  disabled?: boolean;
  requireText?: boolean;
  textFirst?: boolean;
  inDialog?: boolean;
  longRecording?: boolean;
  replyTo?: { id: string; text: string };
  goal?: string;
  candidates?: string[];
  candidatesSample?: SampleMeta;
  onRequestCandidates?: () => Promise<void>;
  onActivity?: (active: boolean) => void;
  suggestion?: { text: string; id: number };
}) {
  const [expanded, setExpanded] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);
  const [chosen, setChosen] = useState<number>();
  useEffect(() => {
    setShowCandidates(false);
    setChosen(undefined);
  }, [replyTo?.id]);
  const [receipt, setReceipt] = useState("");
  const editor = useRef<HTMLTextAreaElement>(null);
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
    [typing, setTyping] = useState(textFirst);
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
      if (inDialog) setExpanded(true);
      setReceipt("");
      setText(suggestion.text);
      setTyping(true);
      setNotice(
        "고른 후보를 넣었어요. 내 말로 고치거나, 마이크로 직접 읽어봐도 좋아요.",
      );
    }
  }, [suggestion, inDialog]);
  useEffect(() => {
    activity.current?.(phase !== "idle");
  }, [phase]);
  const dirty = !!text.trim() || !!clip || phase !== "idle";
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: Event) => {
      if (!window.confirm("작성 중인 입력이 있어요. 저장하지 않고 이동할까요?"))
        event.preventDefault();
    };
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener(WORKSPACE_LEAVE_EVENT, guard);
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener(WORKSPACE_LEAVE_EVENT, guard);
      window.removeEventListener("beforeunload", unload);
    };
  }, [inDialog, dirty]);
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
  const transcriptionBlock = sampleMode
    ? "샘플 모드에서는 AI 문자 변환을 사용하지 않아요. 녹음은 그대로 두고 아래에서 AI 모드로 전환할 수 있어요."
    : !consent
      ? "녹음은 남아 있어요. 아래에서 AI 전송에 동의한 뒤 ‘문자로 바꾸기’를 눌러주세요."
      : !config.voiceAvailable
        ? "현재 AI 음성 변환에 연결할 수 없어요. 녹음을 내려받거나 직접 입력해 주세요."
        : "";
  async function transcribe(c: AudioClip, id = epoch.current) {
    if (transcriptionBlock) {
      setNotice(transcriptionBlock);
      return;
    }
    setPhase("transcribing");
    setNotice("녹음 완료 · 음성을 글로 바꾸고 있어요.");
    setError("");
    const controller = new AbortController();
    abort.current = controller;
    if (longRecording) {
      busy.current = true;
      try {
        const result = await transcribeAudio(c, {
          signal: controller.signal,
          sampleOnly: config.sampleOnly,
          status: (message) => {
            if (epoch.current === id) setNotice(message);
          },
          progress: (progress, transcript) => {
            if (epoch.current !== id) return;
            setText(transcript);
            setClip({ ...c, transcription: progress });
          },
        });
        if (epoch.current === id) {
          setText(result.text);
          setClip({ ...c, transcription: result.progress });
          setNotice(
            `전체 ${result.progress.total}구간 문자 변환 완료. 내용을 확인하고 저장해 주세요.`,
          );
        }
      } catch (e) {
        if (epoch.current === id) {
          setError(
            e instanceof Error && e.name === "AbortError"
              ? "변환을 중단했어요. 완료한 구간부터 이어서 시도할 수 있어요."
              : e instanceof Error
                ? e.message
                : "문자 변환을 완료하지 못했어요.",
          );
          setNotice(
            "원본과 완료한 문자는 남아 있어요. ‘문자 변환 이어서’를 누르거나 현재 기록을 저장해 주세요.",
          );
        }
      } finally {
        if (epoch.current === id) {
          busy.current = false;
          setPhase("idle");
        }
      }
      return;
    }
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const form = new FormData();
      form.append("audio", c.blob, c.name);
      form.append("consent", "true");
      form.append("adultConsent", "true");
      form.append("sampleConsent", String(config.sampleOnly));
      const r = await aiFetch("/api/transcribe", {
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
      if (blob.size > (longRecording ? RECORDING_MAX_BYTES : MAX_AUDIO_BYTES))
        throw new Error(
          longRecording
            ? "50MB 이하의 음성을 선택해 주세요. 텍스트 파일로도 가져올 수 있어요."
            : "2.4MB 이하의 짧은 음성을 선택해 주세요.",
        );
      if (!normalizeAudioMime(blob.type, name))
        throw new Error(
          "MP3, M4A, WAV, WebM, OGG, FLAC, AAC 음성을 선택해 주세요.",
        );
      const c = await inspectAudio(
        blob,
        name,
        longRecording ? RECORDING_MAX_SECONDS : 120,
      );
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
        "audio/mp4",
        "audio/webm;codecs=opus",
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
      rec.start();
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
  async function use(candidate?: string) {
    const outgoingText = candidate ?? text.trim();
    const outgoingClip = candidate === undefined ? clip : undefined;
    if (
      busy.current ||
      phase !== "idle" ||
      disabled ||
      submitDisabled ||
      (!outgoingClip && !outgoingText) ||
      (requireText && !outgoingText)
    )
      return;
    if (candidate !== undefined) {
      if (
        (text.trim() || clip) &&
        !window.confirm("작성 중인 내용 대신 이 후보를 바로 보낼까요?")
      )
        return;
      setText(candidate);
      setClip(undefined);
    }
    busy.current = true;
    editor.current?.blur();
    const id = epoch.current;
    setPhase("saving");
    setError("");
    try {
      await onUse({ clip: outgoingClip, text: outgoingText });
      if (epoch.current !== id) return;
      setExpanded(false);
      setReceipt(textFirst ? "답변을 기록했어요." : "기록에 저장했어요.");
      setText("");
      setClip(undefined);
      setChosen(undefined);
      setShowCandidates(false);
      setTyping(textFirst);
      setNotice(
        textFirst
          ? "답변을 보냈어요. 상대의 말을 보고 이어서 답해보세요."
          : "저장했어요. 이어서 다른 이야기를 남겨도 돼요.",
      );
    } catch (e) {
      if (epoch.current === id)
        setError(
          e instanceof Error
            ? e.message
            : "저장하지 못했어요. 입력은 그대로 남겨뒀어요.",
        );
    } finally {
      busy.current = false;
      if (epoch.current === id) setPhase("idle");
    }
  }
  const working = phase !== "idle";
  const composer = (
    <section
      className={"vn-composer " + (textFirst ? "vn-chat-composer" : "")}
      aria-label="음성 또는 문자 입력"
    >
      {textFirst && (
        <div className="vn-compose-context">
          <strong>내 답변</strong>
          {replyTo && (
            <p>
              <span>답장할 말</span> {replyTo.text}
            </p>
          )}
          {goal && <small>내 목표 · {goal}</small>}
        </div>
      )}
      {onRequestCandidates && (
        <div className="vn-compose-candidates">
          <button
            type="button"
            className="dd-secondary"
            disabled={disabled || working}
            aria-expanded={showCandidates}
            onClick={() => {
              if (candidates.length) setShowCandidates((v) => !v);
              else {
                setShowCandidates(true);
                void onRequestCandidates();
              }
            }}
          >
            <Icon name="chat" size={17} />
            {candidates.length
              ? showCandidates
                ? "후보 접기"
                : "답변 후보 다시 보기"
              : showCandidates
                ? disabled
                  ? "후보 생성 중"
                  : "답변 후보 다시 요청"
                : "내 목표에 맞는 답변 후보 3개 보기"}
          </button>
          {showCandidates && (
            <div className="vn-reply-choices">
              <p className="vn-caption">
                문장을 누르면 바로 보내요. 바꾸고 싶다면 ‘고쳐 쓰기’를 누르세요.
              </p>
              {!candidates.length && (
                <p role="status">
                  {disabled
                    ? "내 목표에 맞는 답변을 준비하고 있어요…"
                    : "후보를 받지 못했어요. 직접 답하거나 다시 요청해 주세요."}
                </p>
              )}
              {candidatesSample && (
                <SampleNotice sample={candidatesSample} compact badge />
              )}
              <div className="vn-choice-list">
                {candidates.map((candidate, index) => (
                  <div className="vn-choice" key={index}>
                    <button
                      type="button"
                      className="vn-choice-send"
                      disabled={disabled || working || submitDisabled}
                      aria-label={`후보 ${index + 1} 바로 보내기: ${candidate}`}
                      onClick={() => void use(candidate)}
                    >
                      <span>{index + 1}</span>
                      {candidate}
                      <Icon name="send" size={16} />
                    </button>
                    <button
                      type="button"
                      className="vn-choice-edit"
                      disabled={disabled || working}
                      aria-label={`후보 ${index + 1} 고쳐 쓰기`}
                      onClick={() => {
                        if (
                          (text.trim() || clip) &&
                          !window.confirm(
                            "작성 중인 내용 대신 이 후보를 고쳐 쓸까요?",
                          )
                        )
                          return;
                        setClip(undefined);
                        setText(candidate);
                        setTyping(true);
                        setChosen(index);
                        setShowCandidates(false);
                        setNotice("후보를 넣었어요. 내 말로 고친 뒤 보내세요.");
                        editor.current?.focus({ preventScroll: true });
                      }}
                    >
                      고쳐 쓰기
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {chosen !== undefined && (
            <span className="vn-selected-candidate">
              후보 {chosen + 1} 선택 · 아직 보내지 않았어요
            </span>
          )}
        </div>
      )}
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
          aria-label={typing ? "직접 입력 접기" : "직접 입력 열기"}
          aria-expanded={typing}
          disabled={working || disabled}
          onClick={() => setTyping((v) => !v)}
        >
          <Icon name="keyboard" />
        </button>
        <input
          ref={file}
          type="file"
          accept={
            longRecording
              ? "audio/*,.m4a,.webm,.mp3,.wav,.txt,.srt,.vtt"
              : "audio/*,.m4a,.webm,.mp3,.wav"
          }
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) {
              if (longRecording && /\.(txt|srt|vtt)$/i.test(f.name)) {
                const id = ++epoch.current;
                busy.current = true;
                setPhase("processing");
                setError("");
                void (async () => {
                  try {
                    if (f.size > 500000)
                      throw new Error(
                        "텍스트 파일은 500KB 이하로 선택해 주세요.",
                      );
                    const imported = importTranscript(await f.text(), f.name);
                    if (epoch.current !== id) return;
                    setText(imported);
                    setClip(undefined);
                    setTyping(true);
                    setNotice(
                      "텍스트를 가져왔어요. AI 전송 없이 내용을 확인하고 저장할 수 있어요.",
                    );
                  } catch (e) {
                    if (epoch.current === id)
                      setError(
                        e instanceof Error
                          ? e.message
                          : "텍스트를 읽지 못했어요.",
                      );
                  } finally {
                    if (epoch.current === id) {
                      busy.current = false;
                      setPhase("idle");
                    }
                  }
                })();
                return;
              }
              busy.current = true;
              void capture(f, f.name, ++epoch.current);
            }
          }}
        />
      </div>
      {textFirst ? (
        notice && (
          <p className="vn-compose-notice" role="status">
            {notice}
          </p>
        )
      ) : (
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
            (textFirst
              ? "내 답장을 적어 보내세요. 마이크로 말해도 좋아요."
              : longRecording
                ? "음성 파일은 30분·50MB까지. 45초씩 나눠 문자로 바꾸며, TXT·SRT·VTT도 가져올 수 있어요."
                : "마이크로 한 문장부터. 녹음은 1분, 파일은 2분·2.4MB까지 가능해요.")
          }
        />
      )}
      {working && phase !== "recording" && phase !== "saving" && (
        <button type="button" className="dd-link" onClick={cancel}>
          처리 취소
        </button>
      )}
      {clip && (
        <>
          <AudioPlayer clip={clip} />
          {transcriptionBlock && (
            <div className="vn-transcription-help" role="status">
              <p>{transcriptionBlock}</p>
              {sampleMode && onEnableAI && (
                <button
                  type="button"
                  className="dd-secondary"
                  disabled={working}
                  onClick={() => {
                    onEnableAI();
                    setNotice(
                      "녹음은 그대로 남아 있어요. 전송 동의를 확인하고 문자로 바꿔주세요.",
                    );
                  }}
                >
                  AI 모드로 전환
                </button>
              )}
              {!sampleMode && !consent && onConsentChange && (
                <AIConsent
                  config={config}
                  checked={consent}
                  onChange={onConsentChange}
                  priority={-2}
                  disabled={working}
                />
              )}
            </div>
          )}
          {!transcriptionBlock && (
            <button
              type="button"
              className="dd-link"
              disabled={working || disabled}
              onClick={() => void transcribe(clip)}
            >
              {clip.transcription && !clip.transcription.complete
                ? "문자 변환 이어서"
                : text
                  ? "다시 문자로 바꾸기"
                  : "문자로 바꾸기"}
            </button>
          )}
        </>
      )}
      {(typing || text || clip) && (
        <label className="vn-label">
          {clip
            ? "인식한 말 · 필요하면 고쳐주세요"
            : textFirst
              ? "내 답장"
              : "직접 입력"}
          <textarea
            ref={editor}
            aria-label="인식한 말 또는 직접 입력"
            rows={3}
            maxLength={longRecording ? RECORDING_MAX_TEXT : 4000}
            value={text}
            disabled={working || disabled}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              textFirst
                ? "상대에게 하듯 편하게 답해보세요."
                : "인식하지 못한 부분은 직접 적어도 돼요."
            }
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
          disabled={
            working ||
            disabled ||
            submitDisabled ||
            (requireText && !text.trim())
          }
          onClick={() => void use()}
        >
          {phase === "saving" ? "저장 중" : submitLabel}
          <Icon name="send" size={17} />
        </button>
      )}
    </section>
  );
  if (!inDialog) return composer;
  return (
    <>
      <div className="input-launcher" aria-label="대화 입력 열기">
        <button
          type="button"
          className="dd-primary"
          disabled={disabled || working}
          onClick={() => {
            setTyping(true);
            setExpanded(true);
            setReceipt("");
          }}
        >
          {text.trim() || clip
            ? "입력 이어쓰기"
            : textFirst
              ? "답변 쓰기"
              : "기록 남기기"}
        </button>
        <button
          type="button"
          className="dd-secondary"
          disabled={disabled || working}
          onClick={() => {
            setExpanded(true);
            setReceipt("");
          }}
        >
          녹음·파일 추가
        </button>
      </div>
      <p className="input-dialog-status" role="status">
        {receipt ||
          (dirty && !expanded
            ? "작성 중인 입력이 있어요. 아직 저장되지 않았어요."
            : "")}
      </p>
      <InputDialog
        open={expanded}
        title={textFirst ? "답변 작성" : "기록 작성"}
        busy={working}
        onClose={() => setExpanded(false)}
        focusTarget={editor}
      >
        {composer}
        <p className="input-dialog-note">
          닫으면 입력을 잠시 보관해요. 저장 전 화면을 나가면 사라질 수 있어요.
        </p>
      </InputDialog>
    </>
  );
}
