'use client'

import { useState } from 'react'
import ResultDisplay from './ResultDisplay'

export type AnalysisResult = {
  service?: {
    nameKo: string
    nameAliases?: string[]
    matched: boolean
  }
  multiChannel?: boolean
  channels?: {
    channel: {
      type: 'web' | 'app_store' | 'google_play' | 'merchant' | 'unknown'
      confidence: 'high' | 'medium' | 'low'
      evidence: string[]
    }
    channelLabel: string
    steps: {
      order: number
      title: string
      detailKo: string
    }[]
    tags: {
      kind: 'dark_pattern' | 'cancel_ne_refund' | 'next_renewal' | 'other_caution'
      labelKo: string
      evidence?: string
    }[]
  }[]
  channel?: {
    type: 'web' | 'app_store' | 'google_play' | 'merchant' | 'unknown'
    confidence: 'high' | 'medium' | 'low'
    evidence: string[]
  }
  steps?: {
    order: number
    title: string
    detailKo: string
  }[]
  tags?: {
    kind: 'dark_pattern' | 'cancel_ne_refund' | 'next_renewal' | 'other_caution'
    labelKo: string
    evidence?: string
  }[]
  disclaimer: string
}

export default function UploadForm() {
  const [inputMode, setInputMode] = useState<'image' | 'brand'>('image')
  const [files, setFiles] = useState<File[]>([])
  const [brandQuery, setBrandQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDemoMode, setIsDemoMode] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length > 3) {
      alert('최대 3개 파일까지 업로드 가능합니다')
      return
    }
    setFiles(selectedFiles)
    setResult(null)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent, demoMode = false, demoScenario?: string) => {
    e.preventDefault()
    
    if (!demoMode) {
      if (inputMode === 'image' && files.length === 0) {
        alert('이미지를 선택해주세요')
        return
      }
      if (inputMode === 'brand' && brandQuery.trim() === '') {
        alert('서비스명을 입력해주세요')
        return
      }
    }

    setLoading(true)
    setError(null)
    setIsDemoMode(demoMode)

    try {
      let response: Response

      if (demoMode) {
        response = await fetch('/api/analyze?demo=1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ demo: true, scenario: demoScenario }),
        })
      } else if (inputMode === 'brand') {
        response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: brandQuery, mode: 'brand' }),
        })
      } else {
        const formData = new FormData()
        files.forEach((file) => {
          formData.append('files', file)
        })
        response = await fetch('/api/analyze', {
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
    setFiles([])
    setBrandQuery('')
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
        <ResultDisplay result={result} />
        <button
          onClick={handleReset}
          className="mt-6 btn-secondary"
        >
          ← 다시 분석하기
        </button>
      </div>
    )
  }

  return (
    <div className="glass-card p-6 sm:p-7">
      {/* iOS-style Segmented Control */}
      <div className="segmented-control mb-6">
        <button
          type="button"
          onClick={() => setInputMode('image')}
          className={`segment-button ${inputMode === 'image' ? 'segment-button-active' : ''}`}
        >
          <span className="text-lg mr-1.5">📸</span>
          스크린샷
        </button>
        <button
          type="button"
          onClick={() => setInputMode('brand')}
          className={`segment-button ${inputMode === 'brand' ? 'segment-button-active' : ''}`}
        >
          <span className="text-lg mr-1.5">🔍</span>
          서비스명
        </button>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-5">
        {inputMode === 'image' ? (
          <div>
            <label className="block text-sm font-bold text-slate-200 mb-3 tracking-wide">
              구독 화면 캡처 (1-3개)
            </label>
            <label className="block cursor-pointer group">
              <div className="relative border-2 border-dashed border-white/20 hover:border-primary-500/50 rounded-3xl p-10 text-center transition-all duration-300 bg-white/5 hover:bg-white/10 backdrop-blur-xl group-hover:shadow-glow">
                <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">📸</div>
                <div className="text-base font-bold text-white mb-2">
                  {files.length > 0 ? (
                    <span className="text-primary-400">
                      {files.length}개 선택됨
                    </span>
                  ) : (
                    '탭하여 이미지 선택'
                  )}
                </div>
                {files.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {files.map((f, i) => (
                      <div key={i} className="text-xs text-slate-400 truncate px-4">
                        {f.name}
                      </div>
                    ))}
                  </div>
                )}
                {files.length === 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    PNG, JPEG, WebP · 최대 10MB
                  </p>
                )}
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-bold text-slate-200 mb-3 tracking-wide">
              서비스·브랜드명
            </label>
            <input
              type="text"
              value={brandQuery}
              onChange={(e) => setBrandQuery(e.target.value)}
              placeholder="티빙, 넷플릭스, 유튜브 프리미엄..."
              className="input-field"
            />
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 backdrop-blur-xl">
            <p className="text-sm font-semibold text-rose-400">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (inputMode === 'image' && files.length === 0) || (inputMode === 'brand' && brandQuery.trim() === '')}
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
            inputMode === 'image' ? '🔮 AI로 해지 경로 찾기' : '🔍 이름으로 찾기'
          )}
        </button>

        {inputMode === 'image' && (
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true, 'appstore')}
            disabled={loading}
            className="btn-demo"
          >
            {loading ? '분석 중...' : '✨ 샘플로 체험'}
          </button>
        )}

        {inputMode === 'brand' && (
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true, 'brand_tving')}
            disabled={loading}
            className="btn-demo"
          >
            {loading ? '분석 중...' : '✨ 샘플: 티빙'}
          </button>
        )}
      </form>

      {/* Info Footer */}
      <div className="mt-6 pt-5 border-t border-white/10">
        <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
          {inputMode === 'image' ? (
            <>
              <span className="flex items-center gap-1.5">
                <span>🔒</span>
                <span>저장 안 됨</span>
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-700"></span>
              <span className="flex items-center gap-1.5">
                <span>⚡</span>
                <span>즉시 분석</span>
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <span>📚</span>
                <span>주요 서비스 지원</span>
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-700"></span>
              <span className="flex items-center gap-1.5">
                <span>🎯</span>
                <span>모든 경로 안내</span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
