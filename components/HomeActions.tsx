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
        <p>대화 중, 내 옆의 AI 도우미</p>
        <h1>다음에 뭐라고 말할지 막힐 때.</h1>
      </div>
      <div className="home-live-entry">
        <div className="coach-presence" aria-label="대화 코치 안내">
          <div className="coach-presence-character">
            <Companion small mood="hello" />
          </div>
          <div className="coach-presence-copy">
            <span>대화 중, 옆에서 함께</span>
            <p>
              상대가 한 말을 알려주세요.
              <br />내 목표에 맞는 다음 한마디를 찾아드릴게요.
            </p>
          </div>
        </div>
        <div className="home-live-action">
          <ol className="practice-loop" aria-label="지금 대화 도움받는 과정">
            <li>
              <span>상대 말 입력</span>
            </li>
            <li>
              <span>다음 한마디</span>
            </li>
            <li>
              <span>대화 이어가기</span>
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
          aria-label="미리 연습하기"
          onClick={() => onNavigate("library")}
        >
          <Icon name="chat" size={22} />
          <strong>미리 연습하기</strong>
          <span>AI 상대와 대화 · 복기 · 재연습</span>
        </button>
        <button
          className="dd-secondary"
          data-purpose="recording"
          aria-label="녹음 분석·코칭"
          onClick={() => onNavigate("recording")}
        >
          <Icon name="mic" size={22} />
          <strong>녹음 분석·코칭</strong>
          <span>내 녹음 첨부 · 분석 · 코칭</span>
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
