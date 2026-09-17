import "./globals.css";
import "./coach.css";
import "./conversation.css";
import "./voice-notebook.css";
import "./onboarding.css";
import "./guide-font.css";
import "./companions.css";
import "./room-environment.css";
import "./ai-resilience.css";
import "./learning-hub.css";
import "./practical-learning.css";
import "./practice-garden.css";
import "./conversation-ajit.css";
import "./daily-talk.css";
import "./conversation-training.css";
import "./messenger.css";
import "./focus-visuals.css";
import "./input-dialog.css";
import "./purpose-home.css";
export const metadata = {
  title: "든든콜 · 대화 연습과 복기",
  description:
    "내 상황으로 대화하고, 실제로 한 말을 근거로 복기한 뒤 같은 장면을 다시 연습하세요.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
