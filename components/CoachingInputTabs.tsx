"use client";
import { Icon } from "./CompanionUI";

export type CoachingInputMode = "voice" | "text" | "continuous";

export default function CoachingInputTabs({
  value,
  onChange,
  busy,
  supportsLive,
  unsupportedMessage,
}: {
  value: CoachingInputMode;
  onChange: (mode: CoachingInputMode) => void;
  busy: boolean;
  supportsLive: boolean;
  unsupportedMessage?: string;
}) {
  const liveActive = value === "continuous" && supportsLive;

  const fallbackButtons = (
    <div className="dc-mode-switch" role="group" aria-label="보조 입력 방식">
      <button
        type="button"
        className={value === "voice" ? "active" : ""}
        aria-pressed={value === "voice"}
        disabled={busy}
        onClick={() => onChange("voice")}
      >
        <Icon name="mic" size={17} />
        짧게 듣기
      </button>
      <button
        type="button"
        className={value === "text" ? "active" : ""}
        aria-pressed={value === "text"}
        disabled={busy}
        onClick={() => onChange("text")}
      >
        <Icon name="keyboard" size={17} />
        직접 입력
      </button>
    </div>
  );

  return (
    <div className="coaching-input-navigation">
      {!supportsLive && (
        <p id="live-support-hint" className="live-stream-note">
          {unsupportedMessage ||
            "이 브라우저에서는 실시간 도움이 제한돼요. 짧게 듣기나 직접 입력을 이용해 주세요."}
        </p>
      )}

      {!liveActive && supportsLive && (
        <button
          type="button"
          className="coaching-return-live"
          disabled={busy}
          onClick={() => onChange("continuous")}
        >
          <Icon name="mic" size={16} />
          실시간 도움으로 돌아가기
        </button>
      )}

      {supportsLive ? (
        <details className="coaching-fallback-modes">
          <summary>다른 방식으로 입력</summary>
          {fallbackButtons}
        </details>
      ) : (
        <div className="coaching-fallback-modes fallback-always-open">
          <p className="coaching-fallback-label">다른 방식으로 입력</p>
          {fallbackButtons}
        </div>
      )}

      {busy && (
        <p className="live-stream-note">
          듣기나 처리를 마친 뒤 입력 방식을 바꿀 수 있어요.
        </p>
      )}
    </div>
  );
}
