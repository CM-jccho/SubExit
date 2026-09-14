'use client'

import { useState, useEffect, useRef } from 'react'

type PracticeScript = {
  whenKo: string
  sayKo: string
}

type CoachPanelProps = {
  practiceScripts: PracticeScript[]
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

const opponentLines: OpponentLine[] = [
  {
    text: '커피 한 잔인데요',
    meaning: '소액임을 강조하여 해지를 망설이게 만들려는 시도일 수 있습니다.',
    responseIndex: 0,
  },
  {
    text: '왜 해지하세요?',
    meaning: '해지 사유를 물으며 설득할 기회를 찾으려는 질문일 수 있습니다.',
    responseIndex: 1,
  },
  {
    text: '더 어려운 아이들이 있어요',
    meaning: '감정적 호소를 통해 죄책감을 유도하려는 시도일 수 있습니다.',
    responseIndex: 2,
  },
  {
    text: '상담원 연결할게요',
    meaning: '전화 연결로 직접 설득하려는 시도일 수 있습니다. 웹 해지가 가능한지 다시 확인하세요.',
    responseIndex: 1,
  },
]

export default function CoachPanel({ practiceScripts }: CoachPanelProps) {
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
          const coachMsg: Message = {
            id: `coach-${Date.now()}`,
            type: 'coach',
            text: practiceScripts[line.responseIndex].sayKo,
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
    <div className="glass-card border-primary-500/30 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-500/10 to-accent-500/10 border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-xl">
              🎯
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                연습 코치
              </h3>
              <p className="text-xs text-slate-400">
                실시간 대화 시뮬레이션
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            초기화
          </button>
        </div>
        
        {/* Badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full text-xs font-semibold text-blue-400">
            <span>🔇</span>
            <span>마이크 없음</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 rounded-full text-xs font-semibold text-rose-400">
            <span>🚫</span>
            <span>통화 대행 아님</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary-500/10 border border-primary-500/30 rounded-full text-xs font-semibold text-primary-400">
            <span>🎭</span>
            <span>연습 모드</span>
          </span>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="p-4 space-y-3 min-h-[300px] max-h-[500px] overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.type === 'opponent' ? 'justify-start' : msg.type === 'coach' ? 'justify-end' : 'justify-center'} animate-slideUp`}
          >
            {msg.type === 'system' ? (
              <div className="max-w-[85%] px-4 py-2 rounded-2xl bg-slate-500/10 border border-slate-500/20">
                <p className="text-xs text-slate-400 text-center leading-relaxed">
                  {msg.text}
                </p>
              </div>
            ) : msg.type === 'opponent' ? (
              <div className="flex items-end gap-2 max-w-[80%]">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center text-sm">
                  👤
                </div>
                <div>
                  <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white/10 border border-white/20">
                    <p className="text-sm text-white leading-relaxed">
                      {msg.text}
                    </p>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 ml-2">
                    {msg.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-end gap-2 max-w-[80%] flex-row-reverse">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-sm">
                  🎓
                </div>
                <div>
                  <div className="px-4 py-3 rounded-2xl rounded-br-md bg-gradient-to-br from-primary-500/20 to-accent-500/20 border border-primary-500/30 relative">
                    <p className="text-sm text-white font-medium leading-relaxed">
                      {msg.text}
                    </p>
                    <button
                      onClick={() => isSpeaking ? handleStopSpeaking() : handleSpeak(msg.text)}
                      className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-primary-500 hover:bg-primary-600 text-white flex items-center justify-center text-xs shadow-lg transition-all active:scale-95"
                      aria-label={isSpeaking ? '음성 정지' : '음성 읽기'}
                    >
                      {isSpeaking ? '⏸' : '🔊'}
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 mr-2 text-right">
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
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-sm">
                🎓
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white/10 border border-white/20">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-white/10 p-4 bg-slate-900/30">
        <div className="mb-2">
          <p className="text-xs font-semibold text-slate-400 mb-2">
            상대방이 이렇게 말한다면 탭하세요
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {opponentLines.map((line, idx) => (
            <button
              key={idx}
              onClick={() => handleLineClick(line)}
              disabled={isTyping}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-slate-300 border border-white/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              "{line.text}"
            </button>
          ))}
        </div>
      </div>

      {/* Footer Disclaimer */}
      <div className="border-t border-white/10 p-3 bg-slate-900/20">
        <p className="text-xs text-slate-500 leading-relaxed text-center">
          ⚠️ 연습용 시뮬레이션 | 통화 대행 아님 | 실제 통화는 본인이 직접
        </p>
      </div>
    </div>
  )
}
