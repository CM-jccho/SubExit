"use client";
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
}: {
  initialCard?: ConversationCard;
  mode?: "practice" | "records" | "chat";
  initialCompanion?: CompanionCharacter;
  initialSessionId?: string;
  config: AIConfig;
  onChooseCard: () => void;
}) {
  const inheritedCompanion = useCompanion();
  const [session, setSession] = useState<VoiceSession | null>(() =>
      mode === "practice" && initialCard
        ? makeSession("practice", initialCard, inheritedCompanion)
        : mode === "chat" && initialCompanion
          ? makeSession("chat", undefined, initialCompanion)
          : null,
    ),
    [sessions, setSessions] = useState<VoiceSession[]>([]),
    [consent, setConsent] = useState(false),
    [sampleMode, setSampleMode] = useState(false),
    [reviewOutage, setReviewOutage] = useState<AIOutage | null>(null),
    [busy, setBusy] = useState(false),
    [captureBusy, setCaptureBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [seed, setSeed] = useState<TermSeed | null>(null),
    [autoplay, setAutoplay] = useState(false),
    [speaking, setSpeaking] = useState(""),
    [suggestion, setSuggestion] = useState<{ text: string; id: number }>();
  const abort = useRef<AbortController | null>(null),
    generation = useRef(0),
    end = useRef<HTMLDivElement>(null),
    mounted = useRef(true);
  const refresh = () =>
    listSessions()
      .then((r) =>
        setSessions(r.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
      )
      .catch(() =>
        setError(
          "음성 기록을 불러오지 못했어요. 브라우저 저장 권한을 확인해 주세요.",
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
          if (found) setSession(found);
          else
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
  useEffect(() => {
    if (session?.turns.length)
      end.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "nearest",
      });
  }, [session?.turns.length]);
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
    await putSession(next);
    if (mounted.current) {
      setSession(next);
      setSessions((rows) => [next, ...rows.filter((s) => s.id !== next.id)]);
    }
  }
  function open(s: VoiceSession | null) {
    generation.current++;
    abort.current?.abort();
    stopAudio();
    setBusy(false);
    setConsent(false);
    setSuggestion(undefined);
    setError("");
    setNotice("");
    setSession(s);
    if (s?.kind === "recording") setSampleMode(false);
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
    setError("");
    setNotice("");
    const timeout = setTimeout(() => c.abort(), 25000);
    try {
      const d = await sampledRequest({
        operation: current.kind === "chat" ? "companion" : "partner",
        language: current.languages?.partner,
        context:
          current.kind === "chat"
            ? current.turns.at(-1)?.text || current.companion?.specialty || ""
            : current.context?.situation || "",
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
      if (generation.current !== id) return;
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
      if (generation.current === id) setBusy(false);
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
      clip: draft.clip,
      terms: [],
      createdAt: new Date().toISOString(),
    };
    const next = {
      ...session,
      updatedAt: new Date().toISOString(),
      turns: [...session.turns, turn],
    };
    await persist(next);
    setSuggestion(undefined);
    setNotice("음성과 문자를 이 기기에 저장했어요.");
    if (session.kind !== "recording") await respond(next);
  }
  async function extract(turn: VoiceTurn) {
    if (!session) return;
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
          text: turn.text.slice(0, 6000),
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
    } catch (e) {
      if (generation.current === id)
        setError(
          e instanceof Error && e.name === "AbortError"
            ? "용어 찾기가 지연됐어요. 다시 시도해 주세요."
            : e instanceof Error
              ? e.message
              : "용어를 찾지 못했어요.",
        );
    } finally {
      clearTimeout(timeout);
      if (generation.current === id) setBusy(false);
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
        context: session.context?.situation || "",
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
    if (!session || !turn.clip) return;
    setError("");
    setBusy(true);
    const c = new AbortController(),
      id = ++generation.current;
    abort.current = c;
    const timeout = setTimeout(() => c.abort(), 25000);
    try {
      const form = new FormData();
      form.append("audio", turn.clip.blob, turn.clip.name);
      form.append("consent", String(consent));
      form.append("adultConsent", String(consent));
      form.append("sampleConsent", String(consent));
      const r = await aiFetch("/api/transcribe", {
        method: "POST",
        body: form,
        signal: c.signal,
      });
      const d = await r.json();
      if (generation.current !== id) return;
      if (!r.ok) throw new Error(d.error);
      if (typeof d.text !== "string" || !d.text.trim())
        throw new Error(
          "음성에서 말을 찾지 못했어요. 원본을 재생해 확인해 주세요.",
        );
      await persist({
        ...session,
        turns: session.turns.map((t) =>
          t.id === turn.id
            ? { ...t, text: d.text.slice(0, 4000), terms: [] }
            : t,
        ),
        updatedAt: new Date().toISOString(),
      });
      setNotice(
        "문자 변환이 끝나 기록에 추가했어요. 단어를 눌러 용어를 모아보세요.",
      );
    } catch (e) {
      if (generation.current === id)
        setError(
          e instanceof Error && e.name === "AbortError"
            ? "음성 인식이 지연됐어요. 원본은 그대로 남아 있으니 다시 시도해 주세요."
            : e instanceof Error
              ? e.message
              : "음성을 인식하지 못했어요.",
        );
    } finally {
      clearTimeout(timeout);
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
  const matching = sessions.filter((s) =>
    [s.title, s.industry, s.context?.partner, ...s.turns.map((t) => t.text)]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const currentReview =
    session?.context &&
    session.review?.sourceKey === reviewKey(session.context, session.turns)
      ? session.review
      : undefined;
  const sessionCharacter = session
    ? companionForSession(session)
    : inheritedCompanion;
  return (
    <CompanionProvider value={sessionCharacter}>
      {!session ? (
        <>
          <section className="dc-page-top">
            <div>
              <p className="dc-overline">말하고, 듣고, 다시 꺼내기</p>
              <h1>음성 기록</h1>
            </div>
            <button
              className="dd-primary"
              onClick={() =>
                open(makeSession("recording", undefined, inheritedCompanion))
              }
            >
              <Icon name="mic" size={18} />새 녹음
            </button>
          </section>
          <CompanionNudge
            text="녹음파일도 여기에 모아둘 수 있어요. 연습한 대화도 함께 남아요."
            dismissible
          />
          <button className="vn-practice-invite" onClick={onChooseCard}>
            <Icon name="chat" />
            <span>
              <strong>저장한 상대와 대화 연습하기</strong>
              <small>내가 말하면, 그 상황의 상대가 답해요.</small>
            </span>
            <Icon name="arrow" />
          </button>
          <label className="dc-search">
            <Icon name="search" size={18} />
            <input
              aria-label="음성 기록 검색"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="제목, 상대, 대화 내용으로 찾기"
            />
          </label>
          <RecordingExamples />
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
                    {s.isSample
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
                {search ? "찾는 기록이 없어요" : "첫 목소리를 남겨볼까요?"}
              </h2>
              <p>새 녹음을 누르거나 대화 카드를 골라 연습해 보세요.</p>
            </div>
          )}
        </>
      ) : (
        <>
          <button
            className="dd-back"
            disabled={captureBusy}
            onClick={() => open(null)}
          >
            <Icon name="back" size={18} />
            음성 기록 목록
          </button>
          <section className="vn-session-heading">
            <div>
              <p className="dc-overline">
                {session.kind === "chat"
                  ? sessionCharacter.name + "와 AI 대화"
                  : session.kind === "practice"
                    ? "내 상황으로 대화 연습"
                    : "나의 음성 기록"}
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
          {session.languages &&
            session.turns.length > 0 &&
            session.kind !== "recording" && (
              <p className="vn-caption">
                상대 · {conversationLanguages[session.languages.partner].label}{" "}
                / 내 답변 후보 ·{" "}
                {conversationLanguages[session.languages.mine].label}
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
              이 브라우저에 저장돼요. 기기 간 자동 동기화는 없으며 브라우저
              데이터를 지우면 사라질 수 있어요. 음성 원본과 대화 문자를 내려받을
              수 있어요. AI 문자 변환·연습·친구 대화·복기·용어 설명을 요청하면
              해당 입력을 Google Gemini에 전송해요.
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
          {!session.isSample &&
            (!sampleMode || session.kind === "recording") && (
              <AIConsent
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
          {session.kind !== "recording" && !session.turns.length && (
            <div className="vn-start-practice" data-tour="practice-settings">
              <CompanionNudge
                text={
                  session.kind === "chat"
                    ? "지금 궁금한 일부터 편하게 이야기해 주세요."
                    : "상대 역할은 제가 맡을게요. 시작하면 그 상황에 맞춰 말을 걸어요."
                }
              />
              <button
                className="dd-primary dd-full"
                disabled={!canTalk || busy}
                onClick={() => void respond(session)}
              >
                {session.kind === "chat"
                  ? "친구와 대화 시작"
                  : "상대와 연습 시작"}
                <Icon name="play" size={18} />
              </button>
            </div>
          )}
          <div className="vn-turns">
            {session.turns.map((t, i) => (
              <article key={t.id} className={"vn-turn " + t.role}>
                <div className="vn-turn-meta">
                  <span>
                    {t.role === "assistant"
                      ? session.kind === "chat"
                        ? sessionCharacter.name
                        : session.context?.partner || "연습 상대"
                      : t.role === "user"
                        ? "나"
                        : "녹음 " + (i + 1)}
                    {t.role === "assistant" && (
                      <small>
                        {t.origin === "recording"
                          ? "녹음에서 가져온 말"
                          : t.sample || session.isSample
                            ? "샘플"
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
                    compact={i < session.turns.length - 1}
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
                  {t.clip && session.kind === "recording" && !t.text && (
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
                      저장한 음성 문자로 바꾸기
                    </button>
                  )}
                  {t.role === "assistant" && (
                    <button className="dd-link" onClick={() => speak(t)}>
                      <Icon
                        name={speaking === t.id ? "pause" : "volume"}
                        size={16}
                      />
                      {speaking === t.id ? "읽기 멈추기" : "읽어주기"}
                    </button>
                  )}
                  {t.text && (
                    <>
                      {!session.isSample && (
                        <button
                          className="dd-link"
                          disabled={
                            busy || captureBusy || !canTalk || sampleMode
                          }
                          onClick={() => void extract(t)}
                        >
                          중요 용어 찾기
                        </button>
                      )}
                      <button
                        className="dd-link"
                        onClick={() => void term("", t.text)}
                      >
                        표현 직접 스크랩
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
            <div ref={end} />
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
                    context={session.context?.situation || ""}
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
                      <h3>잘한 점</h3>
                      <blockquote>{currentReview.strength.quote}</blockquote>
                      <p>{currentReview.strength.note}</p>
                    </article>
                    <article>
                      <h3>다음에는 이렇게</h3>
                      <blockquote>{currentReview.improvement.quote}</blockquote>
                      <p>{currentReview.improvement.note}</p>
                      <strong>다시 말해보기</strong>
                      <p className="dc-review-rewrite">
                        {currentReview.improvement.rewrite}
                      </p>
                    </article>
                    <p>
                      <strong>다음 연습의 목표</strong> · {currentReview.focus}
                    </p>
                    <button
                      className="dd-primary"
                      disabled={busy || captureBusy}
                      onClick={() => void startDrill()}
                    >
                      이 장면부터 다시 연습 <Icon name="arrow" size={16} />
                    </button>
                    <small>
                      내 원래 목표와 지킬 선은 유지돼요. 복기는 AI의 제안이므로
                      실제 의도와 맞는지 확인해 주세요.
                    </small>
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
          {speaking && (
            <CompanionNudge
              mood="speak"
              text="상대의 말을 읽고 있어요. 다 듣고 나서 편하게 답해보세요."
            />
          )}
          {busy && (
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
            session.kind === "practice" &&
            !!session.turns.length &&
            !pending &&
            !complete &&
            !session.turns.at(-1)?.suggestions?.length && (
              <button
                className="vn-get-choices dd-secondary dd-full"
                disabled={busy || captureBusy || !canTalk}
                onClick={() => void suggestReplies()}
              >
                <Icon name="chat" size={18} />내 목표에 맞는 답변 후보 3개 보기
              </button>
            )}
          {!session.isSample &&
            session.kind === "practice" &&
            !pending &&
            !complete &&
            !!session.turns.at(-1)?.suggestions?.length && (
              <details className="vn-reply-choices" open>
                <summary>
                  <Icon name="chat" size={17} />
                  어떻게 답할까요? 후보 3개 보기
                </summary>
                <p className="vn-caption">
                  하나를 골라 내 말로 바꿔보세요. 고르는 것만으로 전송되지는
                  않아요.
                </p>
                {session.turns.at(-1)?.suggestionsSample && (
                  <SampleNotice
                    sample={session.turns.at(-1)!.suggestionsSample!}
                  />
                )}
                <div className="vn-choice-list">
                  {session.turns.at(-1)!.suggestions!.map((s, i) => (
                    <button
                      key={i}
                      disabled={busy || captureBusy}
                      onClick={() => {
                        setSuggestion({ text: s, id: Date.now() });
                        setNotice(
                          "답변 후보를 입력칸에 넣었어요. 수정하거나 직접 읽어볼 수 있어요.",
                        );
                      }}
                    >
                      <span>0{i + 1}</span>
                      {s}
                      <Icon name="arrow" size={16} />
                    </button>
                  ))}
                </div>
              </details>
            )}
          {!session.isSample &&
            (session.kind === "recording" ||
              (session.turns.length > 0 && !pending && !complete)) && (
              <VoiceComposer
                key={session.id}
                config={session.kind === "recording" ? config : sampleConfig}
                consent={
                  sampleMode && session.kind !== "recording" ? false : consent
                }
                disabled={busy || (session.kind !== "recording" && !canTalk)}
                requireText={session.kind !== "recording"}
                submitLabel={
                  session.kind !== "recording"
                    ? "내 답변 보내기"
                    : "음성과 문자 기록 저장"
                }
                onUse={saveDraft}
                onActivity={setCaptureBusy}
                suggestion={suggestion}
              />
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
                className="dd-link"
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
