'use client'

import { useState } from 'react'
import { AnalysisResult } from './UploadForm'

const channelLabels = {
  web: '웹사이트',
  app_store: 'App Store',
  google_play: 'Google Play',
  merchant: '가맹점',
  unknown: '확인 필요',
}

const confidenceLabels = {
  high: '높음',
  medium: '중간',
  low: '낮음',
}

const confidenceColors = {
  high: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-rose-100 text-rose-800 border-rose-200',
}

const tagStyles = {
  dark_pattern: { bg: 'bg-amber-50', text: 'text-amber-900', border: 'border-amber-200', icon: '🚨' },
  cancel_ne_refund: { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-200', icon: '💰' },
  next_renewal: { bg: 'bg-emerald-50', text: 'text-emerald-900', border: 'border-emerald-200', icon: '📅' },
  other_caution: { bg: 'bg-rose-50', text: 'text-rose-900', border: 'border-rose-200', icon: '⚠️' },
}

export default function ResultDisplay({ result }: { result: AnalysisResult }) {
  const [selectedChannelIndex, setSelectedChannelIndex] = useState(0)
  const isMultiChannel = result.multiChannel && result.channels

  if (isMultiChannel && result.channels) {
    const selectedChannel = result.channels[selectedChannelIndex]

    return (
      <div className="space-y-4">
        {/* Service Name */}
        {result.service && (
          <div className="card bg-gradient-to-r from-primary-50 to-blue-50 border-2 border-primary-200">
            <div className="text-center">
              <div className="text-sm text-primary-600 font-semibold mb-1">인식된 서비스</div>
              <div className="text-lg font-bold text-primary-900">{result.service.nameKo}</div>
            </div>
          </div>
        )}

        {/* Multi Channel Info */}
        <div className="card bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">💡</span>
            <div>
              <div className="text-sm font-bold text-amber-900 mb-1">여러 결제 경로</div>
              <p className="text-xs text-amber-800 leading-relaxed">
                결제한 채널에 맞는 경로를 선택하세요
              </p>
            </div>
          </div>
        </div>

        {/* Channel Selector */}
        <div className="card">
          <div className="grid grid-cols-3 gap-2 mb-4">
            {result.channels.map((ch, idx) => {
              const isSelected = idx === selectedChannelIndex
              const icon = idx === 0 ? '🌐' : idx === 1 ? '🍎' : '🤖'
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedChannelIndex(idx)}
                  className={`py-3 px-2 rounded-xl text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <div className="text-lg mb-1">{icon}</div>
                  <div className="truncate">
                    {channelLabels[ch.channel.type]}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Channel Info */}
          <div className="p-4 rounded-2xl bg-slate-50 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-700">
                {selectedChannel.channelLabel}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${confidenceColors[selectedChannel.channel.confidence]}`}>
                신뢰도 {confidenceLabels[selectedChannel.channel.confidence]}
              </span>
            </div>
            {selectedChannel.channel.evidence.length > 0 && (
              <div className="mt-3 space-y-1">
                {selectedChannel.channel.evidence.map((ev, i) => (
                  <p key={i} className="text-xs text-slate-600 leading-relaxed">• {ev}</p>
                ))}
              </div>
            )}
          </div>

          {/* Steps */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-900">📋 해지 단계</h3>
            {selectedChannel.steps.map((step, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold">
                  {step.order}
                </div>
                <div className="flex-1 pt-0.5">
                  <h4 className="text-sm font-bold text-slate-900 mb-1">{step.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{step.detailKo}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tags */}
          {selectedChannel.tags.length > 0 && (
            <div className="mt-6 space-y-2">
              <h3 className="text-base font-bold text-slate-900">⚠️ 주의사항</h3>
              {selectedChannel.tags.map((tag, i) => {
                const style = tagStyles[tag.kind]
                return (
                  <div key={i} className={`p-3 rounded-xl border-2 ${style.bg} ${style.border}`}>
                    <div className="flex items-start gap-2">
                      <span className="text-lg flex-shrink-0">{style.icon}</span>
                      <div className="flex-1">
                        <div className={`text-xs font-bold ${style.text} mb-1`}>{tag.labelKo}</div>
                        {tag.evidence && (
                          <p className={`text-xs ${style.text} opacity-80 leading-relaxed`}>{tag.evidence}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="card bg-slate-50 border-2 border-slate-200">
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0">📌</span>
            <div>
              <div className="text-xs font-bold text-slate-700 mb-2">면책 고지</div>
              <p className="text-xs text-slate-600 leading-relaxed">{result.disclaimer}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Single Channel
  return (
    <div className="space-y-4">
      {/* Service Name */}
      {result.service && (
        <div className="card bg-gradient-to-r from-primary-50 to-blue-50 border-2 border-primary-200">
          <div className="text-center">
            <div className="text-sm text-primary-600 font-semibold mb-1">
              {result.service.matched ? '인식된 서비스' : '검색된 서비스'}
            </div>
            <div className="text-lg font-bold text-primary-900">{result.service.nameKo}</div>
          </div>
        </div>
      )}

      {/* Channel */}
      {result.channel && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs text-slate-500 font-semibold mb-1">결제 채널</div>
              <div className="text-lg font-bold text-slate-900">
                {channelLabels[result.channel.type]}
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${confidenceColors[result.channel.confidence]}`}>
              {confidenceLabels[result.channel.confidence]}
            </span>
          </div>
          {result.channel.evidence.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-50 space-y-1">
              {result.channel.evidence.map((ev, i) => (
                <p key={i} className="text-xs text-slate-600 leading-relaxed">• {ev}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Steps */}
      {result.steps && result.steps.length > 0 && (
        <div className="card">
          <h3 className="text-base font-bold text-slate-900 mb-4">📋 해지 단계</h3>
          <div className="space-y-3">
            {result.steps.map((step, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold">
                  {step.order}
                </div>
                <div className="flex-1 pt-0.5">
                  <h4 className="text-sm font-bold text-slate-900 mb-1">{step.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{step.detailKo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {result.tags && result.tags.length > 0 && (
        <div className="card">
          <h3 className="text-base font-bold text-slate-900 mb-3">⚠️ 주의사항</h3>
          <div className="space-y-2">
            {result.tags.map((tag, i) => {
              const style = tagStyles[tag.kind]
              return (
                <div key={i} className={`p-3 rounded-xl border-2 ${style.bg} ${style.border}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">{style.icon}</span>
                    <div className="flex-1">
                      <div className={`text-xs font-bold ${style.text} mb-1`}>{tag.labelKo}</div>
                      {tag.evidence && (
                        <p className={`text-xs ${style.text} opacity-80 leading-relaxed`}>{tag.evidence}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="card bg-slate-50 border-2 border-slate-200">
        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0">📌</span>
          <div>
            <div className="text-xs font-bold text-slate-700 mb-2">면책 고지</div>
            <p className="text-xs text-slate-600 leading-relaxed">{result.disclaimer}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
