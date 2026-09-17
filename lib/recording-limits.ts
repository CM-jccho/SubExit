export const RECORDING_MAX_BYTES = 50 * 1024 * 1024;
export const RECORDING_MAX_SECONDS = 30 * 60;
export const RECORDING_MAX_TEXT = 60000;
export const RECORDING_MAX_SEGMENTS = 600;
export const TRANSCRIBE_PART_SECONDS = 45;
export type TranscriptionProgress = {
  version: 1;
  parts: string[];
  total: number;
  complete: boolean;
};
export function importTranscript(raw: string, name: string) {
  const text = /\.(srt|vtt)$/i.test(name)
    ? raw
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .filter(
          (line) =>
            !/^WEBVTT(?:\s.*)?$/.test(line) &&
            !/^\d+$/.test(line.trim()) &&
            !/\d{2}:\d{2}.*-->/.test(line),
        )
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    : raw.replace(/^\uFEFF/, "").trim();
  if (!text) throw new Error("텍스트 파일이 비어 있어요.");
  if (text.length > RECORDING_MAX_TEXT)
    throw new Error(
      "텍스트는 60,000자까지 가져올 수 있어요. 대화를 나눠 주세요.",
    );
  return text;
}
