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
  onBrowse,
  sampleCount = 0,
  onCreate,
  editing,
  onEditingChange,
}: {
  value: ConversationFocus | null;
  onBrowse?: () => void;
  sampleCount?: number;
  onCreate?: () => void;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onChange: (focus: ConversationFocus) => void;
}) {
  function choose(next: ConversationFocus) {
    onChange(next);
    onEditingChange(false);
  }
  if (value && !editing)
    return (
      <aside className="focus-current" aria-label="선택한 대화 맥락">
        <span>
          <small>내 관심 상황</small>
          <strong>{focusInfo(value)?.label || "아직 정하지 않음"}</strong>
        </span>
        <button className="dd-link" onClick={() => onEditingChange(true)}>
          선택 바꾸기
        </button>
        {onBrowse && (
          <button className="dd-link" onClick={onBrowse}>
            모든 연습 상황 보기 ({sampleCount}) <Icon name="arrow" size={16} />
          </button>
        )}
      </aside>
    );
  return (
    <section className="focus-picker" aria-label="대화 맥락 선택">
      <div className="focus-intro">
        <div className="focus-intro-copy">
          <p className="dc-overline">관심 상황 선택</p>
          <h1>어떤 상황의 대화를 연습할까요?</h1>
          <p>관심 상황을 고르면, 다음 화면에서 연습할 장면을 보여드려요.</p>
        </div>
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
          <button className="dd-link" onClick={() => onEditingChange(false)}>
            선택 유지하기
          </button>
        )}
      </div>
      <small>선택은 이 브라우저에 저장돼요. 언제든 바꿀 수 있어요.</small>
    </section>
  );
}
