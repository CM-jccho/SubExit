import { Suspense } from 'react'
import UploadForm from '@/components/UploadForm'

function UploadFormWrapper() {
  return (
    <Suspense fallback={
      <div className="paper-card p-6 sm:p-7">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-3xl mb-3">⏳</div>
            <p className="text-sm text-ink/60">로딩 중...</p>
          </div>
        </div>
      </div>
    }>
      <UploadForm />
    </Suspense>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-[436px] mx-auto px-5 py-8 sm:py-12">
        {/* Hero Header */}
        <header className="text-center mb-8">
          {/* Accent Bar */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 mb-6 shadow-soft">
            <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse"></div>
            <span className="text-xs font-bold text-primary-700 tracking-wide">통화 중 실시간 코치</span>
          </div>
          
          <div className="mb-6">
            <h1 className="text-5xl sm:text-6xl font-black mb-4 tracking-tighter text-ink">
              <span className="bg-gradient-to-br from-primary-600 via-primary-500 to-primary-400 bg-clip-text text-transparent">든든콜</span>
            </h1>
            <p className="text-xl sm:text-2xl font-black text-ink mb-4 leading-tight tracking-tight">
              걸려 온 영업 전화,<br />
              거절하려다 또 넘어간 적 있나요?
            </p>
            <p className="text-sm text-ink/70 mb-3 font-semibold leading-relaxed">
              통화 받는 순간 옆에서<br />
              「지금 이렇게 말하세요」실시간 제안
            </p>
            <div className="flex items-center justify-center gap-2 text-xs">
              <span className="px-3 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-700 font-bold shadow-soft">
                📞 영업 전화 거절 ★
              </span>
              <span className="text-ink/40">·</span>
              <span className="text-ink/60 font-semibold">연습 시뮬레이션</span>
            </div>
          </div>

          {/* Simplified disclaimer */}
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            <span className="caution-chip bg-sway-50 border-sway-300 text-sway-700 font-bold">
              🚫 통화 대행 아님
            </span>
            <span className="caution-chip bg-indigo-50 border-indigo-300 text-indigo-700 font-bold">
              🎭 시뮬레이션
            </span>
            <span className="caution-chip bg-hold-50 border-hold-300 text-hold-700 font-bold">
              ✅ 녹음 동의
            </span>
          </div>
        </header>

        {/* Main Content */}
        <UploadFormWrapper />

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
