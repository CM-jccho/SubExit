import MobileKeyboardViewport from "@/components/MobileKeyboardViewport";
import { ConsentSessionProvider } from "@/components/ConsentSession";
import "./globals.css";
import "./design-tokens.css";
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
import "./live-speech.css";
import "./chat-flow.css";
import "./mobile-keyboard.css";
import "./compact-fields.css";
import "./brand-and-terms.css";
import "./submission-polish.css";
export const metadata = {
  title: "스픽코칭 · 당신의 말 곁에",
  description:
    "대화 중에는 내 상황과 목표에 맞는 다음 한마디를, 평소에는 AI 상대와 같은 상황의 대화 연습을 제공합니다.",
  icons: {
    icon: [{ url: "/brand/favicon-v1.png", sizes: "32x32", type: "image/png" }],
    apple: [
      {
        url: "/brand/apple-touch-icon-v1.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <MobileKeyboardViewport />
        <ConsentSessionProvider>{children}</ConsentSessionProvider>
      </body>
    </html>
  );
}
