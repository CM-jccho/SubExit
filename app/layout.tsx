import "./globals.css";
import "./coach.css";
export const metadata = {
  title: "든든콜 · 말하기 어려운 순간, 내 편이 되는 한 문장",
  description:
    "부담스러운 대화에서 내가 말할 다음 한 문장을 제안하는 옆자리 코치. 짧은 마이크 입력과 직접 답변 연습.",
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
