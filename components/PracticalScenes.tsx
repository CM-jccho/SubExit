"use client";
import { useEffect, useRef, useState } from "react";
import {
  practicalCards,
  practicalScenes,
  type PracticalScene,
} from "@/lib/practical-scenes";
import type { ConversationCard } from "@/lib/conversation-cards";
import { Icon } from "./CompanionUI";
function ScenePreview({
  scene,
  onClose,
  onPractice,
}: {
  scene: PracticalScene;
  onClose: () => void;
  onPractice: (card: ConversationCard) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="vn-dialog dc-scene-dialog"
      aria-labelledby="scene-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="vn-dialog-head">
        <div>
          <p className="dc-overline">사전 작성 샘플 · {scene.label}</p>
          <h2 id="scene-title">{scene.hook}</h2>
        </div>
        <button
          className="vn-icon"
          aria-label="응대 샘플 닫기"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <p>
        <strong>내 목표</strong> · {scene.context.goal}
      </p>
      <p>
        <strong>지킬 선</strong> · {scene.context.boundaries}
      </p>
      <ol className="dc-observer-lines">
        {scene.lines.map((text, i) => (
          <li key={i} className={i % 2 ? "second" : ""}>
            <strong>{i % 2 ? "나" : "상대"}</strong>
            <p>{text}</p>
          </li>
        ))}
      </ol>
      <p className="learn-callout">{scene.tip}</p>
      <button
        className="dd-primary dd-full"
        onClick={() =>
          onPractice(
            practicalCards.find((c) => c.id === `card-scene-${scene.id}`)!,
          )
        }
      >
        이 장면에서 내가 말해보기 <Icon name="mic" size={18} />
      </button>
    </dialog>
  );
}
export default function PracticalScenes({
  onPractice,
  ids,
}: {
  ids?: readonly string[];
  onPractice: (card: ConversationCard) => void;
}) {
  const [scene, setScene] = useState<PracticalScene | null>(null);
  const rows = practicalScenes.filter((s) => !ids || ids.includes(s.id));
  if (!rows.length) return null;
  return (
    <section className="dc-practical-scenes" aria-label="어려운 응대 연습">
      <div className="vn-toolbar">
        <h2>막막했던 그 장면부터</h2>
        <small>응대 상황 예시</small>
      </div>
      <div className="dc-scene-grid">
        {rows.map((s) => (
          <button key={s.id} aria-haspopup="dialog" onClick={() => setScene(s)}>
            <small>{s.label}</small>
            <strong>{s.hook}</strong>
            <span>대화 예시 보고 연습하기 →</span>
          </button>
        ))}
      </div>
      {scene && (
        <ScenePreview
          scene={scene}
          onClose={() => setScene(null)}
          onPractice={(c) => {
            setScene(null);
            onPractice(c);
          }}
        />
      )}
    </section>
  );
}
