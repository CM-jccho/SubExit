'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import UploadForm from '@/components/UploadForm'
import RealtimeSideCoach from '@/components/RealtimeSideCoach'
import { loadGamificationState, getLevelBadge, getLevelLabel, getStreakLabel, getLastUsedScenario, updateLastUsedScenario, recordScenarioAttempt, isScenarioCleared } from '@/lib/gamification'
import { loadCoachTone } from '@/lib/coach-tone'
import { scenarioRecommendedPersona } from '@/lib/opponent-persona'

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

function HomeInner() {
  const searchParams = useSearchParams()
  const isDemo = searchParams.get('demo') === '1'
  
  const [mode, setMode] = useState<'home' | 'realtime' | 'upload'>('home')
  const [selectedScenario, setSelectedScenario] = useState<string>('sales')
  const [gamificationState, setGamificationState] = useState({ level: 0, streak: 0 })
  const [lastUsedScenarioId, setLastUsedScenarioId] = useState<string>('sales')
  const [levelUpInfo, setLevelUpInfo] = useState<{ leveledUp: boolean; newLevel: number } | null>(null)

  useEffect(() => {
    const state = loadGamificationState()
    setGamificationState({ level: state.level, streak: state.streak })
    const lastScenario = getLastUsedScenario()
    setLastUsedScenarioId(lastScenario)
    
    // Auto-start realtime coach for demo mode
    if (isDemo) {
      setSelectedScenario('sales') // Force sales for demo judges
      setMode('realtime')
    }
  }, [isDemo])

  const handleStartPractice = (scenarioId: string) => {
    setSelectedScenario(scenarioId)
    updateLastUsedScenario(scenarioId)
    setLastUsedScenarioId(scenarioId)
    setMode('realtime')
  }

  const handleGoToUpload = (scenarioId: string) => {
    setSelectedScenario(scenarioId)
    updateLastUsedScenario(scenarioId)
    setLastUsedScenarioId(scenarioId)
    setMode('upload')
  }

  const handleCallEnd = async () => {
    // Call analysis API after realtime coach
    try {
      const coachTone = loadCoachTone()
      const response = await fetch('/api/analyze-call?demo=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo: true, scenario: selectedScenario, coachTone }),
      })

      if (response.ok) {
        const data = await response.json()
        
        // Record gamification progress
        if (data.analysis?.pressureSegments) {
          const totalSegments = data.analysis.pressureSegments.length
          const heldSegments = data.analysis.pressureSegments.filter((seg: any) => seg.held !== false).length
          const heldRate = totalSegments > 0 ? Math.round((heldSegments / totalSegments) * 100) : 0
          const cleared = isScenarioCleared(heldRate)
          
          const { state, leveledUp } = recordScenarioAttempt(selectedScenario, heldRate, cleared)
          
          if (leveledUp) {
            setLevelUpInfo({ leveledUp: true, newLevel: state.level })
            setGamificationState({ level: state.level, streak: state.streak })
          }
        }
      }
    } catch (err) {
      console.error('Failed to record progress:', err)
    }
    
    // Return to home
    setMode('home')
    setLevelUpInfo(null)
  }

  const handleReset = () => {
    setMode('home')
    setLevelUpInfo(null)
  }

  // Realtime coach mode
  if (mode === 'realtime') {
    const scenarioData = scenarios.find(s => s.id === selectedScenario)
    const coachTone = loadCoachTone()
    const selectedPersona = scenarioRecommendedPersona[selectedScenario as keyof typeof scenarioRecommendedPersona] || 'sales_agent'
    
    // Get transcript for selected scenario
    type TranscriptLine = {
      speaker: string
      text: string
      startTime: number
      endTime: number
      tags?: string[]
    }
    
    const scenarioTranscripts: Record<string, TranscriptLine[]> = {
      sales: [
        { speaker: 'agent', text: '안녕하세요 고객님, OO카드 프리미엄 회원 혜택 안내 전화드렸습니다.', startTime: 2, endTime: 7 },
        { speaker: 'user', text: '아, 괜찮습니다. 필요 없어요.', startTime: 8, endTime: 10 },
        { speaker: 'agent', text: '잠깐만요! 지금 가입하시면 첫 달 무료에 3만 원 캐시백까지 드립니다. 공짜인데 왜 안 받으세요?', startTime: 11, endTime: 19, tags: ['pressure', 'urgency', 'fomo'] },
        { speaker: 'user', text: '아니요, 정말 괜찮습니다.', startTime: 20, endTime: 22 },
        { speaker: 'agent', text: '고객님 같은 우량 고객분들은 다들 가입하셨는데요? 지금 안 하시면 다음 달부터는 혜택이 축소됩니다. 1분만 투자하시면 돼요.', startTime: 23, endTime: 34, tags: ['pressure', 'fomo', 'comparison'] },
        { speaker: 'user', text: '관심 없습니다. 전화 끊을게요.', startTime: 35, endTime: 38 },
        { speaker: 'agent', text: '아 잠깐만요! 정말 마지막입니다. 연회비도 첫 해 면제인데, 손해 보시는 거예요. 다른 분들은 저한테 고맙다고 하시던데...', startTime: 39, endTime: 50, tags: ['pressure', 'guilt'] },
        { speaker: 'user', text: '필요 없다고 했습니다. 이제 끊겠습니다.', startTime: 51, endTime: 54 },
        { speaker: 'agent', text: '네... 알겠습니다. 좋은 하루 되세요.', startTime: 55, endTime: 58 },
      ],
      job_interview: [
        { speaker: 'agent', text: '자기소개 부탁드립니다.', startTime: 2, endTime: 4 },
        { speaker: 'user', text: '안녕하세요. 저는 3년간 프론트엔드 개발 경험이 있는 지원자입니다.', startTime: 5, endTime: 10 },
        { speaker: 'agent', text: '3년이면 그렇게 길지 않은데, 왜 우리 회사에 지원하셨나요?', startTime: 11, endTime: 16, tags: ['pressure'] },
        { speaker: 'user', text: '귀사의 기술 스택과 제가 추구하는 방향이 잘 맞아서 지원했습니다.', startTime: 17, endTime: 22 },
        { speaker: 'agent', text: '...', startTime: 23, endTime: 28, tags: ['pressure', 'silence'] },
        { speaker: 'user', text: '특히 React와 TypeScript 기반의 프로젝트에서 좋은 성과를 냈습니다.', startTime: 29, endTime: 34 },
        { speaker: 'agent', text: '성과라고 하셨는데, 구체적인 숫자가 있나요? 예를 들어 성능 개선 같은?', startTime: 35, endTime: 42, tags: ['pressure'] },
        { speaker: 'user', text: '네, 페이지 로딩 시간을 40% 단축시켰고, 번들 사이즈를 30% 줄였습니다.', startTime: 43, endTime: 50 },
        { speaker: 'agent', text: '그게 정말 당신 혼자서 한 건가요? 팀 프로젝트 아닌가요?', startTime: 51, endTime: 56, tags: ['pressure', 'comparison'] },
        { speaker: 'user', text: '팀 프로젝트였지만 제가 주도적으로 최적화 전략을 설계하고 구현했습니다.', startTime: 57, endTime: 63 },
      ],
      first_date: [
        { speaker: 'agent', text: '오늘 영화 어땠어요? 재밌었죠?', startTime: 2, endTime: 5 },
        { speaker: 'user', text: '네, 재미있었어요.', startTime: 6, endTime: 8 },
        { speaker: 'agent', text: '저는 이런 영화 진짜 좋아하는데, 다음에 또 같이 보러 가요. 이번 주말은 어때요?', startTime: 9, endTime: 16, tags: ['pressure', 'urgency'] },
        { speaker: 'user', text: '음... 이번 주는 약속이 있어서요.', startTime: 17, endTime: 20 },
        { speaker: 'agent', text: '그럼 다다음 주? 아니면 평일 저녁에라도? 제가 맞출 수 있어요!', startTime: 21, endTime: 27, tags: ['pressure'] },
        { speaker: 'user', text: '감사한데, 제가 일정 확인하고 연락드릴게요.', startTime: 28, endTime: 32 },
      ],
      relationship: [
        { speaker: 'user', text: '저기... 요즘 약속 시간에 자주 늦는 것 같아서 얘기하고 싶었어.', startTime: 2, endTime: 8 },
        { speaker: 'agent', text: '아, 그게... 회사 일이 바빠서 그런 거야. 이해해줄 수 있지?', startTime: 9, endTime: 14, tags: ['guilt'] },
        { speaker: 'user', text: '그건 이해하는데, 연락이라도 미리 해주면 좋겠어.', startTime: 15, endTime: 19 },
        { speaker: 'agent', text: '그렇게까지 예민하게 굴 필요 있어? 다른 커플들은 다 이해해주던데.', startTime: 20, endTime: 26, tags: ['comparison', 'guilt'] },
        { speaker: 'user', text: '다른 사람들 얘기는 중요하지 않아. 우리 관계에서 내가 느낀 걸 말하는 거야.', startTime: 27, endTime: 33 },
      ],
      school_group: [
        { speaker: 'agent', text: '야, 조별과제 PPT 네가 만들어줘. 너 잘하잖아.', startTime: 2, endTime: 6 },
        { speaker: 'user', text: '이번엔 제가 다른 파트 하고 싶은데요.', startTime: 7, endTime: 10 },
        { speaker: 'agent', text: '에이, 근데 네가 해야 점수 잘 나오잖아. 우리 다 바쁘고, 너는 이거 금방 하잖아.', startTime: 11, endTime: 18, tags: ['pressure', 'guilt'] },
        { speaker: 'user', text: '저도 바빠요. 이번엔 역할을 나눠서 공평하게 했으면 좋겠어요.', startTime: 19, endTime: 24 },
        { speaker: 'agent', text: '아 진짜, 네가 안 하면 우리 조 망하는 거 알지? 교수님 되게 까다로운데.', startTime: 25, endTime: 31, tags: ['guilt', 'pressure'] },
        { speaker: 'user', text: '그렇게 걱정되면 같이 제대로 역할 분담해서 다 같이 열심히 하면 돼요.', startTime: 32, endTime: 38 },
      ],
      work_presentation: [
        { speaker: 'agent', text: '이 제안의 ROI가 명확하지 않은 것 같은데요. 구체적인 수치가 있나요?', startTime: 2, endTime: 8, tags: ['pressure'] },
        { speaker: 'user', text: '7페이지에 3년 예상 ROI가 나와 있습니다. 15% 수익률을 예상하고 있습니다.', startTime: 9, endTime: 16 },
        { speaker: 'agent', text: '그런데 경쟁사는 이미 비슷한 걸 하고 있지 않나요? 우리가 늦은 거 아닌가요?', startTime: 17, endTime: 24, tags: ['fomo', 'pressure'] },
        { speaker: 'user', text: '경쟁사는 다른 접근법을 사용합니다. 저희는 차별화된 전략으로 후발주자 이점을 활용할 수 있습니다.', startTime: 25, endTime: 34 },
        { speaker: 'agent', text: '리스크는 어떻게 관리할 건가요? 실패하면 손실이 크지 않나요?', startTime: 35, endTime: 41, tags: ['pressure', 'guilt'] },
        { speaker: 'user', text: '단계별 리스크 관리 계획이 있으며, 각 단계마다 go/no-go 결정 포인트를 두었습니다.', startTime: 42, endTime: 50 },
      ],
    }
    
    const transcript = scenarioTranscripts[selectedScenario] || scenarioTranscripts.sales

    return (
      <main className="min-h-screen pb-12">
        <div className="max-w-[436px] mx-auto px-5 py-6 sm:py-8">
          <header className="text-center mb-5">
            <h1 className="text-4xl sm:text-5xl font-black mb-2 tracking-tight text-ink">
              든든콜
            </h1>
            <p className="text-sm text-ink-500 font-medium leading-relaxed">
              {scenarioData?.title || '영업 전화 거절'} 연습
            </p>
          </header>

          {levelUpInfo?.leveledUp && (
            <div className="mb-5 paper-card p-5 bg-gradient-to-r from-primary-500/10 to-hold-500/10 border-primary-500/30 animate-slideUp">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{getLevelBadge(levelUpInfo.newLevel)}</span>
                <div className="flex-1">
                  <div className="text-lg font-bold text-primary-500 mb-1">
                    레벨 업! 🎉
                  </div>
                  <p className="text-sm text-ink-500">
                    {getLevelLabel(levelUpInfo.newLevel)}로 승급했습니다
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="animate-fadeIn">
            <button
              onClick={handleReset}
              className="mb-4 text-sm text-ink-500 hover:text-ink transition-colors flex items-center gap-1"
            >
              ← 처음으로
            </button>
            
            <RealtimeSideCoach
              transcript={transcript}
              coachTone={coachTone}
              selectedPersona={selectedPersona}
              onCallEnd={handleCallEnd}
            />
          </div>

          <footer className="mt-8 text-center">
            <p className="text-xs text-ink/30 font-medium">
              Wanted AI Championship 2026
            </p>
          </footer>
        </div>
      </main>
    )
  }

  // Upload mode
  if (mode === 'upload') {
    return (
      <main className="min-h-screen pb-12">
        <div className="max-w-[436px] mx-auto px-5 py-6 sm:py-8">
          <header className="text-center mb-5">
            <h1 className="text-4xl sm:text-5xl font-black mb-2 tracking-tight text-ink">
              든든콜
            </h1>
          </header>

          <div className="animate-fadeIn">
            <button
              onClick={handleReset}
              className="mb-4 text-sm text-ink-500 hover:text-ink transition-colors flex items-center gap-1"
            >
              ← 다른 시나리오 선택
            </button>
            <UploadFormWrapper selectedScenario={selectedScenario} />
          </div>

          <footer className="mt-8 text-center">
            <p className="text-xs text-ink/30 font-medium">
              Wanted AI Championship 2026
            </p>
          </footer>
        </div>
      </main>
    )
  }

  // Home mode
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
              onClick={() => handleStartPractice(lastUsedScenarioId)}
              className="w-full py-4 px-6 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-2xl transition-all duration-200 shadow-soft-md hover:shadow-glow text-base"
            >
              📞 실시간 연습 시작
            </button>
            
            {/* Optional Plus teaser - muted */}
            <div className="mt-3 text-center">
              <p className="text-xs text-ink/40">
                매일 연습하고 🔥 연속 기록을 늘려보세요
              </p>
            </div>
          </div>
        </div>

        {/* Scenario Cards - 2-column grid */}
        <div className="mb-6">
          <h2 className="text-base font-bold text-ink mb-3 px-1">
            또는 다른 시나리오 선택
          </h2>
          <ScenarioCards onSelectScenario={handleStartPractice} />
        </div>

        {/* Secondary: Upload/Analysis Path */}
        <div className="mb-6">
          <details className="paper-card overflow-hidden">
            <summary className="p-4 cursor-pointer hover:bg-surface-light transition-colors flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <span className="text-sm font-semibold text-ink">
                  또는 녹음 파일 업로드 · 분석
                </span>
              </div>
              <span className="text-ink-500 text-sm">▼</span>
            </summary>
            <div className="p-4 pt-0 space-y-2">
              <p className="text-xs text-ink-500 mb-3">
                이미 녹음한 통화 파일이 있다면 업로드하여 분석할 수 있습니다
              </p>
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => handleGoToUpload(scenario.id)}
                  className="w-full p-3 rounded-xl bg-surface-light hover:bg-surface border border-ink/10 text-left transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{scenario.emoji}</span>
                    <span className="text-sm font-medium text-ink">{scenario.title}</span>
                  </div>
                </button>
              ))}
            </div>
          </details>
        </div>

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

export default function Home() {
  return (
    <Suspense fallback={
      <main className="min-h-screen pb-12">
        <div className="max-w-[436px] mx-auto px-5 py-6 sm:py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-3xl mb-3">⏳</div>
              <p className="text-sm text-ink/60">로딩 중...</p>
            </div>
          </div>
        </div>
      </main>
    }>
      <HomeInner />
    </Suspense>
  )
}
