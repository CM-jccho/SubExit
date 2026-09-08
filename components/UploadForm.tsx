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
      <>
        {isDemoMode && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-center">
            <span className="text-sm font-semibold">📱 샘플 데모</span>
          </div>
        )}
        <ResultDisplay result={result} />
        <button
          onClick={handleReset}
          className="mt-6 w-full py-4 px-6 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold rounded-2xl transition-all duration-200 min-h-[56px]"
        >
          다시 분석하기
        </button>
      </>
    )
  }

  return (
    <div className="card">
      {/* Tabs */}
      <div className="flex border-b-2 border-slate-100 mb-6 -mx-6 px-6">
        <button
          type="button"
          onClick={() => setInputMode('image')}
          className={`tab-button ${inputMode === 'image' ? 'tab-button-active' : ''}`}
        >
          📷 스크린샷
        </button>
        <button
          type="button"
          onClick={() => setInputMode('brand')}
          className={`tab-button ${inputMode === 'brand' ? 'tab-button-active' : ''}`}
        >
          🔍 서비스명
        </button>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
        {inputMode === 'image' ? (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              구독 화면 캡처 (1-3개)
            </label>
            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-primary-500 hover:bg-primary-50/50 transition-all">
                <div className="text-4xl mb-2">📸</div>
                <div className="text-sm font-medium text-slate-600">
                  {files.length > 0 ? (
                    <span className="text-primary-600">
                      {files.length}개 선택됨
                    </span>
                  ) : (
                    '탭하여 이미지 선택'
                  )}
                </div>
                {files.length > 0 && (
                  <div className="mt-2 text-xs text-slate-500">
                    {files.map(f => f.name).join(', ')}
                  </div>
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
            <label className="block text-sm font-semibold text-slate-700 mb-3">
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
          <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-200">
            <p className="text-sm text-red-800">{error}</p>
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
            inputMode === 'image' ? '해지 경로 찾기' : '이름으로 찾기'
          )}
        </button>

        {inputMode === 'image' && (
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true, 'appstore')}
            disabled={loading}
            className="btn-demo"
          >
            {loading ? '분석 중...' : '📱 샘플로 체험'}
          </button>
        )}

        {inputMode === 'brand' && (
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true, 'brand_tving')}
            disabled={loading}
            className="btn-demo"
          >
            {loading ? '분석 중...' : '📱 샘플: 티빙'}
          </button>
        )}
      </form>

      {/* Info Footer */}
      <div className="mt-6 pt-6 border-t border-slate-100">
        {inputMode === 'image' ? (
          <div className="space-y-2 text-xs text-slate-500">
            <p><span className="font-semibold text-slate-700">지원:</span> PNG, JPEG, WebP</p>
            <p><span className="font-semibold text-slate-700">용량:</span> 총 8-10MB</p>
            <p><span className="font-semibold text-slate-700">보안:</span> 업로드 이미지는 저장 안 됨</p>
          </div>
        ) : (
          <div className="space-y-2 text-xs text-slate-500">
            <p><span className="font-semibold text-slate-700">지원:</span> 티빙, 넷플릭스, 유튜브 프리미엄 등</p>
            <p className="leading-relaxed">결제 채널이 여러 개면 모든 경로를 안내합니다</p>
          </div>
        )}
      </div>
    </div>
  )
}
