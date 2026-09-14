import './globals.css'

export const metadata = {
  title: '든든콜 - 영업 전화 거절 연습 & 압박 구간 분석',
  description: '영업 전화, 거절하려다 또 넘어간 적 있나요? 통화 녹음 분석으로 압박·FOMO·죄책감 구간을 찾고 연습 멘트를 받으세요. 영업 거절, 연봉 협상.',
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
