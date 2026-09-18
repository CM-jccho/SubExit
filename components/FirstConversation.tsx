"use client";
import { useState } from "react";
import InputDialog from "./InputDialog";
export const TOUR_KEY = "ddeundeun-spotlight-guide-v2";
const steps = [
  {
    target: "starter-card",
    title: "예시 상황으로 시작해 볼까요?",
    text: "상대와 목표가 준비된 상황을 열어볼게요. 지금은 아무것도 입력하지 않아도 돼요.",
    action: "예시 상황 보기",
    click: true,
  },
  {
    target: "conversation-goal",
    title: "이번 대화에서 원하는 결과예요",
    text: "상대와 어떤 결과를 만들고 싶은지 확인하세요. 코칭은 이 목표를 바탕으로 답변을 준비해요.",
    action: "확인했어요",
    click: false,
  },
  {
    target: "practice-button",
    title: "같은 상황으로 대화를 연습해요",
    text: "연습 화면에서 직접 답하거나 답변 후보를 선택할 수 있어요.",
    action: "연습 화면 열기",
    click: true,
  },
  {
    target: "practice-settings",
    title: "이제 직접 시작해 보세요",
    text: "샘플로 가볍게 체험하거나, AI 전송에 동의한 뒤 AI 모드로 연습할 수 있어요.",
    action: "안내 마치고 연습하기",
    click: false,
  },
];
export default function FirstConversation({
  step,
  onStep,
  onClose,
  scene,
}: {
  step: number;
  onStep: (step: number) => void;
  onClose: () => void;
  scene: { title: string; goal: string };
}) {
  const [error, setError] = useState("");
  const current = steps[step];
  function finish() {
    try {
      localStorage.setItem(TOUR_KEY, "seen");
    } catch {
      /* Help also closes without storage. */
    }
    onClose();
  }
  function advance() {
    if (current.click) {
      const target = document.querySelector<HTMLElement>(
        `[data-tour="${current.target}"]`,
      );
      if (!target) {
        setError("이 화면을 열지 못했어요. 안내를 닫고 다시 시도해 주세요.");
        return;
      }
      target.click();
    }
    setError("");
    if (step === steps.length - 1) finish();
    else onStep(step + 1);
  }
  return (
    <InputDialog
      open
      title={`대화 연습 안내 · ${step + 1}/${steps.length}`}
      className="screen-help practice-walkthrough"
      onClose={finish}
    >
      <h3>{current.title}</h3>
      {step < 2 && (
        <aside className="help-context">
          <small>{step === 0 ? "연습할 상황" : "원하는 결과"}</small>
          <strong>{step === 0 ? scene.title : scene.goal}</strong>
        </aside>
      )}
      <p>{current.text}</p>
      {error && (
        <p className="dd-error" role="alert">
          {error}
        </p>
      )}
      <button className="dd-primary dd-full" onClick={advance}>
        {current.action}
      </button>
    </InputDialog>
  );
}
