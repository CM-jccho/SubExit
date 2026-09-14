'use client'

import { useState, useEffect } from 'react'
import CallResultDisplay from './CallResultDisplay'
import { CoachTone, coachToneLabels, loadCoachTone, saveCoachTone } from '@/lib/coach-tone'
import PracticeTab from './PracticeTab'

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

type ScenarioType = 'cancel' | 'sales' | 'romantic' | 'general' | 'salary' | 'parent' | 'formal'

export default function UploadForm() {
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>('sales')
  const [coachTone, setCoachTone] = useState<CoachTone>('firm_polite')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [activeTab, setActiveTab] = useState<'analysis' | 'practice'>('analysis')

  useEffect(() => {
    setCoachTone(loadCoachTone())
  }, [])

  const handleToneChange = (tone: CoachTone) => {
    setCoachTone(tone)
    saveCoachTone(tone)
  }

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
          body: JSON.stringify({ demo: true, scenario: demoScenario || selectedScenario, coachTone }),
        })
      } else {
        const formData = new FormData()
        formData.append('audio', audioFile!)
        formData.append('coachTone', coachTone)
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
    setActiveTab('analysis')
  }

  if (result) {
    return (
      <div className="animate-fadeIn">
        {isDemoMode && (
          <div className="mb-5 px-4 py-2.5 rounded-full bg-gradient-to-r from-indigo-600/20 to-cyan-600/20 border border-indigo-500/30 text-center backdrop-blur-xl shadow-soft">
            <span className="text-sm font-bold text-indigo-300">📱 샘플 데모</span>
          </div>
        )}
        
        {/* Tab Navigation */}
        <div className="mb-5 glass-card p-1.5 flex gap-1.5 shadow-soft-lg">
          <button
            onClick={() => setActiveTab('analysis')}
            className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
              activeTab === 'analysis'
                ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-soft-lg'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            🎧 통화 녹음 분석
          </button>
          <button
            onClick={() => setActiveTab('practice')}
            className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
              activeTab === 'practice'
                ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-soft-lg'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            🎭 실전 연습
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'analysis' ? (
          <CallResultDisplay result={result as any} coachTone={coachTone} />
        ) : (
          <PracticeTab />
        )}

        <button
          onClick={handleReset}
          className="mt-6 btn-secondary"
        >
          ← 다시 분석하기
        </button>
      </div>
    )
  }

  // MUST only: sales★ primary
  const scenarios = [
    { id: 'sales' as ScenarioType, label: '영업 전화 거절', emoji: '📞', primary: true, featured: true },
    { id: 'salary' as ScenarioType, label: '연봉·조건 협상', emoji: '💰', primary: false, featured: false },
  ]
  
  // Secondary/expansion (available, not hero)
  // cancel, parent, formal, general, romantic
  
  // Soft-Go scenarios (hidden, available via API)
  // parent, formal, general, romantic

  return (
    <div className="glass-card p-6 sm:p-7 shadow-soft-lg">
      {/* Coach Tone Selection */}
      <div className="mb-6">
        <label className="block text-xs font-black text-emerald-400/80 mb-3 uppercase tracking-wider">
          코치 톤 선택
        </label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(coachToneLabels) as CoachTone[]).map((tone) => (
            <button
              key={tone}
              type="button"
              onClick={() => handleToneChange(tone)}
              className={`px-4 py-2.5 rounded-full text-sm font-bold transition-all duration-200 ${
                coachTone === tone
                  ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-soft-lg border border-emerald-400/30'
                  : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] border border-white/[0.12] shadow-soft'
              }`}
            >
              {coachToneLabels[tone]}
            </button>
          ))}
        </div>
      </div>

      {/* Scenario Selection Chips */}
      <div className="mb-6">
        <label className="block text-xs font-black text-slate-400/80 mb-3 uppercase tracking-wider">
          시나리오 선택 (데모용)
        </label>
        <div className="flex flex-wrap gap-2">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => setSelectedScenario(scenario.id)}
              className={`px-4 py-2.5 rounded-full text-sm font-bold transition-all duration-200 ${
                selectedScenario === scenario.id
                  ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-soft-lg border border-primary-400/30'
                  : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] border border-white/[0.12] shadow-soft'
              }`}
            >
              <span className="mr-1.5">{scenario.emoji}</span>
              {scenario.label}
              {scenario.featured && <span className="ml-1.5 text-amber-300">★</span>}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-5">
        <div>
          <label className="block text-sm font-black text-slate-200 mb-3 tracking-tight">
            통화 녹음 파일 업로드
          </label>
          <label className="block cursor-pointer group">
            <div className="relative border-2 border-dashed border-white/[0.12] hover:border-primary-500/40 rounded-3xl p-10 text-center transition-all duration-300 bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-xl group-hover:shadow-soft-lg">
              <div className="text-6xl mb-4 group-hover:scale-105 transition-transform">🎙️</div>
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
                <p className="text-xs text-slate-500 font-semibold mt-2">
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
          <div className="mt-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-soft">
            <p className="text-xs text-amber-300 font-semibold leading-relaxed">
              ⚠️ 본인이 직접 녹음한 통화만 업로드하세요. 상대방 동의가 필요할 수 있습니다.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 backdrop-blur-xl shadow-soft">
            <p className="text-sm font-bold text-rose-300">{error}</p>
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
      <div className="mt-6 pt-5 border-t border-white/[0.08]">
        <div className="flex items-center justify-center gap-4 text-xs text-slate-500 font-semibold">
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
