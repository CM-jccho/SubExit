import "./globals.css";
import "./coach.css";
import "./conversation.css";
import "./voice-notebook.css";
export const metadata = {
  title: "든든콜 · 내 상황을 기억하는 대화 코치",
  description:
    "상대와 내 목표를 대화 카드로 저장하고, 필요한 순간 내 맥락에 맞는 다음 한 문장을 준비하세요.",
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
