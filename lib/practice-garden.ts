import type { VoiceSession } from "./voice-notebook";
import { reviewDrill, reviewKey } from "./practice-review";
import {
  conversationRoot,
  sceneForSession,
  type AjitSceneId,
  type SceneStamp,
} from "./ajit-scenes";

export const gardenItems = [
  { id: "clay", name: "살구빛 화분", cost: 2 },
  { id: "mug", name: "친구의 머그컵", cost: 2 },
  { id: "star", name: "별빛 장식", cost: 2 },
] as const;
export type GardenItem = (typeof gardenItems)[number]["id"];
export type GardenQuest = "speak" | "reflect" | "retry";
export type GardenState = {
  ajitVersion?: 1;
  stamps?: Partial<Record<AjitSceneId, SceneStamp>>;
  id: "practice-garden-v1";
  earned: number;
  spent: number;
  events: Record<string, { quest: GardenQuest; amount: number }>;
  owned: GardenItem[];
  equipped: GardenItem[];
};
export const emptyGarden = (): GardenState => ({
  id: "practice-garden-v1",
  earned: 0,
  spent: 0,
  events: {},
  owned: [],
  equipped: [],
});
export function freshAnswers(s: VoiceSession) {
  return s.turns
    .slice(s.practicePlan?.carriedTurns || 0)
    .filter(
      (t) =>
        t.role === "user" &&
        !t.sample &&
        !t.unchangedSuggestion &&
        t.text.trim(),
    );
}
export function validReflection(s: VoiceSession) {
  const r = s.gardenReflection;
  const turn = freshAnswers(s).find((t) => t.id === r?.turnId);
  return !!(
    r &&
    turn &&
    r.original === turn.text &&
    r.rewrite.trim().length >= 4 &&
    r.rewrite.length <= 800 &&
    r.rewrite.trim() !== turn.text.trim()
  );
}
export function earnGarden(state: GardenState, s: VoiceSession): GardenState {
  if (s.isSample || s.kind !== "practice") return state;
  const events = { ...state.events };
  let earned = state.earned;
  const root = s.gardenRootId || s.practicePlan?.sourceSessionId || s.id;
  const add = (quest: GardenQuest, amount: number) => {
    const key = `${root}:${quest}`;
    if (Object.hasOwn(events, key)) return;
    events[key] = { quest, amount };
    earned += amount;
  };
  const answers = freshAnswers(s);
  if (answers.length >= 2) add("speak", 2);
  if (answers.length >= 2 && validReflection(s)) add("reflect", 1);
  if (
    s.practicePlan &&
    answers.length &&
    s.gardenRetryOriginal &&
    answers.some((t) => t.text.trim() !== s.gardenRetryOriginal!.trim())
  )
    add("retry", 3);
  return stampScene({ ...state, events, earned }, s);
}
export function stampScene(state: GardenState, s: VoiceSession): GardenState {
  const scene = sceneForSession(s),
    root = conversationRoot(s);
  if (
    s.isSample ||
    s.kind !== "practice" ||
    !s.practicePlan ||
    !scene ||
    state.stamps?.[scene.id] ||
    !(["speak", "reflect", "retry"] as const).every(
      (q) => state.events[`${root}:${q}`]?.quest === q,
    ) ||
    !s.gardenRetryOriginal ||
    !freshAnswers(s).some(
      (t) => t.text.trim() !== s.gardenRetryOriginal!.trim(),
    )
  )
    return state;
  return {
    ...state,
    stamps: {
      ...state.stamps,
      [scene.id]: {
        sourceSessionId: root,
        replaySessionId: s.id,
        completedAt: s.updatedAt,
      },
    },
  };
}
export function migrateAjit(
  state: GardenState,
  sessions: VoiceSession[],
): GardenState {
  if (state.ajitVersion === 1) return state;
  let next = state;
  for (const s of [...sessions].sort((a, b) =>
    a.updatedAt.localeCompare(b.updatedAt),
  ))
    next = stampScene(next, s);
  return { ...next, ajitVersion: 1 };
}
export function decorateGarden(
  state: GardenState,
  id: GardenItem,
): GardenState {
  const item = gardenItems.find((i) => i.id === id);
  if (!item) throw new Error("이 소품을 찾지 못했어요.");
  if (state.owned.includes(id))
    return {
      ...state,
      equipped: state.equipped.includes(id)
        ? state.equipped.filter((i) => i !== id)
        : [...state.equipped, id],
    };
  if (state.earned - state.spent < item.cost)
    throw new Error("꾸미기 티켓이 더 필요해요. 연습 퀘스트를 이어가세요.");
  return {
    ...state,
    spent: state.spent + item.cost,
    owned: [...state.owned, id],
    equipped: [...state.equipped, id],
  };
}
export function gardenStage(earned: number) {
  return earned >= 24
    ? "꽃 피운 화분"
    : earned >= 12
      ? "튼튼한 새싹"
      : earned >= 6
        ? "첫 새싹"
        : "씨앗";
}
export function reflectionDrill(s: VoiceSession): VoiceSession {
  if (!s.context || !validReflection(s))
    throw new Error("내 답변을 고쳐 쓴 뒤 저장해 주세요.");
  const r = s.gardenReflection!;
  const next = reviewDrill(s, {
    strength: { turnId: r.turnId, quote: r.original, note: "직접 돌아본 문장" },
    improvement: {
      turnId: r.turnId,
      quote: r.original,
      note: "직접 고쳐 쓰기",
      rewrite: r.rewrite,
    },
    focus: "내가 고쳐 쓴 문장을 참고해 다시 답하기: " + r.rewrite,
    sourceKey: reviewKey(s.context, s.turns),
    createdAt: new Date().toISOString(),
  });
  return {
    ...next,
    gardenRootId: s.gardenRootId || s.practicePlan?.sourceSessionId || s.id,
    gardenRetryOriginal: r.original,
  };
}
