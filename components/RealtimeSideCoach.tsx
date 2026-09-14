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

type Props = {
  transcript: TranscriptLine[]
  coachTone: CoachTone
  onCallEnd: () => void
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

export default function RealtimeSideCoach({ transcript, coachTone, onCallEnd }: Props) {
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasConsented, setHasConsented] = useState(false)
  const [currentSuggestion, setCurrentSuggestion] = useState<CoachSuggestion | null>(null)
  const [displayedLines, setDisplayedLines] = useState<TranscriptLine[]>([])
  const [playbackSpeed, setPlaybackSpeed] = useState(2.5) // 기본 2.5배 속도
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isPlaying && hasConsented) {
      // 속도에 따라 시간 증가 간격 조정 (기본 2.5배 = 400ms, 1배 = 1000ms, 2배 = 500ms)
      const interval = 1000 / playbackSpeed
      intervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const newTime = prev + 1
          const maxTime = transcript[transcript.length - 1]?.endTime || 0
          
          if (newTime > maxTime) {
            setIsPlaying(false)
            setTimeout(() => {
              onCallEnd()
            }, 800)
            return prev
          }
          
          return newTime
        })
      }, interval)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isPlaying, hasConsented, playbackSpeed, transcript, onCallEnd])

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

  const handleSkipToCoach = () => {
    // 다음 코치 제안이 나오는 시점으로 건너뛰기
    const pressureTags = ['pressure', 'urgency', 'fomo', 'comparison', 'guilt']
    const nextCoachMoment = transcript.find(
      (line) => 
        line.startTime > currentTime && 
        line.speaker === 'agent' && 
        line.tags?.some(tag => pressureTags.includes(tag))
    )
    
    if (nextCoachMoment) {
      setCurrentTime(nextCoachMoment.startTime)
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!hasConsented) {
    return (
      <div className="space-y-4 animate-fadeIn">
        {/* 단계 표시기 */}
        <div className="paper-card p-4 bg-cream-100">
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center text-sm font-bold">1</div>
              <span className="text-sm font-bold text-primary-700">동의</span>
            </div>
            <div className="w-8 h-0.5 bg-ink/20"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-ink/10 text-ink/40 flex items-center justify-center text-sm font-bold">2</div>
              <span className="text-sm text-ink/40">통화 중</span>
            </div>
            <div className="w-8 h-0.5 bg-ink/20"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-ink/10 text-ink/40 flex items-center justify-center text-sm font-bold">3</div>
              <span className="text-sm text-ink/40">복기</span>
            </div>
          </div>
        </div>

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
            ✓ 시뮬레이션 시작
          </button>
          <p className="text-xs text-center text-ink/50 mt-3">
            약 40초 소요 · 빠른 체험 가능
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* 단계 표시기 */}
      <div className="paper-card p-4 bg-cream-100">
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2 opacity-50">
            <div className="w-8 h-8 rounded-full bg-hold text-white flex items-center justify-center text-sm font-bold">✓</div>
            <span className="text-sm text-ink/60">동의</span>
          </div>
          <div className="w-8 h-0.5 bg-hold"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center text-sm font-bold animate-pulse">2</div>
            <span className="text-sm font-bold text-primary-700">통화 중</span>
          </div>
          <div className="w-8 h-0.5 bg-ink/20"></div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-ink/10 text-ink/40 flex items-center justify-center text-sm font-bold">3</div>
            <span className="text-sm text-ink/40">복기</span>
          </div>
        </div>
      </div>

      {/* Recording Indicator - 단순화 */}
      <div className="paper-card p-3 bg-sway-50 border-sway-300">
        <div className="flex items-center justify-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full bg-sway-600 ${isPlaying ? 'animate-pulse' : ''}`}></div>
          <span className="text-sm font-bold text-sway-600">
            {isPlaying ? '녹음 중' : '일시정지'}
          </span>
        </div>
      </div>

      {/* Main Content: Split View */}
      <div className="grid grid-cols-1 gap-4">
        {/* Left: Transcript Timeline - dim 처리 when coach suggestion active */}
        <div className={`paper-card overflow-hidden transition-all ${currentSuggestion ? 'opacity-40' : 'opacity-100'}`}>
          <div className="bg-cream-100 border-b border-ink/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-ink">통화 진행</h3>
              <span className="text-xs font-medium text-ink/60">
                {formatTime(currentTime)} / {formatTime(transcript[transcript.length - 1]?.endTime || 0)}
              </span>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {!isPlaying ? (
                <button
                  onClick={handleStart}
                  className="flex-1 min-w-[120px] px-4 py-2.5 bg-hold hover:bg-hold-600 text-white rounded-xl text-sm font-bold transition-all"
                >
                  ▶ 시작
                </button>
              ) : (
                <>
                  <button
                    onClick={handlePause}
                    className="flex-1 min-w-[100px] px-4 py-2.5 bg-ink hover:bg-ink-400 text-white rounded-xl text-sm font-bold transition-all"
                  >
                    ⏸ 일시정지
                  </button>
                  <button
                    onClick={handleSkipToCoach}
                    className="px-3 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-xs font-medium transition-all"
                  >
                    건너뛰기 →
                  </button>
                </>
              )}
            </div>
            
            {/* 속도 조절 */}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-ink/60 font-medium">속도:</span>
              <button
                onClick={() => setPlaybackSpeed(1)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  playbackSpeed === 1
                    ? 'bg-ink text-white'
                    : 'bg-white text-ink/60 border border-ink/15 hover:bg-cream-100'
                }`}
              >
                1x
              </button>
              <button
                onClick={() => setPlaybackSpeed(2.5)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  playbackSpeed === 2.5
                    ? 'bg-ink text-white'
                    : 'bg-white text-ink/60 border border-ink/15 hover:bg-cream-100'
                }`}
              >
                2.5x
              </button>
              <button
                onClick={() => setPlaybackSpeed(4)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  playbackSpeed === 4
                    ? 'bg-ink text-white'
                    : 'bg-white text-ink/60 border border-ink/15 hover:bg-cream-100'
                }`}
              >
                4x
              </button>
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

        {/* Right: Coach Suggestions - 강조 */}
        <div className={`paper-card overflow-hidden transition-all ${
          currentSuggestion ? 'ring-4 ring-hold/50 shadow-lg scale-[1.02]' : ''
        }`}>
          <div className="bg-hold-50 border-b border-hold-200 p-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-hold flex items-center justify-center text-lg">
                🎓
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">
                  옆자리 코치
                </h3>
                <p className="text-xs text-ink/60">
                  지금 이렇게 말하세요
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 min-h-[180px] flex items-center justify-center bg-cream-100">
            {currentSuggestion ? (
              <div className="w-full animate-slideUp">
                <div className="p-5 rounded-xl bg-gradient-to-br from-hold-50 to-primary-50 border-2 border-hold-500 shadow-lg mb-3">
                  <div className="text-xs font-bold text-hold-700 mb-3 uppercase tracking-wider">
                    💡 추천 대응 ({coachTone === 'cold' ? '냉정' : coachTone === 'warm' ? '감성' : '단호·공손'})
                  </div>
                  <p className="text-lg text-ink font-bold leading-relaxed mb-2">
                    "{currentSuggestion.text}"
                  </p>
                  <div className="text-xs text-hold-600 font-medium">
                    👆 이 멘트를 참고하여 응답하세요
                  </div>
                </div>
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
        </div>
      </div>
    </div>
  )
}
