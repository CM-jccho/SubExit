'use client'

import { useState } from 'react'

type OpponentPreset = {
  id: string
  name: string
  emoji: string
  description: string
  opener: string
  chips: string[]
  interpretation: string
  coachScript: string
}

const opponentPresets: OpponentPreset[] = [
  {
    id: 'emotional',
    name: '감성 영업',
    emoji: '😢',
    description: '죄책감과 감정 호소 중심',
    opener: '고객님, 후원 중단하시면 아이들이 정말 힘들어요. 그래도 괜찮으신가요?',
    chips: ['더 어려운 아이들이 있어요', '다른 분들은 계속하시는데', '마지막으로 한 번만 생각해주세요'],
    interpretation: '감정적 죄책감을 유도하여 거절을 어렵게 만들려는 전술입니다. 상대방의 감정 호소에 흔들리지 않고, 자신의 결정을 명확히 하는 것이 중요합니다.',
    coachScript: '마음은 이해하지만, 제 결정은 이미 정해졌습니다. 죄송하지만 중단하겠습니다.',
  },
  {
    id: 'fomo',
    name: '혜택·마감 압박',
    emoji: '⏰',
    description: 'FOMO, 할인, 데드라인 강조',
    opener: '지금 안 하시면 이 혜택은 오늘까지입니다. 다른 분들은 다 신청하셨는데요?',
    chips: ['오늘만 3만 원 할인', '나중엔 이 가격 없어요', '선착순 100명만'],
    interpretation: 'FOMO(Fear of Missing Out)와 긴급성을 강조하여 빠른 결정을 유도하는 압박 전술입니다. 시간 제한과 손실 강조로 판단력을 흐리게 만듭니다.',
    coachScript: '급하게 결정할 필요 없습니다. 필요하면 제가 찾아보겠습니다. 전화 끊겠습니다.',
  },
  {
    id: 'redirect',
    name: '말 돌리기',
    emoji: '🔄',
    description: '화제 전환, 절차 지연',
    opener: '잠깐만요, 해지 사유가 뭔지 여쭤봐도 될까요? 시스템 등록용이에요.',
    chips: ['확인 좀 해볼게요', '상담원 연결할게요', '설문 하나만 부탁드려요'],
    interpretation: '직접적인 해지를 피하고 대화를 연장하여 설득 기회를 만들거나, 해지를 복잡하게 만들려는 시도입니다. 불필요한 절차에 말려들지 않는 것이 중요합니다.',
    coachScript: '더 이상 설명 필요 없습니다. 해지 처리 부탁드립니다. 웹에서 직접 하겠습니다.',
  },
]

