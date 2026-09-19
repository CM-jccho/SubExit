"use client";
import { useEffect, useState } from "react";
import InputDialog from "./InputDialog";
import BrandMark from "./BrandMark";
import useHorizontalSwipe from "./useHorizontalSwipe";
const KEY = "speakcoaching-intro-v2";
const scenes = [
  {
    title: "상대 말을 듣고, 다음 한마디",
    label: "실시간 도움",
    question: "상대 “왜 미리 말 안 했어요?”",
    answer: "스픽코칭 “제가 먼저 공유했어야 했어요. 지금 상황부터 말씀드릴게요.”",
    detail:
      "대화 중 말이 막히는 순간, 상대의 말을 듣고 내 목표에 맞는 다음 한마디를 바로 제안해요. 자막은 보조이고, 화면의 중심은 지금 말할 한마디예요.",
  },
  {
    title: "시작 전에 두 가지만 정해요",
    label: "상대·목표",
    question: "누구와 이야기하나요?",
    answer: "상대와 이번 대화의 목표만 고르면 준비 끝.",
    detail:
      "친구·동료·고객처럼 상대를 정하고, 확인·거절·일정 조율처럼 원하는 결과를 선택해요. 상황 설명과 지킬 선은 필요할 때만 추가할 수 있어요.",
  },
  {
    title: "끝난 대화는 다음 대화로 이어져요",
    label: "저장·재연습",
    question: "이번 대화, 다음에도 기억할까요?",
    answer: "저장하면 같은 상대의 기록과 묶고 다시 연습할 수 있어요.",
    detail:
      "사용자가 저장한 대화는 내 기록에 남고, 숫자·날짜·금액·용어 같은 정보를 다시 확인할 수 있어요. 어려웠던 장면은 같은 흐름으로 다시 연습해요.",
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
  function startLiveHelp() {
    close();
    const url = new URL(window.location.href);
    url.searchParams.set("view", "quick");
    url.searchParams.set("purpose", "live");
    url.searchParams.delete("tour");
    url.searchParams.delete("demo");
    window.history.pushState(null, "", url.pathname + url.search);
    window.dispatchEvent(new PopStateEvent("popstate"));
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
              <button
                type="button"
                className="dd-primary"
                onClick={startLiveHelp}
              >
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
      <p className="gesture-hint">3단계만 보면 바로 시작할 수 있어요</p>
    </InputDialog>
  );
}
