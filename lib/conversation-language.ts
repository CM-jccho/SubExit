export const conversationLanguages = {
  ko: { label: "한국어", locale: "ko-KR" },
  en: { label: "English", locale: "en-US" },
  ja: { label: "日本語", locale: "ja-JP" },
} as const;
export type Language = keyof typeof conversationLanguages;
export type ConversationLanguages = { partner: Language; mine: Language };
export const defaultLanguages: ConversationLanguages = {
  partner: "ko",
  mine: "ko",
};
export function parseLanguages(value: unknown): ConversationLanguages {
  if (value === undefined) return { ...defaultLanguages };
  if (!value || typeof value !== "object") throw new Error("invalid_language");
  const d = value as ConversationLanguages;
  if (
    !Object.hasOwn(conversationLanguages, d.partner) ||
    !Object.hasOwn(conversationLanguages, d.mine)
  )
    throw new Error("invalid_language");
  return { partner: d.partner, mine: d.mine };
}
export function languageInstruction(
  value: unknown,
  target: "partner" | "mine" = "partner",
) {
  const language = parseLanguages(value);
  return ` 出力言語 / Output language: ${conversationLanguages[language[target]].label}. 앞 지침의 한국어 고정 표현보다 이 언어 설정을 우선한다. 사용자의 입력 언어가 달라도 지정된 출력 언어를 유지한다. 용어와 직접 인용은 원문 그대로 보존한다.`;
}
export const foreignSamples = {
  en: {
    openings: [
      "What would you like to talk about?",
      "Which part would you like to work through together?",
      "What is the main thing you want to clarify?",
    ],
    replies: [
      "Could you tell me a little more about that?",
      "What would a workable next step look like?",
      "Which part matters most to you?",
    ],
    suggestions: [
      "Could we clarify what is possible before deciding?",
      "I would like to explain what I need first.",
      "Could we check the next step together?",
    ],
  },
  ja: {
    openings: [
      "どのようなことをお話ししたいですか。",
      "一緒に整理したいのは、どの部分ですか。",
      "まず、何を確認したいですか。",
    ],
    replies: [
      "もう少し詳しく教えていただけますか。",
      "次にできそうなことは何でしょうか。",
      "特に大切にしたい点はどこですか。",
    ],
    suggestions: [
      "決める前に、可能な範囲を確認できますか。",
      "まず、私の希望をお伝えしたいです。",
      "次の進め方を一緒に確認できますか。",
    ],
  },
};
