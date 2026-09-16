"use client";
import { useEffect, useRef, useState } from "react";
import { useCompanion } from "./CompanionTheme";
import { Companion, Icon } from "./CompanionUI";
export const TOUR_KEY = "ddeundeun-spotlight-guide-v2";
const steps = [
  {
    target: "starter-card",
    title: "우선, 이 카드를 눌러봐요",
    text: "상대와 목표가 미리 들어 있어요. 아무것도 적지 않고 시작해도 괜찮아요.",
    action: "이 카드 열기",
    click: true,
  },
  {
    target: "conversation-goal",
    title: "내가 원하는 건 여기에!",
    text: "상대에게 하고 싶은 말의 방향이에요. 지킬 선과 함께 기억해 두세요.",
    action: "확인했어요",
    click: false,
  },
  {
    target: "practice-button",
    title: "이제 상대와 연습해봐요",
    text: "이 버튼을 누르면 저장한 상황의 상대와 대화를 주고받을 수 있어요.",
    action: "연습 화면 열기",
    click: true,
  },
  {
    target: "practice-settings",
    title: "준비되면, 한마디부터",
    text: "전송 안내에 동의하고 ‘상대와 연습 시작’을 눌러요. 이후에는 녹음하거나 답변 후보를 골라 말할 수 있어요.",
    action: "여기서 시작할게요",
    click: false,
  },
];
type Box = { left: number; top: number; width: number; height: number };
export default function FirstConversation({
  step,
  onStep,
  onClose,
}: {
  step: number;
  onStep: (step: number) => void;
  onClose: () => void;
}) {
  const character = useCompanion();
  const dialog = useRef<HTMLDialogElement>(null),
    panel = useRef<HTMLDivElement>(null),
    next = useRef<HTMLButtonElement>(null);
  const [box, setBox] = useState<Box | null>(null),
    [placement, setPlacement] = useState({ top: 200, left: 20, below: true });
  const current = steps[step];
  function finish() {
    try {
      localStorage.setItem(TOUR_KEY, "seen");
    } catch {
      /* Closing still works without storage. */
    }
    onClose();
  }
  useEffect(() => {
    const el = dialog.current,
      previous = document.activeElement as HTMLElement | null;
    el?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el?.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    setBox(null);
    let observer: ResizeObserver | undefined;
    let frame = 0;
    const measure = () => {
      const target = document.querySelector<HTMLElement>(
        `[data-tour="${current.target}"]`,
      );
      if (!target) return;
      const r = target.getBoundingClientRect(),
        gap = 22,
        margin = 12;
      const w = window.innerWidth,
        h = window.innerHeight;
      const height = panel.current?.offsetHeight || 270;
      const width = Math.min(360, w - margin * 2);
      const below =
        r.bottom + gap + height <= h - margin || r.top < height + gap;
      setBox({
        left: Math.max(4, r.left - 5),
        top: Math.max(4, r.top - 5),
        width: Math.min(w - 8, r.width + 10),
        height: r.height + 10,
      });
      setPlacement({
        left: Math.max(margin, Math.min(r.left, w - width - margin)),
        top: Math.max(
          margin,
          Math.min(
            below ? r.bottom + gap : r.top - height - gap,
            h - height - margin,
          ),
        ),
        below,
      });
    };
    // The parent renders the actual destination view; observe it instead of cloning UI.
    frame = requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-tour="${current.target}"]`,
      );
      target?.scrollIntoView({ block: "center", behavior: "instant" });
      measure();
      next.current?.focus({ preventScroll: true });
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(measure);
        if (target) observer.observe(target);
        if (panel.current) observer.observe(panel.current);
      }
    });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, current.target]);
  function advance() {
    if (current.click) {
      const target = document.querySelector<HTMLElement>(
        `[data-tour="${current.target}"]`,
      );
      if (!target) return;
      target.click();
    }
    if (step === steps.length - 1) finish();
    else onStep(step + 1);
  }
  return (
    <dialog
      ref={dialog}
      className="dc-spotlight"
      aria-labelledby="spotlight-title"
      aria-describedby="spotlight-description"
      onCancel={(e) => {
        e.preventDefault();
        finish();
      }}
    >
      {box && (
        <div className="dc-spotlight-hole" style={box} aria-hidden="true" />
      )}
      {box && current.click && (
        <button
          className="dc-spotlight-hit"
          style={box}
          onClick={advance}
          aria-label={current.action}
        />
      )}
      <div
        className="dc-spotlight-panel"
        ref={panel}
        style={{ top: placement.top, left: placement.left }}
      >
        {box && (
          <svg
            className={
              "dc-sketch-arrow " +
              (placement.below ? "points-up" : "points-down")
            }
            viewBox="0 0 80 52"
            aria-hidden="true"
          >
            <path d="M68 45 C27 50 20 22 19 7 M8 19 L19 5 L32 17" />
          </svg>
        )}
        <div className="dc-spotlight-top">
          <span>
            {character.name}와 첫 걸음 · {step + 1} / {steps.length}
          </span>
          <button aria-label="가이드 닫기" onClick={finish}>
            <Icon name="close" size={19} />
          </button>
        </div>
        <div className="dc-spotlight-title">
          <Companion small mood={step === 3 ? "done" : "hello"} />
          <h2 id="spotlight-title">{current.title}</h2>
        </div>
        <p id="spotlight-description">{current.text}</p>
        <div className="dc-spotlight-controls">
          {step > 0 && (
            <button className="dd-link" onClick={() => onStep(step - 1)}>
              이전
            </button>
          )}
          <button
            ref={next}
            className="dd-primary"
            disabled={!box}
            onClick={advance}
          >
            {current.action}
            <Icon name="arrow" size={17} />
          </button>
        </div>
        <button className="dc-spotlight-skip" onClick={finish}>
          건너뛰기 · 안내에서 다시 볼 수 있어요
        </button>
      </div>
    </dialog>
  );
}
