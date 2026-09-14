import './globals.css'

export const metadata = {
  title: '든든콜 - 거절 통화 연습 & 압박 구간 분석',
  description: '거절해야 하는데, 말리다가 또 받아들인 적 있나요? 통화 녹음 분석으로 압박·죄책감 구간을 찾고 연습 멘트를 받으세요. 구독 해지, 영업 거절, 연봉 협상.',
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
