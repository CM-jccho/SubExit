export default function QuotaHelp({ error }: { error: string }) {
  if (!/한도|이용량을 모두|요청이 많/.test(error)) return null;
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
    </details>
  );
}
