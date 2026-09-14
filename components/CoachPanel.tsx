'use client'

import { useState, useEffect, useRef } from 'react'
import { CoachTone } from '@/lib/coach-tone'

type PracticeScript = {
  whenKo: string
  sayKo: string
}

type CoachPanelProps = {
  practiceScripts: PracticeScript[]
  coachTone?: CoachTone
}

type Message = {
  id: string
  type: 'opponent' | 'coach' | 'system'
  text: string
  timestamp: Date
}

type OpponentLine = {
  text: string
  meaning: string
  responseIndex: number
}

// Generate tone-specific responses
function getTonedResponse(baseResponse: string, tone: CoachTone): string {
  const responses: Record<string, Record<CoachTone, string>> = {
    '제안 감사하지만 필요 없습니다. 더 이상 안내 전화 주지 마세요.': {
      cold: '필요 없습니다. 끊겠습니다.',
      warm: '제안은 감사하지만 지금은 필요 없어요. 안내 전화는 사양할게요.',
      firm_polite: '제안 감사하지만 필요 없습니다. 더 이상 안내 전화 주지 마세요.',
    },
    '제 판단으로 결정하겠습니다. 통화 종료할게요.': {
      cold: '관심 없습니다. 끊겠습니다.',
      warm: '다른 분들 말씀은 이해하지만, 제 상황에는 맞지 않아요. 통화 종료할게요.',
      firm_polite: '제 판단으로 결정하겠습니다. 통화 종료할게요.',
    },
    '급하게 결정할 필요 없습니다. 관심 없으니 전화 끊겠습니다.': {
      cold: '관심 없습니다. 끊겠습니다.',
      warm: '급하게 결정하고 싶지 않아서요. 필요하면 제가 연락드릴게요. 감사합니다.',
      firm_polite: '급하게 결정할 필요 없습니다. 관심 없으니 전화 끊겠습니다.',
    },
  }

  return responses[baseResponse]?.[tone] || baseResponse
}

const opponentLines: OpponentLine[] = [
  {
    text: '지금 가입하면 3만원 캐시백이에요',
    meaning: '무료 혜택을 강조하며 즉각적인 결정을 유도하는 영업 전술입니다.',
    responseIndex: 0,
  },
  {
    text: '다른 분들은 다 하셨는데요?',
    meaning: '다른 사람과의 비교를 통해 FOMO(놓칠까봐 두려운 심리)를 자극하는 압박입니다.',
    responseIndex: 1,
  },
  {
    text: '지금 안 하시면 손해보세요',
    meaning: '시간 제한과 손실 프레임을 사용한 긴급성 압박 전술입니다.',
    responseIndex: 2,
  },
  {
    text: '1분만 시간 내주시면 안될까요?',
    meaning: '작은 요청으로 시작해 대화를 연장하려는 시도입니다. 단호하게 거절하셔도 됩니다.',
    responseIndex: 1,
  },
]

