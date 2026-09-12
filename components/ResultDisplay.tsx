'use client'

import { useState } from 'react'
import { AnalysisResult } from './UploadForm'

const channelLabels = {
  web: '웹',
  app_store: 'App Store',
  google_play: 'Play',
  merchant: '가맹점',
  unknown: '확인 필요',
}

const confidenceColors = {
  high: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
}

const tagStyles = {
  dark_pattern: { 
    bg: 'bg-rose-500/10', 
    text: 'text-rose-400', 
    border: 'border-rose-500/30', 
    icon: '🚨',
    glow: 'hover:shadow-[0_0_20px_rgba(244,63,94,0.3)]'
  },
  cancel_ne_refund: { 
    bg: 'bg-blue-500/10', 
    text: 'text-blue-400', 
    border: 'border-blue-500/30', 
    icon: '💰',
    glow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]'
  },
  next_renewal: { 
    bg: 'bg-amber-500/10', 
    text: 'text-amber-400', 
    border: 'border-amber-500/30', 
    icon: '📅',
    glow: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]'
  },
  other_caution: { 
    bg: 'bg-violet-500/10', 
    text: 'text-violet-400', 
    border: 'border-violet-500/30', 
    icon: '⚠️',
    glow: 'hover:shadow-[0_0_20px_rgba(139,92,246,0.3)]'
  },
}

