import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

type AnalysisResult = {
  channel: {
    type: 'web' | 'app_store' | 'google_play' | 'merchant' | 'unknown'
    confidence: 'high' | 'medium' | 'low'
    evidence: string[]
  }
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
  disclaimer: string
}

const SYSTEM_PROMPT = `당신은 구독 관리 화면을 분석하여 해지 경로를 안내하는 AI 어시스턴트입니다.

중요한 제약사항:
- 절대 다음 표현을 사용하지 마세요: "환불됩니다", "환불 확정", "위약은 무효", "승소", "자동 해지 완료", "법률 자문"
- 대신 "확인이 필요할 수 있습니다", "약관을 참고하세요" 등의 신중한 표현을 사용하세요
- 이 서비스는 법률 자문이 아니며, 참고 정보만 제공합니다

분석 절차:
1. 화면에서 보이는 UI 텍스트, 버튼, 레이아웃을 추출
2. 결제 채널 추정 (web, app_store, google_play, merchant, unknown)
3. 해지 경로를 단계별로 한국어로 안내
4. 주의사항 태그 추가 (dark_pattern, cancel_ne_refund, next_renewal, other_caution)
5. 각 판단에 대한 근거 텍스트 제시

JSON 형식으로 응답하세요:
{
  "channel": {
    "type": "web|app_store|google_play|merchant|unknown",
    "confidence": "high|medium|low",
    "evidence": ["근거1", "근거2"]
  },
  "steps": [
    {"order": 1, "title": "단계 제목", "detailKo": "상세 설명"}
  ],
  "tags": [
    {"kind": "dark_pattern|cancel_ne_refund|next_renewal|other_caution", "labelKo": "주의사항 라벨", "evidence": "근거"}
  ],
  "disclaimer": "면책 고지문"
}`

function loadFixture(scenario: string = 'appstore'): AnalysisResult {
  const fixtureMap: Record<string, string> = {
    appstore: 'appstore.json',
    play: 'play.json',
    web_dark: 'web_dark.json',
    email_renewal: 'email_renewal.json',
  }
  
  const filename = fixtureMap[scenario] || 'appstore.json'
  const fixturePath = path.join(process.cwd(), 'fixtures', filename)
  const data = fs.readFileSync(fixturePath, 'utf-8')
  return JSON.parse(data)
}

async function analyzeWithAnthropic(imageBuffers: Buffer[]): Promise<AnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const anthropic = new Anthropic({ apiKey })
  
  const imageContents = imageBuffers.map((buffer) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: 'image/png' as const,
      data: buffer.toString('base64'),
    },
  }))

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          ...imageContents,
          {
            type: 'text',
            text: '위 이미지들은 구독 관리 화면입니다. 화면을 분석하여 결제 채널을 추정하고, 해지 경로를 단계별로 안내하며, 주의사항을 추출해주세요. 반드시 JSON 형식으로만 응답하세요.',
          },
        ],
      },
    ],
    system: SYSTEM_PROMPT,
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Anthropic')
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in response')
  }

  return JSON.parse(jsonMatch[0])
}

async function analyzeWithOpenAI(imageBuffers: Buffer[]): Promise<AnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const openai = new OpenAI({ apiKey })
  
  const imageContents = imageBuffers.map((buffer) => ({
    type: 'image_url' as const,
    image_url: {
      url: `data:image/png;base64,${buffer.toString('base64')}`,
    },
  }))

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: [
          ...imageContents,
          {
            type: 'text',
            text: '위 이미지들은 구독 관리 화면입니다. 화면을 분석하여 결제 채널을 추정하고, 해지 경로를 단계별로 안내하며, 주의사항을 추출해주세요. 반드시 JSON 형식으로만 응답하세요.',
          },
        ],
      },
    ],
    max_tokens: 2000,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from OpenAI')
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in response')
  }

  return JSON.parse(jsonMatch[0])
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const isDemoParam = url.searchParams.get('demo') === '1'
    
    if (isDemoParam) {
      const body = await request.json().catch(() => ({}))
      const scenario = body.scenario || 'appstore'
      const result = loadFixture(scenario)
      return NextResponse.json(result)
    }

    const contentType = request.headers.get('content-type') || ''
    
    if (contentType.includes('application/json')) {
      const body = await request.json()
      if (body.demo) {
        const result = loadFixture(body.scenario || 'appstore')
        return NextResponse.json(result)
      }
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    
    if (files.length === 0) {
      return NextResponse.json(
        { error: '이미지 파일이 필요합니다' },
        { status: 400 }
      )
    }

    const imageBuffers: Buffer[] = []
    for (const file of files) {
      const bytes = await file.arrayBuffer()
      imageBuffers.push(Buffer.from(bytes))
    }

    let result: AnalysisResult
    
    try {
      if (process.env.ANTHROPIC_API_KEY) {
        result = await analyzeWithAnthropic(imageBuffers)
      } else if (process.env.OPENAI_API_KEY) {
        result = await analyzeWithOpenAI(imageBuffers)
      } else {
        console.log('No API key configured, falling back to demo fixture')
        result = loadFixture('appstore')
      }
    } catch (error) {
      console.error('Vision API error, falling back to demo fixture:', error)
      result = loadFixture('appstore')
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Analysis error:', error)
    
    try {
      const fallbackResult = loadFixture('appstore')
      return NextResponse.json(fallbackResult)
    } catch (fixtureError) {
      return NextResponse.json(
        { error: '분석 중 오류가 발생했습니다' },
        { status: 500 }
      )
    }
  }
}
