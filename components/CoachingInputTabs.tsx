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

  return (
    <div className="coaching-input-navigation">
      {!liveActive && (
        <button
          type="button"
          className="coaching-primary-mode"
          aria-pressed={value === "continuous"}
          disabled={busy || !supportsLive}
          onClick={() => onChange("continuous")}
        >
          <span className="coaching-primary-icon">
            <Icon name="mic" size={19} />
          </span>
          <span>
            <strong>실시간 도움으로 돌아가기</strong>
            <small>상대 말을 들으면서 다음 한마디를 받아요</small>
          </span>
        </button>
      )}

      {!supportsLive && (
        <p id="live-support-hint" className="live-stream-note">
          {unsupportedMessage ||
            "이 브라우저에서는 실시간 도움이 제한돼요. 짧게 듣기나 직접 입력을 이용해 주세요."}
        </p>
      )}

      {liveActive ? (
        <details className="coaching-fallback-modes">
          <summary>다른 방식으로 입력</summary>
          <div className="dc-mode-switch" role="group" aria-label="보조 입력 방식">
            <button
              type="button"
              aria-pressed="false"
              disabled={busy}
              onClick={() => onChange("voice")}
            >
              <Icon name="mic" size={17} />
              짧게 듣기
            </button>
            <button
              type="button"
              aria-pressed="false"
              disabled={busy}
              onClick={() => onChange("text")}
            >
              <Icon name="keyboard" size={17} />
              직접 입력
            </button>
          </div>
        </details>
      ) : (
        <div className="coaching-fallback-modes is-open">
          <p className="coaching-fallback-label">다른 방식으로 입력</p>
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
