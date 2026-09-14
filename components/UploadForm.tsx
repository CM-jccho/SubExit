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

type ScenarioType = 'sales' | 'first_date' | 'relationship' | 'school_group' | 'presentation_qa' | 'work_comm' | 'work_presentation'

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
    // 시나리오별 transcript 매핑
    const scenarioTranscripts: Record<ScenarioType, TranscriptLine[]> = {
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
      presentation_qa: [
        { speaker: 'agent', text: '발표 내용 중에 3페이지 데이터가 최신인지 의심스러운데요?', startTime: 2, endTime: 7, tags: ['pressure'] },
        { speaker: 'user', text: '해당 데이터는 지난달 공식 보고서 기준입니다.', startTime: 8, endTime: 12 },
        { speaker: 'agent', text: '그럼 올해 초 데이터는 왜 빠졌나요? 그게 더 중요하지 않나요?', startTime: 13, endTime: 19, tags: ['pressure'] },
        { speaker: 'user', text: '좋은 지적입니다. 올해 초 데이터는 트렌드 비교 자료로 다음 슬라이드에 포함되어 있습니다.', startTime: 20, endTime: 28 },
        { speaker: 'agent', text: '근데 경쟁사 분석은 너무 얕은 거 아닌가요? 실무에서 쓰기에는...', startTime: 29, endTime: 35, tags: ['pressure', 'guilt'] },
        { speaker: 'user', text: '이번 발표는 개요 중심이라 간략히 다뤘습니다. 상세 분석은 별도 자료로 준비되어 있으니 공유드리겠습니다.', startTime: 36, endTime: 45 },
      ],
      work_comm: [
        { speaker: 'agent', text: '김 대리, 이번 주 금요일까지 보고서 가능하죠?', startTime: 2, endTime: 6 },
        { speaker: 'user', text: '현재 다른 업무도 있어서 일정이 빠듯한데요.', startTime: 7, endTime: 11 },
        { speaker: 'agent', text: '그래도 박 대리는 어제 다 끝냈던데? 금요일이면 충분하지 않나요?', startTime: 12, endTime: 18, tags: ['comparison', 'pressure'] },
        { speaker: 'user', text: '박 대리님 업무량과 제 업무량은 다릅니다. 다음 주 화요일이면 가능합니다.', startTime: 19, endTime: 26 },
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

    type TranscriptLine = {
      speaker: string
      text: string
      startTime: number
      endTime: number
      tags?: string[]
    }

    const transcript = scenarioTranscripts[selectedScenario] || scenarioTranscripts.sales
    
    return (
      <div className="animate-fadeIn">
        <div className="mb-5 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-center">
          <span className="text-sm font-bold text-primary-700">실시간 통화 시뮬레이션</span>
        </div>
        
        <RealtimeSideCoach
          transcript={transcript}
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
        {/* 단계 표시기 */}
        <div className="paper-card p-4 bg-cream-100 mb-5">
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-2 opacity-50">
              <div className="w-8 h-8 rounded-full bg-hold text-white flex items-center justify-center text-sm font-bold">✓</div>
              <span className="text-sm text-ink/60">동의</span>
            </div>
            <div className="w-8 h-0.5 bg-hold"></div>
            <div className="flex items-center gap-2 opacity-50">
              <div className="w-8 h-8 rounded-full bg-hold text-white flex items-center justify-center text-sm font-bold">✓</div>
              <span className="text-sm text-ink/60">통화 중</span>
            </div>
            <div className="w-8 h-0.5 bg-hold"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center text-sm font-bold">3</div>
              <span className="text-sm font-bold text-primary-700">복기</span>
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
      emoji: '💼', 
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

      {/* Scenario Card Selection */}
      <div className="mb-6">
        <label className="block text-xs font-semibold text-ink/60 mb-3 tracking-wide">
          시나리오 선택 (데모용)
        </label>
        <div className="grid grid-cols-1 gap-3">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => setSelectedScenario(scenario.id)}
              className={`text-left p-4 rounded-xl transition-all duration-200 ${
                selectedScenario === scenario.id
                  ? 'bg-primary-500 text-white shadow-lg scale-[1.02]'
                  : 'bg-white hover:bg-cream-100 border border-ink/15 hover:border-primary-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`text-2xl flex-shrink-0 ${
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
                          : 'bg-hold-50 text-hold-600'
                      }`}>
                        ★
                      </span>
                    )}
                  </div>
                  <p className={`text-xs leading-relaxed ${
                    selectedScenario === scenario.id ? 'text-white/90' : 'text-ink/60'
                  }`}>
                    {scenario.description}
                  </p>
                </div>
              </div>
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
            '📊 통화 분석 시작하기'
          )}
        </button>
        {!audioFile && (
          <p className="text-xs text-center text-ink/50 -mt-2">
            파일을 선택하면 분석을 시작할 수 있습니다
          </p>
        )}

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-ink/10"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-ink/50 font-medium">또는 데모 체험</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowRealtimeCoach(true)}
          disabled={loading}
          className="btn-demo"
        >
          📞 실시간 시뮬레이션 체험하기
        </button>
        <p className="text-xs text-center text-ink/50 -mt-2">
          약 40초 · 빠른 데모 체험
        </p>
        
        <button
          type="button"
          onClick={(e) => handleSubmit(e, true, selectedScenario)}
          disabled={loading}
          className="btn-secondary text-sm"
        >
          {loading ? '분석 중...' : `${scenarios.find(s => s.id === selectedScenario)?.emoji} ${scenarios.find(s => s.id === selectedScenario)?.label} 복기 보기`}
        </button>
        <p className="text-xs text-center text-ink/50 -mt-2">
          시뮬레이션 없이 바로 분석 결과 확인
        </p>
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
