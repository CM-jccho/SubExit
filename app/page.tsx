'use client'

import { Suspense, useState } from 'react'
import UploadForm from '@/components/UploadForm'

type ScenarioCard = {
  id: string
  emoji: string
  title: string
  subtitle: string
  featured?: boolean
  guardrail?: boolean
}

const scenarios: ScenarioCard[] = [
  { id: 'sales', emoji: '📞', title: '영업 전화 거절', subtitle: '압박 전화 단호하게 끊기', featured: true },
  { id: 'interview', emoji: '👔', title: '면접', subtitle: '자신감 있게 답변하기' },
  { id: 'date', emoji: '☕', title: '소개팅 · 첫 데이트', subtitle: '편하게 대화 이어가기' },
  { id: 'school', emoji: '🎓', title: '학교 발표', subtitle: '발표 불안 극복하기' },
  { id: 'presentation', emoji: '📊', title: '제안서 · 사내 발표', subtitle: '전문적으로 프레젠테이션' },
  { id: 'work', emoji: '💼', title: '직장 소통', subtitle: '상사·동료와 원활한 대화' },
  { id: 'relationship', emoji: '💔', title: '연인 불편', subtitle: '감정 다루는 대화', guardrail: true },
]

function ScenarioCards({ onSelectScenario }: { onSelectScenario: (id: string) => void }) {
  return (
    <div className="space-y-3 mb-8">
      {scenarios.map((scenario) => (
        <button
          key={scenario.id}
          onClick={() => onSelectScenario(scenario.id)}
          className="w-full paper-card-hover p-5 text-left group"
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
              {scenario.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-bold text-ink">
                  {scenario.title}
                </h3>
                {scenario.featured && (
                  <span className="text-hold text-sm">★</span>
                )}
                {scenario.guardrail && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-sway-50 border border-sway-300 text-sway-600">
                    가드레일
                  </span>
                )}
              </div>
              <p className="text-sm text-ink/60">
                {scenario.subtitle}
              </p>
            </div>
            <div className="text-ink/40 group-hover:text-ink/80 transition-colors flex-shrink-0">
              →
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

function UploadFormWrapper({ selectedScenario }: { selectedScenario?: string }) {
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
      <UploadForm selectedScenario={selectedScenario} />
    </Suspense>
  )
}

export default function Home() {
  const [selectedScenario, setSelectedScenario] = useState<string | undefined>(undefined)

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
            <p className="text-base text-ink/70 font-semibold leading-relaxed">
              통화 받는 순간 옆에서<br />
              「지금 이렇게 말하세요」실시간 제안
            </p>
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

        {/* Scenario Cards */}
        {!selectedScenario && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-ink mb-4 px-1">
              어떤 상황을 연습하고 싶나요?
            </h2>
            <ScenarioCards onSelectScenario={setSelectedScenario} />
          </div>
        )}

        {/* Main Content */}
        {selectedScenario && (
          <div className="animate-fadeIn">
            <button
              onClick={() => setSelectedScenario(undefined)}
              className="mb-4 text-sm text-ink/60 hover:text-ink transition-colors flex items-center gap-1"
            >
              ← 다른 시나리오 선택
            </button>
            <UploadFormWrapper selectedScenario={selectedScenario} />
          </div>
        )}

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
