"use client";
import { useEffect, useState } from "react";
import InputDialog from "./InputDialog";
import BrandMark from "./BrandMark";
import useHorizontalSwipe from "./useHorizontalSwipe";
const KEY = "speakcoaching-intro-v1";
const scenes = [
  {
    title: "말이 막히는 순간, 다음 한마디",
    label: "대화 중",
    question: "“왜 미리 말 안 했어요?”",
    answer: "“제가 먼저 공유했어야 했어요. 지금 상황부터 바로 말씀드릴게요.”",
    detail:
      "실제 대화에서 순간 말이 막힐 때, 상대의 말과 내 목표를 바탕으로 지금 필요한 한마디를 제안해요. 그대로 따라 하기보다 내 말로 바꿔 이어가세요.",
  },
  {
    title: "중요한 대화는, 미리 말해보세요",
    label: "대화 전",
    question: "이 부탁, 어떻게 거절하지?",
    answer: "내 입장을 지키면서도 관계를 해치지 않는 표현을 먼저 연습해요.",
    detail:
      "상사, 고객, 친구처럼 실제 상대를 떠올리고 AI와 먼저 말해볼 수 있어요. 유창함보다 내가 원하는 결과를 분명하게 전하는 연습에 집중해요.",
  },
  {
    title: "끝난 대화도, 다음 실전이 됩니다",
    label: "대화 후",
    question: "아까 왜 그렇게 말했지…",
    answer: "잘한 말과 다음에 바꿔볼 한마디를 함께 찾아봐요.",
    detail:
      "녹음이나 문자로 실제 내 말을 돌아보고, 근거 있는 피드백을 확인한 뒤 같은 장면을 다시 연습할 수 있어요. 준비 → 실전 → 복기가 하나의 흐름으로 이어져요.",
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
                실시간 대화 도움 시작
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
