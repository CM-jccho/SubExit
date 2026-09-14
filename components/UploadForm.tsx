'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import CallResultDisplay from './CallResultDisplay'
import RealtimeSideCoach from './RealtimeSideCoach'
import { CoachTone, coachToneLabels, loadCoachTone, saveCoachTone } from '@/lib/coach-tone'
import PracticeTab from './PracticeTab'

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

type ScenarioType = 'cancel' | 'sales' | 'romantic' | 'general' | 'salary' | 'parent' | 'formal'

export default function UploadForm() {
  const searchParams = useSearchParams()
  const isRealtimeDemo = searchParams.get('demo') === '1'
  
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>('sales')
  const [coachTone, setCoachTone] = useState<CoachTone>('firm_polite')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [activeTab, setActiveTab] = useState<'analysis' | 'practice'>('analysis')
  const [showRealtimeCoach, setShowRealtimeCoach] = useState(false)

  useEffect(() => {
    setCoachTone(loadCoachTone())
    
    if (isRealtimeDemo) {
      setShowRealtimeCoach(true)
    }
  }, [isRealtimeDemo])

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
    setShowRealtimeCoach(false)
  }

  const handleCallEnd = async () => {
    setShowRealtimeCoach(false)
    setLoading(true)
    
    try {
      const response = await fetch('/api/analyze-call?demo=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo: true, scenario: selectedScenario, coachTone }),
      })

      if (!response.ok) {
        throw new Error('분석 중 오류가 발생했습니다')
      }

      const data = await response.json()
      setResult(data)
      setIsDemoMode(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  if (showRealtimeCoach) {
    return (
      <div className="animate-fadeIn">
        <div className="mb-5 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-center">
          <span className="text-sm font-bold text-primary-700">실시간 통화 시뮬레이션</span>
        </div>
        
        <RealtimeSideCoach
          transcript={[
            { speaker: 'agent', text: '안녕하세요 고객님, OO카드 프리미엄 회원 혜택 안내 전화드렸습니다.', startTime: 2, endTime: 7 },
            { speaker: 'user', text: '아, 괜찮습니다. 필요 없어요.', startTime: 8, endTime: 10 },
            { speaker: 'agent', text: '잠깐만요! 지금 가입하시면 첫 달 무료에 3만 원 캐시백까지 드립니다. 공짜인데 왜 안 받으세요?', startTime: 11, endTime: 19, tags: ['pressure', 'urgency', 'fomo'] },
            { speaker: 'user', text: '아니요, 정말 괜찮습니다.', startTime: 20, endTime: 22 },
            { speaker: 'agent', text: '고객님 같은 우량 고객분들은 다들 가입하셨는데요? 지금 안 하시면 다음 달부터는 혜택이 축소됩니다. 1분만 투자하시면 돼요.', startTime: 23, endTime: 34, tags: ['pressure', 'fomo', 'comparison'] },
            { speaker: 'user', text: '관심 없습니다. 전화 끊을게요.', startTime: 35, endTime: 38 },
            { speaker: 'agent', text: '아 잠깐만요! 정말 마지막입니다. 연회비도 첫 해 면제인데, 손해 보시는 거예요. 다른 분들은 저한테 고맙다고 하시던데...', startTime: 39, endTime: 50, tags: ['pressure', 'guilt'] },
            { speaker: 'user', text: '필요 없다고 했습니다. 이제 끊겠습니다.', startTime: 51, endTime: 54 },
            { speaker: 'agent', text: '네... 알겠습니다. 좋은 하루 되세요.', startTime: 55, endTime: 58 },
          ]}
          coachTone={coachTone}
          onCallEnd={handleCallEnd}
        />

        <button
          onClick={handleReset}
          className="mt-6 btn-secondary"
        >
          ← 처음으로
        </button>
      </div>
    )
  }

  if (result) {
    return (
      <div className="animate-fadeIn">
        {isDemoMode && (
          <div className="mb-5 px-4 py-2 rounded-full bg-hold-50 border border-hold-200 text-center">
            <span className="text-sm font-medium text-hold-600">통화 분석 결과</span>
          </div>
        )}
        
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
    { id: 'sales' as ScenarioType, label: '영업 전화 거절', emoji: '📞', primary: true, featured: true },
    { id: 'salary' as ScenarioType, label: '연봉·조건 협상', emoji: '💰', primary: false, featured: false },
  ]
  
  // Secondary/expansion (available, not hero)
  // cancel, parent, formal, general, romantic
  
  // Soft-Go scenarios (hidden, available via API)
  // parent, formal, general, romantic

  return (
    <div className="paper-card p-6 sm:p-7">
      {/* Coach Tone Selection */}
      <div className="mb-6">
        <label className="block text-xs font-semibold text-ink/60 mb-3 tracking-wide">
          코치 톤
        </label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(coachToneLabels) as CoachTone[]).map((tone) => (
            <button
              key={tone}
              type="button"
              onClick={() => handleToneChange(tone)}
              className={`px-3.5 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
                coachTone === tone
                  ? 'bg-hold text-white'
                  : 'bg-white text-ink/70 hover:bg-cream-200 border border-ink/15'
              }`}
            >
              {coachToneLabels[tone]}
            </button>
          ))}
        </div>
      </div>

      {/* Scenario Selection Chips */}
      <div className="mb-6">
        <label className="block text-xs font-semibold text-ink/60 mb-3 tracking-wide">
          시나리오 (데모용)
        </label>
        <div className="flex flex-wrap gap-2">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => setSelectedScenario(scenario.id)}
              className={`px-3.5 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
                selectedScenario === scenario.id
                  ? 'bg-ink text-cream'
                  : 'bg-white text-ink/70 hover:bg-cream-200 border border-ink/15'
              }`}
            >
              {scenario.label}
              {scenario.featured && <span className="ml-1 text-hold">★</span>}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-ink mb-3">
            통화 녹음 업로드
          </label>
          <label className="block cursor-pointer group">
            <div className="relative border-2 border-dashed border-ink/20 hover:border-hold/50 rounded-2xl p-8 text-center transition-all duration-200 bg-cream-100 hover:bg-hold-50">
              <div className="text-4xl mb-3">🎙️</div>
              <div className="text-sm font-medium text-ink mb-1">
                {audioFile ? (
                  <span className="text-hold-600">
                    {audioFile.name}
                  </span>
                ) : (
                  '탭하여 녹음 파일 선택'
                )}
              </div>
              {!audioFile && (
                <p className="text-xs text-ink/50 mt-1">
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
          <div className="mt-3 p-3 rounded-xl bg-sway-50 border border-sway-200">
            <p className="text-xs text-sway-600 leading-relaxed">
              본인이 직접 녹음한 통화만 업로드하세요. 상대방 동의가 필요할 수 있습니다.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-sway-50 border border-sway-300">
            <p className="text-sm font-medium text-sway-600">{error}</p>
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
            '통화 분석 시작'
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowRealtimeCoach(true)}
          disabled={loading}
          className="btn-demo"
        >
          📞 실시간 통화 시뮬레이션 체험
        </button>
        
        <button
          type="button"
          onClick={(e) => handleSubmit(e, true, selectedScenario)}
          disabled={loading}
          className="btn-secondary text-sm"
        >
          {loading ? '분석 중...' : `${scenarios.find(s => s.id === selectedScenario)?.label} 사후 분석만 보기`}
        </button>
      </form>

      {/* Info Footer */}
      <div className="mt-6 pt-4 border-t border-ink/10">
        <div className="flex items-center justify-center gap-3 text-xs text-ink/50">
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
