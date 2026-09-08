export const metadata = {
  title: 'SubExit - 구독 해지 경로 도우미',
  description: '구독 관리 화면 캡처로 해지 경로를 안내받으세요',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body style={{
        margin: 0,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#f5f5f5',
      }}>
        {children}
      </body>
    </html>
  )
}
