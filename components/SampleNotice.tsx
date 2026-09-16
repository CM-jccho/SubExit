"use client";
import { outageLabel, retryAdvice, type AIOutage } from "@/lib/ai-client";
import { chooseDemoCase, type SampleMeta } from "@/lib/demo-bank";
export default function SampleNotice({
  sample,
  compact = false,
}: {
  sample: SampleMeta;
  compact?: boolean;
}) {
  const content = (
    <>
      <p>AI가 지금 생성한 답변이 아닌, 사전에 준비한 일반 예시예요.</p>
      <p>{retryAdvice(sample.outage)}</p>
      <small>
        {sample.topic} · 예시 {sample.sampleId}
      </small>
    </>
  );
  return compact ? (
    <details className="dc-sample-notice is-compact">
      <summary>사전 작성 샘플 · {outageLabel(sample.outage)}</summary>
      {content}
    </details>
  ) : (
    <aside className="dc-sample-notice" role="status">
      <strong>사전 작성 샘플 · {outageLabel(sample.outage)}</strong>
      {content}
    </aside>
  );
}
export function SampleSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="dc-sample-switch">
      <label className="dd-check">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        샘플로 연습하기 · AI 호출 없음
      </label>
      {checked && (
        <p>
          사전 작성 예시로 흐름을 체험해요. 음성 문자 변환과 AI 복기는 사용하지
          않아요. 해제하면 AI로 돌아가요.
        </p>
      )}
    </div>
  );
}
export function ReviewExample({
  context,
  outage,
}: {
  context: string;
  outage: AIOutage;
}) {
  const row = chooseDemoCase(context);
  return (
    <aside className="dc-sample-notice" role="status">
      <strong>
        {outage.reason === "manual"
          ? "사전 작성 복기 예시"
          : "AI 복기를 완료하지 못했어요"}{" "}
        · {outageLabel(outage)}
      </strong>
      <p>{retryAdvice(outage)}</p>
      <p>
        내 기록은 그대로 남아 있어요. 기다리는 동안 ‘내 목표를 말했는지’, ‘확인
        없이 약속한 부분은 없는지’를 직접 살펴보세요.
      </p>
      <details>
        <summary>가상 대화의 복기 예시 보기</summary>
        <p>
          <b>{row.title} · 사전 작성 예시</b> — 아래 문장은 내 대화에서 가져온
          것이 아니에요.
        </p>
        <blockquote>{row.reviewExample.before}</blockquote>
        <p>{row.reviewExample.note}</p>
        <strong>다시 말하는 예시</strong>
        <p>{row.reviewExample.rewrite}</p>
      </details>
    </aside>
  );
}
