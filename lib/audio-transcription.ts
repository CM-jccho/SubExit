import { aiFetch } from "./ai-client";
import type { AudioClip } from "./voice-notebook";
import {
  RECORDING_MAX_SECONDS,
  RECORDING_MAX_TEXT,
  TRANSCRIBE_PART_SECONDS,
  type TranscriptionProgress,
} from "./recording-limits";

// Standard 16-bit mono PCM WAV. Audio is resampled with the browser's offline
// audio renderer before this encoder; every segment remains a valid standalone file.
export function encodeMonoWav(samples: Float32Array, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const label = (offset: number, value: string) =>
    [...value].forEach((v, i) => view.setUint8(offset + i, v.charCodeAt(0)));
  label(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  label(8, "WAVE");
  label(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  label(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => {
    const value = Math.max(-1, Math.min(1, sample));
    view.setInt16(
      44 + i * 2,
      Math.round(value * (value < 0 ? 32768 : 32767)),
      true,
    );
  });
  return new Blob([buffer], { type: "audio/wav" });
}
function checkAbort(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
}
export async function* audioParts(clip: AudioClip, signal: AbortSignal) {
  checkAbort(signal);
  // Preserve small input unchanged, including valid M4A MIME handling on server.
  if (clip.duration <= TRANSCRIBE_PART_SECONDS && clip.blob.size <= 2400000) {
    yield { blob: clip.blob, name: clip.name, index: 0, total: 1 };
    return;
  }
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(
      await clip.blob.arrayBuffer(),
    );
    checkAbort(signal);
    if (decoded.duration > RECORDING_MAX_SECONDS)
      throw new Error("30분 이하의 파일을 선택해 주세요.");
    const total = Math.ceil(decoded.duration / TRANSCRIBE_PART_SECONDS);
    for (let index = 0; index < total; index++) {
      checkAbort(signal);
      const from = index * TRANSCRIBE_PART_SECONDS;
      const duration = Math.min(
        TRANSCRIBE_PART_SECONDS,
        decoded.duration - from,
      );
      const offline = new OfflineAudioContext(
        1,
        Math.ceil(duration * 16000),
        16000,
      );
      const source = offline.createBufferSource();
      source.buffer = decoded;
      source.connect(offline.destination);
      source.start(0, from, duration);
      const rendered = await offline.startRendering();
      checkAbort(signal);
      yield {
        blob: encodeMonoWav(rendered.getChannelData(0)),
        name: `part-${index + 1}.wav`,
        index,
        total,
      };
    }
  } finally {
    await context.close();
  }
}
function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    checkAbort(signal);
    const stop = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      resolve();
    }, ms);
    signal.addEventListener("abort", stop, { once: true });
  });
}
export async function transcribeAudio(
  clip: AudioClip,
  options: {
    signal: AbortSignal;
    sampleOnly: boolean;
    progress: (
      progress: TranscriptionProgress,
      text: string,
    ) => void | Promise<void>;
    status?: (message: string) => void;
  },
) {
  const { signal } = options;
  const old = clip.transcription;
  const parts = old?.version === 1 ? [...old.parts] : [];
  let lastStarted = 0,
    total = old?.total || 1;
  options.status?.(
    "전송할 음성을 45초 단위로 준비하고 있어요. 원본은 그대로 보관해요.",
  );
  for await (const part of audioParts(clip, signal)) {
    total = part.total;
    if (part.index === 0)
      await options.progress(
        {
          version: 1,
          parts: [...parts],
          total,
          complete: parts.length === total,
        },
        parts.join("\n"),
      );
    if (part.index < parts.length) continue;
    const wait = lastStarted + 6000 - Date.now();
    if (wait > 0) await pause(wait, signal);
    checkAbort(signal);
    options.status?.(
      `문자 변환 ${part.index + 1}/${total}구간 · 완료한 구간은 유지돼요`,
    );
    lastStarted = Date.now();
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(cancel, 25000);
    try {
      const form = new FormData();
      form.append("audio", part.blob, part.name);
      form.append("consent", "true");
      form.append("adultConsent", "true");
      form.append("sampleConsent", String(options.sampleOnly));
      const response = await aiFetch("/api/transcribe", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const data = await response.json();
      checkAbort(signal);
      if (!response.ok)
        throw new Error(data.error || "문자 변환을 완료하지 못했어요.");
      if (typeof data.text !== "string")
        throw new Error("음성 인식 결과를 확인하지 못했어요.");
      if (parts.join("\n").length + data.text.length + 1 > RECORDING_MAX_TEXT)
        throw new Error(
          "60,000자에 도달했어요. 완료한 문자와 원본을 저장한 뒤 나머지 대화를 나눠 주세요.",
        );
      parts.push(data.text.trim());
      await options.progress(
        {
          version: 1,
          parts: [...parts],
          total,
          complete: parts.length === total,
        },
        parts.join("\n"),
      );
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", cancel);
    }
  }
  const text = parts.join("\n");
  if (!text.trim())
    throw new Error(
      "음성에서 말을 찾지 못했어요. 원본을 재생해 확인해 주세요.",
    );
  return {
    text,
    progress: { version: 1 as const, parts, total, complete: true },
  };
}
