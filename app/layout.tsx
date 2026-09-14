import './globals.css'

export const metadata = {
  title: 'SideCue - 후원·구독 해지 커뮤니케이션 코치',
  description: '스크린샷으로 해지 경로 찾기 + 해지 대화 연습 멘트 제공. AI가 결제 채널을 분석하고 해지 경로·주의사항·연습 스크립트를 안내합니다.',
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
