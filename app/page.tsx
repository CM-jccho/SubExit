'use client'

import { Suspense, useState, useEffect } from 'react'
import UploadForm from '@/components/UploadForm'
import { loadGamificationState, getLevelBadge, getLevelLabel, getStreakLabel, getLastUsedScenario, updateLastUsedScenario } from '@/lib/gamification'

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
  { id: 'job_interview', emoji: '👔', title: '면접', subtitle: '자신감 있게 답변하기' },
  { id: 'first_date', emoji: '☕', title: '소개팅 · 첫 데이트', subtitle: '편하게 대화 이어가기' },
  { id: 'school_group', emoji: '🎓', title: '학교 발표', subtitle: '발표 불안 극복하기' },
  { id: 'work_presentation', emoji: '📊', title: '제안서 · 사내 발표', subtitle: '전문적으로 프레젠테이션' },
  { id: 'work_comm', emoji: '💼', title: '직장 소통', subtitle: '상사·동료와 원활한 대화' },
  { id: 'relationship', emoji: '💔', title: '연인 불편', subtitle: '감정 다루는 대화', guardrail: true },
]

function ScenarioCards({ onSelectScenario }: { onSelectScenario: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-8">
      {scenarios.map((scenario) => (
        <button
          key={scenario.id}
          onClick={() => onSelectScenario(scenario.id)}
          className="paper-card-hover p-4 text-left group relative overflow-hidden"
        >
          {scenario.featured && (
            <div className="absolute top-2 right-2">
              <span className="text-primary-500 text-lg">★</span>
            </div>
          )}
          <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-200">
            {scenario.emoji}
          </div>
          <h3 className="text-sm font-bold text-ink mb-1 line-clamp-1">
            {scenario.title}
          </h3>
          <p className="text-xs text-ink-500 line-clamp-2 leading-snug">
            {scenario.subtitle}
          </p>
          {scenario.guardrail && (
            <div className="mt-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-sway-50/10 border border-sway-500/30 text-sway-400">
                가드레일
              </span>
            </div>
          )}
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
  const [gamificationState, setGamificationState] = useState({ level: 0, streak: 0 })
  const [lastUsedScenarioId, setLastUsedScenarioId] = useState<string>('sales')

  useEffect(() => {
    const state = loadGamificationState()
    setGamificationState({ level: state.level, streak: state.streak })
    setLastUsedScenarioId(getLastUsedScenario())
  }, [])

  const handleSelectScenario = (scenarioId: string) => {
    setSelectedScenario(scenarioId)
    updateLastUsedScenario(scenarioId)
    setLastUsedScenarioId(scenarioId)
  }

  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-[436px] mx-auto px-5 py-6 sm:py-8">
        {/* Hero Header - Short & Dense */}
        <header className="text-center mb-5">
          {/* Gamification badges */}
          {(gamificationState.level > 0 || gamificationState.streak > 0) && (
            <div className="flex items-center justify-center gap-2 mb-3">
              {gamificationState.level > 0 && (
                <div className="px-3 py-1.5 rounded-xl bg-surface border border-ink/10 flex items-center gap-1.5">
                  <span className="text-base">{getLevelBadge(gamificationState.level)}</span>
                  <span className="text-xs font-bold text-primary-500">
                    {getLevelLabel(gamificationState.level)}
                  </span>
                </div>
              )}
              {gamificationState.streak > 0 && (
                <div className="px-3 py-1.5 rounded-xl bg-surface border border-ink/10">
                  <span className="text-xs font-bold text-hold-500">
                    {getStreakLabel(gamificationState.streak)}
                  </span>
                </div>
              )}
            </div>
          )}
          
          {/* Logo + Hook */}
          <div>
            <h1 className="text-4xl sm:text-5xl font-black mb-2 tracking-tight text-ink">
              든든콜
            </h1>
            <p className="text-sm text-ink-500 font-medium leading-relaxed">
              통화 받는 순간 옆에서<br />
              「지금 이렇게 말하세요」실시간 제안
            </p>
          </div>
        </header>

        {/* 오늘의 연습 Card - LongBlack inspired */}
        {!selectedScenario && (
          <div className="mb-6">
            <div className="paper-card p-5 bg-gradient-to-br from-primary-500/10 to-hold-500/10 border-2 border-primary-500/20">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-xs font-bold text-primary-600 mb-1.5 tracking-wide uppercase">
                    오늘의 연습
                  </div>
                  <div className="flex items-center gap-2 text-sm text-ink/70">
                    <span className="font-semibold">오늘 1회</span>
                    <span className="text-ink/40">·</span>
                    <span>{scenarios.find(s => s.id === lastUsedScenarioId)?.title || '영업 전화 거절'}</span>
                  </div>
                </div>
                <div className="text-3xl">
                  {scenarios.find(s => s.id === lastUsedScenarioId)?.emoji || '📞'}
                </div>
              </div>
              
              <button
                onClick={() => handleSelectScenario(lastUsedScenarioId)}
                className="w-full py-4 px-6 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-2xl transition-all duration-200 shadow-soft-md hover:shadow-glow text-base"
              >
                연습 시작
              </button>
              
              {/* Optional Plus teaser - muted */}
              <div className="mt-3 text-center">
                <p className="text-xs text-ink/40">
                  매일 연습하고 🔥 연속 기록을 늘려보세요
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Scenario Cards - 2-column grid */}
        {!selectedScenario && (
          <div className="mb-6">
            <h2 className="text-base font-bold text-ink mb-3 px-1">
              또는 다른 시나리오 선택
            </h2>
            <ScenarioCards onSelectScenario={handleSelectScenario} />
          </div>
        )}

        {/* Main Content */}
        {selectedScenario && (
          <div className="animate-fadeIn">
            <button
              onClick={() => setSelectedScenario(undefined)}
              className="mb-4 text-sm text-ink-500 hover:text-ink transition-colors flex items-center gap-1"
            >
              ← 다른 시나리오 선택
            </button>
            <UploadFormWrapper selectedScenario={selectedScenario} />
          </div>
        )}

        {/* Footer */}
        <footer className="mt-8 text-center">
          <p className="text-xs text-ink/30 font-medium">
            Wanted AI Championship 2026
          </p>
        </footer>
      </div>
    </main>
  )
}
