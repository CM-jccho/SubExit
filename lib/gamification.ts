// Gamification system using localStorage
// - Scenario clear unlocks 거절 Lv badges
// - Track 버팀률 stamps
// - Optional 오늘 연습 streak

export type ScenarioProgress = {
  scenarioId: string
  cleared: boolean
  clearedAt?: string
  bestHeldRate: number
  attempts: number
}

export type GamificationState = {
  level: number // 거절 레벨 (cleared scenarios count)
  scenarios: Record<string, ScenarioProgress>
  streak: number // 연속 연습 일수
  lastPracticeDate?: string // YYYY-MM-DD
  totalAttempts: number
  lastUsedScenario?: string // Last scenario ID used for 오늘의 연습
}

const STORAGE_KEY = 'subexit_gamification'

export function loadGamificationState(): GamificationState {
  if (typeof window === 'undefined') {
    return getDefaultState()
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return getDefaultState()
    
    const state = JSON.parse(stored) as GamificationState
    return state
  } catch {
    return getDefaultState()
  }
}

export function saveGamificationState(state: GamificationState): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error('Failed to save gamification state:', e)
  }
}

function getDefaultState(): GamificationState {
  return {
    level: 0,
    scenarios: {},
    streak: 0,
    totalAttempts: 0,
  }
}

export function recordScenarioAttempt(
  scenarioId: string,
  heldRate: number,
  cleared: boolean
): { state: GamificationState; leveledUp: boolean; newStreak: boolean } {
  const state = loadGamificationState()
  
  // Update scenario progress
  const prev = state.scenarios[scenarioId]
  const isFirstClear = cleared && (!prev || !prev.cleared)
  
  state.scenarios[scenarioId] = {
    scenarioId,
    cleared: cleared || (prev?.cleared ?? false),
    clearedAt: isFirstClear ? new Date().toISOString() : prev?.clearedAt,
    bestHeldRate: Math.max(heldRate, prev?.bestHeldRate ?? 0),
    attempts: (prev?.attempts ?? 0) + 1,
  }
  
  // Update level (count cleared scenarios)
  const clearedCount = Object.values(state.scenarios).filter(s => s.cleared).length
  const leveledUp = clearedCount > state.level
  state.level = clearedCount
  
  // Update streak
  const today = new Date().toISOString().split('T')[0]
  const lastDate = state.lastPracticeDate
  let newStreak = false
  
  if (!lastDate) {
    state.streak = 1
    newStreak = true
  } else if (lastDate !== today) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    
    if (lastDate === yesterdayStr) {
      state.streak += 1
      newStreak = true
    } else {
      state.streak = 1
      newStreak = true
    }
  }
  
  state.lastPracticeDate = today
  state.totalAttempts += 1
  
  saveGamificationState(state)
  
  return { state, leveledUp, newStreak }
}

export function getLevelBadge(level: number): string {
  if (level === 0) return '🔰'
  if (level <= 2) return '🥉'
  if (level <= 4) return '🥈'
  if (level <= 6) return '🥇'
  return '💎'
}

export function getLevelLabel(level: number): string {
  return `거절 Lv.${level}`
}

export function getStreakLabel(streak: number): string {
  if (streak <= 0) return ''
  return `🔥 ${streak}일 연속`
}

// Check if scenario should be considered "cleared"
// Clear criteria: heldRate >= 80%
export function isScenarioCleared(heldRate: number): boolean {
  return heldRate >= 80
}

// Update last used scenario for 오늘의 연습
export function updateLastUsedScenario(scenarioId: string): void {
  const state = loadGamificationState()
  state.lastUsedScenario = scenarioId
  saveGamificationState(state)
}

// Get last used scenario or default to 'sales'
export function getLastUsedScenario(): string {
  const state = loadGamificationState()
  return state.lastUsedScenario || 'sales'
}
