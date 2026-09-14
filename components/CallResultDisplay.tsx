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
  '마음 흔들기': 'bg-sway-50 border-sway-300 text-sway-600',
  'FOMO·압박': 'bg-amber-50 border-amber-300 text-amber-700',
  '절차·질질': 'bg-blue-50 border-blue-300 text-blue-700',
}

const severityColors = {
  high: 'bg-sway-50 border-sway-300',
  medium: 'bg-amber-50 border-amber-300',
  low: 'bg-blue-50 border-blue-300',
}

const riskLevelBadge = {
  high: { bg: 'bg-sway-50', text: 'text-sway-600', border: 'border-sway-300', label: '높음' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', label: '중간' },
  low: { bg: 'bg-hold-50', text: 'text-hold-600', border: 'border-hold-300', label: '낮음' },
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
    <div className="space-y-4 animate-fadeIn">
      {/* 버팀률 Ring + Stats */}
      {result.analysis.pressureSegments.length > 0 && (
        <div className="paper-card p-6 bg-gradient-to-br from-hold-50 via-primary-50 to-hold-50 shadow-soft-lg">
          <div className="flex items-center gap-6">
            {/* 버팀률 Ring */}
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg className="w-24 h-24 transform -rotate-90 drop-shadow-md">
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  stroke="currentColor"
                  strokeWidth="7"
                  fill="none"
                  className="text-ink/10"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  stroke="url(#gradient-hold)"
                  strokeWidth="7"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 38}`}
                  strokeDashoffset={`${2 * Math.PI * 38 * (1 - heldRate / 100)}`}
                  className="transition-all duration-1000"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="gradient-hold" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-black text-hold">{heldRate}<span className="text-sm">%</span></div>
                </div>
              </div>
            </div>
            
            {/* Stats */}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black text-hold/80 mb-1.5 uppercase tracking-wider">
                버팀률
              </div>
              <div className="text-3xl font-black text-ink mb-2 tracking-tight">
                {heldCount}<span className="text-ink/60 text-xl font-bold">/{totalCount}</span> <span className="text-lg text-ink/50 font-semibold">구간</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {heldCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-hold-100 border border-hold-300 rounded-lg text-xs font-bold text-hold-700 shadow-soft">
                    <span>✅</span>
                    <span>버팀 {heldCount}</span>
                  </span>
                )}
                {totalCount > heldCount && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 border border-amber-300 rounded-lg text-xs font-bold text-amber-700 shadow-soft">
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
      <div className="paper-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-ink/50 mb-1 tracking-wide">분석 완료</div>
            <div className="text-lg font-bold text-ink">{result.metadata.organization}</div>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-medium border ${riskBadge.bg} ${riskBadge.text} ${riskBadge.border}`}>
            압박도: {riskBadge.label}
          </div>
        </div>
      </div>

      {/* Timeline + Transcript */}
      <div className="paper-card p-5">
        <div className="mb-4 pb-4 border-b border-ink/10">
          <h3 className="text-base font-bold text-ink flex items-center gap-2">
            통화 타임라인
            <span className="text-sm font-normal text-ink/50 ml-1">
              ({formatTime(result.duration)})
            </span>
          </h3>
          <p className="text-xs text-ink/60 mt-1">
            색상 박스는 압박 구간입니다
          </p>
        </div>

        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-2">
          {result.transcript.map((line, idx) => {
            const isPressure = isPressureSegment(line.startTime, line.endTime)
            const pressureSeg = getPressureSegmentForTime(line.startTime, line.endTime)
            const isUser = line.speaker === 'user'
            
            return (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border transition-all ${
                  isPressure
                    ? `${severityColors[pressureSeg?.severity as keyof typeof severityColors] || 'bg-sway-50 border-sway-300'} cursor-pointer hover:shadow-soft-md`
                    : 'bg-cream-100 border-ink/10'
                }`}
                onClick={() => isPressure && setSelectedSegment(isPressure ? idx : null)}
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base ${
                      isUser ? 'bg-ink/10' : 'bg-ink/5'
                    }`}>
                      {isUser ? '👤' : '📞'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-ink/60">
                        {isUser ? '나' : '상대방'}
                      </span>
                      <span className="text-xs text-ink/40">
                        {formatTime(line.startTime)}
                      </span>
                      {isPressure && pressureSeg && (
                        <>
                          <span className={`px-2 py-0.5 border rounded-full text-xs font-medium ${
                            patternLabelColors[pressureSeg.patternLabel as keyof typeof patternLabelColors] || 'bg-sway-50 border-sway-300 text-sway-600'
                          }`}>
                            {pressureSeg.patternLabel || '압박'}
                          </span>
                          {pressureSeg.held !== undefined && (
                            <span className={`px-2 py-0.5 border rounded-full text-xs font-medium ${
                              pressureSeg.held 
                                ? 'bg-hold-50 border-hold-300 text-hold-600' 
                                : 'bg-sway-50 border-sway-300 text-sway-600'
                            }`}>
                              {pressureSeg.held ? '버팀' : '흔들림'}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-sm text-ink leading-relaxed">
                      {line.text}
                    </p>
                    {isPressure && pressureSeg && selectedSegment === idx && (
                      <div className="mt-2.5 pt-2.5 border-t border-ink/10">
                        <p className="text-xs text-ink/70 leading-relaxed">
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

      {/* Pressure Segments Summary - Only show first one as callout */}
      {result.analysis.pressureSegments.length > 0 && (
        <div className="paper-card p-4 bg-sway-50">
          <h3 className="text-sm font-bold text-ink mb-3">
            압박 구간 요약
          </h3>
          <div className="bg-white rounded-xl p-3 border border-sway-200">
            <div className="flex items-center flex-wrap gap-2 mb-2">
              <span className="text-xs font-medium text-ink/60">
                {formatTime(result.analysis.pressureSegments[0].startTime)} - {formatTime(result.analysis.pressureSegments[0].endTime)}
              </span>
              <span className={`px-2 py-0.5 border rounded-full text-xs font-medium ${
                patternLabelColors[result.analysis.pressureSegments[0].patternLabel as keyof typeof patternLabelColors] || 'bg-sway-50 border-sway-300 text-sway-600'
              }`}>
                {result.analysis.pressureSegments[0].patternLabel || result.analysis.pressureSegments[0].type}
              </span>
              {result.analysis.pressureSegments[0].held !== undefined && (
                <span className={`px-2 py-0.5 border rounded-full text-xs font-medium ${
                  result.analysis.pressureSegments[0].held 
                    ? 'bg-hold-50 border-hold-300 text-hold-600' 
                    : 'bg-sway-50 border-sway-300 text-sway-600'
                }`}>
                  {result.analysis.pressureSegments[0].held ? '버팀' : '흔들림'}
                </span>
              )}
            </div>
            <p className="text-sm text-ink leading-relaxed">
              {result.analysis.pressureSegments[0].description}
            </p>
          </div>
          {result.analysis.pressureSegments.length > 1 && (
            <p className="text-xs text-ink/60 mt-2">
              + {result.analysis.pressureSegments.length - 1}개 구간 더 (타임라인 참고)
            </p>
          )}
        </div>
      )}

      {/* Feedback */}
      <div className="paper-card p-5">
        <h3 className="text-sm font-bold text-ink mb-4">
          대응 평가
        </h3>
        
        {result.analysis.feedback.positive.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-hold-600 mb-2 tracking-wide">
              잘한 점
            </div>
            <div className="space-y-1.5">
              {result.analysis.feedback.positive.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-hold-600 mt-0.5 text-xs">•</span>
                  <p className="text-sm text-ink/80 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.analysis.feedback.improvements.length > 0 && (
          <div className="pt-4 border-t border-ink/10">
            <div className="text-xs font-semibold text-ink/60 mb-2 tracking-wide">
              개선 제안
            </div>
            <div className="space-y-1.5">
              {result.analysis.feedback.improvements.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-ink/40 mt-0.5 text-xs">•</span>
                  <p className="text-sm text-ink/80 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Practice Scripts Section - Show only first one */}
      {result.analysis.practiceScripts && result.analysis.practiceScripts.length > 0 && (
        <div className="paper-card p-5 bg-hold-50">
          <div className="mb-3">
            <h4 className="text-sm font-bold text-ink mb-1">연습용 대응 멘트</h4>
            <p className="text-xs text-ink/60">
              비슷한 상황에서 이렇게 말해보세요
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-hold-200">
            <div className="mb-2.5">
              <div className="text-xs font-semibold text-ink/60 mb-1">상황</div>
              <p className="text-sm text-ink/80 leading-relaxed">{result.analysis.practiceScripts[0].whenKo}</p>
            </div>
            <div>
              <div className="text-xs font-semibold text-hold-600 mb-1">추천 응답</div>
              <p className="text-sm text-ink font-medium leading-relaxed">"{result.analysis.practiceScripts[0].sayKo}"</p>
            </div>
          </div>
        </div>
      )}

      {/* Coach Panel */}
      {result.analysis.practiceScripts && result.analysis.practiceScripts.length > 0 && (
        <CoachPanel practiceScripts={result.analysis.practiceScripts} coachTone={coachTone} />
      )}

      {/* Disclaimer */}
      <div className="paper-card p-4 bg-cream-100">
        <div className="flex items-start gap-2.5">
          <span className="text-lg flex-shrink-0">📌</span>
          <div>
            <div className="text-xs font-semibold text-ink/70 mb-1">면책 고지</div>
            <p className="text-xs text-ink/60 leading-relaxed">{result.disclaimer}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
