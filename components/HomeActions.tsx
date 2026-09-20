"use client";
import { useEffect, useState } from "react";
import { listSessions, type VoiceSession } from "@/lib/voice-notebook";
import type { WorkspaceView } from "@/lib/workspace-navigation";
import {
  speechSupport,
  speechSupportMessage,
  type SpeechSupportReason,
} from "@/lib/live-speech";
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
  const [speechReason, setSpeechReason] = useState<SpeechSupportReason>();
  useEffect(() => {
    let active = true;
    const support = speechSupport();
    setSpeechSupported(!!support.Engine);
    setSpeechReason(support.reason);
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
            <span>실시간 대화 도움</span>
            <p>
              상대의 말을 들으면 지금 필요한 다음 한마디를 바로 제안해요.
              <br />직접 입력과 짧게 듣기는 필요할 때 보조로 사용할 수 있어요.
            </p>
          </div>
        </div>
        <div className="home-live-action">
          <button
            className="dd-primary purpose-start coach-start"
            data-purpose="live"
            aria-describedby="live-input-limit"
            onClick={onLive}
          >
            실시간 대화 도움 시작 <Icon name="arrow" size={20} />
          </button>
          <p className="purpose-limit browser-capability" id="live-input-limit">
            <Icon name={speechSupported ? "mic" : "keyboard"} size={16} />
            {speechSupported === null
              ? "음성 또는 문자로 상대의 말을 입력할 수 있어요."
              : speechSupported
                ? "상대 말을 들으면서 다음 한마디를 바로 받아볼 수 있어요."
                : speechSupportMessage(speechReason)}
          </p>
          <div className="home-live-example" aria-label="스픽코칭 사용 장면 예시">
            <span className="home-live-example-label">이렇게 도와드려요</span>
            <p>
              <strong>상대</strong>
              “왜 미리 말 안 했어요?”
            </p>
            <p>
              <strong>스픽코칭</strong>
              “제가 먼저 공유했어야 했어요. 지금 상황부터 바로 말씀드릴게요.”
            </p>
          </div>
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
      <div className="home-secondary-heading">
        <span>필요할 때 이어서</span>
        <p>연습과 복기는 실시간 대화를 더 잘 이어가기 위한 보조 도구예요.</p>
      </div>
      <div
        className="home-core-options home-secondary-tools"
        role="group"
        aria-label="대화 전후 보조 기능"
      >
        <button
          className="dd-secondary"
          data-purpose="library"
          aria-label="대화 전 미리 연습하기"
          onClick={() => onNavigate("library")}
        >
          <Icon name="chat" size={22} />
          <strong>미리 연습</strong>
          <span>중요한 장면을 AI 상대와 먼저 말해봐요.</span>
        </button>
        <button
          className="dd-secondary"
          data-purpose="recording"
          aria-label="대화 후 내 대화 복기하기"
          onClick={() => onNavigate("recording")}
        >
          <Icon name="mic" size={22} />
          <strong>대화 복기</strong>
          <span>끝난 대화를 돌아보고 같은 장면을 다시 연습해요.</span>
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
