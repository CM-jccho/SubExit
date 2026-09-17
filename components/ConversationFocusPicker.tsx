import { useState } from "react";
import FocusScene from "./FocusScene";
import { Icon } from "./CompanionUI";
import {
  focusInfo,
  focusOptions,
  type ConversationFocus,
} from "@/lib/conversation-focus";
export default function ConversationFocusPicker({
  value,
  onChange,
  browsing = false,
  onBrowse,
  onCreate,
}: {
  value: ConversationFocus | null;
  browsing?: boolean;
  onBrowse?: () => void;
  onCreate?: () => void;
  onChange: (focus: ConversationFocus) => void;
}) {
  const [editing, setEditing] = useState(false);
  function choose(next: ConversationFocus) {
    onChange(next);
    setEditing(false);
  }
  if (value && !editing)
    return (
      <aside className="focus-current" aria-label="선택한 대화 맥락">
        <span>
          <small>
            {browsing ? "전체를 보는 중 · 내 선택" : "지금 준비할 대화"}
          </small>
          <strong>{focusInfo(value)?.label || "전체 둘러보기"}</strong>
        </span>
        <button className="dd-link" onClick={() => setEditing(true)}>
          선택 바꾸기
        </button>
        {value !== "all" && (
          <button
            className="dd-link"
            onClick={onBrowse || (() => choose("all"))}
          >
            {browsing ? "내 선택만 보기" : "전체 둘러보기"}
          </button>
        )}
      </aside>
    );
  return (
    <section className="focus-picker" aria-label="대화 맥락 선택">
      <div className="focus-intro">
        <div className="focus-intro-copy">
          <p className="dc-overline">나에게 필요한 대화부터</p>
          <h1>지금 어떤 대화를 준비하세요?</h1>
          <p>
            연습하고 싶은 장면을 골라보세요.
            <br />
            나에게 맞는 상황과 표현부터 함께 준비해요.
          </p>
        </div>
        <FocusScene />
      </div>
      <div className="focus-options">
        {focusOptions
          .filter((option) => option.id !== "custom")
          .map((option) => (
            <button
              key={option.id}
              data-focus={option.id}
              aria-label={`${option.label} ${option.example}`}
              aria-pressed={value === option.id}
              onClick={() => choose(option.id)}
            >
              <FocusScene focus={option.id} compact />
              <div className="focus-option-copy">
                <strong>{option.label}</strong>
                <span>{option.example}</span>
                <i className="focus-option-arrow" aria-hidden="true">
                  <Icon name="arrow" size={18} />
                </i>
              </div>
            </button>
          ))}
      </div>
      <div className="vn-toolbar">
        {onCreate && (
          <button className="dd-secondary" onClick={onCreate}>
            내 상황 직접 설명하기
          </button>
        )}
        <button className="dd-link" onClick={() => choose("all")}>
          아직 정하지 않았어요 · 전체 둘러보기
        </button>
        {value && (
          <button className="dd-link" onClick={() => setEditing(false)}>
            선택 유지하기
          </button>
        )}
      </div>
      <small>
        선택은 이 브라우저에 저장해요. 직업을 추정하거나 AI로 분석하지 않아요.
      </small>
    </section>
  );
}
