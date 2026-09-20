"use client";
import { outageLabel, retryAdvice, type AIOutage } from "@/lib/ai-client";
import { chooseDemoCase, type SampleMeta } from "@/lib/demo-bank";
export default function SampleNotice({
  sample,
  compact = false,
  badge = false,
}: {
  sample: SampleMeta;
  compact?: boolean;
  badge?: boolean;
}) {
  const content = (
    <>
      <p>AI가 지금 생성한 답변이 아닌, 사전에 준비한 일반 예시예요.</p>
      <p>{retryAdvice(sample.outage)}</p>
      <small>{sample.topic}</small>
    </>
  );
  return compact ? (
    <details
      className={"dc-sample-notice is-compact" + (badge ? " is-badge" : "")}
    >
      <summary>
        {badge ? "샘플 · " : "사전 작성 샘플 · "}
        {outageLabel(sample.outage)}
      </summary>
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
  label = "샘플로 연습하기 · AI 호출 없음",
  onChange,
  description,
}: {
  description?: string;
  checked: boolean;
  disabled?: boolean;
  label?: string;
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
        <span>{label}</span>
      </label>
      {checked && (
        <p>
          {description ||
            "사전 작성 예시로 흐름을 체험해요. 직접 쓴 답변을 AI가 분석하지 않아요. 음성 문자 변환과 AI 복기는 사용할 수 없어요. 해제하면 AI로 돌아가요."}
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

  if (outage.reason === "manual")
    return (
      <aside className="dc-sample-review" role="status" data-review-example>
        <span>사전 작성 예시 · 내 대화 분석 아님</span>
        <blockquote>{row.reviewExample.before}</blockquote>
        <div className="dc-sample-review-rewrite">
          <strong>다시 말한다면</strong>
          <p>{row.reviewExample.rewrite}</p>
        </div>
        <details>
          <summary>왜 이렇게 바꿨나요?</summary>
          <p>{row.reviewExample.note}</p>
          <small>{row.title}</small>
        </details>
      </aside>
    );

  return (
    <aside className="dc-sample-notice" role="status">
      <strong>
        AI 복기를 완료하지 못했어요 · {outageLabel(outage)}
      </strong>
      <p>{retryAdvice(outage)}</p>
      <details>
        <summary>기록과 대체 예시 확인</summary>
        <p>
          내 기록은 그대로 남아 있어요. 목표를 말했는지, 확인 없이 약속한
          부분은 없는지 먼저 살펴보세요.
        </p>
        <blockquote>{row.reviewExample.before}</blockquote>
        <strong>다시 말하는 예시</strong>
        <p>{row.reviewExample.rewrite}</p>
      </details>
    </aside>
  );
}
