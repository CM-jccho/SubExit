'use client'

import { useState } from 'react'
import CoachPanel from './CoachPanel'
import { CoachTone } from '@/lib/coach-tone'

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
      patternLabel?: string
      severity: string
      held?: boolean
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

const patternLabelColors = {
  '마음 흔들기': 'bg-coral-500/20 border-coral-500/40 text-coral-300',
  'FOMO·압박': 'bg-amber-500/20 border-amber-500/40 text-amber-300',
  '절차·질질': 'bg-blue-500/20 border-blue-500/40 text-blue-300',
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

export default function CallResultDisplay({ result, coachTone = 'firm_polite' }: { result: CallAnalysisResult; coachTone?: CoachTone }) {
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

  // Calculate 버팀률 (held rate)
  const heldCount = result.analysis.pressureSegments.filter(seg => seg.held !== false).length
  const totalCount = result.analysis.pressureSegments.length
  const heldRate = totalCount > 0 ? Math.round((heldCount / totalCount) * 100) : 0

  const riskBadge = riskLevelBadge[result.analysis.riskLevel as keyof typeof riskLevelBadge] || riskLevelBadge.medium

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* 버팀률 Ring + Stats */}
      {result.analysis.pressureSegments.length > 0 && (
        <div className="glass-card p-6 border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.08] via-cyan-500/[0.06] to-emerald-500/[0.04] shadow-soft-lg">
          <div className="flex items-center gap-6">
            {/* 버팀률 Ring */}
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg className="w-24 h-24 transform -rotate-90 drop-shadow-lg">
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  stroke="currentColor"
                  strokeWidth="7"
                  fill="none"
                  className="text-white/[0.08]"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  stroke="url(#gradient-emerald)"
                  strokeWidth="7"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 38}`}
                  strokeDashoffset={`${2 * Math.PI * 38 * (1 - heldRate / 100)}`}
                  className="transition-all duration-1000"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="gradient-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-black text-emerald-400">{heldRate}<span className="text-sm">%</span></div>
                </div>
              </div>
            </div>
            
            {/* Stats */}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black text-emerald-400/80 mb-1.5 uppercase tracking-wider">
                버팀률
              </div>
              <div className="text-3xl font-black text-white mb-2 tracking-tight">
                {heldCount}<span className="text-slate-400 text-xl font-bold">/{totalCount}</span> <span className="text-lg text-slate-500 font-semibold">구간</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {heldCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-xs font-bold text-emerald-300">
                    <span>✅</span>
                    <span>버팀 {heldCount}</span>
                  </span>
                )}
                {totalCount > heldCount && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded-lg text-xs font-bold text-amber-300">
                    <span>⚠️</span>
                    <span>흔들림 {totalCount - heldCount}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Badge */}
      <div className="glass-card p-5 border-primary-500/20 shadow-soft-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-black text-primary-400/80 mb-1.5 uppercase tracking-wider">분석 완료</div>
            <div className="text-2xl font-black text-white tracking-tight">{result.metadata.organization}</div>
          </div>
          <div className={`px-4 py-2 rounded-full text-sm font-bold border shadow-soft ${riskBadge.bg} ${riskBadge.text} ${riskBadge.border}`}>
            압박도 {riskBadge.label}
          </div>
        </div>
      </div>

      {/* Timeline + Transcript */}
      <div className="glass-card p-6 shadow-soft-lg">
        <div className="mb-5 pb-4 border-b border-white/[0.08]">
          <h3 className="section-header">
            <span className="text-2xl">🎙️</span>
            <span>통화 타임라인</span>
            <span className="text-sm font-semibold text-slate-400 ml-auto">
              {formatTime(result.duration)}
            </span>
          </h3>
          <p className="text-xs text-slate-400 font-semibold mt-2 flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-rose-500/30 border border-rose-500/50"></span>
            <span>색상 박스는 압박·죄책감 구간입니다</span>
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
                      {isPressure && pressureSeg && (
                        <>
                          <span className={`px-2 py-0.5 border rounded-full text-xs font-bold ${
                            patternLabelColors[pressureSeg.patternLabel as keyof typeof patternLabelColors] || 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                          }`}>
                            {pressureSeg.patternLabel || '압박'}
                          </span>
                          {pressureSeg.held !== undefined && (
                            <span className={`px-2 py-0.5 border rounded-full text-xs font-bold ${
                              pressureSeg.held 
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                                : 'bg-coral-500/20 border-coral-500/40 text-coral-300'
                            }`}>
                              {pressureSeg.held ? '✅ 버팀' : '⚠️ 흔들림'}
                            </span>
                          )}
                        </>
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
        <div className="glass-card p-6 border-rose-500/20 shadow-soft-lg">
          <h3 className="section-header">
            <span className="text-xl">⚠️</span>
            <span>압박 구간 요약</span>
          </h3>
          <div className="space-y-3">
            {result.analysis.pressureSegments.map((seg, idx) => (
              <div key={idx} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="flex items-center flex-wrap gap-2 mb-2">
                  <span className="text-xs font-bold text-slate-400">
                    {formatTime(seg.startTime)} - {formatTime(seg.endTime)}
                  </span>
                  <span className={`px-2 py-0.5 border rounded-full text-xs font-bold ${
                    patternLabelColors[seg.patternLabel as keyof typeof patternLabelColors] || 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                  }`}>
                    {seg.patternLabel || seg.type}
                  </span>
                  {seg.held !== undefined && (
                    <span className={`px-2 py-0.5 border rounded-full text-xs font-bold ${
                      seg.held 
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                        : 'bg-coral-500/20 border-coral-500/40 text-coral-300'
                    }`}>
                      {seg.held ? '✅ 버팀' : '⚠️ 흔들림'}
                    </span>
                  )}
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
      <div className="glass-card p-6 shadow-soft-lg">
        <h3 className="section-header">
          <span className="text-xl">📊</span>
          <span>대응 평가</span>
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
        <div className="glass-card p-6 border-primary-500/20 shadow-soft-lg">
          <div className="space-y-4">
            <div className="flex items-start gap-3 pb-4 border-b border-white/[0.08]">
              <span className="text-2xl">💬</span>
              <div className="flex-1">
                <h4 className="text-base font-black text-white mb-2 tracking-tight">연습용 대응 멘트</h4>
                <p className="text-xs text-slate-400 font-semibold">
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
        <CoachPanel practiceScripts={result.analysis.practiceScripts} coachTone={coachTone} />
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
