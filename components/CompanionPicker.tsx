"use client";
import { Companion, Icon } from "./CompanionUI";
import {
  allCompanions,
  recommendCompanion,
  resolveCompanion,
  type CompanionCharacter,
  type CompanionChoice,
} from "@/lib/companions";
import type { ContextProfile } from "@/lib/conversation-cards";
export default function CompanionPicker({
  value,
  onChange,
  profile,
  custom = [],
  disabled = false,
}: {
  value: CompanionChoice;
  onChange: (value: CompanionChoice) => void;
  profile: ContextProfile;
  custom?: CompanionCharacter[];
  disabled?: boolean;
}) {
  const current = resolveCompanion(value, profile, custom),
    recommended = recommendCompanion(profile);
  return (
    <details className="dc-friend-picker">
      <summary>
        <Companion small character={current} />
        <span>
          함께할 도우미 <strong>{current.name}</strong>
          <small>
            {value === "auto" ? "상황에 맞춰 추천 중" : "직접 선택함"} · 눌러서
            변경
          </small>
        </span>
        <Icon name="edit" size={16} />
      </summary>
      <fieldset disabled={disabled}>
        <legend>대화 도우미 선택</legend>
        <label className="dc-friend-auto">
          <input
            type="radio"
            name="companion-choice"
            checked={value === "auto"}
            onChange={() => onChange("auto")}
          />
          <span>
            <strong>상황에 맞춰 추천</strong>
            <small>{recommended.reason}</small>
          </span>
        </label>
        <div className="dc-friend-options">
          {allCompanions(custom).map((c) => (
            <label key={c.id} className={value === c.id ? "selected" : ""}>
              <input
                type="radio"
                name="companion-choice"
                checked={value === c.id}
                onChange={() => onChange(c.id)}
              />
              <Companion small character={c} />
              <strong>{c.name}</strong>
              <small>{c.specialty}</small>
            </label>
          ))}
        </div>
      </fieldset>
      <p>
        선택은 카드와 함께 저장돼요. 직접 고른 친구는 상황을 수정해도 바뀌지
        않아요. 새 친구는 AI 대화 상대에서 만들 수 있어요.
      </p>
    </details>
  );
}
