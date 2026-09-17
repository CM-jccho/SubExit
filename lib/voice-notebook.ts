import type { ConversationLanguages } from "./conversation-language";
import {
  emptyGarden,
  earnGarden,
  migrateAjit,
  decorateGarden,
  type GardenState,
  type GardenItem,
} from "./practice-garden";
import type { RecordingAnalysisDraft } from "./recording-analysis";
import type { SampleMeta } from "./demo-bank";
import type { PracticeReview } from "./practice-review";
import type { CompanionCharacter } from "./companions";
import type { ContextProfile } from "./conversation-cards";
export type AudioClip = {
  blob: Blob;
  duration: number;
  peaks: number[];
  name: string;
  transcription?: import("./recording-limits").TranscriptionProgress;
};
export type VoiceTurn = {
  unchangedSuggestion?: boolean;
  origin?: "recording";
  id: string;
  role: "user" | "assistant" | "recording";
  text: string;
  createdAt: string;
  clip?: AudioClip;
  terms: string[];
  suggestions?: string[];
  sample?: SampleMeta;
  suggestionsSample?: SampleMeta;
};
export type VoiceSession = {
  messenger?: import("./messenger").MessengerRecord;
  training?: import("./conversation-training").TrainingRecord;
  promptPractice?: {
    version: 1;
    taskId: string;
    attempts: import("./prompt-practice").PromptVersion[];
  };
  daily?: {
    version: 1;
    topicId: string;
    completed: boolean;
    bridge: string;
    reflection?: { turnId: string; original: string; rewrite: string };
    search?: import("./trend-search").TrendResult;
  };
  gardenReflection?: { turnId: string; original: string; rewrite: string };
  gardenRootId?: string;
  gardenRetryOriginal?: string;
  languages?: ConversationLanguages;
  recordingAnalysis?: RecordingAnalysisDraft;
  review?: PracticeReview;
  practicePlan?: {
    focus: string;
    sourceSessionId: string;
    carriedTurns: number;
  };
  companion?: CompanionCharacter;
  isSample?: boolean;
  id: string;
  title: string;
  kind: "practice" | "recording" | "chat";
  context?: ContextProfile;
  industry: string;
  turns: VoiceTurn[];
  createdAt: string;
  updatedAt: string;
};
export type TermNote = {
  isSample?: boolean;
  id: string;
  term: string;
  industry: string;
  meaning: string;
  usage: string;
  caution: string;
  memo: string;
  quote: string;
  sessionId: string;
  source: "manual" | "ai";
  reviewed: boolean;
  updatedAt: string;
};
export const MAX_AUDIO_BYTES = 2400000;
export function normalizeAudioMime(type: string, name = "") {
  const base = type.split(";")[0].toLowerCase();
  const aliases: Record<string, string> = {
    "audio/mp4": "audio/m4a",
    "audio/x-m4a": "audio/m4a",
    "audio/x-wav": "audio/wav",
    "audio/mp3": "audio/mpeg",
    "video/webm": "audio/webm",
  };
  const inferred = (
    {
      mp3: "audio/mpeg",
      m4a: "audio/m4a",
      mp4: "audio/m4a",
      wav: "audio/wav",
      webm: "audio/webm",
      ogg: "audio/ogg",
      flac: "audio/flac",
      aac: "audio/aac",
    } as Record<string, string>
  )[name.split(".").at(-1)?.toLowerCase() || ""];
  const mime =
    aliases[base] ||
    (!base || base === "application/octet-stream" ? inferred : base);
  return [
    "audio/webm",
    "audio/m4a",
    "audio/ogg",
    "audio/wav",
    "audio/mpeg",
    "audio/flac",
    "audio/aac",
  ].includes(mime)
    ? mime
    : null;
}
export function termCandidates(value: unknown, text: string): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter(
          (t): t is string =>
            typeof t === "string" &&
            t.trim().length > 0 &&
            t.length <= 60 &&
            text.toLocaleLowerCase().includes(t.toLocaleLowerCase()),
        )
        .map((t) => t.trim()),
    ),
  ].slice(0, 8);
}
export function parseTerm(input: unknown): TermNote {
  if (!input || typeof input !== "object")
    throw new Error("용어 파일 형식을 확인해 주세요.");
  const d = input as Record<string, unknown>;
  const fields = {
    term: 80,
    industry: 120,
    meaning: 1000,
    usage: 1000,
    caution: 600,
    memo: 2000,
    quote: 1500,
    sessionId: 100,
  };
  const clean: Record<string, string> = {};
  for (const [k, max] of Object.entries(fields)) {
    if (typeof d[k] !== "string" || (d[k] as string).length > max)
      throw new Error("용어 항목의 길이와 형식을 확인해 주세요.");
    clean[k] = (d[k] as string).trim();
  }
  if (!clean.term) throw new Error("용어를 입력해 주세요.");
  return {
    ...clean,
    id:
      typeof d.id === "string" && /^term-[a-zA-Z0-9-]{1,70}$/.test(d.id)
        ? d.id
        : "term-" + crypto.randomUUID(),
    source: d.source === "ai" ? "ai" : "manual",
    reviewed: d.reviewed === true,
    ...(d.isSample === true ? { isSample: true } : {}),
    updatedAt: new Date().toISOString(),
  } as TermNote;
}
export function parseTermImport(raw: string): TermNote[] {
  if (raw.length > 1000000)
    throw new Error("1MB 이하의 용어 파일을 선택해 주세요.");
  const d = JSON.parse(raw);
  if (d.version !== 1 || !Array.isArray(d.terms) || d.terms.length > 300)
    throw new Error("곁말 용어 JSON 파일을 선택해 주세요.");
  return d.terms.map((t: unknown) => ({
    ...parseTerm(t),
    id: "term-" + crypto.randomUUID(),
    sessionId: "",
    quote: "",
  }));
}
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("ddeundeun-voice-notebook-v1", 2);
    r.onupgradeneeded = () => {
      for (const name of ["sessions", "terms", "meta"])
        if (!r.result.objectStoreNames.contains(name))
          r.result.createObjectStore(name, { keyPath: "id" });
    };
    r.onerror = () =>
      reject(
        new Error(
          "기기 저장소를 열지 못했어요. 브라우저 저장 권한을 확인해 주세요.",
        ),
      );
    r.onblocked = () =>
      reject(new Error("다른 곁말 탭을 닫고 다시 시도해 주세요."));
    r.onsuccess = () => {
      r.result.onversionchange = () => r.result.close();
      resolve(r.result);
    };
  });
}
async function transact<T>(
  store: "sessions" | "terms",
  mode: IDBTransactionMode,
  work: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let request: IDBRequest<T>;
    const tx = db.transaction(store, mode);
    try {
      request = work(tx.objectStore(store));
    } catch (e) {
      db.close();
      reject(e);
      return;
    }
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        new Error(
          "저장하지 못했어요. 저장 공간을 확인하거나 파일로 내려받아 주세요.",
        ),
      );
    };
  });
}
export const listSessions = () =>
  transact<VoiceSession[]>("sessions", "readonly", (s) => s.getAll());
