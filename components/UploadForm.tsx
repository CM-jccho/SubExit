'use client'

import { useState } from 'react'
import CallResultDisplay from './CallResultDisplay'

export type AnalysisResult = {
  // Call recording analysis result
  callType?: string
  duration?: number
  transcript?: {
    speaker: string
    text: string
    startTime: number
    endTime: number
    tags?: string[]
  }[]
  analysis?: {
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
  metadata?: {
    scenario: string
    organization: string
    callDate: string
    outcome: string
  }
  disclaimer: string
}

type ScenarioType = 'cancel' | 'sales' | 'romantic' | 'general' | 'salary'

export default function UploadForm() {
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>('sales')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDemoMode, setIsDemoMode] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      const validTypes = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-m4a']
      if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(mp3|m4a|wav)$/i)) {
        alert('MP3, M4A, WAV 파일만 업로드 가능합니다')
        return
      }
      setAudioFile(selectedFile)
      setResult(null)
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent, demoMode = false, demoScenario?: ScenarioType) => {
    e.preventDefault()
    
    if (!demoMode && !audioFile) {
      alert('통화 녹음 파일을 선택해주세요')
      return
    }

    setLoading(true)
    setError(null)
    setIsDemoMode(demoMode)

    try {
      let response: Response

      if (demoMode) {
        response = await fetch('/api/analyze-call?demo=1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ demo: true, scenario: demoScenario || selectedScenario }),
        })
      } else {
        const formData = new FormData()
        formData.append('audio', audioFile!)
        response = await fetch('/api/analyze-call', {
          method: 'POST',
          body: formData,
        })
      }

      if (!response.ok) {
        throw new Error('분석 중 오류가 발생했습니다')
      }

      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setAudioFile(null)
    setResult(null)
    setError(null)
    setIsDemoMode(false)
  }

  if (result) {
    return (
      <div className="animate-fadeIn">
        {isDemoMode && (
          <div className="mb-5 px-4 py-2.5 rounded-full bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 text-center backdrop-blur-xl">
            <span className="text-sm font-bold text-blue-300">📱 샘플 데모</span>
          </div>
        )}
        <CallResultDisplay result={result as any} />
        <button
          onClick={handleReset}
          className="mt-6 btn-secondary"
        >
          ← 다시 분석하기
        </button>
      </div>
    )
  }

  const scenarios = [
    { id: 'sales' as ScenarioType, label: '영업 전화 거절', emoji: '📞', primary: true },
    { id: 'salary' as ScenarioType, label: '연봉·조건 협상', emoji: '💰', primary: false },
    { id: 'cancel' as ScenarioType, label: '구독·후원 해지', emoji: '🚫', primary: false },
    { id: 'general' as ScenarioType, label: '부탁 거절', emoji: '🤝', primary: false },
    { id: 'romantic' as ScenarioType, label: '이별 통보', emoji: '💔', primary: false },
  ]

  return (
    <div className="glass-card p-6 sm:p-7">
      {/* Scenario Selection Chips */}
      <div className="mb-6">
        <label className="block text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">
          시나리오 선택 (데모용)
        </label>
        <div className="flex flex-wrap gap-2">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => setSelectedScenario(scenario.id)}
              className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                selectedScenario === scenario.id
                  ? 'bg-primary-500 text-white shadow-glow'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20 border border-white/20'
              }`}
            >
              <span className="mr-1.5">{scenario.emoji}</span>
              {scenario.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-slate-200 mb-3 tracking-wide">
            통화 녹음 파일 업로드
          </label>
          <label className="block cursor-pointer group">
            <div className="relative border-2 border-dashed border-white/20 hover:border-primary-500/50 rounded-3xl p-10 text-center transition-all duration-300 bg-white/5 hover:bg-white/10 backdrop-blur-xl group-hover:shadow-glow">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">🎙️</div>
              <div className="text-base font-bold text-white mb-2">
                {audioFile ? (
                  <span className="text-primary-400">
                    {audioFile.name}
                  </span>
                ) : (
                  '탭하여 녹음 파일 선택'
                )}
              </div>
              {!audioFile && (
                <p className="text-xs text-slate-500 mt-2">
                  MP3, M4A, WAV · 최대 25MB
                </p>
              )}
            </div>
            <input
              type="file"
              accept="audio/mpeg,audio/mp4,audio/wav,audio/x-m4a,.mp3,.m4a,.wav"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          
          {/* Upload Notice */}
          <div className="mt-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-300 leading-relaxed">
              ⚠️ 본인이 직접 녹음한 통화만 업로드하세요. 상대방 동의가 필요할 수 있습니다.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 backdrop-blur-xl">
            <p className="text-sm font-semibold text-rose-400">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !audioFile}
          className="btn-primary"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              분석 중...
            </span>
          ) : (
            '🎯 통화 분석 시작'
          )}
        </button>

        <button
          type="button"
          onClick={(e) => handleSubmit(e, true, selectedScenario)}
          disabled={loading}
          className="btn-demo"
        >
          {loading ? '분석 중...' : `✨ ${scenarios.find(s => s.id === selectedScenario)?.label} 샘플 체험`}
        </button>
      </form>

      {/* Info Footer */}
      <div className="mt-6 pt-5 border-t border-white/10">
        <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span>🔒</span>
            <span>녹음 미저장</span>
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-700"></span>
          <span className="flex items-center gap-1.5">
            <span>⚡</span>
            <span>압박 구간 탐지</span>
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-700"></span>
          <span className="flex items-center gap-1.5">
            <span>💬</span>
            <span>연습 멘트 제공</span>
          </span>
        </div>
      </div>
    </div>
  )
}
