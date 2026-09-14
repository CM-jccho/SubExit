import UploadForm from '@/components/UploadForm'

export default function Home() {
  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-[436px] mx-auto px-5 py-8 sm:py-12">
        {/* Hero Header */}
        <header className="text-center mb-8">
          <div className="mb-6">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4 tracking-tight text-ink">
              든든콜
            </h1>
            <p className="text-lg sm:text-xl font-semibold text-ink mb-3 leading-snug">
              걸려 온 영업 전화,<br />
              거절하려다 또 넘어간 적 있나요?
            </p>
            <p className="text-sm text-ink/70 mb-3 leading-relaxed">
              통화 녹음 업로드 → 압박 구간 분석<br />
              + 연습 멘트 + 옆자리 코치
            </p>
            <p className="text-xs text-ink/60 font-medium">
              영업 전화 거절 ★ · 연봉 협상 / 구독 해지 외
            </p>
          </div>

          {/* Simplified disclaimer */}
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            <span className="caution-chip bg-sway-50 border-sway-300 text-sway-600">
              통화 대행 아님
            </span>
            <span className="caution-chip bg-cream-200 border-ink/20 text-ink/70">
              연습용 시뮬레이션
            </span>
          </div>
        </header>

        {/* Main Content */}
        <UploadForm />

        {/* Footer */}
        <footer className="mt-12 text-center">
          <p className="text-xs text-ink/40 font-medium">
            Wanted AI Championship 2026
          </p>
        </footer>
      </div>
    </main>
  )
}
