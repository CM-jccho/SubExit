export type OpponentPersona = 'sales_agent' | 'interviewer' | 'professor' | 'date' | 'workplace' | 'audience'

export const opponentPersonaLabels: Record<OpponentPersona, string> = {
  sales_agent: '영업 상담원',
  interviewer: '면접관',
  professor: '교수님 / 조별 팀원',
  date: '소개팅·데이트 상대',
  workplace: '직장 상사·동료',
  audience: '발표 청중 Q&A',
}

export const opponentPersonaAvatars: Record<OpponentPersona, string> = {
  sales_agent: '/avatars/sales-agent.svg',
  interviewer: '/avatars/interviewer.svg',
  professor: '/avatars/professor.svg',
  date: '/avatars/date.svg',
  workplace: '/avatars/manager.svg',
  audience: '/avatars/audience.svg',
}

export const opponentPersonaTraits: Record<OpponentPersona, { traits: string; openerStyle: string }> = {
  sales_agent: {
    traits: '적극적, 설득 중심, FOMO 활용',
    openerStyle: '혜택 강조 → 긴급성 압박 → 비교',
  },
  interviewer: {
    traits: '날카로운 질문, 침묵 활용, 검증 중심',
    openerStyle: '기본 질문 → 침묵 압박 → 구체적 증거 요구',
  },
  professor: {
    traits: '권위적, 역할 부여, 책임 전가',
    openerStyle: '능력 강조 → 책임 전가 → 협박',
  },
  date: {
    traits: '열정적, 빠른 친밀감, 재촉',
    openerStyle: '칭찬 → 빠른 다음 약속 → 여러 대안 제시',
  },
  workplace: {
    traits: '업무 중심, 비교 압박, 일정 독촉',
    openerStyle: '업무 요청 → 동료 비교 → 일정 압박',
  },
  audience: {
    traits: '비판적 사고, 증거 요구, 실무 적합성 의심',
    openerStyle: '의문 제기 → 추가 정보 요구 → 실무성 도전',
  },
}

// 시나리오별 추천 페르소나
export const scenarioRecommendedPersona: Record<string, OpponentPersona> = {
  sales: 'sales_agent',
  job_interview: 'interviewer',
  first_date: 'date',
  relationship: 'date',
  school_group: 'professor',
  presentation_qa: 'audience',
  work_comm: 'workplace',
  work_presentation: 'audience',
}
