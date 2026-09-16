"use client";
import { useEffect, useRef, useState } from "react";
import { Companion, Icon } from "./CompanionUI";

export const TOUR_KEY = "ddeundeun-first-conversation-v1";
export default function FirstConversation({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  const titles = [
    "처음엔, 같이 해볼까요?",
    "먼저, 내 상황을 꺼내요",
    "상대가 이렇게 말했다면?",
    "내 목표에 맞는 한마디",
  ];
  function finish(create = false) {
    try {
      localStorage.setItem(TOUR_KEY, "seen");
    } catch {
      /* Tour still closes if storage is unavailable. */
    }
    onClose();
    if (create) onCreate();
  }
  return (
    <dialog
      ref={dialog}
      className="dc-tour"
      aria-labelledby="tour-title"
      onCancel={(e) => {
        e.preventDefault();
        finish();
      }}
    >
      <div className="dc-tour-top">
        <span>든든콜 첫 걸음</span>
        <button
          className="dc-icon-button"
          aria-label="튜토리얼 닫기"
          onClick={() => finish()}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="dc-tour-content" key={step}>
        {step === 0 ? (
          <Companion />
        ) : (
          <div className="dc-tour-progress" aria-label={`${step} / 3단계`}>
            {[1, 2, 3].map((n) => (
              <span key={n} className={n <= step ? "complete" : ""}>
                {n < step ? <Icon name="check" size={15} /> : n}
              </span>
            ))}
          </div>
        )}
        <h2 id="tour-title" ref={heading} tabIndex={-1}>
          {titles[step]}
        </h2>
        <p className="dc-tour-sub">
          {
            [
              "작은 대화 하나로 사용법을 익혀봐요.",
              "상대와 목표를 기억하는 ‘대화 카드’예요.",
              "아래 말풍선을 눌러 상대의 말을 골라보세요.",
              "완벽한 답보다, 내가 전하고 싶은 말에 가깝게.",
            ][step]
          }
        </p>
        {step === 0 && (
          <div className="dc-tour-map">
            <span>
              <Icon name="cards" />
              상황 정하기
            </span>
            <b>→</b>
            <span>
              <Icon name="chat" />
              상대 말 듣기
            </span>
            <b>→</b>
            <span>
              <Icon name="target" />
              힌트 받기
            </span>
          </div>
        )}
        {step === 1 && (
          <button
            className={"dc-tour-card " + (selected ? "selected" : "")}
            onClick={() => setSelected(!selected)}
            aria-pressed={selected}
          >
            <span className="dc-tour-card-label">
              <Icon name="cards" size={18} /> 연습용 카드{" "}
              <span className="dc-choice-dot">
                {selected && <Icon name="check" size={15} />}
              </span>
            </span>
            <strong>팀장님과 마감 조율</strong>
            <span>
              상대 <b>업무를 요청한 팀장님</b>
            </span>
            <span>
              목표 <b>추가 보고서 마감을 다음 주로</b>
            </span>
            <span>
              지킬 선 <b>주말 근무는 약속하지 않기</b>
            </span>
          </button>
        )}
        {step === 2 && (
          <div className="dc-tour-conversation">
            <span className="dc-tour-person">팀장님</span>
            <button
              className={"dc-opponent-bubble " + (selected ? "selected" : "")}
              onClick={() => setSelected(true)}
              aria-pressed={selected}
            >
              보고서, 금요일까지 가능하죠?
              <Icon name={selected ? "check" : "plus"} size={19} />
            </button>
            <p>
              <Icon name="mic" size={16} /> 실제 코칭에서는 마이크나 직접
              입력으로 전달해요.
            </p>
          </div>
        )}
        {step === 3 && (
          <div className="dc-tour-answer">
            <span>
              <Icon name="target" size={16} /> 마감 조율이라는 내 목표를 담아서
            </span>
            <blockquote>
              “현재 업무를 마치려면 시간이 더 필요해요. 추가 보고서는 다음
              주까지로 조율할 수 있을까요?”
            </blockquote>
            <small>사용법을 보여주는 사전 작성 예시예요.</small>
          </div>
        )}
      </div>
      <div className="dc-tour-bottom">
        <button
          className="dd-primary dd-full"
          disabled={(step === 1 || step === 2) && !selected}
          onClick={() => {
            if (step === 3) finish(true);
            else {
              setSelected(false);
              setStep(step + 1);
            }
          }}
        >
          {
            [
              "30초만 함께 해보기",
              selected ? "이 상황으로 연습하기" : "위 카드를 눌러주세요",
              selected ? "답변 힌트 보기" : "상대의 말을 눌러주세요",
              "이제 내 대화 만들기",
            ][step]
          }
          <Icon name="arrow" size={19} />
        </button>
        <button className="dd-link" onClick={() => finish()}>
          {step === 3 ? "홈으로 가기" : "건너뛰고 둘러보기"}
        </button>
      </div>
    </dialog>
  );
}
