"use client";
import { useEffect, useRef, useState } from "react";
import { Companion, Icon } from "./CompanionUI";
import { defaultCompanions } from "@/lib/companions";
const scenes = [
  {
    name: "느린 구름",
    topic: "동료에게 도움 부탁하기",
    question: "동료도 바쁜데 검토를 부탁하려니 눈치가 보여요.",
    replies: [
      "검토할 부분을 작게 나눠서 부탁해보면 어떨까요?",
      "먼저 가능한 시간을 물어보는 것도 좋아요.",
    ],
  },
  {
    name: "작은 별",
    topic: "거절해도 괜찮을까요?",
    question: "이번 주에는 추가 업무를 맡기 어려운데 어떻게 말할까요?",
    replies: [
      "지금 맡은 일과 가능한 범위를 함께 설명해보세요.",
      "바로 약속하기 전에 우선순위를 물어봐도 좋겠어요.",
    ],
  },
  {
    name: "초록 바람",
    topic: "서로 다른 세대의 말",
    question: "가족이 쓰는 표현을 모를 때 어떻게 물어보면 편할까요?",
    replies: [
      "어떤 뜻으로 쓴 말인지 궁금하다고 편하게 물어보세요.",
      "아는 척하기보다 사용한 문장을 함께 보면 좋아요.",
    ],
  },
];
export default function CommunityPreview() {
  const [open, setOpen] = useState(false),
    [scene, setScene] = useState(0),
    [reply, setReply] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else if (dialog.current?.open) {
      dialog.current.close();
    }
  }, [open]);
  function close() {
    setOpen(false);
    setReply("");
    trigger.current?.focus();
  }
  const current = scenes[scene];
  return (
    <>
      <div className="learn-preview-invite">
        <span>
          <small>다음에 만날 공간 · 준비 중</small>
          <strong>익명 라운지</strong>
          <p>
            비슷한 고민을 가진 사람들과 잠시 이야기하는 공간을 구상하고 있어요.
          </p>
        </span>
        <button
          ref={trigger}
          className="dd-secondary"
          onClick={() => setOpen(true)}
        >
          샘플 공간 둘러보기 <Icon name="arrow" size={16} />
        </button>
      </div>
      <dialog
        ref={dialog}
        className="vn-dialog learn-community-dialog"
        aria-labelledby="community-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <div className="vn-dialog-head">
          <div>
            <span className="dc-sample-badge">향후 서비스 · 샘플</span>
            <h2 id="community-title">익명 라운지 미리보기</h2>
          </div>
          <button
            className="vn-icon"
            aria-label="라운지 미리보기 닫기"
            onClick={close}
          >
            <Icon name="close" />
          </button>
        </div>
        <p className="learn-callout">
          아래 캐릭터와 대화는 모두 가상 예시예요. 실제 접속자·메시지 전송
          기능은 아직 없어요.
        </p>
        <div className="learn-community-room" aria-label="가상 참가자 3명">
          {scenes.map((s, i) => (
            <button
              key={s.name}
              className={scene === i ? "selected" : ""}
              aria-pressed={scene === i}
              onClick={() => {
                setScene(i);
                setReply("");
              }}
            >
              <span className="learn-lounge-actor">
                <Companion small character={defaultCompanions[i]} />
              </span>
              <strong>{s.name}</strong>
              <small>가상 참가자</small>
            </button>
          ))}
        </div>
        <section className="learn-community-card" aria-live="polite">
          <small>샘플 고민 · {current.name}</small>
          <h3>{current.topic}</h3>
          <blockquote>{current.question}</blockquote>
          <p>이런 한마디를 건네는 흐름을 체험해보세요.</p>
          <div className="vn-choice-list">
            {current.replies.map((r) => (
              <button key={r} onClick={() => setReply(r)}>
                {r}
              </button>
            ))}
          </div>
          {reply && (
            <div className="learn-callout">
              <strong>내가 고른 답변 · 체험용</strong>
              <p>{reply}</p>
              <small>
                다른 사람에게 보내지 않았어요. 창을 닫으면 선택은 사라져요.
              </small>
            </div>
          )}
        </section>
        <details className="vn-quote">
          <summary>실제 서비스에서는 어떤 모습일까요?</summary>
          <p>
            익명 별명으로 주제별 방에 들어와 고민을 나누고, 원하면 대화 연습으로
            이어가는 흐름을 구상하고 있어요. 실제 출시에는 이용 연령 구분,
            신고·차단, 운영과 보관 정책을 함께 마련할 예정이에요.
          </p>
        </details>
      </dialog>
    </>
  );
}
