"use client";
import { useState } from "react";
import { clearAIHold } from "@/lib/ai-client";

export default function QuotaHelp({ error }: { error: string }) {
  const [preparedFor, setPreparedFor] = useState<string | null>(null);
  if (!/한도|이용량을 모두|요청이 많/.test(error)) return null;
  const prepared = preparedFor === error;
  return (
    <details className="dc-quota-help">
      <summary>지금 사용할 수 있는 기능</summary>
      <p>
        저장된 기록 열기, 문자로 기록하기, 준비된 샘플 보기는 계속 사용할 수
        있어요.
      </p>
      <p>
        AI 추천·대화·음성 문자 변환·분석은 이용이 재개된 뒤 요청해 주세요.
        실패한 답변을 샘플로 자동 대체하지 않아요.
      </p>
      <p>
        일시적인 요청 제한은 안내된 시간 뒤 다시 시도할 수 있어요. 전체
        이용량이나 예산이 소진된 경우에는 운영자가 이용을 재개해야 할 수 있어요.
        무료 AI로 자동 전환되지 않아요.
      </p>
      <p>운영자가 이용을 재개했는데도 이전 한도 안내가 남아 있나요?</p>
      <button
        type="button"
        className="dd-secondary"
        disabled={prepared}
        onClick={() => {
          clearAIHold();
          setPreparedFor(error);
        }}
      >
        이용 재개 후 다시 시도
      </button>
      {prepared && (
        <p role="status">
          이전 대기 상태를 해제했어요. 입력한 내용은 그대로예요. 원래 요청
          버튼을 다시 눌러주세요. 실제 이용 한도가 남아 있는지는 요청 시
          확인하며, 한도가 그대로면 다시 안내해요.
        </p>
      )}
    </details>
  );
}
