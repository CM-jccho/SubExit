export type ConversationSignals = {
  numbers: string[];
  terms: string[];
  commitments: string[];
};

const unique = (values: string[], max: number) =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, max);

function commitmentCandidates(text: string) {
  return text
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 4 && sentence.length <= 140)
    .filter((sentence) =>
      /(?:약속|하기로|하겠습니다|드리겠습니다|할게요|할께요|해야|해\s?주세요|해주세요|예정|마감|결정|확인(?:할|해|해서)|연락(?:할|드|해)|보내(?:드|주|겠|야)|전달(?:드|하|해)|공유(?:드|하|해)|완료(?:하|해|예정)|진행(?:하|해|하기)|까지|내일|오늘|이번\s?주|다음\s?주)/i.test(
        sentence,
      ),
    );
}

export function extractConversationSignals(text: string): ConversationSignals {
  const source = text.slice(0, 12000);
  const numbers =
    source.match(
      /(?:\d{1,4}[./-]\d{1,2}(?:[./-]\d{1,2})?|\d{1,2}:\d{2}|\d[\d,.]*(?:\s?(?:원|만원|억원|%|퍼센트|명|개|건|회|번|시|분|일|월|년|주|개월|kg|km|MB|GB))?)/gi,
    ) || [];
  const terms = source.match(/\b[A-Z][A-Z0-9._/+:-]{1,19}\b/g) || [];

  return {
    numbers: unique(numbers, 20),
    terms: unique(terms, 20),
    commitments: unique(commitmentCandidates(source), 12),
  };
}

export function mergeConversationSignals(
  ...signals: ConversationSignals[]
): ConversationSignals {
  return {
    numbers: unique(signals.flatMap((item) => item.numbers), 30),
    terms: unique(signals.flatMap((item) => item.terms), 30),
    commitments: unique(signals.flatMap((item) => item.commitments), 20),
  };
}

export function partnerGroupKey(partner: string) {
  return partner
    .trim()
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/g, " ")
    .slice(0, 160);
}
