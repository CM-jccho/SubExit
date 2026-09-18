"use client";
import InputDialog from "./InputDialog";
import { waitForPartnerBeat } from "@/lib/chat-timing";
import { useAIConsent } from "./ConsentSession";
import { canLeaveWorkspace } from "@/lib/navigation-guard";
import MessengerPractice from "./MessengerPractice";
import ConversationTraining from "./ConversationTraining";
import {
  trainingOrigin,
  type TrainingOrigin,
} from "@/lib/conversation-training";
import DailyTalk from "./DailyTalk";
import PromptPractice from "./PromptPractice";
import { GardenPractice } from "./PracticeGarden";
import RecordingAnalysis, { RecordingExamples } from "./RecordingAnalysis";
import LanguagePicker from "./LanguagePicker";
import {
  defaultLanguages,
  conversationLanguages,
} from "@/lib/conversation-language";
import {
  reviewKey,
  reviewDrill,
  type PracticeReview,
} from "@/lib/practice-review";
import SampleNotice, { SampleSwitch, ReviewExample } from "./SampleNotice";
import { practiceSampleContext } from "@/lib/demo-bank";
import { sampledRequest } from "@/lib/resilient-ai";
import {
  aiFetch,
  AIServiceError,
  connectionOutage,
  manualSample,
  outageMessage,
  type AIOutage,
} from "@/lib/ai-client";
import QuotaHelp from "./QuotaHelp";
import { useEffect, useRef, useState } from "react";
import { CompanionProvider, useCompanion } from "./CompanionTheme";
import { companionForSession, type CompanionCharacter } from "@/lib/companions";
import { Companion, Icon } from "./CompanionUI";
import CompanionNudge from "./CompanionNudge";
import VoiceComposer, {
  AIConsent,
  type AIConfig,
  type VoiceDraft,
} from "./VoiceComposer";
import AudioPlayer from "./AudioPlayer";
import { transcribeAudio } from "@/lib/audio-transcription";
import { TermEditor, TermText, type TermSeed } from "./TermNotebook";
import {
  deleteSession,
  downloadBlob,
  listSessions,
  listTerms,
  putSession,
  type VoiceSession,
  type VoiceTurn,
} from "@/lib/voice-notebook";
import type {
  ContextProfile,
  ConversationCard,
} from "@/lib/conversation-cards";
const makeSession = (
  kind: VoiceSession["kind"],
  context?: ContextProfile,
  companion?: CompanionCharacter,
): VoiceSession => {
  const now = new Date().toISOString();
  return {
    id: "session-" + crypto.randomUUID(),
    title:
      context?.title ||
      (kind === "chat" && companion
        ? companion.name + "와 이야기"
        : "새 음성 기록"),
    companion,
    kind,
    context,
    industry: "",
    languages: { ...defaultLanguages },
    turns: [],
    createdAt: now,
    updatedAt: now,
  };
};
export default function VoiceWorkspace({
  initialCard,
  mode = "records",
  config,
  onChooseCard,
  initialCompanion,
  initialSessionId,
  onRoom,
  onRecords,
  onBackToPreparation,
}: {
  onBackToPreparation?: () => void;
  onRoom?: () => void;
  onRecords?: () => void;
  initialCard?: ConversationCard;
  mode?: "practice" | "records" | "chat" | "recording";
  initialCompanion?: CompanionCharacter;
  initialSessionId?: string;
  config: AIConfig;
  onChooseCard: () => void;
}) {
  const inheritedCompanion = useCompanion();
  const [termStatus, setTermStatus] = useState<{
    id: string;
    text: string;
    error?: boolean;
  } | null>(null);
  const [termRequestId, setTermRequestId] = useState<string | null>(null);
  const [session, setSession] = useState<VoiceSession | null>(() =>
      mode === "practice" && initialCard
        ? makeSession("practice", initialCard, inheritedCompanion)
        : mode === "chat" && initialCompanion
          ? makeSession("chat", undefined, initialCompanion)
          : mode === "recording"
            ? makeSession("recording", undefined, inheritedCompanion)
            : null,
    ),
    [sessions, setSessions] = useState<VoiceSession[]>([]),
    [trainingFrom, setTrainingFrom] = useState<TrainingOrigin>(),
    [consent, setConsent] = useAIConsent(),
    [sampleMode, setSampleModeState] = useState(false),
    [reviewOutage, setReviewOutage] = useState<AIOutage | null>(null),
    [busy, setBusy] = useState(false),
    [responding, setResponding] = useState(false),
    [captureBusy, setCaptureBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [recordFilter, setRecordFilter] = useState<"all" | "mine" | "sample">(
      "all",
    ),
    [recordSort, setRecordSort] = useState<"recent" | "name">("recent"),
    [settingsOpen, setSettingsOpen] = useState(false),
    [seed, setSeed] = useState<TermSeed | null>(null),
    [autoplay, setAutoplay] = useState(false),
    [speaking, setSpeaking] = useState(""),
    [suggestion, setSuggestion] = useState<{ text: string; id: number }>();
  const abort = useRef<AbortController | null>(null),
    generation = useRef(0),
    mounted = useRef(true);
  const thread = useRef<HTMLDivElement>(null);
  const sampleModeRef = useRef(false);
  const followConversation = useRef(false);
  const latestTurnId = session?.turns.at(-1)?.id;
  useEffect(() => {
    if (!followConversation.current) return;
    const latest =
      thread.current?.querySelector<HTMLElement>("[data-latest-turn]");
    latest?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
    latest?.focus({ preventScroll: true });
  }, [latestTurnId]);
  const refresh = () =>
    listSessions()
      .then((r) =>
        setSessions(r.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
      )
      .catch(() =>
        setError(
          "대화 기록을 불러오지 못했어요. 브라우저 저장 권한을 확인해 주세요.",
        ),
      );
  useEffect(() => {
    mounted.current = true;
    void refresh();
    if (initialSessionId)
      listSessions()
        .then((rows) => {
          if (!mounted.current) return;
          const found = rows.find((s) => s.id === initialSessionId);
          if (found) {
            setSession(found);
            restoreSampleMode(found);
          } else
            setError(
              "이 대화 기록을 찾지 못했어요. 삭제되었는지 확인해 주세요.",
            );
        })
        .catch(() => {
          if (mounted.current) setError("대화 기록을 불러오지 못했어요.");
        });
    return () => {
      mounted.current = false;
      generation.current++;
      abort.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);
  function stopAudio() {
    window.speechSynthesis?.cancel();
    setSpeaking("");
    document.querySelectorAll("audio").forEach((a) => a.pause());
  }
  function speak(turn: VoiceTurn) {
    if (!("speechSynthesis" in window)) {
      setNotice(
        "이 브라우저는 읽어주기를 지원하지 않아요. 문자로 대화를 이어갈 수 있어요.",
      );
      return;
    }
    if (speaking === turn.id) {
      stopAudio();
      return;
    }
    stopAudio();
    const utterance = new SpeechSynthesisUtterance(
      (turn.sample
        ? session?.languages?.partner === "en"
          ? "Prewritten sample. "
          : session?.languages?.partner === "ja"
            ? "事前作成のサンプルです。"
            : "사전 작성 샘플입니다. "
        : "") + turn.text,
    );
    const language = turn.sample?.sampleId.startsWith("language-en")
      ? "en"
      : turn.sample?.sampleId.startsWith("language-ja")
        ? "ja"
        : session?.languages?.partner || "ko";
    utterance.lang = conversationLanguages[language].locale;
    utterance.rate = 0.98;
    const voice = speechSynthesis
      .getVoices()
      .find((v) => v.lang.startsWith(language));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      if (mounted.current) setSpeaking(turn.id);
    };
    utterance.onend = () => {
      if (mounted.current) setSpeaking("");
    };
    utterance.onerror = (e) => {
      if (mounted.current) {
        setSpeaking("");
        if (e.error !== "canceled" && e.error !== "interrupted")
          setNotice(
            "자동 읽기가 제한됐어요. 말풍선 아래 ‘읽어주기’를 눌러주세요.",
          );
      }
    };
    speechSynthesis.speak(utterance);
  }
  async function persist(next: VoiceSession) {
    next = {
      ...next,
      sampleMode: next.kind !== "recording" && sampleModeRef.current,
    };
    await putSession(next);
    if (mounted.current) {
      setSession(next);
      setSessions((rows) => [next, ...rows.filter((s) => s.id !== next.id)]);
    }
  }
  function restoreSampleMode(next: VoiceSession | null) {
    sampleModeRef.current =
      next?.kind !== "recording" && next?.sampleMode === true;
    setSampleModeState(sampleModeRef.current);
  }
  function setSampleMode(value: boolean) {
    sampleModeRef.current = value;
    setSampleModeState(value);
    if (!session) return;
    const next = { ...session, sampleMode: value };
    setSession(next);
    // Saving a preference must not reopen a screen the user has left.
    void putSession(next)
      .then(() => {
        if (mounted.current)
          setSessions((rows) => [
            next,
            ...rows.filter((s) => s.id !== next.id),
          ]);
      })
      .catch(() => {
        if (mounted.current)
          setError(
            "연습 방식 설정을 저장하지 못했어요. 브라우저 저장 권한을 확인해 주세요.",
          );
      });
  }
  function open(s: VoiceSession | null) {
    // Let the parent change the primary destination as well as the content.
    // Its navigation handler owns the unsaved-input guard.
    // Inside records the parent destination is already unchanged. Clear the
    // selected session locally; navigating to the same view would be a no-op.
    if (!s && onRecords && mode !== "records") {
      onRecords();
      return;
    }
    if (!canLeaveWorkspace()) return;
    generation.current++;
    abort.current?.abort();
    stopAudio();
    setBusy(false);
    setResponding(false);
    followConversation.current = false;
    setSuggestion(undefined);
    setError("");
    setNotice("");
    setTermStatus(null);
    setTermRequestId(null);
    setSession(s);
    setSettingsOpen(false);
    restoreSampleMode(s);
    setReviewOutage(null);
    window.scrollTo({ top: 0 });
  }
  async function respond(current: VoiceSession) {
    if ((!sampleMode && (!consent || !config.available)) || busy) return;
    if (!current.title.trim()) {
      setError("기록 이름을 입력해 주세요.");
      return;
    }
    if (current.turns.length > 24) {
      setNotice(
        "이번 연습을 마쳤어요. 기록은 저장됐고, 같은 설정으로 다시 연습할 수 있어요.",
      );
      return;
    }
    const id = ++generation.current,
      c = new AbortController();
    abort.current = c;
    setBusy(true);
    setResponding(true);
    const startedAt = Date.now();
    setError("");
    setNotice("");
    const timeout = setTimeout(() => c.abort(), 25000);
    try {
      // Save the chosen context even if the first AI turn fails.
      await putSession({ ...current, sampleMode: sampleModeRef.current });
      if (generation.current !== id || c.signal.aborted) return;
      const d = await sampledRequest({
        operation: current.kind === "chat" ? "companion" : "partner",
        language: current.languages?.partner,
        context:
          current.kind === "chat"
            ? current.turns.at(-1)?.text || current.companion?.specialty || ""
            : practiceSampleContext(current.context),
        previous: current.turns
          .filter((t) => t.role === "assistant")
          .map((t) => t.text),
        manual: sampleMode,
        url: current.kind === "chat" ? "/api/companion" : "/api/roleplay",
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: c.signal,
          body: JSON.stringify({
            context: current.context,
            ...(current.kind === "chat"
              ? { companion: current.companion }
              : {}),
            industry: current.industry,
            languages: current.languages,
            messages: current.turns.map((t) => ({
              role: t.role,
              text: t.text,
            })),
            consent,
            adultConsent: consent,
            sampleConsent: consent,
          }),
        },
      });
      if (current.turns.at(-1)?.role === "user")
        await waitForPartnerBeat(startedAt, c.signal);
      if (generation.current !== id || c.signal.aborted) return;
      const turn: VoiceTurn = {
        id: "turn-" + crypto.randomUUID(),
        role: "assistant",
        text: d.reply,
        terms: d.terms || [],
        suggestions: d.suggestions || [],
        ...(d.sample ? { sample: d.sample } : {}),
        createdAt: new Date().toISOString(),
      };
      await persist({
        ...current,
        updatedAt: new Date().toISOString(),
        turns: [...current.turns, turn],
      });
      if (autoplay) speak(turn);
    } catch (e) {
      if (generation.current === id)
        setError(
          e instanceof Error && e.name === "AbortError"
            ? "상대 응답이 지연됐어요. 내 답변은 저장됐으니 ‘상대 답변 다시 받기’를 눌러주세요."
            : e instanceof Error
              ? e.message
              : "답변을 받지 못했어요.",
        );
    } finally {
      clearTimeout(timeout);
      if (generation.current === id) {
        setBusy(false);
        setResponding(false);
      }
    }
  }
  async function reviewPractice() {
    if (!session?.context || busy || (!sampleMode && !consent)) return;
    if (sampleMode) {
      setReviewOutage(manualSample());
      return;
    }
    setReviewOutage(null);
    const id = ++generation.current,
      c = new AbortController();
    abort.current = c;
    setBusy(true);
    setError("");
    const timeout = setTimeout(() => c.abort(), 25000);
    try {
      const r = await aiFetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: c.signal,
        body: JSON.stringify({
          context: session.context,
          turns: session.turns.map((t) => ({
            id: t.id,
            role: t.role,
            text: t.text,
          })),
          consent,
          adultConsent: consent,
          sampleConsent: consent,
        }),
      });
      const d = await r.json();
      if (generation.current !== id) return;
      if (!r.ok) throw new Error(d.error || "대화를 복기하지 못했어요.");
      await persist({ ...session, review: d.review as PracticeReview });
      setNotice(
        "내 말에서 찾은 복기를 저장했어요. 같은 장면을 다시 연습해 볼까요?",
      );
    } catch (e) {
      if (generation.current === id) {
        const outage =
          e instanceof AIServiceError
            ? e.outage
            : e instanceof Error && e.name === "AbortError"
              ? connectionOutage()
              : null;
        if (outage) setReviewOutage(outage);
        else setError(e instanceof Error ? e.message : "복기하지 못했어요.");
      }
    } finally {
      clearTimeout(timeout);
      if (generation.current === id) setBusy(false);
    }
  }
  async function startDrill() {
    if (!session?.review) return;
    try {
      const next = reviewDrill(session, session.review);
      await putSession(next);
      open(next);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "재연습을 저장하지 못했어요.");
    }
  }
  async function saveDraft(draft: VoiceDraft) {
    if (!session) return;
    if (!session.title.trim()) throw new Error("기록 이름을 입력해 주세요.");
    const turn: VoiceTurn = {
      id: "turn-" + crypto.randomUUID(),
      role: session.kind !== "recording" ? "user" : "recording",
      text: draft.text,
      unchangedSuggestion: session.turns.some((t) =>
        t.suggestions?.some(
          (candidate) => candidate.trim() === draft.text.trim(),
        ),
      ),
      clip: draft.clip,
      terms: [],
      createdAt: new Date().toISOString(),
    };
    const next = {
      ...session,
      updatedAt: new Date().toISOString(),
      turns: [...session.turns, turn],
    };
    followConversation.current = session.kind !== "recording";
    await persist(next);
    setSuggestion(undefined);
    setNotice(
      session.kind === "recording" ? "음성과 문자를 이 기기에 저장했어요." : "",
    );
    if (session.kind !== "recording") void respond(next);
  }
  async function extract(turn: VoiceTurn) {
    if (!session || busy || captureBusy || !consent || !config.available)
      return;
    setTermRequestId(null);
    setTermStatus({ id: turn.id, text: "중요 용어를 찾고 있어요…" });
    setError("");
    setBusy(true);
    const c = new AbortController(),
      id = ++generation.current;
    abort.current = c;
    const timeout = setTimeout(() => c.abort(), 25000);
    try {
      const r = await aiFetch("/api/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extract",
          text: turn.text,
          industry: session.industry,
          consent,
          adultConsent: consent,
          sampleConsent: consent,
        }),
        signal: c.signal,
      });
      const d = await r.json();
      if (generation.current !== id) return;
      if (!r.ok) throw new Error(d.error);
      if (
        !Array.isArray(d.terms) ||
        d.terms.some((word: unknown) => typeof word !== "string")
      )
        throw new Error("용어 응답을 확인하지 못했어요. 다시 시도해 주세요.");
      await persist({
        ...session,
        turns: session.turns.map((t) =>
          t.id === turn.id ? { ...t, terms: d.terms } : t,
        ),
        updatedAt: new Date().toISOString(),
      });
      setNotice(
        d.terms.length
          ? "밑줄 친 용어를 눌러 뜻과 메모를 남겨보세요."
          : "추출할 전문 용어를 찾지 못했어요. 원하는 단어를 직접 눌러 추가할 수 있어요.",
      );
      setTermStatus({
        id: turn.id,
        text: d.terms.length
          ? `${d.terms.length}개를 찾았어요. 아래 용어를 눌러 저장하세요.`
          : "찾은 용어가 없어요. 표현을 선택하거나 직접 입력해 스크랩할 수 있어요.",
      });
    } catch (e) {
      if (generation.current === id)
        setTermStatus({
          id: turn.id,
          error: true,
          text:
            e instanceof Error && e.name === "AbortError"
              ? "용어 찾기가 지연됐어요. 다시 시도해 주세요."
              : e instanceof Error
                ? e.message
                : "용어를 찾지 못했어요.",
        });
    } finally {
      clearTimeout(timeout);
      if (generation.current === id) {
        setBusy(false);
        setTermStatus((current) =>
          current?.id === turn.id && current.text === "중요 용어를 찾고 있어요…"
            ? {
                id: turn.id,
                text: "용어 찾기를 완료하지 못했어요. 아래 오류 안내를 확인하거나 직접 스크랩해 주세요.",
              }
            : current,
        );
      }
    }
  }
  async function suggestReplies() {
    if (!session || busy || (!sampleMode && !consent)) return;
    const id = ++generation.current,
      c = new AbortController();
    abort.current = c;
    setBusy(true);
    setError("");
    const timeout = setTimeout(() => c.abort(), 25000);
    try {
      const d = await sampledRequest({
        operation: "suggestions",
        language: session.languages?.mine,
        context: practiceSampleContext(session.context),
        previous: session.turns.at(-1)?.suggestions || [],
        manual: sampleMode,
        url: "/api/roleplay",
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: c.signal,
          body: JSON.stringify({
            action: "suggest",
            languages: session.languages,
            context: session.context,
            industry: session.industry,
            messages: session.turns.map((t) => ({
              role: t.role,
              text: t.text,
            })),
            consent,
            adultConsent: consent,
            sampleConsent: consent,
          }),
        },
      });
      if (generation.current !== id) return;
      await persist({
        ...session,
        turns: session.turns.map((t, i) =>
          i === session.turns.length - 1
            ? { ...t, suggestions: d.suggestions, suggestionsSample: d.sample }
            : t,
        ),
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      if (generation.current === id)
        setError(
          e instanceof Error && e.name === "AbortError"
            ? "후보 생성이 지연됐어요. 다시 눌러 시도해 주세요."
            : e instanceof Error
              ? e.message
              : "후보를 만들지 못했어요.",
        );
    } finally {
      clearTimeout(timeout);
      if (generation.current === id) setBusy(false);
    }
  }
  async function transcribeSaved(turn: VoiceTurn) {
    if (!session || !turn.clip || !consent || busy) return;
    setError("");
    setBusy(true);
    const c = new AbortController(),
      id = ++generation.current;
    abort.current = c;
    let latest = session;
    try {
      const result = await transcribeAudio(turn.clip, {
        signal: c.signal,
        sampleOnly: config.sampleOnly,
        status: (message) => {
          if (generation.current === id) setNotice(message);
        },
        progress: async (progress, text) => {
          if (generation.current !== id) return;
          latest = {
            ...latest,
            turns: latest.turns.map((t) =>
              t.id === turn.id
                ? {
                    ...t,
                    text,
                    terms: [],
                    clip: { ...turn.clip!, transcription: progress },
                  }
                : t,
            ),
            updatedAt: new Date().toISOString(),
          };
          await putSession(latest);
          if (generation.current === id) setSession(latest);
        },
      });
      if (generation.current !== id) return;
      await persist(latest);
      setNotice(
        `전체 ${result.progress.total}구간 문자 변환 완료. 표현을 골라 스크랩할 수 있어요.`,
      );
    } catch (e) {
      if (generation.current === id) {
        await persist(latest).catch(() => {});
        setError(
          e instanceof Error && e.name === "AbortError"
            ? "음성 인식이 지연됐어요. 원본은 그대로 남아 있으니 다시 시도해 주세요."
            : e instanceof Error
              ? e.message
              : "음성을 인식하지 못했어요.",
        );
      }
    } finally {
      if (generation.current === id) setBusy(false);
    }
  }
  async function term(word: string, text: string) {
    if (!session) return;
    const clean = word.trim().slice(0, 80);
    try {
      const saved = (await listTerms()).find(
        (t) =>
          t.term.toLowerCase() === clean.toLowerCase() &&
          t.industry.toLowerCase() === session.industry.toLowerCase(),
      );
      setSeed({
        term: clean,
        quote: text,
        industry: session.industry,
        sessionId: session.id,
        note: saved,
      });
    } catch {
      setError("용어 노트를 열지 못했어요. 저장 권한을 확인해 주세요.");
    }
  }
  const canTalk = sampleMode || (consent && config.available);
  const sampleConfig = sampleMode
    ? { ...config, available: false, voiceAvailable: false }
    : config;
  const pending =
    session &&
    session.kind !== "recording" &&
    session.turns.at(-1)?.role === "user";
  const complete =
    session &&
    session.kind !== "recording" &&
    (session.turns.filter((t) => t.role === "user").length || 0) >= 12 &&
    session.turns.at(-1)?.role === "assistant";
  const matching = sessions
    .filter(
      (s) =>
        (recordFilter === "all" ||
          (recordFilter === "sample" ? s.isSample : !s.isSample)) &&
        [s.title, s.industry, s.context?.partner, ...s.turns.map((t) => t.text)]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      recordSort === "name"
        ? a.title.localeCompare(b.title, "ko")
        : b.updatedAt.localeCompare(a.updatedAt),
    );
  const currentReview =
    session?.context &&
    session.review?.sourceKey === reviewKey(session.context, session.turns)
      ? session.review
      : undefined;
  const sessionCharacter = session
    ? companionForSession(session)
    : inheritedCompanion;
  if (session?.messenger)
    return (
      <MessengerPractice
        key={session.id}
        config={config}
        initialSession={session}
        onRecords={() => {
          open(null);
          void refresh();
        }}
      />
    );
  if (session?.training || trainingFrom)
    return (
      <CompanionProvider value={sessionCharacter}>
        <ConversationTraining
          key={
            session?.training
              ? session.id
              : trainingFrom!.sessionId + "-training"
          }
          config={config}
          initialSession={session?.training ? session : undefined}
          origin={trainingFrom}
          onRecords={() => {
            setTrainingFrom(undefined);
            open(null);
            void refresh();
          }}
          onSession={(s) => {
            setTrainingFrom(undefined);
            open(s);
            void refresh();
          }}
        />
      </CompanionProvider>
    );
  if (session?.promptPractice)
    return (
      <PromptPractice
        key={session.id}
        config={config}
        initialSession={session}
        onRecords={() => {
          open(null);
          void refresh();
        }}
      />
    );
  if (session?.daily)
    return (
      <DailyTalk
        key={session.id}
        config={config}
        initialSession={session}
        onRecords={() => {
          open(null);
          void refresh();
        }}
      />
    );
  const inConversation =
    !!session && session.kind !== "recording" && session.turns.length > 0;
  const preparationControls = session && (
    <>
      {(session.kind !== "recording" || !session.turns.length) && (
        <details className="vn-start-options">
          <summary>
            {session.kind === "recording"
              ? "기록 이름·업종 설정"
              : "언어·자동 읽기·기록 설정"}
          </summary>
          {!session.turns.length && (
            <div className="vn-session-settings">
              <label className="vn-label">
                기록 이름
                <input
                  value={session.title}
                  maxLength={80}
                  disabled={busy || captureBusy}
                  onChange={(e) =>
                    setSession({ ...session, title: e.target.value })
                  }
                />
              </label>
              <label className="vn-label">
                업종·하는 일
                <input
                  value={session.industry}
                  maxLength={120}
                  disabled={busy || captureBusy}
                  onChange={(e) =>
                    setSession({ ...session, industry: e.target.value })
                  }
                  placeholder="예: IT 서비스 기획 · 파트너 영업"
                />
              </label>
            </div>
          )}
          {!session.isSample &&
            session.kind !== "recording" &&
            !session.turns.length && (
              <LanguagePicker
                value={session.languages || defaultLanguages}
                disabled={busy || captureBusy}
                onChange={(languages) => setSession({ ...session, languages })}
              />
            )}
          {session.kind !== "recording" && (
            <label className="dd-check vn-autoplay">
              <input
                type="checkbox"
                checked={autoplay}
                onChange={(e) => {
                  setAutoplay(e.target.checked);
                  if (!e.target.checked) stopAudio();
                }}
              />
              상대 답변 자동 읽기 <span>기기 음성 사용</span>
            </label>
          )}
        </details>
      )}
      {session.languages &&
        session.turns.length > 0 &&
        session.kind !== "recording" && (
          <p className="vn-caption">
            상대 · {conversationLanguages[session.languages.partner].label} / 내
            답변 후보 · {conversationLanguages[session.languages.mine].label}
          </p>
        )}
      {session.kind === "chat" && (
        <div className="vn-persona">
          <Companion small />
          <div>
            <strong>
              {sessionCharacter.name}
              <span>AI 대화 친구</span>
            </strong>
            <p>{sessionCharacter.specialty}</p>
            <small>이 대화에서 나눈 내용을 바탕으로 답해요.</small>
          </div>
        </div>
      )}
      {session.context && (
        <div className="vn-persona">
          <span className="vn-session-icon practice">
            <Icon name="chat" />
          </span>
          <div>
            <strong>
              {session.context.partner}
              <span>AI 연습 상대</span>
            </strong>
            <p>내 역할 · {session.context.myRole || "대화 참여자"}</p>
            <p>목표 · {session.context.goal}</p>
            <details>
              <summary>상황과 지킬 선</summary>
              <p>{session.context.situation}</p>
              <p>{session.context.boundaries}</p>
            </details>
          </div>
        </div>
      )}
      <details className="vn-data-note">
        <summary>음성과 문자는 어디에 남나요?</summary>
        <p>
          이 브라우저에 저장돼요. 기기 간 자동 동기화는 없으며 브라우저 데이터를
          지우면 사라질 수 있어요. 음성 원본과 대화 문자를 내려받을 수 있어요.
          AI 문자 변환·연습·친구 대화·복기·용어 설명을 요청하면 해당 입력을
          Google Gemini에 전송해요.
        </p>
      </details>
      {!session.isSample && session.kind !== "recording" && (
        <SampleSwitch
          checked={sampleMode}
          disabled={busy || captureBusy}
          onChange={(v) => {
            setSampleMode(v);
            setReviewOutage(null);
            setError("");
          }}
        />
      )}
    </>
  );
  return (
    <CompanionProvider value={sessionCharacter}>
      {!session ? (
        <>
          <section className="dc-page-top">
            <div>
              <p className="dc-overline">연습·답장·녹음을 한곳에서</p>
              <h1>내 기록</h1>
            </div>
            <button
              className="dd-primary"
              onClick={() =>
                open(makeSession("recording", undefined, inheritedCompanion))
              }
            >
              <Icon name="mic" size={18} />
              녹음·파일 추가
            </button>
          </section>
          <CompanionNudge
            text="끝난 대화를 돌아보려면 ‘녹음·파일 추가’를 누르세요. 문자로 바꾼 뒤 내 말·상대 말을 확인하고 코칭을 받아요."
            dismissible
          />
          <button
            className="vn-practice-invite"
            aria-label="연습할 상황 고르기"
            onClick={onChooseCard}
          >
            <Icon name="chat" />
            <span>
              <strong>연습할 상황 고르기</strong>
              <small>내가 만든 상황이나 연습 예시를 골라 시작해요.</small>
            </span>
            <Icon name="arrow" />
          </button>
          <div className="record-list-toolbar">
            <div className="record-list-controls">
              <div
                className="purpose-switch"
                role="group"
                aria-label="기록 종류"
              >
                {(
                  [
                    ["all", "전체"],
                    ["mine", "내 기록"],
                    ["sample", "샘플"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={recordFilter === value}
                    onClick={() => setRecordFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label>
                정렬{" "}
                <select
                  aria-label="기록 정렬"
                  value={recordSort}
                  onChange={(e) =>
                    setRecordSort(e.target.value as "recent" | "name")
                  }
                >
                  <option value="recent">최근순</option>
                  <option value="name">이름순</option>
                </select>
              </label>
            </div>
            <label className="dc-search">
              <Icon name="search" size={18} />
              <input
                aria-label="대화 기록 검색"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="제목, 상대, 대화 내용으로 찾기"
              />
            </label>
          </div>
          {recordFilter !== "mine" && !search && (
            <section
              className="record-examples"
              aria-label="녹음 코칭 결과 미리보기"
            >
              <h2>어떤 코칭을 받을 수 있나요?</h2>
              <p>가상 대화의 잘한 점과 개선할 표현을 미리 살펴보세요.</p>
              <RecordingExamples
                onStart={() =>
                  open(makeSession("recording", undefined, inheritedCompanion))
                }
              />
            </section>
          )}
          <p className="vn-caption" role="status">
            {recordFilter === "mine"
              ? "내가 남긴 기록"
              : recordFilter === "sample"
                ? "샘플 기록"
                : "전체 기록"}{" "}
            {matching.length}개
          </p>
          <div className="vn-session-list">
            {matching.map((s) => (
              <button
                key={s.id}
                className="vn-session-card"
                onClick={() => open(s)}
              >
                <span className={"vn-session-icon " + s.kind}>
                  <Companion small character={companionForSession(s)} />
                </span>
                <span>
                  <small>
                    {s.messenger
                      ? "메시지 답장"
                      : s.training
                        ? "기초 훈련"
                        : s.promptPractice
                          ? "AI 요청 연습"
                          : s.daily
                            ? "오늘의 한마디"
                            : s.isSample
                              ? "샘플 · 사전 작성 대화"
                              : s.kind === "chat"
                                ? "친구와 대화"
                                : s.kind === "practice"
                                  ? "상대와 연습"
                                  : "음성 기록"}{" "}
                    · {new Date(s.updatedAt).toLocaleDateString("ko-KR")}
                  </small>
                  <strong>{s.title}</strong>
                  <span>
                    {s.turns.length}개 대화 ·{" "}
                    {s.turns.filter((t) => t.clip).length}개 음성
                    {s.industry ? " · " + s.industry : ""}
                  </span>
                </span>
                <Icon name="arrow" size={18} />
              </button>
            ))}
          </div>
          {!matching.length && (
            <div className="dc-empty-state">
              <Icon name="mic" size={32} />
              <h2>
                {search
                  ? "찾는 기록이 없어요"
                  : recordFilter === "sample"
                    ? "저장된 샘플 기록이 없어요"
                    : "첫 기록을 남겨볼까요?"}
              </h2>
              <p>녹음·파일 추가를 누르거나 대화 카드를 골라 연습해 보세요.</p>
            </div>
          )}
        </>
      ) : (
        <>
          <nav className="purpose-breadcrumb" aria-label="현재 기록 위치">
            <button
              className="dd-back"
              disabled={captureBusy}
              onClick={() =>
                onBackToPreparation ? onBackToPreparation() : open(null)
              }
            >
              <Icon name="back" size={18} />
              {onBackToPreparation ? "연습 준비로" : "내 기록으로"}
            </button>
            <span className="breadcrumb-separator" aria-hidden="true">
              /
            </span>
            <span aria-current="location">
              {session.kind === "practice"
                ? "대화 연습"
                : session.kind === "chat"
                  ? "AI 대화"
                  : "내 대화 돌아보기"}
            </span>
          </nav>
          <section className="vn-session-heading">
            <div>
              <p className="dc-overline">
                {session.kind === "chat"
                  ? sessionCharacter.name + "와 AI 대화"
                  : session.kind === "practice"
                    ? "AI와 역할 대화 연습"
                    : "내 대화 돌아보기"}
              </p>
              <h1>{session.title}</h1>
              {session.isSample && (
                <p className="vn-caption">
                  <span className="dc-sample-badge">샘플</span> 사용법을
                  보여주는 가상의 대화예요. 녹음 원본은 없으며 ‘읽어주기’로 들을
                  수 있어요. 삭제하기 전까지 남아요.
                </p>
              )}
            </div>
            {session.turns.length > 0 && (
              <span className="vn-saved">
                <Icon name="check" size={15} />이 기기에 저장됨
              </span>
            )}
          </section>
          {inConversation ? (
            <>
              <div className="practice-settings-bar">
                <span>
                  {session.languages
                    ? conversationLanguages[session.languages.partner].label
                    : "한국어"}{" "}
                  · 자동 읽기 {autoplay ? "켬" : "끔"} ·{" "}
                  {sampleMode || session.isSample ? "샘플" : "AI 연습"}
                </span>
                <button
                  className="dd-secondary"
                  onClick={() => setSettingsOpen(true)}
                >
                  설정·대화 목표
                </button>
              </div>
              {settingsOpen && (
                <InputDialog
                  open={settingsOpen}
                  title="연습 설정과 대화 목표"
                  onClose={() => setSettingsOpen(false)}
                  busy={captureBusy}
                >
                  {preparationControls}
                </InputDialog>
              )}
            </>
          ) : (
            preparationControls
          )}
          {!session.isSample &&
            (!sampleMode || session.kind === "recording") && (
              <AIConsent
                priority={0}
                config={config}
                checked={consent}
                onChange={setConsent}
                disabled={busy || captureBusy}
              />
            )}
          {session.isSample && (
            <button
              className="dd-primary"
              onClick={() =>
                open(makeSession("practice", session.context, sessionCharacter))
              }
            >
              이 상황으로 새 연습 시작 <Icon name="arrow" size={18} />
            </button>
          )}
          {session.kind !== "recording" && !session.turns.length && (
            <div className="vn-start-practice" data-tour="practice-settings">
              <CompanionNudge
                text={
                  session.kind === "chat"
                    ? "지금 궁금한 일부터 편하게 이야기해 주세요."
                    : sampleMode
                      ? "미리 작성된 상대 말로 연습해요. 답변 후보를 고르거나 직접 적어 대화를 이어가세요."
                      : "AI가 상대 역할로 먼저 말해요. 내가 문자나 목소리로 답하면 대화가 이어져요."
                }
              />
              <button
                className="dd-primary dd-full"
                disabled={!canTalk || busy}
                aria-describedby={
                  !canTalk ? "practice-start-reason" : undefined
                }
                onClick={() => void respond(session)}
              >
                {session.kind === "chat"
                  ? "친구와 대화 시작"
                  : "상대와 연습 시작"}
                <Icon name="play" size={18} />
              </button>
              {!canTalk && (
                <p
                  id="practice-start-reason"
                  className="action-reason"
                  role="status"
                >
                  {!consent
                    ? "AI 전송에 동의하거나 샘플 모드를 선택하면 시작할 수 있어요."
                    : "AI 연결을 확인하고 있어요. 샘플 모드로 먼저 연습할 수 있어요."}
                </p>
              )}
            </div>
          )}
          <div
            hidden={
              session.kind !== "recording" && !session.turns.length && !busy
            }
            className={
              session.kind !== "recording" ? "vn-conversation" : undefined
            }
          >
            <div
              ref={thread}
              className={
                "vn-turns " +
                (session.kind !== "recording" ? "vn-chat-thread" : "")
              }
              aria-label={
                session.kind !== "recording"
                  ? "AI와 주고받는 대화"
                  : "녹음 기록"
              }
            >
              {session.turns.map((t, i) => (
                <article
                  key={t.id}
                  className={"vn-turn " + t.role}
                  tabIndex={-1}
                  data-latest-turn={
                    i === session.turns.length - 1 ? "" : undefined
                  }
                  aria-label={
                    t.role === "user"
                      ? "내가 보낸 답변"
                      : t.role === "assistant"
                        ? "상대의 답변"
                        : "내 기록"
                  }
                >
                  <div className="vn-turn-meta">
                    <span>
                      {t.role === "assistant"
                        ? session.kind === "chat"
                          ? sessionCharacter.name
                          : "연습 상대"
                        : t.role === "user"
                          ? "나"
                          : (t.clip ? "녹음 " : "문자 기록 ") + (i + 1)}
                      {t.role === "assistant" && !t.sample && (
                        <small>
                          {t.origin === "recording"
                            ? "녹음에서 가져온 말"
                            : t.sample || session.isSample
                              ? "예시"
                              : "AI"}
                        </small>
                      )}
                    </span>
                    <time>
                      {new Date(t.createdAt).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  {t.sample && (
                    <SampleNotice
                      sample={t.sample}
                      compact
                      badge={session.kind !== "recording"}
                    />
                  )}
                  {t.clip && <AudioPlayer clip={t.clip} />}
                  {t.text ? (
                    <TermText
                      text={t.text}
                      candidates={t.terms}
                      onTerm={(w) => void term(w, t.text)}
                    />
                  ) : (
                    <p className="vn-caption">
                      음성 원본을 저장했어요. 문자 변환을 하지 않은 기록이에요.
                    </p>
                  )}
                  <div className="vn-turn-actions">
                    {t.clip &&
                      session.kind === "recording" &&
                      (!t.text ||
                        (t.clip.transcription &&
                          !t.clip.transcription.complete)) && (
                        <button
                          className="dd-link"
                          disabled={
                            busy ||
                            captureBusy ||
                            !consent ||
                            !config.voiceAvailable
                          }
                          onClick={() => void transcribeSaved(t)}
                        >
                          {t.clip.transcription &&
                          !t.clip.transcription.complete
                            ? "문자 변환 이어서"
                            : "저장한 음성 문자로 바꾸기"}
                        </button>
                      )}
                    {t.role === "assistant" && (
                      <button
                        className="dd-link"
                        aria-label={
                          speaking === t.id ? "읽기 멈추기" : "읽어주기"
                        }
                        onClick={() => speak(t)}
                      >
                        <Icon
                          name={speaking === t.id ? "pause" : "volume"}
                          size={16}
                        />
                        {speaking === t.id ? "멈춤" : "듣기"}
                      </button>
                    )}
                    {t.text && (
                      <>
                        {!session.isSample && (
                          <button
                            className="dd-link"
                            aria-label="중요 용어 찾기"
                            disabled={busy || captureBusy}
                            onClick={() => {
                              if (!consent || !config.available || sampleMode) {
                                setTermRequestId(t.id);
                                setTermStatus(null);
                                setError("");
                                return;
                              }
                              void extract(t);
                            }}
                          >
                            용어 찾기
                          </button>
                        )}
                        <button
                          className="dd-link"
                          aria-label="표현 직접 스크랩"
                          onClick={() => {
                            const selected =
                              window.getSelection()?.toString().trim() || "";
                            void term(
                              selected && t.text.includes(selected)
                                ? selected
                                : "",
                              t.text,
                            );
                          }}
                        >
                          스크랩
                        </button>
                      </>
                    )}
                  </div>
                  {termRequestId === t.id && (
                    <section
                      className="vn-term-help"
                      aria-label="용어 찾기 안내"
                    >
                      <p>
                        {!config.available
                          ? "AI 연결이 준비되지 않아 용어를 찾을 수 없어요. 원하는 표현은 스크랩으로 직접 저장할 수 있어요."
                          : sampleMode
                            ? "용어 찾기는 AI 기능이에요. 전송에 동의한 뒤 AI 모드로 전환해 실행할 수 있어요."
                            : "이 기록의 문장에서 용어를 찾아드려요. 처음 한 번 AI 전송 동의가 필요해요."}
                      </p>
                      {config.available && (
                        <AIConsent
                          priority={-1}
                          config={config}
                          checked={consent}
                          onChange={setConsent}
                          disabled={busy || captureBusy}
                        />
                      )}
                      <div className="vn-term-help-actions">
                        {config.available && (
                          <button
                            className="dd-secondary"
                            disabled={!consent || busy || captureBusy}
                            onClick={() => {
                              setSampleMode(false);
                              void extract(t);
                            }}
                          >
                            {sampleMode
                              ? "AI로 전환하고 용어 찾기"
                              : "용어 찾기 시작"}
                          </button>
                        )}
                        <button
                          className="dd-link"
                          onClick={() => setTermRequestId(null)}
                        >
                          닫기
                        </button>
                      </div>
                    </section>
                  )}
                  {termStatus?.id === t.id && (
                    <div className="vn-term-status">
                      <p
                        className={termStatus.error ? "dd-error" : "vn-caption"}
                        role={termStatus.error ? "alert" : "status"}
                      >
                        {termStatus.text}
                      </p>
                      {termStatus.error && (
                        <p className="vn-caption">
                          원하는 표현은 위의 ‘스크랩’으로 직접 저장할 수 있어요.
                        </p>
                      )}
                    </div>
                  )}
                  {!!t.terms.length && (
                    <div
                      className="vn-term-results"
                      role="group"
                      aria-label="추출한 중요 용어"
                    >
                      <span>찾은 용어 {t.terms.length}개 · 눌러서 저장</span>
                      {t.terms.map((word) => (
                        <button
                          className="dd-secondary"
                          key={word}
                          onClick={() => void term(word, t.text)}
                        >
                          {word}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              ))}
              {responding && (
                <p className="vn-partner-typing" role="status">
                  <span aria-hidden="true">•••</span>{" "}
                  {sampleMode
                    ? "연습 상대의 다음 말을 준비하고 있어요"
                    : "상대가 답변을 준비하고 있어요"}
                </p>
              )}
            </div>
            {!session.isSample &&
              session.kind === "recording" &&
              session.turns.length > 0 && (
                <>
                  <RecordingAnalysis
                    key={session.id}
                    session={session}
                    config={config}
                    disabled={captureBusy || busy}
                    onBusy={setBusy}
                    onSave={async (draft) => {
                      await persist({
                        ...session,
                        recordingAnalysis: draft,
                        updatedAt: new Date().toISOString(),
                      });
                    }}
                    onPractice={async (next) => {
                      await putSession(next);
                      open(next);
                      await refresh();
                    }}
                  />
                </>
              )}
            {speaking && (
              <CompanionNudge
                mood="speak"
                text="상대의 말을 읽고 있어요. 다 듣고 나서 편하게 답해보세요."
              />
            )}
            {busy && !responding && (
              <CompanionNudge
                mood="think"
                text="대화의 맥락을 살펴보고 있어요. 잠시 기다려 주세요."
              />
            )}
            {!session.isSample && pending && !busy && !complete && (
              <button
                className="dd-secondary dd-full"
                disabled={!canTalk}
                onClick={() => void respond(session)}
              >
                상대 답변 다시 받기
              </button>
            )}
            {complete && (
              <CompanionNudge
                mood="done"
                text="이번 연습을 마쳤어요. 남겨둔 말을 읽어보고 필요한 표현을 모아보세요."
              />
            )}
            {!session.isSample &&
              (session.kind === "recording" || session.turns.length > 0) && (
                <div hidden={!!complete}>
                  <VoiceComposer
                    inDialog={session.kind === "recording"}
                    replyTo={
                      session.kind !== "recording" && !pending
                        ? session.turns.at(-1)
                        : undefined
                    }
                    goal={session.context?.goal}
                    candidates={
                      !pending ? session.turns.at(-1)?.suggestions : undefined
                    }
                    candidatesSample={
                      !pending
                        ? session.turns.at(-1)?.suggestionsSample
                        : undefined
                    }
                    onRequestCandidates={
                      session.kind === "practice" && !pending && !complete
                        ? suggestReplies
                        : undefined
                    }
                    longRecording={session.kind === "recording"}
                    key={session.id}
                    config={config}
                    consent={consent}
                    sampleMode={sampleMode && session.kind !== "recording"}
                    onEnableAI={() => setSampleMode(false)}
                    onConsentChange={setConsent}
                    submitDisabled={session.kind !== "recording" && !canTalk}
                    disabled={
                      busy ||
                      (session.kind !== "recording" &&
                        (!!pending || !!complete))
                    }
                    requireText={session.kind !== "recording"}
                    textFirst={session.kind !== "recording"}
                    submitLabel={
                      session.kind !== "recording"
                        ? "내 답변 보내기"
                        : "음성과 문자 기록 저장"
                    }
                    onUse={saveDraft}
                    onActivity={setCaptureBusy}
                    suggestion={suggestion}
                  />
                </div>
              )}
          </div>
          {!session.isSample &&
            session.kind === "practice" &&
            session.turns.some((turn) => turn.role === "user") && (
              <GardenPractice
                key={"garden-" + session.id}
                session={session}
                disabled={captureBusy || busy}
                onSave={persist}
                onRoom={onRoom}
                onPractice={async (next) => {
                  await putSession(next);
                  open(next);
                  await refresh();
                }}
              />
            )}
          {session.practicePlan && (
            <aside className="dc-drill-focus">
              <strong>이번에 해볼 한 가지</strong>
              <p>{session.practicePlan.focus}</p>
              <small>
                앞의 {session.practicePlan.carriedTurns}개 말풍선은 지난 대화의
                맥락이에요. 마지막 상대 말에 새로 답해보세요.
              </small>
            </aside>
          )}
          {!session.isSample &&
            session.kind === "practice" &&
            session.turns.filter((t) => t.role === "user").length >= 2 && (
              <section className="dc-review">
                {reviewOutage && (
                  <ReviewExample
                    context={practiceSampleContext(session.context)}
                    outage={reviewOutage}
                  />
                )}
                <div className="vn-toolbar">
                  <h2>내 대화 복기</h2>
                  <span>
                    {currentReview
                      ? "저장된 AI 복기"
                      : sampleMode
                        ? "사전 작성 예시"
                        : "AI 분석 · 이 기기에 저장"}
                  </span>
                </div>
                {currentReview ? (
                  <>
                    <article>
                      <h3>다음에는 이렇게 말해보세요</h3>
                      <p className="dc-review-rewrite">
                        {currentReview.improvement.rewrite}
                      </p>
                      <p>
                        <strong>이번 연습의 초점</strong> ·{" "}
                        {currentReview.focus}
                      </p>
                    </article>
                    <details className="dc-guide-faq" data-review-evidence>
                      <summary>내 말에서 근거 보기</summary>
                      <article>
                        <h3>고쳐볼 표현</h3>
                        <blockquote>
                          {currentReview.improvement.quote}
                        </blockquote>
                        <p>{currentReview.improvement.note}</p>
                      </article>
                      <article>
                        <h3>잘한 점</h3>
                        <blockquote>{currentReview.strength.quote}</blockquote>
                        <p>{currentReview.strength.note}</p>
                      </article>
                    </details>
                    <button
                      className="dd-primary"
                      disabled={busy || captureBusy}
                      onClick={() => void startDrill()}
                    >
                      이 장면부터 다시 연습 <Icon name="arrow" size={16} />
                    </button>
                    <small>
                      목표와 지킬 선은 유지돼요. AI 제안이 내 의도와 맞는지
                      근거를 확인하세요.
                    </small>
                    <details className="dc-guide-faq training-review-entry">
                      <summary>필요한 기술부터 훈련하기</summary>
                      <p>
                        질문하기·생각 넓히기·핵심 전달을 훈련한 뒤 이 장면으로
                        돌아와요.
                      </p>
                      <button
                        className="dd-secondary"
                        disabled={busy || captureBusy}
                        onClick={() => {
                          try {
                            setTrainingFrom(trainingOrigin(session));
                            window.scrollTo({ top: 0 });
                          } catch (e) {
                            setError(
                              e instanceof Error
                                ? e.message
                                : "복기를 확인해 주세요.",
                            );
                          }
                        }}
                      >
                        이 복기에서 기초 훈련 시작
                      </button>
                    </details>
                  </>
                ) : (
                  <>
                    <p>
                      내가 실제로 한 말에서 잘한 점과 고쳐 말할 부분을 찾아요.
                      분석한 장면은 다시 연습할 수 있어요.
                    </p>
                    <button
                      className="dd-secondary"
                      disabled={busy || captureBusy || !canTalk}
                      onClick={() => void reviewPractice()}
                    >
                      {sampleMode
                        ? "가상 대화의 복기 예시 보기"
                        : session.review
                          ? "이어진 대화까지 다시 복기"
                          : "AI로 이 대화 복기하기"}
                    </button>
                    <small>
                      이 대화의 문자와 카드 설정을 전송해요. 음성 파일과 다른
                      대화는 보내지 않아요.
                    </small>
                  </>
                )}
              </section>
            )}
          {session.turns.length > 0 && (
            <div className="vn-toolbar vn-session-tools">
              <button
                className="dd-link"
                onClick={() =>
                  downloadBlob(
                    new Blob(
                      [
                        `# ${session.title}\n\n` +
                          session.turns
                            .map(
                              (t) =>
                                `**${t.role === "assistant" ? (session.kind === "chat" ? sessionCharacter.name : session.context?.partner) || "AI 연습 상대" : t.role === "user" ? "나" : "녹음"}**\n\n${t.origin === "recording" ? "[녹음에서 가져온 상대 말]\n\n" : ""}${t.sample ? "[사전 작성 샘플 · " + t.sample.topic + "] " + outageMessage(t.sample.outage) + "\n\n" : ""}${t.text || "(문자 변환 없는 음성)"}\n`,
                            )
                            .join("\n"),
                      ],
                      { type: "text/markdown;charset=utf-8" },
                    ),
                    "ddeundeun-conversation.md",
                  )
                }
              >
                <Icon name="download" size={16} />
                대화 문자 내려받기
              </button>
              {session.kind !== "recording" && !session.isSample && (
                <button
                  className="dd-link"
                  disabled={busy || captureBusy}
                  onClick={() =>
                    open({
                      ...makeSession(
                        session.kind,
                        session.context,
                        sessionCharacter,
                      ),
                      industry: session.industry,
                      languages: session.languages,
                    })
                  }
                >
                  같은 설정으로 새 대화
                </button>
              )}
              <button
                className="dd-link dd-danger"
                disabled={busy || captureBusy}
                onClick={async () => {
                  if (
                    !confirm(
                      "이 기록의 음성과 문자를 이 기기에서 삭제할까요? 스크랩한 용어 노트는 남아요.",
                    )
                  )
                    return;
                  try {
                    await deleteSession(session.id);
                    open(null);
                    await refresh();
                  } catch {
                    setError("기록을 삭제하지 못했어요.");
                  }
                }}
              >
                기록 삭제
              </button>
            </div>
          )}
        </>
      )}
      {error && (
        <>
          <p className="dd-error" role="alert">
            {error}
          </p>
          <QuotaHelp error={error} />
        </>
      )}
      {notice && <CompanionNudge mood="done" text={notice} dismissible />}
      {seed && (
        <TermEditor
          key={seed.note?.id || seed.term}
          seed={seed}
          config={session?.kind === "recording" ? config : sampleConfig}
          onClose={() => setSeed(null)}
          onSaved={() => setNotice("우리 일의 말을 용어 노트에 저장했어요.")}
        />
      )}
    </CompanionProvider>
  );
}
