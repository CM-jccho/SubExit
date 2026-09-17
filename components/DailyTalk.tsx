"use client";
import { useAIConsent } from "./ConsentSession";
import { useEffect, useRef, useState } from "react";
import {
  dailyCategories,
  dailyCount,
  dailyGreeting,
  dailyPrepared,
  dailySelection,
  dailyTurn,
  createDailySession,
  findDailyTopic,
  newsTopic,
  readDailyFavorites,
  saveDailyFavorites,
  type DailyCategory,
  type DailyTopic,
} from "@/lib/daily-talk";
import { aiFetch, AIServiceError, connectionOutage } from "@/lib/ai-client";
import {
  deleteSession,
  listSessions,
  putSession,
  type VoiceSession,
} from "@/lib/voice-notebook";
import { companionForSession, type CompanionCharacter } from "@/lib/companions";
import { CompanionProvider, useCompanion } from "./CompanionTheme";
import { Companion, Icon } from "./CompanionUI";
import VoiceComposer, {
  AIConsent,
  type AIConfig,
  type VoiceDraft,
} from "./VoiceComposer";
import AudioPlayer from "./AudioPlayer";
import SampleNotice from "./SampleNotice";
import TrendSearch from "./TrendSearch";
import type { TrendResult } from "@/lib/trend-search";

