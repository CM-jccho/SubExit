import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

type CoachTone = 'cold' | 'warm' | 'firm_polite'

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

function loadCallFixture(scenario: string = 'sales'): CallAnalysisResult {
  const fixtureMap: Record<string, string> = {
    sales: 'call_sales_pressure.json',
    first_date: 'call_first_date.json',
    relationship: 'call_relationship_concern.json',
    school_group: 'call_school_group.json',
    presentation_qa: 'call_presentation_qa.json',
    work_comm: 'call_work_communication.json',
    work_presentation: 'call_work_presentation.json',
    // Legacy scenarios (still supported)
    salary: 'call_salary_negotiation.json',
    cancel: 'call_sponsor_guilt.json',
    parent: 'call_parent_request.json',
    formal: 'call_formal_meeting.json',
    general: 'call_general_refusal.json',
    romantic: 'call_romantic_refusal.json',
  }
  
  const filename = fixtureMap[scenario] || 'call_sales_pressure.json'
  const fixturePath = path.join(process.cwd(), 'fixtures', filename)
  const data = fs.readFileSync(fixturePath, 'utf-8')
  return JSON.parse(data)
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const isDemoParam = url.searchParams.get('demo') === '1'
    
    // Demo mode - return fixture immediately
    if (isDemoParam) {
      const body = await request.json().catch(() => ({}))
      const scenario = body.scenario || 'sales'
      const coachTone = body.coachTone || 'firm_polite'
      console.log('[Demo] Scenario:', scenario, 'CoachTone:', coachTone)
      const result = loadCallFixture(scenario)
      return NextResponse.json(result)
    }

    // Real audio upload mode
    const contentType = request.headers.get('content-type') || ''
    
    if (contentType.includes('application/json')) {
      const body = await request.json()
      if (body.demo) {
        const scenario = body.scenario || 'sales'
        const coachTone = body.coachTone || 'firm_polite'
        console.log('[Demo JSON] Scenario:', scenario, 'CoachTone:', coachTone)
        const result = loadCallFixture(scenario)
        return NextResponse.json(result)
      }
    }

    // Handle audio file upload
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const coachTone = (formData.get('coachTone') as string) || 'firm_polite'
    console.log('[Upload] Audio:', audioFile?.name, 'CoachTone:', coachTone)
    
    if (!audioFile) {
      return NextResponse.json(
        { error: '오디오 파일이 필요합니다' },
        { status: 400 }
      )
    }

    // Check if Whisper API key is available
    const openaiKey = process.env.OPENAI_API_KEY
    
    if (!openaiKey) {
      console.log('OPENAI_API_KEY not configured, returning demo fixture')
      const result = loadCallFixture('sales')
      return NextResponse.json(result)
    }

    // TODO: Implement real Whisper STT + LLM analysis when API key is present
    // For now, return fixture to ensure demo works
    console.log('Audio file received:', audioFile.name, 'size:', audioFile.size)
    console.log('Real STT not yet implemented, returning demo fixture')
    
    const result = loadCallFixture('sales')
    return NextResponse.json(result)

  } catch (error) {
    console.error('Call analysis error:', error)
    
    // Fallback to fixture on any error
    try {
      const fallbackResult = loadCallFixture('sales')
      return NextResponse.json(fallbackResult)
    } catch (fixtureError) {
      return NextResponse.json(
        { error: '분석 중 오류가 발생했습니다' },
        { status: 500 }
      )
    }
  }
}
