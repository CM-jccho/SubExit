export type CoachTone = 'cold' | 'warm' | 'firm_polite'

export const COACH_TONE_STORAGE_KEY = 'ddeundeun_coach_tone'

export const coachToneLabels: Record<CoachTone, string> = {
  cold: '냉정',
  warm: '감성',
  firm_polite: '단호·공손',
}

export const coachToneDescriptions: Record<CoachTone, string> = {
  cold: '짧고 단호하게, 감정 최소화',
  warm: '감정 인정하되 경계선 유지',
  firm_polite: '감사 + 명확한 거절 + 통화 종료',
}

export function loadCoachTone(): CoachTone {
  if (typeof window === 'undefined') return 'firm_polite'
  
  try {
    const stored = localStorage.getItem(COACH_TONE_STORAGE_KEY)
    if (stored === 'cold' || stored === 'warm' || stored === 'firm_polite') {
      return stored
    }
  } catch (e) {
    console.warn('Failed to load coach tone from localStorage:', e)
  }
  
  return 'firm_polite'
}

export function saveCoachTone(tone: CoachTone): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(COACH_TONE_STORAGE_KEY, tone)
  } catch (e) {
    console.warn('Failed to save coach tone to localStorage:', e)
  }
}