export default function PracticeTab() {
  const [selectedPreset, setSelectedPreset] = useState<OpponentPreset | null>(null)
  const [showInterpretation, setShowInterpretation] = useState(false)
  const [showCoachScript, setShowCoachScript] = useState(false)
  const [selectedChip, setSelectedChip] = useState<string | null>(null)

  const handlePresetSelect = (preset: OpponentPreset) => {
    setSelectedPreset(preset)
    setShowInterpretation(false)
    setShowCoachScript(false)
    setSelectedChip(null)
  }

  const handleChipClick = (chip: string) => {
    setSelectedChip(chip)
    setShowInterpretation(true)
    setTimeout(() => {
      setShowCoachScript(true)
    }, 800)
  }

  const handleReset = () => {
    setSelectedPreset(null)
    setShowInterpretation(false)
    setShowCoachScript(false)
    setSelectedChip(null)
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Info Banner */}
      <div className="glass-card p-4 border-primary-500/30 bg-gradient-to-r from-primary-500/10 to-accent-500/10">
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">🎭</span>
          <div>
            <h3 className="text-sm font-bold text-white mb-1">실전 연습 모드</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              영업 전화 상대방 유형을 선택하고, 상황별 대응 멘트를 연습하세요
            </p>
          </div>
        </div>
      </div>

      {/* Preset Selection */}
      {!selectedPreset ? (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-300 mb-3">상대방 유형 선택</h3>
          <div className="grid gap-3">
            {opponentPresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset)}
                className="glass-card p-5 border-white/20 hover:border-primary-500/50 transition-all duration-200 text-left group hover:shadow-glow"
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl flex-shrink-0 group-hover:scale-110 transition-transform">
                    {preset.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-base font-bold text-white mb-1">
                      {preset.name}
                    </h4>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      {preset.description}
                    </p>
                  </div>
                  <div className="text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    →
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Selected Preset Header */}
          <div className="glass-card p-5 border-primary-500/30 bg-gradient-to-r from-primary-500/10 to-accent-500/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedPreset.emoji}</span>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedPreset.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedPreset.description}
                  </p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                변경
              </button>
            </div>
          </div>

          {/* Opponent Opener */}
          <div className="glass-card p-5 border-rose-500/30 bg-rose-500/5">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center text-lg">
                📞
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-rose-400 mb-2 uppercase tracking-wider">
                  상대방 첫 멘트
                </div>
                <p className="text-sm text-white leading-relaxed">
                  "{selectedPreset.opener}"
                </p>
              </div>
            </div>
          </div>

          {/* Chips - Opponent Follow-ups */}
          <div className="glass-card p-5">
            <div className="mb-4">
              <h4 className="text-sm font-bold text-slate-300 mb-2">
                상대방 추가 멘트 (탭하여 대응 연습)
              </h4>
              <p className="text-xs text-slate-500">
                아래 버튼을 눌러 상황별 코치 추천 멘트를 확인하세요
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedPreset.chips.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleChipClick(chip)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    selectedChip === chip
                      ? 'bg-primary-500 text-white shadow-glow'
                      : 'bg-white/10 hover:bg-white/20 text-slate-300 border border-white/20'
                  }`}
                >
                  "{chip}"
                </button>
              ))}
            </div>
          </div>

          {/* Interpretation (Step 1) */}
          {showInterpretation && (
            <div className="glass-card p-5 border-amber-500/30 bg-amber-500/5 animate-slideUp">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">💡</span>
                <div>
                  <div className="text-xs font-bold text-amber-400 mb-2 uppercase tracking-wider">
                    해석 (가설)
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {selectedPreset.interpretation}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Coach Script (Step 2) */}
          {showCoachScript && (
            <div className="glass-card p-5 border-emerald-500/30 bg-emerald-500/5 animate-slideUp">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">🎓</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-emerald-400 mb-2 uppercase tracking-wider">
                    코치 추천 멘트
                  </div>
                  <div className="p-4 rounded-2xl bg-white/10 border border-white/20">
                    <p className="text-base text-white font-medium leading-relaxed">
                      "{selectedPreset.coachScript}"
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                    <span>💡</span>
                    <span>이 멘트를 연습해보세요</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Practice Tips */}
          <div className="glass-card p-5 border-slate-700">
            <div className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0">✨</span>
              <div>
                <div className="text-xs font-bold text-slate-300 mb-2">연습 팁</div>
                <ul className="text-xs text-slate-400 leading-relaxed space-y-1">
                  <li>• 상대방의 압박 패턴을 인지하는 것부터 시작하세요</li>
                  <li>• 코치 추천 멘트를 소리 내어 여러 번 연습하세요</li>
                  <li>• 실제 상황에서는 자신만의 표현으로 자연스럽게 말하세요</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Badges Footer */}
      <div className="flex flex-wrap gap-2 justify-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full text-xs font-semibold text-blue-400">
          <span>🎭</span>
          <span>시뮬레이션</span>
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 rounded-full text-xs font-semibold text-rose-400">
          <span>🚫</span>
          <span>통화 대행 아님</span>
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-xs font-semibold text-amber-400">
          <span>✅</span>
          <span>연습용</span>
        </span>
      </div>
    </div>
  )
}
