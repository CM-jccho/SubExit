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
          <div style={{
            backgroundColor: '#e3f2fd',
            border: '2px solid #2196f3',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px',
            textAlign: 'center',
            fontWeight: 'bold',
            color: '#1565c0',
          }}>
            📱 샘플 데모 모드
          </div>
        )}
        <ResultDisplay result={result} />
        <button
          onClick={handleReset}
          style={{
            width: '100%',
            padding: '15px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            cursor: 'pointer',
            marginTop: '20px',
          }}
        >
          다시 분석하기
        </button>
      </>
    )
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '30px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    }}>
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
        borderBottom: '2px solid #eee',
      }}>
        <button
          type="button"
          onClick={() => setInputMode('image')}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: 'transparent',
            color: inputMode === 'image' ? '#007bff' : '#666',
            border: 'none',
            borderBottom: inputMode === 'image' ? '3px solid #007bff' : '3px solid transparent',
            fontSize: '1rem',
            fontWeight: inputMode === 'image' ? 'bold' : 'normal',
            cursor: 'pointer',
          }}
        >
          📷 스크린샷으로 찾기
        </button>
        <button
          type="button"
          onClick={() => setInputMode('brand')}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: 'transparent',
            color: inputMode === 'brand' ? '#007bff' : '#666',
            border: 'none',
            borderBottom: inputMode === 'brand' ? '3px solid #007bff' : '3px solid transparent',
            fontSize: '1rem',
            fontWeight: inputMode === 'brand' ? 'bold' : 'normal',
            cursor: 'pointer',
          }}
        >
          🔍 서비스명으로 찾기
        </button>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)}>
        {inputMode === 'image' ? (
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '10px',
              fontWeight: 'bold',
              color: '#333',
            }}>
              구독 관리 화면 스크린샷 업로드 (1-3개)
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={handleFileChange}
              style={{
                width: '100%',
                padding: '10px',
                border: '2px dashed #ddd',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            />
            {files.length > 0 && (
              <div style={{ marginTop: '10px', fontSize: '0.9rem', color: '#666' }}>
                선택된 파일: {files.map(f => f.name).join(', ')}
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '10px',
              fontWeight: 'bold',
              color: '#333',
            }}>
              서비스·브랜드명
            </label>
            <input
              type="text"
              value={brandQuery}
              onChange={(e) => setBrandQuery(e.target.value)}
              placeholder="예: 티빙, 넷플릭스, 유튜브 프리미엄"
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #ddd',
                borderRadius: '8px',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {error && (
          <div style={{
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (inputMode === 'image' && files.length === 0) || (inputMode === 'brand' && brandQuery.trim() === '')}
          style={{
            width: '100%',
            padding: '15px',
            backgroundColor: (inputMode === 'image' && files.length === 0) || (inputMode === 'brand' && brandQuery.trim() === '') || loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            cursor: (inputMode === 'image' && files.length === 0) || (inputMode === 'brand' && brandQuery.trim() === '') || loading ? 'not-allowed' : 'pointer',
            marginBottom: '10px',
          }}
        >
          {loading ? '분석 중...' : inputMode === 'image' ? '해지 경로 분석하기' : '이름으로 찾기'}
        </button>

        {inputMode === 'image' && (
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true, 'appstore')}
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: loading ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '10px',
            }}
          >
            {loading ? '분석 중...' : '📱 샘플로 체험하기'}
          </button>
        )}

        {inputMode === 'brand' && (
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true, 'brand_tving')}
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: loading ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '분석 중...' : '📱 샘플: 티빙'}
          </button>
        )}
      </form>

      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        fontSize: '0.85rem',
        color: '#666',
      }}>
        {inputMode === 'image' ? (
          <>
            <p style={{ margin: '0 0 8px 0' }}><strong>지원 형식:</strong> PNG, JPEG, WebP</p>
            <p style={{ margin: '0 0 8px 0' }}><strong>최대 용량:</strong> 총 8-10MB</p>
            <p style={{ margin: '0' }}><strong>개인정보 보호:</strong> 업로드된 이미지는 서버에 저장되지 않습니다</p>
          </>
        ) : (
          <>
            <p style={{ margin: '0 0 8px 0' }}><strong>지원 서비스:</strong> 티빙, 넷플릭스, 디즈니+, 유튜브 프리미엄, 쿠팡플레이, 멜론, 스포티파이 등</p>
            <p style={{ margin: '0' }}><strong>참고:</strong> 서비스명만으로는 정확한 결제 채널(웹/앱스토어/구글플레이)을 알 수 없으므로, 가능한 모든 경로를 안내합니다</p>
          </>
        )}
      </div>
    </div>
  )
}
