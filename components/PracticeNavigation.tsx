import type { WorkspaceView } from "@/lib/workspace-navigation";
import { practiceModes } from "@/lib/practice-modes";
import { supportTools } from "@/lib/support-tools";
import { Icon } from "./CompanionUI";
export default function PracticeNavigation({
  purpose = "practice",
  view,
  onNavigate,
}: {
  purpose?: "live" | "practice";
  view: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
}) {
  const support = supportTools.find((tool) => tool.id === view);
  const current = practiceModes.find((mode) => mode.id === view) || support;
  if (!current) return null;
  return (
    <nav
      className="purpose-breadcrumb"
      aria-label={support ? "현재 도구 위치" : "현재 연습 위치"}
    >
      <button
        className="dd-link"
        onClick={() => onNavigate(support ? "more" : "home")}
      >
        <Icon name="back" size={16} />
        {support ? "더보기로" : "홈으로"}
      </button>
      <span aria-current="location">
        {view === "library" && purpose === "live"
          ? "지금 대화 도움받기"
          : current.label}
      </span>
    </nav>
  );
}
