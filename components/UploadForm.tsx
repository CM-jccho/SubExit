'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import CallResultDisplay from './CallResultDisplay'
import RealtimeSideCoach from './RealtimeSideCoach'
import { CoachTone, coachToneLabels, loadCoachTone, saveCoachTone } from '@/lib/coach-tone'
import { OpponentPersona, opponentPersonaLabels, opponentPersonaTraits, opponentPersonaAvatars, scenarioRecommendedPersona } from '@/lib/opponent-persona'
import PracticeTab from './PracticeTab'
import { recordScenarioAttempt, isScenarioCleared, getLevelBadge, getLevelLabel } from '@/lib/gamification'

export type AnalysisResult = {
  // Call recording analysis result
  callType?: string
  duration?: number
  transcript?: {
    speaker: string
    text: string
    startTime: number
    endTime: number
    tags?: string[]
  }[]
  analysis?: {
    pressureSegments: {
      startTime: number
      endTime: number
      type: string
      severity: string
      description: string
    }[]
    overallTone: string
    riskLevel: string
    feedback: {
      positive: string[]
      improvements: string[]
    }
    practiceScripts: {
      whenKo: string
      sayKo: string
    }[]
  }
  metadata?: {
    scenario: string
    organization: string
    callDate: string
    outcome: string
  }
  disclaimer: string
}

type ScenarioType = 'sales' | 'job_interview' | 'first_date' | 'relationship' | 'school_group' | 'presentation_qa' | 'work_comm' | 'work_presentation'