export function DailyInvite({
  onClick,
  character,
}: {
  onClick: () => void;
  character?: CompanionCharacter;
}) {
  const [greeting, setGreeting] = useState("잠깐, 오늘의 한마디 나눌까요?");
  useEffect(() => {
    const update = () => setGreeting(dailyGreeting());
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, []);
  return (
    <button className="daily-invite" onClick={onClick}>
      <Companion small character={character} />
      <span>
        <strong>{greeting}</strong>
        <small>오늘의 한마디 · 세 번 정도, 편하게 이야기해요</small>
      </span>
      <Icon name="arrow" />
    </button>
  );
}
export default function DailyTalk({
  config,
  initialSession,
  character,
  onRecords,
}: {
  config: AIConfig;
  initialSession?: VoiceSession;
  character?: CompanionCharacter;
  onRecords: () => void;
}) {
  const inherited = useCompanion();
  const [session, setSession] = useState<VoiceSession | null>(
      initialSession || null,
    ),
    [category, setCategory] = useState<DailyCategory>("everyday"),
    [offset, setOffset] = useState(0),
    [favorites, setFavorites] = useState<string[]>([]),
    [recent, setRecent] = useState<VoiceSession[]>([]),
    [now, setNow] = useState(new Date(0)),
    [busy, setBusy] = useState(false),
    [capture, setCapture] = useState(false),
    [useAI, setUseAI] = useState(false),
    [consent, setConsent] = useAIConsent(),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [suggestion, setSuggestion] = useState<{ text: string; id: number }>(),
    [reflectionId, setReflectionId] = useState(""),
    [rewrite, setRewrite] = useState("");
  const alive = useRef(true),
    lock = useRef(false),
    abort = useRef<AbortController | null>(null),
    end = useRef<HTMLDivElement>(null);
  const friend = session
    ? companionForSession(session)
    : character || inherited;
  useEffect(() => {
    alive.current = true;
    setNow(new Date());
    setFavorites(readDailyFavorites());
    listSessions()
      .then((rows) => {
        if (alive.current)
          setRecent(
            rows
              .filter((s) => s.daily)
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
          );
      })
      .catch(() => setError("지난 한마디를 불러오지 못했어요."));
    return () => {
      alive.current = false;
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (session?.turns.length)
      end.current?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
  }, [session?.turns.length]);
  async function persist(next: VoiceSession) {
    await putSession(next);
    if (alive.current) {
      setSession(next);
      setRecent((rows) => [next, ...rows.filter((s) => s.id !== next.id)]);
    }
  }
  async function start(t: DailyTopic, search?: TrendResult) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await persist(createDailySession(t, friend, search));
      setSuggestion(undefined);
      setRewrite("");
      setReflectionId("");
      setNotice("");
    } catch {
      setError("대화를 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function respond(current: VoiceSession, prepared = false) {
    const topic = findDailyTopic(current.daily!.topicId)!;
    const count = dailyCount(current),
      c = new AbortController();
    abort.current = c;
    const timer = setTimeout(() => c.abort(), 25000);
    try {
      let turn;
      if (!useAI || prepared) turn = dailyPrepared(topic, count);
      else {
        try {
          const r = await aiFetch("/api/daily-talk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: c.signal,
            body: JSON.stringify({
              topicId: topic.id,
              companion: friend,
              messages: current.turns.map((t) => ({
                role: t.role,
                text: t.text,
              })),
              consent,
              adultConsent: consent,
              sampleConsent: consent,
              ...(current.daily?.search
                ? { searchContext: current.daily.search.text }
                : {}),
            }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || "대화를 이어가지 못했어요.");
          if (
            typeof d.reply !== "string" ||
            !d.reply.trim() ||
            !Array.isArray(d.choices)
          )
            throw new AIServiceError({
              ...connectionOutage(),
              reason: "response",
            });
          turn = { ...dailyTurn(d.reply, "assistant"), suggestions: d.choices };
        } catch (e) {
          if (!alive.current) return;
          if (e instanceof AIServiceError)
            turn = dailyPrepared(topic, count, e.outage);
          else if (e instanceof Error && e.name === "AbortError")
            turn = dailyPrepared(topic, count, connectionOutage());
          else throw e;
        }
      }
      if (alive.current)
        await persist({
          ...current,
          turns: [...current.turns, turn],
          updatedAt: new Date().toISOString(),
          daily: { ...current.daily!, completed: count >= 3 },
        });
    } catch (e) {
      if (alive.current)
        setError(
          (e instanceof Error ? e.message : "응답을 저장하지 못했어요.") +
            " 내 말은 저장됐어요. 아래에서 다시 이어갈 수 있어요.",
        );
    } finally {
      clearTimeout(timer);
      abort.current = null;
    }
  }
  async function send(draft: VoiceDraft) {
    if (
      !session ||
      lock.current ||
      session.daily?.completed ||
      dailyCount(session) >= 3
    )
      return;
    if (useAI && (!consent || !config.available))
      throw new Error(
        "AI 전송 안내를 확인하거나 준비된 질문으로 전환해 주세요.",
      );
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const next = {
        ...session,
        turns: [
          ...session.turns,
          { ...dailyTurn(draft.text, "user"), clip: draft.clip },
        ],
        updatedAt: new Date().toISOString(),
      };
      await persist(next);
      setSuggestion(undefined);
      await respond(next);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function retry(prepared: boolean) {
    if (!session || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await respond(session, prepared);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function finish() {
    if (!session || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await persist({
        ...session,
        daily: { ...session.daily!, completed: true },
        updatedAt: new Date().toISOString(),
      });
    } catch {
      setError("마무리 상태를 저장하지 못했어요.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function remember(id: string) {
    try {
      const next = favorites.includes(id)
        ? favorites.filter((f) => f !== id)
        : [...favorites, id];
      saveDailyFavorites(next);
      setFavorites(next);
      setNotice(
        next.includes(id)
          ? "이 주제를 다음에도 추천할게요. 대화에서 취향을 자동으로 추측하지 않아요."
          : "추천 취향에서 지웠어요.",
      );
    } catch {
      setError("추천 취향을 저장하지 못했어요.");
    }
  }
  const topic = session?.daily
      ? findDailyTopic(session.daily.topicId)
      : undefined,
    pending = session?.turns.at(-1)?.role === "user",
    done = session?.daily?.completed;
  const userTurns = session?.turns.filter((t) => t.role === "user") || [],
    selected = userTurns.find((t) => t.id === reflectionId) || userTurns.at(-1);
  async function reflect() {
    if (
      !session ||
      !selected ||
      rewrite.trim().length < 2 ||
      rewrite.trim() === selected.text.trim()
    )
      return;
    try {
      await persist({
        ...session,
        daily: {
          ...session.daily!,
          reflection: {
            turnId: selected.id,
            original: selected.text,
            rewrite: rewrite.trim(),
          },
        },
      });
      setNotice("내가 고친 표현을 저장했어요.");
    } catch {
      setError("표현을 저장하지 못했어요.");
    }
  }
  return (
    <CompanionProvider value={friend}>
      <section className="daily-talk" aria-label={"가볍게 이야기하기"}>
        <div className="dc-page-top">
          <div>
            <p className="dc-overline">점수 없이, 편하게 나누는 1~3분</p>
            <h1>{"가볍게 이야기하기"}</h1>
          </div>
          <button
            className="dd-link"
            disabled={busy || capture}
            onClick={onRecords}
          >
            지난 대화 보기
          </button>
        </div>
        {error && (
          <p className="dd-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="dc-toast">
            {notice}
          </p>
        )}
        {!session ? (
          <>
            <div className="daily-welcome">
              <Companion character={friend} />
              <div>
                <h2>{dailyGreeting(now)}</h2>
                <p>
                  무슨 말을 할지 고민되면 주제부터 골라보세요. 하루를 건너뛰어도
                  괜찮아요.
                </p>
              </div>
            </div>
            {!!recent.length && (
              <div className="daily-recent">
                <strong>
                  {recent[0].daily?.completed
                    ? "지난번 이야기"
                    : "이어 나눌 이야기"}
                </strong>
                <button
                  className="dd-link"
                  onClick={() => {
                    setSession(recent[0]);
                    setRewrite(recent[0].daily?.reflection?.rewrite || "");
                  }}
                >
                  {recent[0].title} ·{" "}
                  {new Date(recent[0].createdAt).toLocaleDateString("ko-KR")}
                </button>
              </div>
            )}
            <div className="daily-tabs" role="group" aria-label="이야기 종류">
              {Object.entries(dailyCategories).map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={category === id}
                  onClick={() => {
                    setCategory(id as DailyCategory);
                    setOffset(0);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="daily-topic-grid">
              {dailySelection(category, now, offset, favorites).map((t) => (
                <button
                  key={t.id}
                  disabled={busy}
                  onClick={() => void start(t)}
                >
                  <small>
                    {favorites.includes(t.id)
                      ? "내가 기억해 둔 주제"
                      : "준비된 시작 질문"}
                  </small>
                  <strong>{t.title}</strong>
                  <span>{t.opening}</span>
                  <Icon name="arrow" size={18} />
                </button>
              ))}
            </div>
            <button
              className="dd-link"
              disabled={busy}
              onClick={() => setOffset((o) => o + 1)}
            >
              다른 주제 보기
            </button>
            <TrendSearch
              config={config}
              kind="smalltalk"
              onUse={(result) => void start(newsTopic, result)}
            />
            {!!favorites.length && (
              <details className="dc-guide-faq">
                <summary>기억해 둔 주제 관리 · {favorites.length}개</summary>
                {favorites.map((id) => (
                  <button
                    className="dd-link"
                    key={id}
                    onClick={() => remember(id)}
                  >
                    {findDailyTopic(id)?.title} 추천 취향에서 지우기
                  </button>
                ))}
              </details>
            )}
            <p className="vn-caption">
              이야기는 이 브라우저의 대화 기록에 남아요. 알림이나 자동 전송
              없이, 들어왔을 때 시작해요.
            </p>
          </>
        ) : (
          <>
            <div className="daily-session-top">
              <Companion
                small
                character={friend}
                mood={busy ? "think" : done ? "done" : "listen"}
              />
              <div>
                <h2>{topic?.title}</h2>
                <p>
                  {friend.name}와 이야기 · {dailyCount(session)}/3번 답했어요
                </p>
              </div>
              <button
                className="dd-link"
                disabled={busy || capture}
                onClick={() => {
                  setSession(null);
                  setError("");
                }}
              >
                주제 바꾸기
              </button>
            </div>
            {session.daily?.search && (
              <details className="dc-guide-faq">
                <summary>
                  이 화제의 검색 자료 ·{" "}
                  {new Date(session.daily.search.searchedAt).toLocaleDateString(
                    "ko-KR",
                  )}
                </summary>
                <p className="daily-search-text">{session.daily.search.text}</p>
                {[
                  ...new Map(
                    session.daily.search.citations
                      .flatMap((c) => c.sources)
                      .map((s) => [s.url, s]),
                  ).values(),
                ].map((s) => (
                  <p key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      {s.title} ↗
                    </a>
                  </p>
                ))}
                <small>
                  검색 당시 자료예요. 지금의 최신 소식과 다를 수 있어요.
                </small>
              </details>
            )}
            {!done && (
              <details className="dc-guide-faq">
                <summary>
                  {useAI
                    ? "AI 친구와 대화 중"
                    : "준비된 질문으로 이야기 중 · AI 응답 없음"}
                </summary>
                <label className="dd-check">
                  <input
                    type="checkbox"
                    checked={useAI}
                    disabled={busy || capture || !config.available}
                    onChange={(e) => setUseAI(e.target.checked)}
                  />
                  내 답변에 맞춰 AI와 이야기하기
                </label>
                {!config.available && (
                  <p>AI 연결 전에는 준비된 질문으로 이야기할 수 있어요.</p>
                )}
                {useAI && (
                  <AIConsent
                    config={config}
                    checked={consent}
                    onChange={setConsent}
                    disabled={busy || capture}
                  />
                )}
                <p>
                  준비된 질문은 내 말을 분석한 응답이 아니에요. AI 음성 변환은
                  별도 전송이 필요해요.
                </p>
              </details>
            )}
            <div className="daily-turns">
              {session.turns.map((t, i) => (
                <article key={t.id} className={"daily-bubble " + t.role}>
                  <small>
                    {t.role === "user" ? "나" : friend.name}
                    {i === 0 ? " · 준비된 시작 질문" : ""}
                    {t.role === "assistant" && i > 0 && !t.sample
                      ? " · AI 응답"
                      : ""}
                  </small>
                  <p>{t.text}</p>
                  {t.clip && <AudioPlayer clip={t.clip} />}{" "}
                  {t.sample && <SampleNotice sample={t.sample} compact />}
                </article>
              ))}
            </div>
            <div ref={end} />
            {busy && (
              <p role="status">{friend.name}가 다음 말을 준비하고 있어요…</p>
            )}
            {!done && pending && !busy && (
              <div className="dc-inline-actions">
                <button
                  className="dd-secondary"
                  disabled={!useAI || !consent || !config.available}
                  onClick={() => void retry(false)}
                >
                  AI 답변 다시 받기
                </button>
                <button
                  className="dd-secondary"
                  onClick={() => void retry(true)}
                >
                  준비된 질문으로 계속
                </button>
              </div>
            )}
            {!done && !pending && (
              <>
                <div
                  className="daily-choices"
                  role="group"
                  aria-label="답변 후보"
                >
                  {session.turns.at(-1)?.suggestions?.map((s, i) => (
                    <button
                      key={i}
                      disabled={busy || capture}
                      onClick={() => setSuggestion({ text: s, id: Date.now() })}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="vn-caption">
                  후보를 고르면 입력칸에 들어가요. 내 말로 바꾼 뒤 보내도
                  좋아요.
                </p>
                <VoiceComposer
                  key={session.id}
                  config={{
                    ...config,
                    voiceAvailable: useAI && consent && config.voiceAvailable,
                  }}
                  consent={useAI && consent}
                  onUse={send}
                  submitLabel="한마디 보내기"
                  requireText
                  disabled={busy || (useAI && !consent)}
                  onActivity={setCapture}
                  suggestion={suggestion}
                />
              </>
            )}
            {!done && (
              <button
                className="dd-link"
                disabled={busy || capture}
                onClick={() => void finish()}
              >
                오늘은 여기까지
              </button>
            )}
            {done && (
              <div className="daily-finish">
                <Companion small mood="done" />
                <h2>오늘은 이만큼 이야기했어요.</h2>
                <p>점수도, 놓친 날짜도 신경 쓰지 않아도 돼요.</p>
                <div className="daily-bridge">
                  <small>실제 사람에게 건넬 수 있는 한마디 · 제안</small>
                  <p>“{session.daily!.bridge}”</p>
                </div>
                {topic && topic.id !== "news" && (
                  <button
                    className="dd-secondary"
                    onClick={() => remember(topic.id)}
                  >
                    {favorites.includes(topic.id)
                      ? "이 주제 기억하지 않기"
                      : "이 주제 다음에도 추천하기"}
                  </button>
                )}
                {!!userTurns.length && (
                  <details className="dc-guide-faq">
                    <summary>원할 때만 · 표현 하나 다듬기</summary>
                    <p>평가 대신, 내가 한 말을 내 방식으로 고쳐봐요.</p>
                    <label className="vn-label">
                      고칠 내 말
                      <select
                        value={selected?.id}
                        onChange={(e) => {
                          setReflectionId(e.target.value);
                          setRewrite("");
                        }}
                      >
                        {userTurns.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.text.slice(0, 60)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <blockquote>{selected?.text}</blockquote>
                    <label className="vn-label">
                      다음에 건넬 표현
                      <textarea
                        maxLength={800}
                        rows={3}
                        value={rewrite}
                        onChange={(e) => setRewrite(e.target.value)}
                      />
                    </label>
                    <button
                      className="dd-secondary"
                      disabled={
                        rewrite.trim().length < 2 ||
                        rewrite.trim() === selected?.text.trim()
                      }
                      onClick={() => void reflect()}
                    >
                      고친 표현 저장
                    </button>
                    {session.daily?.reflection && (
                      <p>저장한 표현: {session.daily.reflection.rewrite}</p>
                    )}
                  </details>
                )}
                <div className="dc-inline-actions">
                  <button className="dd-primary" onClick={onRecords}>
                    그냥 마치기
                  </button>
                  <button
                    className="dd-link"
                    onClick={() => {
                      setSession(null);
                      setError("");
                    }}
                  >
                    다른 이야기 고르기
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        {session && (
          <button
            className="dd-link"
            disabled={busy || capture}
            onClick={async () => {
              if (!window.confirm("이 한마디 기록과 음성을 삭제할까요?"))
                return;
              try {
                await deleteSession(session.id);
                setRecent((rows) => rows.filter((s) => s.id !== session.id));
                setSession(null);
                setNotice("기록을 삭제했어요.");
              } catch {
                setError("기록을 삭제하지 못했어요.");
              }
            }}
          >
            이 한마디 기록 삭제
          </button>
        )}
      </section>
    </CompanionProvider>
  );
}
