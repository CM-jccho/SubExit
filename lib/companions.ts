import type { ContextProfile } from "./conversation-cards";
export type CompanionId =
  | "dundi"
  | "moa"
  | "tori"
  | "coco"
  | `custom-${string}`;
export type CompanionChoice = "auto" | CompanionId;
export type CompanionShape = "round" | "owl" | "rabbit" | "cat";
export type CompanionColor = "sage" | "sky" | "peach" | "lilac";
export type CompanionCharacter = {
  id: CompanionId;
  name: string;
  shape: CompanionShape;
  color: CompanionColor;
  specialty: string;
  persona: string;
  custom?: boolean;
  updatedAt?: string;
};
export const companionColors = {
  sage: { label: "초록", body: "#CFDDB9", arm: "#C0D0A6", accent: "#D67651" },
  sky: { label: "하늘", body: "#B9D7E7", arm: "#A4C8DB", accent: "#54779C" },
  peach: { label: "살구", body: "#F0C9AE", arm: "#E5B692", accent: "#B86D54" },
  lilac: { label: "보라", body: "#D3C7E4", arm: "#BCADD3", accent: "#87719D" },
} as const;
export const companionShapes: Record<CompanionShape, string> = {
  round: "둥근 친구",
  owl: "부엉이",
  rabbit: "토끼",
  cat: "고양이",
};
export const defaultCompanions: CompanionCharacter[] = [
  {
    id: "dundi",
    name: "두리",
    shape: "round",
    color: "sage",
    specialty: "차근차근 업무 조율",
    persona:
      "친근하고 차분한 대화 도우미. 사용자가 원하는 결과와 할 수 있는 일을 정리하고, 무리한 약속 없이 다음 행동을 함께 찾는다. 따뜻한 존댓말을 쓴다.",
  },
  {
    id: "moa",
    name: "모아",
    shape: "owl",
    color: "sky",
    specialty: "면접 · 발표 · 생각 정리",
    persona:
      "핵심을 모아주는 차분한 대화 도우미. 질문의 의도와 답의 구조를 짧게 정리하고 면접·발표를 준비하는 사용자가 자기 경험을 말하도록 돕는다. 공손하고 또렷하게 말한다.",
  },
  {
    id: "tori",
    name: "토리",
    shape: "rabbit",
    color: "peach",
    specialty: "친구 · 가족 · 일상 대화",
    persona:
      "편안하게 이야기를 들어주는 대화 도우미. 일상 대화의 마음과 표현을 함께 정리한다. 가볍고 다정한 존댓말을 사용하고 관계를 단정하지 않는다.",
  },
  {
    id: "coco",
    name: "코코",
    shape: "cat",
    color: "lilac",
    specialty: "협상 · 거절 · 지킬 선",
    persona:
      "분명한 표현을 도와주는 대화 도우미. 요청 범위와 조건을 확인하고 정중한 거절·협상 문장을 함께 준비한다. 상대를 공격하지 않고 차분한 존댓말로 말한다.",
  },
];
export const COMPANIONS_KEY = "ddeundeun-custom-companions-v1";
export function isCompanionId(v: unknown): v is CompanionId {
  return (
    typeof v === "string" &&
    (defaultCompanions.some((c) => c.id === v) ||
      /^custom-[a-zA-Z0-9-]{1,70}$/.test(v))
  );
}
export function isCompanionChoice(v: unknown): v is CompanionChoice {
  return v === "auto" || isCompanionId(v);
}
export function parseCompanion(v: unknown): CompanionCharacter {
  if (!v || typeof v !== "object")
    throw new Error("캐릭터 설정을 확인해 주세요.");
  const d = v as Record<string, unknown>;
  if (
    !isCompanionId(d.id) ||
    typeof d.shape !== "string" ||
    !Object.hasOwn(companionShapes, d.shape) ||
    typeof d.color !== "string" ||
    !Object.hasOwn(companionColors, d.color)
  )
    throw new Error("캐릭터 모습을 선택해 주세요.");
  const fields: Record<string, string> = {};
  for (const [k, max] of Object.entries({
    name: 12,
    specialty: 80,
    persona: 500,
  })) {
    if (
      typeof d[k] !== "string" ||
      !(d[k] as string).trim() ||
      (d[k] as string).length > max
    )
      throw new Error("이름·도와줄 일·말투를 길이에 맞게 입력해 주세요.");
    fields[k] = (d[k] as string).trim();
  }
  return {
    id: d.id,
    name: fields.name,
    specialty: fields.specialty,
    persona: fields.persona,
    shape: d.shape as CompanionShape,
    color: d.color as CompanionColor,
    ...(d.id.startsWith("custom-") ? { custom: true } : {}),
    ...(typeof d.updatedAt === "string" ? { updatedAt: d.updatedAt } : {}),
  };
}
export function readSavedCompanions(): CompanionCharacter[] {
  const raw = localStorage.getItem(COMPANIONS_KEY);
  if (!raw) return [];
  try {
    const d = JSON.parse(raw);
    if (
      d.version !== 1 ||
      !Array.isArray(d.characters) ||
      d.characters.length > 16
    )
      throw new Error();
    const rows = d.characters.map(parseCompanion) as CompanionCharacter[];
    if (new Set(rows.map((c) => c.id)).size !== rows.length) throw new Error();
    return rows;
  } catch {
    throw new Error("저장한 캐릭터를 읽지 못했어요. 원본 데이터는 유지했어요.");
  }
}
export function saveCompanion(input: CompanionCharacter) {
  const c = parseCompanion(input);
  const old = readSavedCompanions();
  if (
    c.custom &&
    old.filter((o) => o.custom).length >= 12 &&
    !old.some((o) => o.id === c.id)
  )
    throw new Error("직접 만든 친구는 12명까지 보관할 수 있어요.");
  const next = [
    { ...c, updatedAt: new Date().toISOString() },
    ...old.filter((o) => o.id !== c.id),
  ];
  localStorage.setItem(
    COMPANIONS_KEY,
    JSON.stringify({ version: 1, characters: next }),
  );
  return next;
}
export function recommendCompanion(profile?: Partial<ContextProfile>): {
  id: CompanionId;
  reason: string;
} {
  const goal = profile?.goal || "";
  const text = [
    profile?.title,
    profile?.partner,
    profile?.myRole,
    profile?.situation,
    goal,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (
    /거절|협상|조건 합의|declin|negotia|断り|断る|交渉/.test(goal.toLowerCase())
  )
    return {
      id: "coco",
      reason:
        "거절·조건 조율이라는 목표에 맞춰 분명한 표현을 도와줄 친구가 어울려요.",
    };
  if (
    /면접|발표|인터뷰|프레젠테이션|interview|presentation|pitch|面接|発表|プレゼン/.test(
      text,
    )
  )
    return {
      id: "moa",
      reason: "면접·발표에서 생각을 정리하도록 차분한 안내가 어울려요.",
    };
  if (
    /친구|가족|부모|연인|동생|언니|오빠|누나|friend|family|partner at home|友達|友人|家族|恋人/.test(
      text,
    )
  )
    return {
      id: "tori",
      reason: "가까운 사람과의 일상 대화라 다정한 말투의 친구가 어울려요.",
    };
  if (
    /거래처|고객|계약|협상|거절|client|customer|contract|negotiat|取引先|顧客|契約|交渉/.test(
      text,
    )
  )
    return {
      id: "coco",
      reason:
        "요청 범위와 조건을 확인하는 대화라 분명한 표현을 도와줄 친구가 어울려요.",
    };
  return {
    id: "dundi",
    reason: text
      ? "일과 대화를 차근차근 정리하도록 기본 도우미가 함께해요."
      : "아직 상황을 정하기 전에는 기본 친구가 함께해요.",
  };
}
export function resolveCompanion(
  choice: unknown = "auto",
  profile?: Partial<ContextProfile>,
  custom: CompanionCharacter[] = [],
) {
  const id =
    choice === "auto" || !isCompanionId(choice)
      ? recommendCompanion(profile).id
      : choice;
  return (
    [...custom, ...defaultCompanions].find((c) => c.id === id) ||
    defaultCompanions[0]
  );
}
export function companionForSession(
  session:
    | { companion?: CompanionCharacter; context?: ContextProfile }
    | null
    | undefined,
) {
  if (session?.companion) {
    try {
      return parseCompanion(session.companion);
    } catch {}
  }
  return resolveCompanion("auto", session?.context);
}

export function allCompanions(saved: CompanionCharacter[]) {
  return [
    ...defaultCompanions.map((c) => saved.find((s) => s.id === c.id) || c),
    ...saved.filter((c) => c.custom),
  ];
}
