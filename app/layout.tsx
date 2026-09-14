import './globals.css'

export const metadata = {
  title: '든든콜 - 영업 전화 거절 연습 & 압박 구간 분석',
  description: '영업 전화에, 또 말려서 들어준 적 있나요? 통화 녹음 분석으로 압박·FOMO·죄책감 구간을 찾고 연습 멘트를 받으세요. 영업 거절, 연봉 협상, 구독 해지, 부탁 거절, 이별 통보까지.',
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