export const getSession = (id: string) =>
  transact<VoiceSession | undefined>("sessions", "readonly", (s) => s.get(id));
export async function putSession(session: VoiceSession): Promise<IDBValidKey> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["sessions", "meta"], "readwrite");
    tx.objectStore("sessions").put(session);
    const meta = tx.objectStore("meta"),
      request = meta.get("practice-garden-v1");
    request.onsuccess = () =>
      meta.put(earnGarden(request.result || emptyGarden(), session));
    tx.oncomplete = () => {
      db.close();
      gardenChanged();
      resolve(session.id);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        new Error(
          "기록과 보상을 저장하지 못했어요. 저장 공간을 확인해 주세요.",
        ),
      );
    };
  });
}
function gardenChanged() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new window.Event("practice-garden-changed"));
}
export async function readGarden(): Promise<GardenState> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["meta", "sessions"], "readwrite"),
      r = tx.objectStore("meta").get("practice-garden-v1");
    let state: GardenState;
    r.onsuccess = () => {
      state = r.result || emptyGarden();
      if (state.ajitVersion === 1) return;
      const sessions = tx.objectStore("sessions").getAll();
      sessions.onsuccess = () => {
        state = migrateAjit(state, sessions.result);
        tx.objectStore("meta").put(state);
      };
    };
    tx.oncomplete = () => {
      db.close();
      resolve(state);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(new Error("아지트 기록을 불러오지 못했어요."));
    };
  });
}
export async function buyGardenItem(id: GardenItem): Promise<GardenState> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("meta", "readwrite"),
      meta = tx.objectStore("meta");
    let next: GardenState, error: unknown;
    const r = meta.get("practice-garden-v1");
    r.onsuccess = () => {
      try {
        next = decorateGarden(r.result || emptyGarden(), id);
        meta.put(next);
      } catch (e) {
        error = e;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      gardenChanged();
      resolve(next);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        error || new Error("소품을 저장하지 못했어요. 다시 시도해 주세요."),
      );
    };
  });
}
export const deleteSession = (id: string) =>
  transact("sessions", "readwrite", (s) => s.delete(id));
