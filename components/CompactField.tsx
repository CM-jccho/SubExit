"use client";
import { useEffect, useId, useRef, useState } from "react";
import { SpeechStream, speechConstructor } from "@/lib/live-speech";

export const fieldExamples: Record<string, string[]> = {
  partner: ["직장 동료", "상사", "고객", "가족", "혼자 말하기"],
  situation: [
    "갑자기 일정 변경을 요청받았어요.",
    "서로 의견이 달라 조율이 필요해요.",
    "부담되는 부탁을 받았어요.",
  ],
  goal: [
    "정중하게 거절하고 싶어요.",
    "가능한 시간을 함께 정하고 싶어요.",
    "오해를 풀고 싶어요.",
  ],
  boundaries: [
    "확인하지 않은 일은 약속하지 않기",
    "내 일정과 입장도 분명히 전하기",
    "개인정보는 말하지 않기",
  ],
};
export default function CompactField({
  label,
  value,
  onChange,
  maxLength,
  disabled = false,
  examples = [],
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  maxLength: number;
  disabled?: boolean;
  examples?: string[];
}) {
  const id = useId();
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(value);
  const [phase, setPhase] = useState<"idle" | "connecting" | "listening">(
      "idle",
    ),
    [allowed, setAllowed] = useState(false),
    [consentOpen, setConsentOpen] = useState(false),
    [notice, setNotice] = useState("");
  const listening = phase !== "idle";
  const textInput = useRef<HTMLTextAreaElement>(null);
  const consentPanel = useRef<HTMLDivElement>(null);
  const speech = useRef<SpeechStream>();
  const original = useRef(value),
    change = useRef(onChange);
  change.current = onChange;
  function updateDraft(text: string) {
    setDraft(text);
    change.current(text);
  }
  function stop() {
    speech.current?.stop();
    speech.current = undefined;
    setPhase("idle");
  }
  useEffect(() => () => speech.current?.stop(), []);
  useEffect(() => {
    if (consentOpen)
      consentPanel.current?.scrollIntoView({
        block: "nearest",
        behavior: "auto",
      });
  }, [consentOpen]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  useEffect(() => {
    if (disabled) stop();
  }, [disabled]);
  function dictate() {
    if (speech.current) {
      stop();
      return;
    }
    const Engine = speechConstructor();
    if (!Engine) {
      setNotice(
        "이 브라우저에서는 앱 안의 음성 인식을 지원하지 않아요. 키보드의 마이크 버튼이 있다면 말해서 입력할 수 있어요.",
      );
      return;
    }
    if (!allowed) {
      setConsentOpen(true);
      setNotice("");
      return;
    }
    startVoice();
  }
  function startVoice() {
    const Engine = speechConstructor();
    if (!Engine || disabled) return;
    setConsentOpen(false);
    const before = draft.trim();
    setNotice("");
    speech.current = new SpeechStream(Engine, {
      caption: (final, interim) =>
        updateDraft(
          [before, final, interim]
            .filter(Boolean)
            .join(" ")
            .slice(0, maxLength),
        ),
      state: setPhase,
      error: (message) => {
        stop();
        setNotice(message);
      },
    });
    try {
      speech.current.start();
    } catch {
      stop();
      setNotice(
        "음성 인식을 시작하지 못했어요. 키보드로 입력하거나 다시 시도해 주세요.",
      );
    }
  }
  return (
    <section className="compact-field">
      <span className="compact-field-title">{label}</span>
      {!open ? (
        <button
          className="compact-field-summary"
          type="button"
          disabled={disabled}
          onClick={() => {
            original.current = value;
            setDraft(value);
            setOpen(true);
            setNotice("");
            setConsentOpen(false);
          }}
          aria-label={`${label} ${value ? "수정" : "입력"}`}
        >
          <span>{value || "눌러서 입력하거나 예시를 골라보세요"}</span>
          <b>{value ? "수정" : "+ 입력"}</b>
        </button>
      ) : (
        <div className="compact-field-editor">
          {examples.length > 0 && (
            <div
              className="compact-field-examples"
              aria-label={`${label} 예시`}
            >
              {examples.map((example) => (
                <button
                  type="button"
                  key={example}
                  disabled={disabled || listening}
                  onClick={() => updateDraft(example.slice(0, maxLength))}
                >
                  {example}
                </button>
              ))}
              <small>예시를 고른 뒤 내 상황에 맞게 고칠 수 있어요.</small>
            </div>
          )}
          <label className="vn-label" htmlFor={id}>
            {label}
            <textarea
              ref={textInput}
              id={id}
              aria-label={label}
              rows={3}
              value={draft}
              maxLength={maxLength}
              disabled={disabled || listening}
              onChange={(e) => updateDraft(e.target.value)}
            />
          </label>
          {consentOpen && (
            <div
              ref={consentPanel}
              className="compact-voice-consent"
              role="group"
              aria-label="음성 입력 시작 안내"
            >
              <strong>말씀하신 내용을 문자로 입력할게요.</strong>
              <p>
                음성이 브라우저의 음성 인식 서비스로 전송될 수 있어요. 동의하면
                마이크 권한을 확인하고 시작해요. Gemini 코칭 동의와는 별개예요.
              </p>
              <button
                type="button"
                className="dd-primary"
                disabled={disabled}
                onClick={() => {
                  setAllowed(true);
                  startVoice();
                }}
              >
                동의하고 음성 입력 시작
              </button>
              <button
                type="button"
                className="dd-link"
                onClick={() => {
                  setConsentOpen(false);
                  textInput.current?.focus();
                }}
              >
                직접 입력할게요
              </button>
            </div>
          )}
          {phase !== "idle" && (
            <p role="status">
              {phase === "connecting"
                ? "마이크 연결 중이에요. 권한 요청이 보이면 허용해 주세요."
                : "듣고 있어요. 말씀하시면 입력란에 바로 나타나요."}
            </p>
          )}
          <div className="compact-field-actions">
            <button
              type="button"
              className="dd-secondary"
              disabled={disabled}
              onClick={dictate}
            >
              {phase === "connecting"
                ? "연결 취소"
                : listening
                  ? "음성 입력 마치기"
                  : "말해서 입력"}
            </button>
            <button
              type="button"
              className="dd-primary"
              disabled={disabled}
              onClick={() => {
                stop();
                onChange(draft.trim());
                setOpen(false);
              }}
            >
              입력 완료
            </button>
            <button
              type="button"
              className="dd-link"
              onClick={() => {
                stop();
                change.current(original.current);
                setOpen(false);
              }}
            >
              취소
            </button>
          </div>
          {allowed && (
            <button
              type="button"
              className="dd-link"
              onClick={() => {
                stop();
                setAllowed(false);
                setConsentOpen(false);
                setNotice(
                  "음성 입력 동의를 철회했어요. 입력한 문자는 유지돼요.",
                );
              }}
            >
              음성 입력 동의 철회
            </button>
          )}
          {notice && (
            <div role="status">
              <p>{notice}</p>
              <button
                type="button"
                className="dd-link"
                onClick={() => textInput.current?.focus()}
              >
                키보드로 입력하기
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
