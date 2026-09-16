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
        대화 연습·친구 대화·답변 후보·한 문장 힌트는 장애 때 사전 작성 샘플로
        이어갈 수 있어요. 저장되는 연습·친구 대화에는 샘플 표시도 남아요. 음성
        문자 변환과 실제 복기는 임의의 결과로 대체하지 않아요.
      </p>
    </details>
  );
}
