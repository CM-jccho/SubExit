"use client";
import { useEffect, useState } from "react";
import { listSessions, type VoiceSession } from "@/lib/voice-notebook";
import type { WorkspaceView } from "@/lib/workspace-navigation";
import { speechConstructor } from "@/lib/live-speech";
import { Companion, Icon } from "./CompanionUI";

export default function HomeActions({
  onLive,
  onNavigate,
  onResume,
}: {
  onLive: () => void;
  onNavigate: (view: WorkspaceView) => void;
  onResume: (id: string) => void;
}) {
  const [recent, setRecent] = useState<VoiceSession>();
  const [error, setError] = useState("");
  const [speechSupported, setSpeechSupported] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    setSpeechSupported(!!speechConstructor());
    listSessions()
      .then((rows) => {
        if (active)
          setRecent(
            rows
              .filter((r) => !r.isSample && !r.promptPractice && !r.daily)
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0],
          );
      })
      .catch(() => {
        if (active)
          setError(
            "최근 기록을 불러오지 못했어요. 내 기록에서 다시 확인해 주세요.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="purpose-home" aria-label="대화 도움과 연습">
      <div className="purpose-heading">
        <p>말이 막히는 순간, 바로 옆에서</p>
        <h1>다음 한마디가 필요할 때, 스픽코칭</h1>
      </div>
      <div className="home-live-entry">
        <div className="coach-presence" aria-label="대화 코치 안내">
          <div className="coach-presence-character">
            <Companion small mood="hello" />
          </div>
          <div className="coach-presence-copy">
            <span>지금 대화 도움</span>
            <p>
              상대의 말을 들려주거나 적어주세요.
              <br />상황과 내 목표를 바탕으로 지금 필요한 한마디를 제안해요.
            </p>
          </div>
        </div>
        <div className="home-live-action">
          <div className="home-live-example" aria-label="스픽코칭 사용 장면 예시">
            <span className="home-live-example-label">한 장면으로 보면</span>
            <p>
              <strong>상대</strong>
              “왜 미리 말 안 했어요?”
            </p>
            <p>
              <strong>스픽코칭</strong>
              “제가 먼저 공유했어야 했어요. 지금 상황부터 바로 말씀드릴게요.”
            </p>
          </div>
          <ol className="practice-loop" aria-label="지금 대화 도움받는 과정">
            <li>
              <span>상대 말 이해</span>
            </li>
            <li>
              <span>다음 한마디</span>
            </li>
            <li>
              <span>내 말로 이어가기</span>
            </li>
          </ol>
          <button
            className="dd-primary purpose-start coach-start"
            data-purpose="live"
            aria-describedby="live-input-limit"
            onClick={onLive}
          >
            지금 대화 도움받기 <Icon name="arrow" size={20} />
          </button>
          <p className="purpose-limit browser-capability" id="live-input-limit">
            <Icon name={speechSupported ? "mic" : "keyboard"} size={16} />
            {speechSupported === null
              ? "음성 또는 문자로 상대의 말을 입력할 수 있어요."
              : speechSupported
                ? "이 브라우저는 실시간 자막 기능을 지원해요. 마이크 권한과 연결 상태를 확인해 주세요."
                : "이 브라우저는 실시간 자막이 제한돼요. 직접 입력하거나 짧게 녹음할 수 있어요."}
          </p>
        </div>
      </div>
      {recent && (
        <section className="purpose-recent" aria-label="최근 기록 이어하기">
          <span>이어서 해볼까요?</span>
          <button onClick={() => onResume(recent.id)}>
            <strong>{recent.title}</strong>
            <Icon name="arrow" size={20} />
          </button>
        </section>
      )}
      <div
        className="home-core-options"
        role="group"
        aria-label="대화 전후의 핵심 기능"
      >
        <button
          className="dd-secondary"
          data-purpose="library"
          aria-label="대화 전 미리 연습하기"
          onClick={() => onNavigate("library")}
        >
          <Icon name="chat" size={22} />
          <strong>대화 전 · 미리 연습하기</strong>
          <span>중요한 대화 전에, AI 상대와 실제처럼 먼저 말해봐요.</span>
        </button>
        <button
          className="dd-secondary"
          data-purpose="recording"
          aria-label="대화 후 내 대화 복기하기"
          onClick={() => onNavigate("recording")}
        >
          <Icon name="mic" size={22} />
          <strong>대화 후 · 내 대화 복기</strong>
          <span>끝난 대화에서 잘한 말과 다음에 바꿔볼 한마디를 찾아요.</span>
        </button>
      </div>
      {error && (
        <p role="status" className="vn-caption">
          {error}
        </p>
      )}
    </section>
  );
}
