"use client";
import { useState } from "react";
import { demoCases } from "@/lib/demo-bank";
import InputDialog from "./InputDialog";

/** A separate, fixed example. Never takes the user's input or calls an AI API. */
export default function SamplePreview({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [id, setId] = useState(demoCases[0].id);
  const example = demoCases.find((item) => item.id === id)!;
  return (
    <InputDialog
      open={open}
      title="준비된 샘플 체험"
      onClose={onClose}
      footer={
        <button type="button" className="dd-primary" onClick={onClose}>
          내 대화로 돌아가기
        </button>
      }
    >
      <p>
        아래는 미리 작성한 가상 상황과 답변이에요. 입력하신 대화에 대한 추천이
        아니며 AI를 호출하지 않아요.
      </p>
      <label>
        체험할 상황
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {demoCases.map((item) => (
            <option value={item.id} key={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      <section className="dc-sample-notice" aria-live="polite">
        <h3>{example.title}</h3>
        <p>
          <strong>상대 말 예시</strong>
        </p>
        <blockquote>{example.openings[0]}</blockquote>
        <p>
          <strong>답변 예시</strong>
        </p>
        <blockquote>{example.hints[0]}</blockquote>
        <p>
          이 상황에서 사용할 표현을 살펴보는 예시예요. 내 대화의 답변은 AI를
          사용할 수 있을 때 요청해 주세요.
        </p>
      </section>
    </InputDialog>
  );
}