export default function CoachPanel({ practiceScripts, coachTone = 'firm_polite' }: CoachPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMsg: Message = {
        id: 'welcome',
        type: 'system',
        text: '💡 아래 버튼을 눌러 상대방 말에 대응하는 연습을 시작하세요',
        timestamp: new Date(),
      }
      setMessages([welcomeMsg])
    }
  }, [messages.length])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleLineClick = (line: OpponentLine) => {
    const opponentMsg: Message = {
      id: `opponent-${Date.now()}`,
      type: 'opponent',
      text: line.text,
      timestamp: new Date(),
    }
    
    setMessages(prev => [...prev, opponentMsg])
    setIsTyping(true)

    setTimeout(() => {
      const meaningMsg: Message = {
        id: `meaning-${Date.now()}`,
        type: 'system',
        text: `💭 ${line.meaning}`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, meaningMsg])
      
      setTimeout(() => {
        setIsTyping(false)
        if (practiceScripts[line.responseIndex]) {
          const baseResponse = practiceScripts[line.responseIndex].sayKo
          const tonedResponse = getTonedResponse(baseResponse, coachTone)
          const coachMsg: Message = {
            id: `coach-${Date.now()}`,
            type: 'coach',
            text: tonedResponse,
            timestamp: new Date(),
          }
          setMessages(prev => [...prev, coachMsg])
        }
      }, 800)
    }, 1200)
  }

  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'ko-KR'
      utterance.rate = 0.9
      utterance.pitch = 1
      
      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)
      
      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    } else {
      alert('이 브라우저는 음성 기능을 지원하지 않습니다')
    }
  }

  const handleStopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }

  const handleReset = () => {
    setMessages([])
    setIsTyping(false)
    handleStopSpeaking()
  }

  return (
    <div className="paper-card overflow-hidden">
      {/* Header */}
      <div className="bg-hold-50 border-b border-hold-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-hold flex items-center justify-center text-lg">
              🎯
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">
                연습 코치
              </h3>
              <p className="text-xs text-ink/60">
                실시간 대화 시뮬레이션
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="px-2.5 py-1 text-xs font-medium text-ink/60 hover:text-ink transition-colors"
          >
            초기화
          </button>
        </div>
        
        {/* Simplified badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="caution-chip bg-white border-ink/15 text-ink/70">
            마이크 없음
          </span>
          <span className="caution-chip bg-sway-50 border-sway-300 text-sway-600">
            통화 대행 아님
          </span>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="p-4 space-y-2.5 min-h-[280px] max-h-[450px] overflow-y-auto bg-cream-100">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.type === 'opponent' ? 'justify-start' : msg.type === 'coach' ? 'justify-end' : 'justify-center'} animate-slideUp`}
          >
            {msg.type === 'system' ? (
              <div className="max-w-[85%] px-3 py-1.5 rounded-xl bg-white border border-ink/10">
                <p className="text-xs text-ink/60 text-center leading-relaxed">
                  {msg.text}
                </p>
              </div>
            ) : msg.type === 'opponent' ? (
              <div className="flex items-end gap-2 max-w-[80%]">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-sway-200 flex items-center justify-center text-sm">
                  📞
                </div>
                <div>
                  <div className="px-3.5 py-2.5 rounded-xl rounded-bl-sm bg-white border border-ink/10">
                    <p className="text-sm text-ink leading-relaxed">
                      {msg.text}
                    </p>
                  </div>
                  <div className="text-xs text-ink/40 mt-1 ml-2">
                    {msg.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-end gap-2 max-w-[80%] flex-row-reverse">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-hold flex items-center justify-center text-sm">
                  🎓
                </div>
                <div>
                  <div className="px-3.5 py-2.5 rounded-xl rounded-br-sm bg-hold-50 border border-hold-200 relative">
                    <p className="text-sm text-ink font-medium leading-relaxed">
                      {msg.text}
                    </p>
                    <button
                      onClick={() => isSpeaking ? handleStopSpeaking() : handleSpeak(msg.text)}
                      className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-hold hover:bg-hold-600 text-white flex items-center justify-center text-xs shadow-soft transition-all active:scale-95"
                      aria-label={isSpeaking ? '음성 정지' : '음성 읽기'}
                    >
                      {isSpeaking ? '⏸' : '🔊'}
                    </button>
                  </div>
                  <div className="text-xs text-ink/40 mt-1 mr-2 text-right">
                    {msg.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        
        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex justify-start animate-slideUp">
            <div className="flex items-end gap-2 max-w-[80%]">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-hold flex items-center justify-center text-sm">
                🎓
              </div>
              <div className="px-3.5 py-2.5 rounded-xl rounded-bl-sm bg-white border border-ink/10">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-ink/30 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-ink/30 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-ink/30 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-ink/10 p-4 bg-white">
        <div className="mb-2">
          <p className="text-xs font-medium text-ink/60 mb-2">
            영업자가 이렇게 말한다면 탭하세요
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {opponentLines.map((line, idx) => (
            <button
              key={idx}
              onClick={() => handleLineClick(line)}
              disabled={isTyping}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-cream-100 hover:bg-cream-200 text-ink/70 border border-ink/15 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              "{line.text}"
            </button>
          ))}
        </div>
      </div>

      {/* Footer Disclaimer */}
      <div className="border-t border-ink/10 p-3 bg-cream-100">
        <p className="text-xs text-ink/50 leading-relaxed text-center">
          연습용 시뮬레이션 · 통화 대행 아님 · 실제 통화는 본인이 직접
        </p>
      </div>
    </div>
  )
}
