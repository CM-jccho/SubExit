import './globals.css'

export const metadata = {
  title: 'SubExit - 스크린샷 AI 분석으로 구독 해지',
  description: '구독 관리 스크린샷을 AI(Vision)가 읽어 해지 경로·주의 태그를 안내합니다. 서비스명 검색도 가능.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
