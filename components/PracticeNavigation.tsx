import type { WorkspaceView } from "@/lib/workspace-navigation";
import { practiceModes } from "@/lib/practice-modes";
import { Icon } from "./CompanionUI";
export default function PracticeNavigation({
  view,
  onNavigate,
}: {
  view: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
}) {
  const current = practiceModes.find((mode) => mode.id === view);
  if (!current) return null;
  return (
    <nav className="purpose-breadcrumb" aria-label="현재 연습 위치">
      <button className="dd-link" onClick={() => onNavigate("home")}>
        <Icon name="back" size={16} />
        홈으로
      </button>
      <span aria-current="location">{current.label}</span>
    </nav>
  );
}
