export default function QuotaHelp({ error }: { error: string }) {
  if (!/한도|요청이 많/.test(error)) return null;
  return (
    <details className="dc-quota-help">
      <summary>AI 한도에 도달하면 어떻게 하나요?</summary>
      <p>
        잠깐 요청이 몰린 경우에는 안내된 시간 뒤 다시 시도해 주세요. 일일
        한도라면 초기화되기까지 기다리거나 프로젝트의 사용 등급을 검토해야 해요.
      </p>
      <p>
        같은 Google 프로젝트를 사용하는 모든 이용자가 한도를 공유해요. API 키만
        새로 만들어도 한도는 늘지 않아요. 결제 연결은 프로젝트 관리자가 비용을
        확인한 뒤 결정해 주세요.
      </p>
      <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer">
        Google AI Studio에서 프로젝트 사용량 확인
      </a>
      {" · "}
      <a
        href="https://ai.google.dev/gemini-api/docs/rate-limits?hl=ko"
        target="_blank"
        rel="noreferrer"
      >
        한도와 초기화 기준
      </a>
      <p>
        저장한 대화·샘플 읽기, 음성 재생, 직접 메모는 AI 호출 없이 이용할 수
        있어요.
      </p>
    </details>
  );
}
