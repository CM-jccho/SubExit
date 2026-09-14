'use client'

import { useState, useEffect, useRef } from 'react'
import { CoachTone } from '@/lib/coach-tone'

type TranscriptLine = {
  speaker: string
  text: string
  startTime: number
  endTime: number
  tags?: string[]
}

type CoachSuggestion = {
  text: string
  tone: CoachTone
  trigger: string
}

type PersonaType = 'salesperson' | 'interviewer' | 'professor' | 'date' | 'boss' | 'audience'

type Props = {
  transcript: TranscriptLine[]
  coachTone: CoachTone
  onCallEnd: () => void
  persona: PersonaType
}

const getTonedSuggestion = (baseTrigger: string, tone: CoachTone): CoachSuggestion => {
  const suggestions: Record<string, Record<CoachTone, string>> = {
    'fomo': {
      cold: '필요 없습니다. 끊겠습니다.',
      warm: '제안은 감사하지만 지금은 필요 없어요. 안내 전화는 사양할게요.',
      firm_polite: '제안 감사하지만 필요 없습니다. 더 이상 안내 전화 주지 마세요.',
    },
    'comparison': {
      cold: '관심 없습니다. 끊겠습니다.',
      warm: '다른 분들 말씀은 이해하지만, 제 상황에는 맞지 않아요. 통화 종료할게요.',
      firm_polite: '제 판단으로 결정하겠습니다. 통화 종료할게요.',
    },
    'guilt': {
      cold: '죄송하지만 관심 없습니다.',
      warm: '마음은 이해하지만, 제 결정은 이미 정해졌습니다. 죄송합니다.',
      firm_polite: '마음은 이해하지만, 제 결정은 이미 정해졌습니다. 중단하겠습니다.',
    },
    'urgency': {
      cold: '관심 없습니다. 끊겠습니다.',
      warm: '급하게 결정하고 싶지 않아서요. 필요하면 제가 연락드릴게요.',
      firm_polite: '급하게 결정할 필요 없습니다. 관심 없으니 전화 끊겠습니다.',
    },
  }

  return {
    text: suggestions[baseTrigger]?.[tone] || '관심 없습니다. 전화 끊겠습니다.',
    tone,
    trigger: baseTrigger,
  }
}

