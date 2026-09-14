'use client'

import { useState } from 'react'

type PracticeScript = {
  whenKo: string
  sayKo: string
}

type CoachPanelProps = {
  practiceScripts: PracticeScript[]
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
  const [selectedLine, setSelectedLine] = useState<OpponentLine | null>(null)
  const [showResponse, setShowResponse] = useState(false)

  const handleLineClick = (line: OpponentLine) => {
    setSelectedLine(line)
    setShowResponse(false)
    setTimeout(() => setShowResponse(true), 300)
  }

  return (
    <div className="glass-card p-6 border-primary-500/30">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start gap-4 pb-5 border-b border-white/10">
          <div className="text-5xl">🎯</div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-2">
              실시간 가이드 (연습)
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-3">
              스피커폰 옆자리 코치 시뮬레이션
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full text-xs font-bold text-blue-400 backdrop-blur-xl">
                <span>🔇</span>
                <span>마이크 없음</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 rounded-full text-xs font-bold text-rose-400 backdrop-blur-xl">
                <span>🚫</span>
                <span>통화 대행 아님</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 border border-violet-500/30 rounded-full text-xs font-bold text-violet-400 backdrop-blur-xl">
                <span>🎭</span>
                <span>시뮬레이션</span>
              </span>
            </div>
          </div>
        </div>

        {/* Instruction */}
        <div className="bg-primary-500/10 rounded-2xl p-4 border border-primary-500/20">
          <p className="text-sm text-primary-300 leading-relaxed">
            💡 아래 버튼을 눌러 상대방 말에 어떻게 대응할지 연습해보세요
          </p>
        </div>

        {/* Opponent Line Chips */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            상대방이 이렇게 말한다면
          </div>
          <div className="flex flex-wrap gap-2">
            {opponentLines.map((line, idx) => (
              <button
                key={idx}
                onClick={() => handleLineClick(line)}
                className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                  selectedLine?.text === line.text
                    ? 'bg-primary-500 text-white shadow-glow'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20 border border-white/20'
                }`}
              >
                "{line.text}"
              </button>
            ))}
          </div>
        </div>

        {/* Response Area */}
        {selectedLine && (
          <div className="space-y-4 animate-fadeIn">
            {/* Meaning Card */}
            <div className="bg-amber-500/10 rounded-2xl p-5 border border-amber-500/20">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">💭</span>
                <div>
                  <div className="text-xs font-bold text-amber-400 mb-2 uppercase tracking-wider">
                    이렇게 들릴 수 있음 (가설)
                  </div>
                  <p className="text-sm text-amber-200 leading-relaxed">
                    {selectedLine.meaning}
                  </p>
                </div>
              </div>
            </div>

            {/* Coach Response */}
            {showResponse && practiceScripts[selectedLine.responseIndex] && (
              <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 rounded-2xl p-5 border border-emerald-500/30 animate-fadeIn">
                <div className="flex items-start gap-3">
                  <div className="text-4xl flex-shrink-0">🎓</div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-emerald-400 mb-2 uppercase tracking-wider">
                      코치 추천 응답
                    </div>
                    <p className="text-base text-white font-semibold leading-relaxed mb-3">
                      "{practiceScripts[selectedLine.responseIndex].sayKo}"
                    </p>
                    <div className="text-xs text-slate-400 leading-relaxed pt-3 border-t border-white/10">
                      💡 이 멘트를 참고하여 본인의 상황에 맞게 조정하세요
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Disclaimer */}
        <div className="pt-4 border-t border-white/10">
          <p className="text-xs text-slate-500 leading-relaxed">
            ⚠️ 이 기능은 연습용 시뮬레이션입니다. 실제 통화 내용을 듣거나 녹음하지 않으며, 통화 대행을 수행하지 않습니다. 
            실제 통화는 본인이 직접 진행하셔야 합니다.
          </p>
        </div>
      </div>
    </div>
  )
}
