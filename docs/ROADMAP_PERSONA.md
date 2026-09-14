# 🎭 User-Defined Persona Feature (Soft-Go - Post-MVP)

## Overview

User-defined persona cards for customizing coach panel + practice scripts tone.

**Status:** 📋 Planned (Do NOT block audio MVP)

---

## Feature Spec

### Persona Card Structure
- **Alias**: Short name (e.g., "까다로운 영업사원", "격식 중시 부모님")
- **Traits**: 3-6 selectable traits (e.g., aggressive, passive-aggressive, formal, emotional)
- **Taboos**: Multi-select forbidden topics/tactics
- **Storage**: localStorage OK

### One-Click Presets

| Preset | Scenario | Traits | Example |
|--------|----------|--------|---------|
| **Cancel Agent** | Subscription | Guilt-inducing, persuasive, sob-story | "커피 한 잔인데요" |
| **Sales Rep** | Phone sales | Aggressive, FOMO, urgency | "지금 아니면 없어요" |
| **Concerned Parent** | Parent request | Emotional, comparison, sacrifice | "동생은 안 그러는데" |
| **상견례 Elder** | Formal meeting | Face-conscious, traditional, indirect | "체면이 있지" |
| **HR Manager** | Salary negotiation | Budget-focused, deadline, alternatives | "예산이 정해져 있어서" |

### Prompt Extraction

Compile persona card into:
1. **Opponent Prompt Block**: Inject into CoachPanel opponent lines
2. **System Prompt**: Adjust practice script generation tone

Example:
```typescript
// Persona: "까다로운 영업사원"
const opponentPrompt = `
You are a pushy sales agent who:
- Uses FOMO tactics
- Creates artificial urgency
- Employs guilt/loss framing
Taboos: [no threats, no personal attacks]
`;
```

### Demo Bar

Visual demonstration:
- User selects persona preset
- Coach panel updates opponent lines in real-time
- Practice scripts adjust tone (formal → casual, aggressive → polite)
- **One demo cycle** to show persona effect

---

## Guardrails

### Forbidden Coaching
- ❌ Manipulation of family members
- ❌ Gaslighting tactics
- ❌ Therapy/psychological advice
- ❌ Legal strategy
- ❌ Deceptive practices

### Approved Coaching
- ✅ Boundary setting
- ✅ Assertive communication
- ✅ De-escalation
- ✅ Negotiation frameworks
- ✅ Emotional regulation

---

## Implementation Plan (Timeboxed)

### Phase 1: Presets Only (MVP+1)
- [ ] Persona preset selector UI
- [ ] 5 hardcoded presets (cancel, sales, parent, 상견례, salary)
- [ ] Visual demo: switch preset → coach lines change
- [ ] No LLM integration (static preset → static coach lines mapping)

### Phase 2: Simple Trait Toggles (MVP+2)
- [ ] Trait checkboxes (6-8 common traits)
- [ ] Trait combination → coach tone adjustment
- [ ] localStorage persistence
- [ ] Guardrail warnings (e.g., "manipulation tactics disabled")

### Phase 3: Full Persona Card (Future)
- [ ] Custom alias input
- [ ] Taboo multi-select
- [ ] Prompt compilation engine
- [ ] LLM integration (OpenAI/Anthropic)
- [ ] Real-time script generation

---

## UI Mockup

```
┌─────────────────────────────────────┐
│ 🎭 상대방 성향 선택 (선택사항)        │
├─────────────────────────────────────┤
│ [까다로운 영업사원] [격식 중시 부모님]│
│ [예산 박한 HR]  [전통적 어른]        │
│ [+ 직접 설정]                        │
├─────────────────────────────────────┤
│ 선택된 성향: 까다로운 영업사원        │
│ • 공격적 마감 압박                   │
│ • FOMO 전술                         │
│ • 죄책감 유도                        │
└─────────────────────────────────────┘
```

---

## Technical Notes

### Storage
```typescript
interface PersonaCard {
  id: string;
  alias: string;
  traits: string[];
  taboos: string[];
  scenarioFit: string[]; // ['sales', 'salary']
}

localStorage.setItem('ddeundeun-persona', JSON.stringify(card));
```

### Prompt Injection (Future)
```typescript
// When LLM integrated
const systemPrompt = `
${baseCoachPrompt}

Opponent persona: ${persona.alias}
Traits: ${persona.traits.join(', ')}
Avoid: ${persona.taboos.join(', ')}

Adjust practice scripts accordingly while maintaining ethical boundaries.
`;
```

---

## Priority

**After audio MVP ships:**
1. ✅ Core recording upload + transcript + highlights
2. ✅ Practice scripts + coach panel (static)
3. ✅ 7 scenario modules
4. 📋 **THEN** persona presets (if time permits)

**Do NOT block MVP with this feature.**

---

## Success Metrics (Future)

- User tries ≥2 persona presets per session
- Coach tone adjustment is perceivable (user survey)
- No guardrail violations reported
- Personas increase practice engagement by X%

---

**Status:** 📋 Documented | ⏸️ Implementation paused | ✅ MVP unblocked
