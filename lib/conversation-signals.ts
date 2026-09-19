export type ConversationSignals = {
  numbers: string[];
  terms: string[];
};

const unique = (values: string[], max: number) =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, max);

export function extractConversationSignals(text: string): ConversationSignals {
  const source = text.slice(0, 12000);
  const numbers =
    source.match(
      /(?:\d{1,4}[./-]\d{1,2}(?:[./-]\d{1,2})?|\d{1,2}:\d{2}|\d[\d,.]*(?:\s?(?:원|만원|억원|%|퍼센트|명|개|건|회|번|시|분|일|월|년|주|개월|kg|km|MB|GB))?)/gi,
    ) || [];
  const terms =
    source.match(/\b[A-Z][A-Z0-9._/+:-]{1,19}\b/g) || [];

  return {
    numbers: unique(numbers, 20),
    terms: unique(terms, 20),
  };
}

export function mergeConversationSignals(
  ...signals: ConversationSignals[]
): ConversationSignals {
  return {
    numbers: unique(signals.flatMap((item) => item.numbers), 30),
    terms: unique(signals.flatMap((item) => item.terms), 30),
  };
}

export function partnerGroupKey(partner: string) {
  return partner.trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").slice(0, 160);
}
