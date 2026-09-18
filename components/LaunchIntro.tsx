"use client";
import { useEffect, useState } from "react";
import InputDialog from "./InputDialog";
import BrandMark from "./BrandMark";
import useHorizontalSwipe from "./useHorizontalSwipe";
const KEY = "speakcoaching-intro-v1";
const scenes = [
  {
    title: "하고 싶은 말을 삼킨 당신에게",
    label: "대화 전",
    question: "이 부탁, 어떻게 거절하지?",
    answer: "내 마음도 지키면서 말할 수 있어요.",
    detail:
      "부탁을 거절하기 어렵거나 중요한 대화가 부담스러울 때, 두리와 먼저 연습해요. 유창함보다 내 뜻을 전하는 일이 먼저니까요.",
  },
  {
    title: "정답 대신, 나다운 한마디",
    label: "대화 중",
    question: "지금 바로 정해 주실 수 있나요?",
    answer: "확인할 시간을 먼저 정해도 될까요?",
    detail:
      "순간 말이 막힐 때, 내 목표에 맞는 답변을 제안해요. 그대로 따라 하지 않아도 괜찮아요. 내 말로 고르고 바꾸는 건 나의 몫이에요.",
  },
  {
    title: "후회보다, 다음을 위한 연습",
    label: "대화 후",
    question: "아까 조금 다르게 말할걸…",
    answer: "잘한 점부터 함께 찾아볼까요?",
    detail:
      "끝난 대화가 자꾸 떠오를 때, 녹음이나 문자로 잘한 점부터 돌아봐요. 나를 평가하기보다 다음 대화에서 시도할 작은 변화를 찾아요.",
  },
];
export default function LaunchIntro() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const scene = scenes[step];
  const swipe = useHorizontalSwipe({
    enabled: open,
    pageKey: step,
    inDialog: true,
    canNext: step < 2,
    canPrevious: step > 0,
    onNext: () => setStep((value) => Math.min(2, value + 1)),
    onPrevious: () => setStep((value) => Math.max(0, value - 1)),
  });
  function close() {
    setOpen(false);
    try {
      localStorage.setItem(KEY, "seen");
    } catch {}
  }
  useEffect(() => {
    const reopen = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener("gyeotmal-show-intro", reopen);
    let seen = false;
    try {
      seen = !!localStorage.getItem(KEY);
    } catch {}
    if (!seen && !new URLSearchParams(window.location.search).has("view"))
      setOpen(true);
    return () => window.removeEventListener("gyeotmal-show-intro", reopen);
  }, []);
  return (
    <InputDialog
      open={open}
      title="스픽코칭"
      closeLabel="인트로 건너뛰기"
      onClose={close}
      className="launch-intro"
      footer={
        <>
          <nav className="launch-progress" aria-label="온보딩 단계">
            {scenes.map((item, index) => (
              <button
                type="button"
                key={item.label}
                aria-label={item.label}
                aria-current={step === index ? "step" : undefined}
                onClick={() => setStep(index)}
              >
                <span />
              </button>
            ))}
          </nav>
          <div className="launch-actions">
            {step > 0 && (
              <button
                type="button"
                className="dd-link"
                onClick={() => setStep(step - 1)}
              >
                이전
              </button>
            )}
            {step < 2 ? (
              <button
                type="button"
                className="dd-secondary"
                onClick={() => setStep(step + 1)}
              >
                다음
              </button>
            ) : (
              <button type="button" className="dd-primary" onClick={close}>
                내 대화 시작하기
              </button>
            )}
          </div>
          {step < 2 && (
            <button
              type="button"
              className="dd-link launch-skip"
              onClick={close}
            >
              건너뛰고 시작하기
            </button>
          )}
        </>
      }
    >
      <div className="launch-mascot" aria-hidden="true">
        <BrandMark size={112} />
      </div>
      <div
        {...swipe}
        className="launch-swipe"
        aria-label="좌우로 넘기는 서비스 소개"
      >
        <div key={step} className="launch-scene" aria-live="polite">
          <p className="launch-eyebrow">
            {scene.label} · {step + 1} / 3
          </p>
          <h1>{scene.title}</h1>
          <div className="launch-bubble launch-question">{scene.question}</div>
          <div className="launch-bubble launch-answer">{scene.answer}</div>
          <p>{scene.detail}</p>
        </div>
      </div>
      <p className="gesture-hint">좌우로 밀어서 둘러보세요</p>
    </InputDialog>
  );
}
