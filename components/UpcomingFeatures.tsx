const upcoming = [
  {
    id: "decision",
    area: "conversation",
    title: "고민 정리",
    description:
      "선택지와 중요한 기준을 정리하고, 결정한 내용을 상대에게 말하는 연습으로 연결하는 방식을 검토하고 있어요.",
  },
  {
    id: "messenger",
    area: "messenger",
    title: "메신저 가져오기 확장",
    description:
      "대화 내보내기 파일·이미지에서 내용을 가져오는 방식을 검토하고 있어요. 현재는 직접 붙여넣기와 답장 복사를 제공해요.",
  },
  {
    id: "community",
    area: "room",
    title: "실시간 익명 커뮤니티",
    description:
      "실제 참여자들이 대화를 나누는 공간을 검토하고 있어요. 현재 라운지는 가상 참가자가 있는 미리보기예요.",
  },
  {
    id: "agents",
    area: "room",
    title: "여러 에이전트의 실시간 대화",
    description:
      "독립적인 에이전트들이 주고받는 대화를 검토하고 있어요. 현재 관찰 기능은 한 번에 생성한 대본을 재생해요.",
  },
  {
    id: "recording",
    area: "audio",
    title: "긴 녹음·자동 화자 구분",
    description:
      "긴 파일과 여러 사람의 대화를 다루는 기능을 검토하고 있어요. 현재는 2분·2.4MB 이내 파일에서 화자를 직접 확인해요.",
  },
  {
    id: "live",
    area: "audio",
    title: "연속 실시간 음성 코칭",
    description:
      "말하는 동안 이어지는 코칭을 검토하고 있어요. 현재는 최대 8초씩 녹음한 뒤 힌트를 받아요.",
  },
  {
    id: "sync",
    area: "storage",
    title: "계정 동기화·전체 백업",
    description:
      "다른 기기에서도 기록을 이어보는 기능을 검토하고 있어요. 현재 기록은 이 브라우저에 저장돼요.",
  },
];
export default function UpcomingFeatures({ area = "all" }: { area?: string }) {
  const items = upcoming.filter((x) => area === "all" || x.area === area);
  return (
    <details className="dc-guide-faq upcoming-features">
      <summary>앞으로 검토하는 방향</summary>
      <p>아래 기능은 아직 사용할 수 없으며 공개 일정은 정해지지 않았어요.</p>
      <div className="upcoming-list">
        {items.map((x) => (
          <article key={x.id}>
            <div>
              <h3>{x.title}</h3>
              <span>검토 중</span>
            </div>
            <p>{x.description}</p>
          </article>
        ))}
      </div>
    </details>
  );
}
