"use client";
import {
  conversationLanguages,
  type ConversationLanguages,
  type Language,
} from "@/lib/conversation-language";
export default function LanguagePicker({
  value,
  disabled,
  onChange,
}: {
  value: ConversationLanguages;
  disabled?: boolean;
  onChange: (v: ConversationLanguages) => void;
}) {
  return (
    <fieldset className="learn-language" disabled={disabled}>
      <legend>대화 언어</legend>
      {(
        [
          ["partner", "상대가 말하는 언어"],
          ["mine", "내 답변 후보의 언어"],
        ] as const
      ).map(([key, title]) => (
        <label className="vn-label" key={key}>
          {title}
          <select
            value={value[key]}
            onChange={(e) =>
              onChange({ ...value, [key]: e.target.value as Language })
            }
          >
            {Object.entries(conversationLanguages).map(([code, language]) => (
              <option key={code} value={code}>
                {language.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <small>
        서로 다른 언어로 말해도 돼요. 화면 안내·복기는 한국어이며, 읽어주기는
        기기에 설치된 음성을 사용해요.
      </small>
    </fieldset>
  );
}
