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

type ScenarioType = 'sales' | 'interview' | 'date' | 'school' | 'presentation' | 'work' | 'relationship'
type PersonaType = 'salesperson' | 'interviewer' | 'professor' | 'date' | 'boss' | 'audience'

const scenarioToPersonaMap: Record<ScenarioType, PersonaType> = {
  sales: 'salesperson',
  interview: 'interviewer',
  date: 'date',
  school: 'professor',
  presentation: 'audience',
  work: 'boss',
  relationship: 'date',
}

const personaLabels: Record<PersonaType, string> = {
  salesperson: '영업상담원',
  interviewer: '면접관',
  professor: '교수/팀원',
  date: '소개팅상대',
  boss: '직장상사',
  audience: '발표청중',
}

export default function UploadForm({ selectedScenario: initialScenario }: { selectedScenario?: string }) {
  const searchParams = useSearchParams()
  const isRealtimeDemo = searchParams.get('demo') === '1'
  
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>(
    (initialScenario as ScenarioType) || 'sales'
  )
  const [selectedPersona, setSelectedPersona] = useState<PersonaType | null>(null)
  const [coachTone, setCoachTone] = useState<CoachTone>('firm_polite')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [activeTab, setActiveTab] = useState<'analysis' | 'practice'>('analysis')
  const [showRealtimeCoach, setShowRealtimeCoach] = useState(false)

  useEffect(() => {
    if (initialScenario) {
      setSelectedScenario(initialScenario as ScenarioType)
      setSelectedPersona(scenarioToPersonaMap[initialScenario as ScenarioType])
    }
  }, [initialScenario])

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

  const getTranscriptForScenario = (scenario: ScenarioType): TranscriptLine[] => {
    const transcripts: Record<ScenarioType, TranscriptLine[]> = {
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
      interview: [
        { speaker: 'agent', text: '자기소개 부탁드립니다.', startTime: 2, endTime: 4 },
        { speaker: 'user', text: '안녕하세요, 저는...', startTime: 5, endTime: 7 },
        { speaker: 'agent', text: '경력이 부족해 보이는데, 어떻게 생각하시나요?', startTime: 8, endTime: 12, tags: ['pressure'] },
        { speaker: 'user', text: '음... 그래도...', startTime: 13, endTime: 15 },
        { speaker: 'agent', text: '우리 회사에 왜 지원하셨나요?', startTime: 16, endTime: 19 },
        { speaker: 'user', text: '귀사의 비전에...', startTime: 20, endTime: 23 },
      ],
      date: [
        { speaker: 'agent', text: '안녕하세요! 만나서 반갑습니다.', startTime: 2, endTime: 5 },
        { speaker: 'user', text: '네, 안녕하세요.', startTime: 6, endTime: 7 },
        { speaker: 'agent', text: '평소에 뭐 하시는 걸 좋아하세요?', startTime: 8, endTime: 11 },
        { speaker: 'user', text: '음... 저는...', startTime: 12, endTime: 14 },
      ],
      school: [
        { speaker: 'agent', text: '다음은 3조 발표 시간입니다.', startTime: 2, endTime: 5 },
        { speaker: 'user', text: '안녕하세요, 오늘 발표 주제는...', startTime: 6, endTime: 10 },
        { speaker: 'agent', text: '질문 있습니다. 그 부분은 어떻게 생각하시나요?', startTime: 11, endTime: 15, tags: ['pressure'] },
        { speaker: 'user', text: '음... 그건...', startTime: 16, endTime: 18 },
      ],
      presentation: [
        { speaker: 'agent', text: '제안서 발표 시작하겠습니다.', startTime: 2, endTime: 5 },
        { speaker: 'user', text: '안녕하세요, 오늘 제안드릴 내용은...', startTime: 6, endTime: 10 },
        { speaker: 'agent', text: '비용 대비 효과가 명확하지 않은데요?', startTime: 11, endTime: 15, tags: ['pressure'] },
        { speaker: 'user', text: '그 부분은...', startTime: 16, endTime: 18 },
      ],
      work: [
        { speaker: 'agent', text: '이번 프로젝트 일정 좀 타이트한데, 가능하겠어요?', startTime: 2, endTime: 6, tags: ['pressure'] },
        { speaker: 'user', text: '음... 최선을...', startTime: 7, endTime: 9 },
        { speaker: 'agent', text: '다른 팀원들은 다 괜찮다고 했는데.', startTime: 10, endTime: 13, tags: ['comparison'] },
        { speaker: 'user', text: '알겠습니다...', startTime: 14, endTime: 16 },
      ],
      relationship: [
        { speaker: 'agent', text: '왜 요즘 연락 안 해? 나한테 관심 없는 거야?', startTime: 2, endTime: 6, tags: ['pressure', 'guilt'] },
        { speaker: 'user', text: '아니야, 바빴어...', startTime: 7, endTime: 9 },
        { speaker: 'agent', text: '항상 바쁘다고만 하네. 다른 사람한테는 시간 내잖아.', startTime: 10, endTime: 15, tags: ['comparison', 'guilt'] },
        { speaker: 'user', text: '그게 아니라...', startTime: 16, endTime: 18 },
      ],
    }
    return transcripts[scenario] || transcripts.sales
  }

  type TranscriptLine = {
    speaker: string
    text: string
    startTime: number
    endTime: number
    tags?: string[]
  }

  if (showRealtimeCoach) {
    return (
      <div className="animate-fadeIn">
        <div className="mb-5 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-center">
          <span className="text-sm font-bold text-primary-700">실시간 통화 시뮬레이션</span>
        </div>
        
        <RealtimeSideCoach
          transcript={getTranscriptForScenario(selectedScenario)}
          coachTone={coachTone}
          onCallEnd={handleCallEnd}
          persona={selectedPersona || scenarioToPersonaMap[selectedScenario]}
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

  const scenarioInfo = {
    sales: { label: '영업 전화 거절', emoji: '📞' },
    interview: { label: '면접', emoji: '👔' },
    date: { label: '소개팅 · 첫 데이트', emoji: '☕' },
    school: { label: '학교 발표', emoji: '🎓' },
    presentation: { label: '제안서 · 사내 발표', emoji: '📊' },
    work: { label: '직장 소통', emoji: '💼' },
    relationship: { label: '연인 불편', emoji: '💔' },
  }

  return (
    <div className="paper-card p-6 sm:p-7">
      {/* Scenario Header */}
      <div className="mb-6 text-center">
        <div className="text-4xl mb-2">{scenarioInfo[selectedScenario].emoji}</div>
        <h2 className="text-xl font-bold text-ink mb-1">
          {scenarioInfo[selectedScenario].label}
        </h2>
        <p className="text-sm text-ink/60">
          시뮬레이션 연습
        </p>
      </div>

      {/* Persona Selection */}
      <div className="mb-6">
        <label className="block text-xs font-semibold text-ink/60 mb-3 tracking-wide">
          상대 페르소나
        </label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(personaLabels).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedPersona(key as PersonaType)}
              className={`px-3.5 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
                selectedPersona === key
                  ? 'bg-ink text-cream'
                  : 'bg-white text-ink/70 hover:bg-cream-200 border border-ink/15'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink/50 mt-2">
          페르소나는 코치의 말투와 대응 전략에 영향을 줍니다
        </p>
      </div>

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
          {loading ? '분석 중...' : `${scenarioInfo[selectedScenario].label} 사후 분석만 보기`}
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
