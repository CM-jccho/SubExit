"use client";
import { Icon } from "./CompanionUI";
export type CoachingInputMode = "voice" | "text" | "continuous";
export default function CoachingInputTabs({
  value,
  onChange,
  busy,
  supportsLive,
}: {
  value: CoachingInputMode;
  onChange: (mode: CoachingInputMode) => void;
  busy: boolean;
  supportsLive: boolean;
}) {
  return (
    <div className="coaching-input-navigation">
      <div className="dc-mode-switch" role="group" aria-label="입력 방식">
        <button
          className={value === "voice" ? "active" : ""}
          aria-pressed={value === "voice"}
          disabled={busy}
          onClick={() => onChange("voice")}
        >
          <Icon name="mic" size={18} />
          들려주기
        </button>
        <button
          className={value === "text" ? "active" : ""}
          aria-pressed={value === "text"}
          disabled={busy}
          onClick={() => onChange("text")}
        >
          <Icon name="keyboard" size={18} />
          직접 입력
        </button>
        <button
          className={value === "continuous" ? "active" : ""}
          aria-pressed={value === "continuous"}
          disabled={busy || !supportsLive}
          aria-describedby={!supportsLive ? "live-support-hint" : undefined}
          onClick={() => onChange("continuous")}
        >
          실시간 자막
        </button>
      </div>
      {!supportsLive && (
        <p id="live-support-hint" className="live-stream-note">
          이 브라우저는 실시간 자막을 지원하지 않아요. 들려주기나 직접 입력을
          이용해 주세요.
        </p>
      )}
      {busy && (
        <p className="live-stream-note">
          듣기나 처리를 마친 뒤 입력 방식을 바꿀 수 있어요.
        </p>
      )}
    </div>
  );
}