export default function RealtimeSideCoach({ transcript, coachTone, onCallEnd, persona }: Props) {
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasConsented, setHasConsented] = useState(false)
  const [currentSuggestion, setCurrentSuggestion] = useState<CoachSuggestion | null>(null)
  const [displayedLines, setDisplayedLines] = useState<TranscriptLine[]>([])
  const [showHints, setShowHints] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const personaLabels: Record<PersonaType, string> = {
    salesperson: '영업상담원',
    interviewer: '면접관',
    professor: '교수/팀원',
    date: '소개팅상대',
    boss: '직장상사',
    audience: '발표청중',
  }

  useEffect(() => {
    if (isPlaying && hasConsented) {
      intervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const newTime = prev + 1
          const maxTime = transcript[transcript.length - 1]?.endTime || 0
          
          if (newTime > maxTime) {
            setIsPlaying(false)
            setTimeout(() => {
              onCallEnd()
            }, 1000)
            return prev
          }
          
          return newTime
        })
      }, 1000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isPlaying, hasConsented, transcript, onCallEnd])

  useEffect(() => {
    const linesToShow = transcript.filter((line) => line.startTime <= currentTime)
    setDisplayedLines(linesToShow)

    const currentLine = transcript.find(
      (line) => line.startTime <= currentTime && line.endTime >= currentTime
    )

    if (currentLine && currentLine.speaker === 'agent' && currentLine.tags) {
      const pressureTags = ['pressure', 'urgency', 'fomo', 'comparison', 'guilt']
      const foundTag = currentLine.tags.find((tag) => pressureTags.includes(tag))
      
      if (foundTag) {
        const suggestion = getTonedSuggestion(foundTag, coachTone)
        setCurrentSuggestion(suggestion)
      }
    }

    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [currentTime, transcript, coachTone])

  const handleStart = () => {
    if (!hasConsented) return
    setIsPlaying(true)
  }

  const handlePause = () => {
    setIsPlaying(false)
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!hasConsented) {
    return (
      <div className="space-y-4 animate-fadeIn">
        <div className="paper-card p-6 bg-hold-50">
          <div className="flex items-start gap-3 mb-6">
            <div className="text-3xl">📞</div>
            <div>
              <h3 className="text-lg font-bold text-ink mb-2">
                실시간 통화 시뮬레이션
              </h3>
              <p className="text-sm text-ink/70 leading-relaxed">
                영업 전화를 받는 상황을 시뮬레이션합니다. 통화 중 옆자리 코치처럼 실시간으로 대응 멘트를 제안합니다.
              </p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex items-start gap-2.5 p-4 rounded-xl bg-white border border-hold-200">
              <span className="text-lg flex-shrink-0">🎭</span>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-ink mb-1">시뮬레이션 안내</h4>
                <ul className="text-xs text-ink/70 leading-relaxed space-y-1">
                  <li>• 실제 통화가 아닌 <strong>연습용 데모</strong>입니다</li>
                  <li>• 통화 대행 서비스가 <strong>아닙니다</strong></li>
                  <li>• 실제 통화는 본인이 직접 진행하셔야 합니다</li>
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-4 rounded-xl bg-white border border-sway-200">
              <span className="text-lg flex-shrink-0">🔴</span>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-ink mb-1">녹음 및 데이터</h4>
                <ul className="text-xs text-ink/70 leading-relaxed space-y-1">
                  <li>• 이 시뮬레이션은 <strong>데모용 사전 녹음</strong>을 사용합니다</li>
                  <li>• 실제 마이크 입력은 사용하지 않습니다</li>
                  <li>• 연습 목적으로만 사용하세요</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={() => setHasConsented(true)}
            className="btn-primary"
          >
            이해했습니다. 시뮬레이션 시작
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Recording Indicator */}
      <div className="paper-card p-3 bg-sway-50 border-sway-300">
        <div className="flex items-center justify-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full bg-sway-600 ${isPlaying ? 'animate-pulse' : ''}`}></div>
          <span className="text-sm font-bold text-sway-600">
            {isPlaying ? '녹음 중 · 시뮬레이션 진행 중' : '녹음 중 · 일시정지'}
          </span>
        </div>
      </div>

      {/* Main Content: Split View */}
      <div className="grid grid-cols-1 gap-4">
        {/* Left: Transcript Timeline */}
        <div className="paper-card overflow-hidden">
          <div className="bg-cream-100 border-b border-ink/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-ink">통화 진행</h3>
              <span className="text-xs font-medium text-ink/60">
                {formatTime(currentTime)} / {formatTime(transcript[transcript.length - 1]?.endTime || 0)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {!isPlaying ? (
                <button
                  onClick={handleStart}
                  className="px-4 py-2 bg-hold hover:bg-hold-600 text-white rounded-xl text-sm font-medium transition-all"
                >
                  ▶ 시작
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="px-4 py-2 bg-ink hover:bg-ink-400 text-white rounded-xl text-sm font-medium transition-all"
                >
                  ⏸ 일시정지
                </button>
              )}
            </div>
          </div>

          <div ref={scrollRef} className="p-4 space-y-2.5 max-h-[400px] overflow-y-auto bg-cream-100">
            {displayedLines.map((line, idx) => {
              const isUser = line.speaker === 'user'
              const isCurrent = line.startTime <= currentTime && line.endTime >= currentTime
              
              return (
                <div
                  key={idx}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-slideUp`}
                >
                  <div className={`flex items-end gap-2 max-w-[85%] ${isUser ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base ${
                      isUser ? 'bg-ink/10' : 'bg-sway-200'
                    }`}>
                      {isUser ? '👤' : '📞'}
                    </div>
                    <div>
                      <div className={`px-3.5 py-2.5 rounded-xl ${
                        isUser 
                          ? 'rounded-br-sm bg-ink/5 border border-ink/10' 
                          : 'rounded-bl-sm bg-white border border-ink/10'
                      } ${isCurrent ? 'ring-2 ring-hold/30' : ''}`}>
                        <p className="text-sm text-ink leading-relaxed">
                          {line.text}
                        </p>
                      </div>
                      <div className={`text-xs text-ink/40 mt-1 ${isUser ? 'text-right mr-2' : 'ml-2'}`}>
                        {formatTime(line.startTime)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Coach Suggestions */}
        <div className="paper-card overflow-hidden">
          <div className="bg-hold-50 border-b border-hold-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-hold flex items-center justify-center text-lg">
                  🎓
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">
                    지금 이렇게 말하세요
                  </h3>
                  <p className="text-xs text-ink/60">
                    상대: {personaLabels[persona]}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHints(!showHints)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 bg-white border border-ink/15 hover:bg-cream-200 text-ink/70"
              >
                {showHints ? '힌트 숨김' : '힌트 보기'}
              </button>
            </div>
          </div>

          <div className="p-5 min-h-[180px] flex items-center justify-center bg-cream-100">
            {currentSuggestion && showHints ? (
              <div className="w-full animate-slideUp">
                <div className="p-4 rounded-xl bg-gradient-to-br from-hold-50 to-hold-100 border-2 border-hold-300 mb-3 ring-2 ring-hold/20 shadow-lg">
                  <div className="text-xs font-semibold text-hold-600 mb-2">
                    추천 대응 ({coachTone === 'cold' ? '냉정' : coachTone === 'warm' ? '감성' : '단호·공손'})
                  </div>
                  <p className="text-lg text-ink font-bold leading-relaxed">
                    "{currentSuggestion.text}"
                  </p>
                </div>
                <div className="text-xs text-ink/50 text-center">
                  💡 이 멘트를 참고하여 응답하세요
                </div>
              </div>
            ) : currentSuggestion && !showHints ? (
              <div className="text-center">
                <div className="text-3xl mb-2">🔕</div>
                <p className="text-sm text-ink/60">
                  힌트가 숨겨져 있습니다
                </p>
                <button
                  onClick={() => setShowHints(true)}
                  className="mt-3 px-4 py-2 bg-hold text-white rounded-xl text-xs font-medium hover:bg-hold-600 transition-colors"
                >
                  힌트 보기
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-3xl mb-2">🎯</div>
                <p className="text-sm text-ink/60">
                  {isPlaying ? '대응이 필요한 순간에 제안을 드립니다' : '시작 버튼을 눌러 통화를 시작하세요'}
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-ink/10 p-4 bg-white">
            <div className="flex flex-wrap gap-2 justify-center">
              <span className="caution-chip bg-sway-50 border-sway-300 text-sway-600">
                통화 대행 아님
              </span>
              <span className="caution-chip bg-cream-200 border-ink/20 text-ink/70">
                시뮬레이션
              </span>
              <span className="caution-chip bg-hold-50 border-hold-300 text-hold-700">
                녹음 동의
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