export const listTerms = () =>
  transact<TermNote[]>("terms", "readonly", (s) => s.getAll());
export const putTerm = (term: TermNote) =>
  transact("terms", "readwrite", (s) => s.put(parseTerm(term)));
export const deleteTerm = (id: string) =>
  transact("terms", "readwrite", (s) => s.delete(id));
// The marker shares the transaction with samples: deletion never re-seeds on reload,
// and concurrent tabs cannot overwrite samples edited by the user.
export async function seedNotebook(
  sessions: VoiceSession[],
  terms: TermNote[],
  restore = false,
  group = "starter-samples-v1",
) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["sessions", "terms", "meta"], "readwrite");
    const meta = tx.objectStore("meta");
    const marker = meta.get(group);
    marker.onsuccess = () => {
      if (marker.result && !restore) return;
      for (const [name, rows] of [
        ["sessions", sessions],
        ["terms", terms],
      ] as const) {
        const target = tx.objectStore(name);
        for (const row of rows) {
          const existing = target.get(row.id);
          existing.onsuccess = () => {
            if (!existing.result) target.add(row);
          };
        }
      }
      meta.put({ id: group, initialized: true });
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        new Error(
          "샘플 기록을 저장하지 못했어요. 기존 기록은 유지돼요. 저장 공간과 권한을 확인해 주세요.",
        ),
      );
    };
  });
}
export async function importTerms(notes: TermNote[]) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("terms", "readwrite");
    notes.forEach((n) => tx.objectStore("terms").put(n));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(new Error("용어를 가져오지 못했어요."));
    };
  });
}
export function guideMarkdown(terms: TermNote[], title = "우리 일의 말 사전") {
  // Only explicitly selected glossary content is exported; conversation quotes/audio stay private.
  const plain = (s: string) =>
    s.replace(/[<>]/g, "").replace(/^([#>*-])/gm, "\\$1");
  return (
    "# " +
    plain(title) +
    "\n\n공유 전에 우리 팀의 사용 맥락과 뜻을 확인해 주세요.\n" +
    terms
      .map(
        (t) =>
          `\n## ${plain(t.term)}${t.industry ? " · " + plain(t.industry) : ""}\n\n${t.reviewed ? "직접 확인함" : t.isSample ? "사전 작성 예시 · 뜻 확인 필요" : t.source === "ai" ? "AI 설명 초안 · 확인 필요" : "직접 작성"}\n\n**뜻** ${plain(t.meaning) || "작성 전"}\n\n**사용 예** ${plain(t.usage) || "작성 전"}\n\n**사용할 때** ${plain(t.caution) || "맥락에 맞게 사용해 주세요."}\n\n**우리 팀 메모** ${plain(t.memo) || "없음"}\n`,
      )
      .join("")
  );
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
