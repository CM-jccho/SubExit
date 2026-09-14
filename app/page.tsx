import UploadForm from '@/components/UploadForm'

export default function Home() {
  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-md mx-auto px-5 sm:px-6 py-8 sm:py-12">
        {/* Hero Header */}
        <header className="text-center mb-8">
          <div className="mb-6">
            <h1 className="text-5xl sm:text-6xl font-black mb-3 tracking-tight">
              <span className="text-gradient-primary">든든콜</span>
            </h1>
            <p className="text-xl sm:text-2xl font-bold text-white mb-3 leading-tight">
              거절해야 하는데,
              <br />
              말리다가 또 받아들인 적 있나요?
            </p>
            <p className="text-base text-slate-300 mb-2 font-medium leading-relaxed">
              통화 녹음 업로드 → 압박 구간 분석
              <br />
              + 연습 멘트 + 옆자리 코치
            </p>
            <p className="text-sm text-slate-400 font-medium">
              구독 해지 · 영업 거절 · 연봉 협상 / (로드맵) 실시간 코칭
            </p>
          </div>

          {/* Compact Disclaimer Chips */}
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-full text-xs font-semibold text-rose-400 backdrop-blur-xl">
              <span>🚫</span>
              <span>통화 대행 아님</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-full text-xs font-semibold text-violet-400 backdrop-blur-xl">
              <span>🎭</span>
              <span>시뮬레이션</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-semibold text-blue-400 backdrop-blur-xl">
              <span>✅</span>
              <span>연습용</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs font-semibold text-amber-400 backdrop-blur-xl">
              <span>⚠️</span>
              <span>본인 녹음·동의 필수</span>
            </span>
          </div>
        </header>

        {/* Main Content */}
        <UploadForm />

        {/* Footer */}
        <footer className="mt-12 text-center">
          <p className="text-xs text-slate-500 font-medium">
            Wanted AI Championship 2026
          </p>
        </footer>
      </div>
    </main>
  )
}
