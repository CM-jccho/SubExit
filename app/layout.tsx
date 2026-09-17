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
  title: "스픽코칭 · 대화 중 다음 한마디",
  description:
    "대화 중에는 내 상황과 목표에 맞는 다음 한마디를, 평소에는 AI 상대와 같은 상황의 대화 연습을 제공합니다.",
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
