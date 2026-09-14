'use client'

import { useState } from 'react'
import CoachPanel from './CoachPanel'

type CallAnalysisResult = {
  callType: string
  duration: number
  transcript: {
    speaker: string
    text: string
    startTime: number
    endTime: number
    tags?: string[]
  }[]
  analysis: {
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
  metadata: {
    scenario: string
    organization: string
    callDate: string
    outcome: string
  }
  disclaimer: string
}

const severityColors = {
  high: 'bg-rose-500/20 border-rose-500/40',
  medium: 'bg-amber-500/20 border-amber-500/40',
  low: 'bg-blue-500/20 border-blue-500/40',
}

const riskLevelBadge = {
  high: { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30', label: '높음' },
  medium: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', label: '중간' },
  low: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', label: '낮음' },
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function CallResultDisplay({ result }: { result: CallAnalysisResult }) {
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null)

  const isPressureSegment = (startTime: number, endTime: number) => {
    return result.analysis.pressureSegments.some(
      seg => seg.startTime <= startTime && seg.endTime >= endTime
    )
  }

  const getPressureSegmentForTime = (startTime: number, endTime: number) => {
    return result.analysis.pressureSegments.find(
      seg => seg.startTime <= startTime && seg.endTime >= endTime
    )
  }

  const riskBadge = riskLevelBadge[result.analysis.riskLevel as keyof typeof riskLevelBadge] || riskLevelBadge.medium

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Pressure Survived Stamp - Light Gamification */}
      {result.analysis.pressureSegments.length > 0 && (
        <div className="glass-card p-4 border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10">
          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl">🛡️</span>
            <div className="text-center">
              <div className="text-sm font-bold text-emerald-400 mb-1">
                오늘 버틴 압박 구간
              </div>
              <div className="text-2xl font-black text-white">
                {result.analysis.pressureSegments.length}개
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Badge */}
      <div className="glass-card p-5 border-primary-500/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-primary-400 mb-1 uppercase tracking-wider">분석 완료</div>
            <div className="text-xl font-bold text-white">{result.metadata.organization}</div>
          </div>
          <div className={`px-4 py-2 rounded-full text-sm font-bold border ${riskBadge.bg} ${riskBadge.text} ${riskBadge.border}`}>
            압박도: {riskBadge.label}
          </div>
        </div>
      </div>

      {/* Timeline + Transcript */}
      <div className="glass-card p-6">
        <div className="mb-5 pb-4 border-b border-white/10">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🎙️</span>
            통화 타임라인
            <span className="text-sm font-normal text-slate-400 ml-2">
              ({formatTime(result.duration)})
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-2">
            🔴 빨간 박스는 압박·죄책감 구간입니다
          </p>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          {result.transcript.map((line, idx) => {
            const isPressure = isPressureSegment(line.startTime, line.endTime)
            const pressureSeg = getPressureSegmentForTime(line.startTime, line.endTime)
            const isUser = line.speaker === 'user'
            
            return (
              <div
                key={idx}
                className={`p-4 rounded-2xl border-2 transition-all ${
                  isPressure
                    ? `${severityColors[pressureSeg?.severity as keyof typeof severityColors] || 'bg-rose-500/20 border-rose-500/40'} cursor-pointer hover:scale-[1.02]`
                    : 'bg-white/5 border-white/10'
                }`}
                onClick={() => isPressure && setSelectedSegment(isPressure ? idx : null)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                      isUser ? 'bg-primary-500/20' : 'bg-slate-500/20'
                    }`}>
                      {isUser ? '👤' : '📞'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase">
                        {isUser ? '나' : '상대방'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatTime(line.startTime)}
                      </span>
                      {isPressure && (
                        <span className="px-2 py-0.5 bg-rose-500/30 border border-rose-500/50 rounded-full text-xs font-bold text-rose-300">
                          ⚠️ 압박
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white leading-relaxed">
                      {line.text}
                    </p>
                    {isPressure && pressureSeg && selectedSegment === idx && (
                      <div className="mt-3 pt-3 border-t border-white/20">
                        <p className="text-xs text-amber-300 leading-relaxed">
                          💡 {pressureSeg.description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pressure Segments Summary */}
      {result.analysis.pressureSegments.length > 0 && (
        <div className="glass-card p-6 border-rose-500/30">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            압박 구간 요약
          </h3>
          <div className="space-y-3">
            {result.analysis.pressureSegments.map((seg, idx) => (
              <div key={idx} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-slate-400">
                    {formatTime(seg.startTime)} - {formatTime(seg.endTime)}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    seg.severity === 'high' ? 'bg-rose-500/20 text-rose-400' :
                    seg.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {seg.type}
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {seg.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback */}
      <div className="glass-card p-6">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-xl">📊</span>
          대응 평가
        </h3>
        
        {result.analysis.feedback.positive.length > 0 && (
          <div className="mb-5">
            <div className="text-xs font-bold text-emerald-400 mb-3 uppercase tracking-wider">
              ✅ 잘한 점
            </div>
            <div className="space-y-2">
              {result.analysis.feedback.positive.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">▸</span>
                  <p className="text-sm text-slate-300 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.analysis.feedback.improvements.length > 0 && (
          <div className="pt-4 border-t border-white/10">
            <div className="text-xs font-bold text-amber-400 mb-3 uppercase tracking-wider">
              💡 개선 제안
            </div>
            <div className="space-y-2">
              {result.analysis.feedback.improvements.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-amber-400 mt-1">▸</span>
                  <p className="text-sm text-slate-300 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Practice Scripts Section */}
      {result.analysis.practiceScripts && result.analysis.practiceScripts.length > 0 && (
        <div className="glass-card p-6 border-primary-500/30">
          <div className="space-y-4">
            <div className="flex items-start gap-3 pb-4 border-b border-white/10">
              <span className="text-2xl">💬</span>
              <div className="flex-1">
                <h4 className="text-base font-bold text-white mb-2">연습용 대응 멘트</h4>
                <p className="text-xs text-slate-400">
                  비슷한 상황에서 이렇게 말해보세요
                </p>
              </div>
            </div>
            <div className="space-y-4">
              {result.analysis.practiceScripts.map((script, i) => (
                <div key={i} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <div className="mb-3">
                    <div className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">상황</div>
                    <p className="text-sm text-slate-300 leading-relaxed">{script.whenKo}</p>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-primary-400 mb-1 uppercase tracking-wider">추천 응답</div>
                    <p className="text-sm text-white font-medium leading-relaxed">"{script.sayKo}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Coach Panel */}
      {result.analysis.practiceScripts && result.analysis.practiceScripts.length > 0 && (
        <CoachPanel practiceScripts={result.analysis.practiceScripts} />
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