export default function UploadForm({ selectedScenario: initialScenario }: { selectedScenario?: string }) {
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>(
    (initialScenario as ScenarioType) || 'sales'
  )
  const [selectedPersona, setSelectedPersona] = useState<OpponentPersona>('sales_agent')
  const [coachTone, setCoachTone] = useState<CoachTone>('firm_polite')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [activeTab, setActiveTab] = useState<'analysis' | 'practice'>('analysis')
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [levelUpInfo, setLevelUpInfo] = useState<{ leveledUp: boolean; newLevel: number } | null>(null)

  useEffect(() => {
    if (initialScenario) {
      setSelectedScenario(initialScenario as ScenarioType)
    }
  }, [initialScenario])

  useEffect(() => {
    setCoachTone(loadCoachTone())
  }, [])

  useEffect(() => {
    // 시나리오 변경 시 추천 페르소나로 자동 설정
    const recommended = scenarioRecommendedPersona[selectedScenario]
    if (recommended) {
      setSelectedPersona(recommended)
    }
  }, [selectedScenario])

  const handleToneChange = (tone: CoachTone) => {
    setCoachTone(tone)
    saveCoachTone(tone)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      const validTypes = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-m4a']
      if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(mp3|m4a|wav)$/i)) {
        alert('MP3, M4A, WAV 파일만 업로드 가능합니다')
        return
      }
      setAudioFile(selectedFile)
      setResult(null)
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent, demoMode = false, demoScenario?: ScenarioType) => {
    e.preventDefault()
    
    if (!demoMode && !audioFile) {
      alert('통화 녹음 파일을 선택해주세요')
      return
    }

    setLoading(true)
    setError(null)
    setIsDemoMode(demoMode)

    try {
      let response: Response

      if (demoMode) {
        response = await fetch('/api/analyze-call?demo=1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ demo: true, scenario: demoScenario || selectedScenario, coachTone }),
        })
      } else {
        const formData = new FormData()
        formData.append('audio', audioFile!)
        formData.append('coachTone', coachTone)
        response = await fetch('/api/analyze-call', {
          method: 'POST',
          body: formData,
        })
      }

      if (!response.ok) {
        throw new Error('분석 중 오류가 발생했습니다')
      }

      const data = await response.json()
      setResult(data)
      
      // Record gamification progress
      if (data.analysis?.pressureSegments) {
        const totalSegments = data.analysis.pressureSegments.length
        const heldSegments = data.analysis.pressureSegments.filter((seg: any) => seg.held !== false).length
        const heldRate = totalSegments > 0 ? Math.round((heldSegments / totalSegments) * 100) : 0
        const cleared = isScenarioCleared(heldRate)
        
        const { state, leveledUp } = recordScenarioAttempt(demoScenario || selectedScenario, heldRate, cleared)
        
        if (leveledUp) {
          setLevelUpInfo({ leveledUp: true, newLevel: state.level })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setAudioFile(null)
    setResult(null)
    setError(null)
    setIsDemoMode(false)
    setActiveTab('analysis')
    setLevelUpInfo(null)
  }

  if (result) {
    return (
      <div className="animate-fadeIn">
        {/* Level Up Notification */}
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

        {/* 단계 표시기 */}
        <div className="paper-card p-4 bg-surface-light mb-5">
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-2 opacity-50">
              <div className="w-8 h-8 rounded-full bg-hold text-white flex items-center justify-center text-sm font-bold">✓</div>
              <span className="text-sm text-ink-500">동의</span>
            </div>
            <div className="w-8 h-0.5 bg-hold"></div>
            <div className="flex items-center gap-2 opacity-50">
              <div className="w-8 h-8 rounded-full bg-hold text-white flex items-center justify-center text-sm font-bold">✓</div>
              <span className="text-sm text-ink-500">통화 중</span>
            </div>
            <div className="w-8 h-0.5 bg-hold"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center text-sm font-bold">3</div>
              <span className="text-sm font-bold text-primary-500">복기</span>
            </div>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="mb-5 segmented-control">
          <button
            onClick={() => setActiveTab('analysis')}
            className={`segment-button ${
              activeTab === 'analysis' ? 'segment-button-active' : ''
            }`}
          >
            통화 분석
          </button>
          <button
            onClick={() => setActiveTab('practice')}
            className={`segment-button ${
              activeTab === 'practice' ? 'segment-button-active' : ''
            }`}
          >
            실전 연습
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'analysis' ? (
          <CallResultDisplay result={result as any} coachTone={coachTone} />
        ) : (
          <PracticeTab />
        )}

        <button
          onClick={handleReset}
          className="mt-6 btn-secondary"
        >
          ← 다시 분석하기
        </button>
      </div>
    )
  }

  // MUST only: sales★ primary
  const scenarios = [
    { 
      id: 'sales' as ScenarioType, 
      label: '영업 전화 거절', 
      emoji: '📞', 
      description: '걸려온 영업 전화, 압박에 흔들리지 않고 거절',
      primary: true, 
      featured: true 
    },
    { 
      id: 'job_interview' as ScenarioType, 
      label: '면접', 
      emoji: '💼', 
      description: '압박 질문, 침묵, follow-up 대응',
      primary: false, 
      featured: true 
    },
    { 
      id: 'first_date' as ScenarioType, 
      label: '소개팅 / 첫 데이트', 
      emoji: '💐', 
      description: '빠른 다음 약속 재촉, 적절한 경계 설정',
      primary: false, 
      featured: false 
    },
    { 
      id: 'relationship' as ScenarioType, 
      label: '연인 불편 말하기', 
      emoji: '💬', 
      description: '불편한 점 전달, 비교 압박에 흔들리지 않기',
      primary: false, 
      featured: false 
    },
    { 
      id: 'school_group' as ScenarioType, 
      label: '학교 생활 (조별/교수)', 
      emoji: '🎓', 
      description: '일방적 역할 부여, 공평한 분담 요구',
      primary: false, 
      featured: false 
    },
    { 
      id: 'presentation_qa' as ScenarioType, 
      label: '학교 발표 Q&A', 
      emoji: '📊', 
      description: '발표 후 날카로운 질문, 침착하게 대응',
      primary: false, 
      featured: false 
    },
    { 
      id: 'work_comm' as ScenarioType, 
      label: '직장 소통 (보고/1:1)', 
      emoji: '💻', 
      description: '무리한 일정 요구, 현실적 대안 제시',
      primary: false, 
      featured: false 
    },
    { 
      id: 'work_presentation' as ScenarioType, 
      label: '제안서·사내 발표', 
      emoji: '📈', 
      description: '제안서 Q&A 압박, 전문적 답변',
      primary: false, 
      featured: false 
    },
  ]
  
  // Secondary/expansion (available, not hero)
  // cancel, parent, formal, general, romantic
  
  // Soft-Go scenarios (hidden, available via API)
  // parent, formal, general, romantic

  return (
    <div className="paper-card p-5 sm:p-6">
      {/* Advanced Settings - Collapsed Accordion */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-light border border-ink/10 hover:border-ink/20 transition-all"
        >
          <span className="text-sm font-semibold text-ink">
            ⚙️ 고급 설정 (코치 톤 · 상대방 캐릭터 · 속도)
          </span>
          <span className="text-ink-500 text-lg">
            {showAdvancedSettings ? '−' : '+'}
          </span>
        </button>
        
        {showAdvancedSettings && (
          <div className="mt-3 space-y-4 animate-slideUp">
            {/* Coach Tone Selection */}
            <div>
              <label className="block text-xs font-semibold text-ink-500 mb-2 tracking-wide">
                코치 톤
              </label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(coachToneLabels) as CoachTone[]).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => handleToneChange(tone)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                      coachTone === tone
                        ? 'bg-primary-500 text-white shadow-soft'
                        : 'bg-surface-light text-ink-500 hover:bg-surface border border-ink/10'
                    }`}
                  >
                    {coachToneLabels[tone]}
                  </button>
                ))}
              </div>
            </div>

            {/* Opponent Persona Picker */}
            <div>
              <label className="block text-xs font-semibold text-ink-500 mb-2 tracking-wide">
                상대방 캐릭터 선택
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(opponentPersonaLabels) as OpponentPersona[]).map((persona) => {
                  const isRecommended = scenarioRecommendedPersona[selectedScenario] === persona
                  const traits = opponentPersonaTraits[persona]
                  const avatar = opponentPersonaAvatars[persona]
                  
                  return (
                    <button
                      key={persona}
                      type="button"
                      onClick={() => setSelectedPersona(persona)}
                      className={`text-center p-4 rounded-xl transition-all duration-200 ${
                        selectedPersona === persona
                          ? 'bg-primary-500/10 border-2 border-primary-500 shadow-soft'
                          : 'bg-surface-light hover:bg-surface border border-ink/10'
                      }`}
                    >
                      {/* Large circular avatar */}
                      <div className="flex justify-center mb-3">
                        <div className={`w-20 h-20 rounded-full overflow-hidden border-3 transition-all ${
                          selectedPersona === persona 
                            ? 'border-primary-500 ring-4 ring-primary-500/30' 
                            : 'border-ink/20'
                        }`}>
                          <img 
                            src={avatar} 
                            alt={opponentPersonaLabels[persona]}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                      
                      {/* Name + Badge */}
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <h4 className={`text-sm font-bold ${
                          selectedPersona === persona ? 'text-primary-500' : 'text-ink'
                        }`}>
                          {opponentPersonaLabels[persona]}
                        </h4>
                        {isRecommended && (
                          <span className={`text-xs px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            selectedPersona === persona 
                              ? 'bg-primary-500 text-white' 
                              : 'bg-primary-500/10 text-primary-500'
                          }`}>
                            추천
                          </span>
                        )}
                      </div>
                      
                      {/* One-line trait */}
                      <p className={`text-[11px] leading-tight ${
                        selectedPersona === persona ? 'text-ink' : 'text-ink-500'
                      }`}>
                        {traits.traits}
                      </p>
                    </button>
                  )
                })}
              </div>
              <div className="mt-2 p-2.5 rounded-lg bg-surface-light border border-ink/10">
                <p className="text-[10px] text-ink-500 leading-relaxed">
                  <strong className="text-ink">스타일:</strong> {opponentPersonaTraits[selectedPersona].openerStyle}
                </p>
              </div>
              <p className="mt-2 text-xs text-ink/40 italic">
                💡 같은 시나리오로 다른 캐릭터와 연습 가능 (예: 면접관 A/B 스타일)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Scenario Card Selection */}
      <div className="mb-5">
        <label className="block text-xs font-semibold text-ink-500 mb-2 tracking-wide">
          분석할 시나리오
        </label>
        <div className="grid grid-cols-1 gap-2">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => setSelectedScenario(scenario.id)}
              className={`text-left p-3 rounded-xl transition-all duration-200 ${
                selectedScenario === scenario.id
                  ? 'bg-primary-500 text-white shadow-soft-md'
                  : 'bg-surface-light hover:bg-surface border border-ink/10'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`text-xl flex-shrink-0 ${
                  selectedScenario === scenario.id ? '' : 'opacity-70'
                }`}>
                  {scenario.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`text-sm font-bold ${
                      selectedScenario === scenario.id ? 'text-white' : 'text-ink'
                    }`}>
                      {scenario.label}
                    </h3>
                    {scenario.featured && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        selectedScenario === scenario.id 
                          ? 'bg-white/20 text-white' 
                          : 'bg-primary-500/10 text-primary-500'
                      }`}>
                        ★
                      </span>
                    )}
                  </div>
                  <p className={`text-xs leading-relaxed ${
                    selectedScenario === scenario.id ? 'text-white/80' : 'text-ink-500'
                  }`}>
                    {scenario.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex-1 h-px bg-ink/10"></div>
        <span className="text-xs text-ink/30 font-medium">그 다음</span>
        <div className="flex-1 h-px bg-ink/10"></div>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">
            통화 녹음 업로드
          </label>
          <label className="block cursor-pointer group">
            <div className="relative border-2 border-dashed border-ink/10 hover:border-primary-500/30 rounded-2xl p-8 text-center transition-all duration-200 bg-surface-light hover:bg-surface">
              <div className="text-4xl mb-3">🎙️</div>
              <div className="text-sm font-medium text-ink mb-1">
                {audioFile ? (
                  <span className="text-primary-500">
                    {audioFile.name}
                  </span>
                ) : (
                  '탭하여 녹음 파일 선택'
                )}
              </div>
              {!audioFile && (
                <p className="text-xs text-ink-500 mt-1">
                  MP3, M4A, WAV · 최대 25MB
                </p>
              )}
            </div>
            <input
              type="file"
              accept="audio/mpeg,audio/mp4,audio/wav,audio/x-m4a,.mp3,.m4a,.wav"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          
          {/* Upload Notice */}
          <div className="mt-3 p-3 rounded-xl bg-sway-50/5 border border-sway-500/20">
            <p className="text-xs text-sway-400 leading-relaxed">
              본인이 직접 녹음한 통화만 업로드하세요. 상대방 동의가 필요할 수 있습니다.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-sway-50/5 border border-sway-500/30">
            <p className="text-sm font-medium text-sway-400">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !audioFile}
          className="btn-primary"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              분석 중...
            </span>
          ) : (
            '📊 통화 분석 시작하기'
          )}
        </button>
        {!audioFile && (
          <p className="text-xs text-center text-ink-500 -mt-2">
            파일을 선택하면 분석을 시작할 수 있습니다
          </p>
        )}

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-ink/10"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-surface px-3 text-ink-500 font-medium">또는 데모 복기</span>
          </div>
        </div>
        
        <button
          type="button"
          onClick={(e) => handleSubmit(e, true, selectedScenario)}
          disabled={loading}
          className="btn-secondary text-sm"
        >
          {loading ? '분석 중...' : `${scenarios.find(s => s.id === selectedScenario)?.emoji} ${scenarios.find(s => s.id === selectedScenario)?.label} 복기 보기`}
        </button>
        <p className="text-xs text-center text-ink-500 -mt-2">
          시뮬레이션 없이 바로 분석 결과 확인
        </p>
      </form>

      {/* Info Footer */}
      <div className="mt-5 pt-4 border-t border-ink/10">
        <div className="flex items-center justify-center gap-3 text-xs text-ink/30">
          <span>녹음 미저장</span>
          <span className="w-1 h-1 rounded-full bg-ink/20"></span>
          <span>압박 구간 탐지</span>
          <span className="w-1 h-1 rounded-full bg-ink/20"></span>
          <span>연습 멘트 제공</span>
        </div>
      </div>
    </div>
  )
}
