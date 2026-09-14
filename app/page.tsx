import UploadForm from '@/components/UploadForm'

export default function Home() {
  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-md mx-auto px-5 sm:px-6 py-8 sm:py-12">
        {/* Hero Header */}
        <header className="text-center mb-8">
          {/* Accent Bar */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary-500/10 to-primary-600/10 border border-primary-500/20 mb-6 backdrop-blur-xl shadow-soft">
            <div className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse"></div>
            <span className="text-xs font-bold text-primary-300 tracking-wide">영업 전화 대응 연습</span>
          </div>
          
          <div className="mb-6">
            <h1 className="text-6xl sm:text-7xl font-black mb-4 tracking-tighter">
              <span className="bg-gradient-to-br from-primary-400 via-primary-300 to-cyan-300 bg-clip-text text-transparent">든든콜</span>
            </h1>
            <p className="text-2xl sm:text-3xl font-black text-white mb-4 leading-tight tracking-tight">
              걸려 온 영업 전화,
              <br />
              거절하려다 또 넘어간 적 있나요?
            </p>
            <p className="text-base text-slate-300 mb-3 font-semibold leading-relaxed">
              통화 녹음 업로드 → 압박 구간 분석
              <br />
              + 연습 멘트 + 옆자리 코치
            </p>
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="px-3 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-300 font-bold">
                📞 영업 전화 거절 ★
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400 font-semibold">연봉 협상 외</span>
            </div>
          </div>

          {/* Compact Disclaimer Chips */}
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-full text-xs font-bold text-rose-300 backdrop-blur-xl shadow-soft">
              <span>🚫</span>
              <span>통화 대행 아님</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs font-bold text-indigo-300 backdrop-blur-xl shadow-soft">
              <span>🎭</span>
              <span>시뮬레이션</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-bold text-emerald-300 backdrop-blur-xl shadow-soft">
              <span>✅</span>
              <span>연습용</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs font-bold text-amber-300 backdrop-blur-xl shadow-soft">
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
