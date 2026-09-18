export const practiceModes = [
  {
    id: "library",
    label: "대화 연습하기",
    description: "부탁하거나 거절할 말을 미리 해봐요.",
    icon: "chat",
    hint: "상대와 주고받으며",
    color: "sage",
  },
  {
    id: "messenger",
    label: "메시지 답장",
    description: "받은 메시지에 어떻게 답할지 준비해요.",
    icon: "send",
    hint: "보내기 전에 한 번 더",
    color: "sky",
  },
  {
    id: "training",
    label: "대화 기초 훈련",
    description: "말문 열기·질문하기·핵심 전달을 연습해요.",
    icon: "target",
    hint: "짧은 과제 하나씩",
    color: "peach",
  },
  {
    id: "prompts",
    label: "AI 요청 연습",
    description: "AI에게 원하는 결과를 정확하게 요청해요.",
    icon: "edit",
    hint: "요청을 쓰고 다듬으며",
    color: "lilac",
  },
] as const;
