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
    <div className="space-y-4 animate-fadeIn">
      {/* Info Banner */}
      <div className="paper-card p-4 bg-hold-50">
        <div className="flex items-start gap-2.5">
          <span className="text-xl flex-shrink-0">🎭</span>
          <div>
            <h3 className="text-sm font-bold text-ink mb-1">실전 연습 모드</h3>
            <p className="text-xs text-ink/70 leading-relaxed">
              영업 전화 상대방 유형을 선택하고, 상황별 대응 멘트를 연습하세요
            </p>
          </div>
        </div>
      </div>

      {/* Preset Selection */}
      {!selectedPreset ? (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-ink mb-2">상대방 유형 선택</h3>
          <div className="grid gap-2.5">
            {opponentPresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset)}
                className="paper-card-hover p-4 text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl flex-shrink-0 group-hover:scale-105 transition-transform">
                    {preset.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-ink mb-1">
                      {preset.name}
                    </h4>
                    <p className="text-xs text-ink/70 leading-relaxed">
                      {preset.description}
                    </p>
                  </div>
                  <div className="text-ink/40 group-hover:text-ink transition-colors text-lg">
                    →
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Selected Preset Header */}
          <div className="paper-card p-4 bg-hold-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{selectedPreset.emoji}</span>
                <div>
                  <h3 className="text-sm font-bold text-ink">
                    {selectedPreset.name}
                  </h3>
                  <p className="text-xs text-ink/60">
                    {selectedPreset.description}
                  </p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="px-2.5 py-1 text-xs font-medium text-ink/60 hover:text-ink transition-colors"
              >
                변경
              </button>
            </div>
          </div>

          {/* Opponent Opener */}
          <div className="paper-card p-4 bg-sway-50">
            <div className="flex items-start gap-2.5">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sway-200 flex items-center justify-center text-base">
                📞
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-sway-600 mb-1.5">
                  상대방 첫 멘트
                </div>
                <p className="text-sm text-ink leading-relaxed">
                  "{selectedPreset.opener}"
                </p>
              </div>
            </div>
          </div>

          {/* Chips - Opponent Follow-ups */}
          <div className="paper-card p-4">
            <div className="mb-3">
              <h4 className="text-sm font-bold text-ink mb-1">
                상대방 추가 멘트
              </h4>
              <p className="text-xs text-ink/60">
                버튼을 눌러 상황별 코치 추천 멘트를 확인하세요
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedPreset.chips.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleChipClick(chip)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                    selectedChip === chip
                      ? 'bg-ink text-cream'
                      : 'bg-white hover:bg-cream-200 text-ink/70 border border-ink/15'
                  }`}
                >
                  "{chip}"
                </button>
              ))}
            </div>
          </div>

          {/* Interpretation (Step 1) */}
          {showInterpretation && (
            <div className="paper-card p-4 bg-amber-50 animate-slideUp">
              <div className="flex items-start gap-2.5">
                <span className="text-xl flex-shrink-0">💡</span>
                <div>
                  <div className="text-xs font-semibold text-amber-700 mb-1.5">
                    해석
                  </div>
                  <p className="text-sm text-ink/80 leading-relaxed">
                    {selectedPreset.interpretation}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Coach Script (Step 2) */}
          {showCoachScript && (
            <div className="paper-card p-4 bg-hold-50 animate-slideUp">
              <div className="flex items-start gap-2.5">
                <span className="text-xl flex-shrink-0">🎓</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-hold-600 mb-2">
                    코치 추천 멘트
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-hold-200">
                    <p className="text-sm text-ink font-medium leading-relaxed">
                      "{selectedPreset.coachScript}"
                    </p>
                  </div>
                  <div className="mt-2 text-xs text-ink/60">
                    이 멘트를 연습해보세요
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Practice Tips */}
          <div className="paper-card p-4 bg-cream-100">
            <div className="flex items-start gap-2.5">
              <span className="text-base flex-shrink-0">✨</span>
              <div>
                <div className="text-xs font-semibold text-ink/70 mb-1.5">연습 팁</div>
                <ul className="text-xs text-ink/70 leading-relaxed space-y-1">
                  <li>• 상대방의 압박 패턴을 인지하는 것부터 시작하세요</li>
                  <li>• 코치 추천 멘트를 소리 내어 여러 번 연습하세요</li>
                  <li>• 실제 상황에서는 자신만의 표현으로 자연스럽게 말하세요</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simplified footer */}
      <div className="flex flex-wrap gap-2 justify-center">
        <span className="caution-chip bg-sway-50 border-sway-300 text-sway-600">
          통화 대행 아님
        </span>
        <span className="caution-chip bg-cream-200 border-ink/20 text-ink/70">
          연습용
        </span>
      </div>
    </div>
  )
}
