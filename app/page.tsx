import UploadForm from '@/components/UploadForm'

export default function Home() {
  return (
    <main className="min-h-screen pb-8">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <header className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
            SubExit
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium">
            구독 해지 경로 찾기
          </p>
        </header>

        {/* Disclaimer - Compact */}
        <div className="card mb-6 border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">⚠️</span>
            <div>
              <h3 className="text-sm font-bold text-amber-900 mb-2">
                중요한 고지사항
              </h3>
              <ul className="text-xs text-amber-800 space-y-1 leading-relaxed">
                <li>• 구독 해지 경로 이해를 돕는 참고 자료입니다</li>
                <li>• 법률 자문이 아니며, 환불/위약 보장 안 함</li>
                <li>• 업로드 이미지는 저장하지 않습니다</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <UploadForm />

        {/* Footer */}
        <footer className="mt-8 text-center">
          <p className="text-xs text-slate-400">
            Wanted AI Championship 2026
          </p>
        </footer>
      </div>
    </main>
  )
}
