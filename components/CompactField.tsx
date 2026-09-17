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
  const [listening, setListening] = useState(false),
    [allowed, setAllowed] = useState(false),
    [notice, setNotice] = useState("");
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
    setListening(false);
  }
  useEffect(() => () => speech.current?.stop(), []);
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
    if (listening) {
      stop();
      return;
    }
    const Engine = speechConstructor();
    if (!Engine) {
      setNotice(
        "이 브라우저에서는 키보드의 마이크 버튼으로 말해서 입력할 수 있어요.",
      );
      return;
    }
    if (!allowed) {
      setNotice("아래 음성 인식 안내를 확인해 주세요.");
      return;
    }
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
      state: () => setListening(true),
      error: (message) => {
        stop();
        setNotice(message);
      },
    });
    speech.current.start();
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
              id={id}
              aria-label={label}
              rows={3}
              value={draft}
              maxLength={maxLength}
              disabled={disabled || listening}
              onChange={(e) => updateDraft(e.target.value)}
            />
          </label>
          <div className="compact-field-actions">
            <button
              type="button"
              className="dd-secondary"
              disabled={disabled}
              onClick={dictate}
            >
              {listening ? "음성 입력 마치기" : "말해서 입력"}
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
          <details>
            <summary>음성 인식 안내</summary>
            <label className="dd-check">
              <input
                type="checkbox"
                checked={allowed}
                onChange={(e) => {
                  setAllowed(e.target.checked);
                  if (!e.target.checked) stop();
                }}
              />
              브라우저 음성 인식 서비스로 음성이 전송될 수 있음에 동의해요.
            </label>
          </details>
          {notice && <p role="status">{notice}</p>}
        </div>
      )}
    </section>
  );
}