export default function ResultDisplay({ result }: { result: AnalysisResult }) {
  const [selectedChannelIndex, setSelectedChannelIndex] = useState(0)
  const isMultiChannel = result.multiChannel && result.channels

  if (isMultiChannel && result.channels) {
    const selectedChannel = result.channels[selectedChannelIndex]

    return (
      <div className="space-y-5 animate-fadeIn">
        {/* Service Badge */}
        {result.service && (
          <div className="glass-card p-5 border-primary-500/30">
            <div className="text-center">
              <div className="text-xs font-bold text-primary-400 mb-2 uppercase tracking-wider">인식 완료</div>
              <div className="text-2xl font-black text-gradient-primary">{result.service.nameKo}</div>
            </div>
          </div>
        )}

        {/* Multi Channel Notice */}
        <div className="glass-card p-5 border-amber-500/20">
          <div className="flex items-start gap-3">
            <span className="text-3xl">💡</span>
            <div>
              <div className="text-sm font-bold text-amber-400 mb-1">여러 결제 경로</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                결제한 채널을 선택하세요
              </p>
            </div>
          </div>
        </div>

        {/* Channel Segmented Control */}
        <div className="segmented-control">
          {result.channels.map((ch, idx) => {
            const isSelected = idx === selectedChannelIndex
            const icon = idx === 0 ? '🌐' : idx === 1 ? '🍎' : '🤖'
            return (
              <button
                key={idx}
                onClick={() => setSelectedChannelIndex(idx)}
                className={`segment-button ${isSelected ? 'segment-button-active' : ''}`}
              >
                <div className="text-xl mb-1">{icon}</div>
                <div className="text-xs font-bold truncate">
                  {channelLabels[ch.channel.type]}
                </div>
              </button>
            )
          })}
        </div>

        {/* Selected Channel Content */}
        <div className="glass-card p-6">
          {/* Channel Info Header */}
          <div className="mb-6 pb-5 border-b border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-white">
                {selectedChannel.channelLabel}
              </h3>
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-xl ${confidenceColors[selectedChannel.channel.confidence]}`}>
                {selectedChannel.channel.confidence === 'high' ? '높음' : selectedChannel.channel.confidence === 'medium' ? '중간' : '낮음'}
              </span>
            </div>
            {selectedChannel.channel.evidence.length > 0 && (
              <div className="space-y-1.5">
                {selectedChannel.channel.evidence.map((ev, i) => (
                  <p key={i} className="text-xs text-slate-400 leading-relaxed flex items-start gap-2">
                    <span className="text-primary-400 mt-0.5">▸</span>
                    <span>{ev}</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Steps Timeline */}
          <div className="space-y-5 mb-6">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-xl">📋</span>
              해지 단계
            </h4>
            {selectedChannel.steps.map((step, i) => (
              <div key={i} className="flex gap-4">
                <div className="step-number">{step.order}</div>
                <div className="flex-1 pt-1">
                  <h5 className="text-sm font-bold text-white mb-2">{step.title}</h5>
                  <p className="text-xs text-slate-400 leading-relaxed">{step.detailKo}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Caution Tags */}
          {selectedChannel.tags.length > 0 && (
            <div className="space-y-3 pt-5 border-t border-white/10">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                주의사항
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedChannel.tags.map((tag, i) => {
                  const style = tagStyles[tag.kind]
                  return (
                    <div
                      key={i}
                      className={`caution-chip ${style.bg} ${style.text} ${style.border} ${style.glow}`}
                    >
                      <span className="text-base">{style.icon}</span>
                      <span>{tag.labelKo}</span>
                    </div>
                  )
                })}
              </div>
              {selectedChannel.tags.some(t => t.evidence) && (
                <div className="mt-3 space-y-2">
                  {selectedChannel.tags.filter(t => t.evidence).map((tag, i) => (
                    <p key={i} className="text-xs text-slate-500 leading-relaxed">
                      • {tag.evidence}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Practice Scripts Section */}
        {selectedChannel.practiceScripts && selectedChannel.practiceScripts.length > 0 && (
          <div className="glass-card p-6 border-amber-500/30">
            <div className="space-y-4">
              <div className="flex items-start gap-3 pb-4 border-b border-white/10">
                <span className="text-2xl">💬</span>
                <div className="flex-1">
                  <h4 className="text-base font-bold text-white mb-2">연습용 해지 멘트 (본인이 말하세요)</h4>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-xs font-bold text-amber-400 backdrop-blur-xl">
                      <span>⚠️</span>
                      <span>연습용</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 rounded-full text-xs font-bold text-rose-400 backdrop-blur-xl">
                      <span>🚫</span>
                      <span>통화 대행 아님</span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                {selectedChannel.practiceScripts.map((script, i) => (
                  <div key={i} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                    <div className="mb-3">
                      <div className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">상황</div>
                      <p className="text-sm text-slate-300 leading-relaxed">{script.whenKo}</p>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-primary-400 mb-1 uppercase tracking-wider">응답 예시</div>
                      <p className="text-sm text-white font-medium leading-relaxed">"{script.sayKo}"</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed pt-3 border-t border-white/10">
                💡 위 멘트는 참고용입니다. 실제 상황에 맞게 조정하여 본인이 직접 말씀하세요.
              </p>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="glass-card p-5 border-slate-700">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">📌</span>
            <div>
              <div className="text-xs font-bold text-slate-300 mb-2">면책 고지</div>
              <p className="text-xs text-slate-500 leading-relaxed">{result.disclaimer}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Single Channel
  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Service Badge */}
      {result.service && (
        <div className="glass-card p-5 border-primary-500/30">
          <div className="text-center">
            <div className="text-xs font-bold text-primary-400 mb-2 uppercase tracking-wider">
              {result.service.matched ? '인식 완료' : '검색 완료'}
            </div>
            <div className="text-2xl font-black text-gradient-primary">{result.service.nameKo}</div>
          </div>
        </div>
      )}

      {/* Channel Info */}
      {result.channel && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">결제 채널</div>
              <div className="text-xl font-bold text-white">
                {channelLabels[result.channel.type]}
              </div>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur-xl ${confidenceColors[result.channel.confidence]}`}>
              {result.channel.confidence === 'high' ? '높음' : result.channel.confidence === 'medium' ? '중간' : '낮음'}
            </span>
          </div>
          {result.channel.evidence.length > 0 && (
            <div className="space-y-1.5 pt-4 border-t border-white/10">
              {result.channel.evidence.map((ev, i) => (
                <p key={i} className="text-xs text-slate-400 leading-relaxed flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">▸</span>
                  <span>{ev}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Steps */}
      {result.steps && result.steps.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
            <span className="text-xl">📋</span>
            해지 단계
          </h3>
          <div className="space-y-5">
            {result.steps.map((step, i) => (
              <div key={i} className="flex gap-4">
                <div className="step-number">{step.order}</div>
                <div className="flex-1 pt-1">
                  <h4 className="text-sm font-bold text-white mb-2">{step.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{step.detailKo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {result.tags && result.tags.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            주의사항
          </h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {result.tags.map((tag, i) => {
              const style = tagStyles[tag.kind]
              return (
                <div
                  key={i}
                  className={`caution-chip ${style.bg} ${style.text} ${style.border} ${style.glow}`}
                >
                  <span className="text-base">{style.icon}</span>
                  <span>{tag.labelKo}</span>
                </div>
              )
            })}
          </div>
          {result.tags.some(t => t.evidence) && (
            <div className="space-y-2 pt-4 border-t border-white/10">
              {result.tags.filter(t => t.evidence).map((tag, i) => (
                <p key={i} className="text-xs text-slate-500 leading-relaxed">
                  • {tag.evidence}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Practice Scripts Section */}
      {result.practiceScripts && result.practiceScripts.length > 0 && (
        <div className="glass-card p-6 border-amber-500/30">
          <div className="space-y-4">
            <div className="flex items-start gap-3 pb-4 border-b border-white/10">
              <span className="text-2xl">💬</span>
              <div className="flex-1">
                <h4 className="text-base font-bold text-white mb-2">연습용 해지 멘트 (본인이 말하세요)</h4>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-xs font-bold text-amber-400 backdrop-blur-xl">
                    <span>⚠️</span>
                    <span>연습용</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 rounded-full text-xs font-bold text-rose-400 backdrop-blur-xl">
                    <span>🚫</span>
                    <span>통화 대행 아님</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {result.practiceScripts.map((script, i) => (
                <div key={i} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <div className="mb-3">
                    <div className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">상황</div>
                    <p className="text-sm text-slate-300 leading-relaxed">{script.whenKo}</p>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-primary-400 mb-1 uppercase tracking-wider">응답 예시</div>
                    <p className="text-sm text-white font-medium leading-relaxed">"{script.sayKo}"</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed pt-3 border-t border-white/10">
              💡 위 멘트는 참고용입니다. 실제 상황에 맞게 조정하여 본인이 직접 말씀하세요.
            </p>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="glass-card p-5 border-slate-700">
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">📌</span>
          <div>
            <div className="text-xs font-bold text-slate-300 mb-2">면책 고지</div>
            <p className="text-xs text-slate-500 leading-relaxed">{result.disclaimer}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
