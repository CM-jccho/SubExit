const tips = [
  {
    title: "부탁은 행동과 기한을 함께",
    before: "이것 좀 빨리 해주세요.",
    after:
      "초안의 숫자 부분을 오늘 3시까지 확인해 주실 수 있을까요? 어려우면 가능한 시간을 알려주세요.",
    why: "무엇을 언제까지 부탁하는지 밝히고, 상대가 조율할 여지를 남겨요.",
    context: "업무 요청",
  },
  {
    title: "의도를 단정하기 전에 확인",
    before: "제 의견은 무시하시는 거죠?",
    after:
      "제가 제안한 일정은 이번 안에서 빠진 것 같아요. 어떤 점을 고려하셨는지 여쭤봐도 될까요?",
    why: "관찰한 사실과 궁금한 점을 나누면 상대의 이유를 들을 수 있어요.",
    context: "의견 차이",
  },
  {
    title: "거절할 때 가능한 범위를 말하기",
    before: "그건 안 돼요.",
    after:
      "오늘 전체 작업을 끝내기는 어려워요. 핵심 두 항목은 오늘, 나머지는 내일 오전까지 가능해요.",
    why: "어려운 범위와 가능한 대안을 함께 말해요. 가능한 대안이 없다면 억지로 약속하지 않아도 돼요.",
    context: "일정 조율",
  },
  {
    title: "답장 기한을 짧게 알려주기",
    before: "확인해 볼게요.",
    after: "메시지 확인했어요. 자료를 살펴보고 내일 오전 10시까지 답드릴게요.",
    why: "지금 확인한 상태와 다음 응답 시점을 구분해요. 지킬 수 있는 시간으로 바꿔 쓰세요.",
    context: "메신저",
  },
  {
    title: "이야기를 이어가는 후속 질문",
    before: "아, 그렇구나.",
    after: "처음 해본 일이었구나. 그중에서 가장 기억에 남는 순간은 뭐였어?",
    why: "상대가 말한 내용 한 가지를 받아 질문해요. 개인적인 이야기는 더 말하고 싶은지 먼저 살펴주세요.",
    context: "스몰토크",
  },
  {
    title: "사과 뒤에는 다음 행동",
    before: "죄송합니다. 제가 원래 바빠서요.",
    after:
      "약속한 시간을 지키지 못해 죄송해요. 수정본은 오늘 4시까지 보내고, 지연될 상황이 생기면 먼저 말씀드릴게요.",
    why: "영향을 인정한 뒤 실제로 할 수 있는 수습 행동을 말해요. 책임이 불분명한 일까지 떠안을 필요는 없어요.",
    context: "실수 수습",
  },
];

export default function CommunicationTips({
  onSave,
}: {
  onSave: (tip: {
    title: string;
    after: string;
    why: string;
    context: string;
  }) => void;
}) {
  return (
    <section className="vn-communication-tips" aria-label="소통 팁">
      <h2>다음 대화에서 써볼 한 가지</h2>
      <p className="vn-caption">
        서비스에서 직접 작성한 예시예요. 정답이나 말솜씨 등급이 아니며, 관계와
        상황에 맞게 바꿔 쓰세요.
      </p>
      {tips.map((tip) => (
        <details className="dc-guide-faq" key={tip.title}>
          <summary>
            {tip.title} <span className="dc-sample-badge">{tip.context}</span>
          </summary>
          <p>
            <strong>막연한 표현</strong> · {tip.before}
          </p>
          <blockquote>{tip.after}</blockquote>
          <p>{tip.why}</p>
          <button className="dd-secondary" onClick={() => onSave(tip)}>
            내 노트에 담기
          </button>
        </details>
      ))}
    </section>
  );
}
