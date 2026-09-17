import type { WorkspaceView } from "@/lib/workspace-navigation";

const modes = [
  {
    id: "library",
    label: "대화 연습",
    description: "상황을 고르고, AI가 맡은 상대에게 직접 답하며 연습해요.",
  },
  {
    id: "messenger",
    label: "메시지 답장",
    description: "받은 메시지를 붙여넣고, 답장을 다듬어 복사해요.",
  },
  {
    id: "training",
    label: "기초 훈련",
    description: "생각 넓히기·질문하기·핵심 전달을 짧은 과제로 연습해요.",
  },
  {
    id: "prompts",
    label: "AI 요청 연습",
    description: "AI에게 원하는 결과를 얻도록 요청을 쓰고 다듬어요.",
  },
] as const;

export default function PracticeNavigation({
  view,
  onNavigate,
}: {
  view: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
}) {
  const current = modes.find((mode) => mode.id === view);
  if (!current) return null;
  return (
    <nav className="practice-navigation" aria-label="내 대화 메뉴">
      <div className="practice-navigation-items">
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            aria-current={mode.id === view ? "true" : undefined}
            aria-describedby={
              mode.id === view ? "practice-mode-description" : undefined
            }
            onClick={() => {
              if (mode.id !== view) onNavigate(mode.id);
            }}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <p id="practice-mode-description">{current.description}</p>
    </nav>
  );
}
