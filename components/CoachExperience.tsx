"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { scenarios, tones, type Tone, type Scenario } from "@/lib/scenarios";
import {
  awardRound,
  loadProgress,
  saveProgress,
  stats,
  localDay,
  PROGRESS_KEY,
  type Progress,
} from "@/lib/progress";
import LiveCoach from "./LiveCoach";
type View = "home" | "lesson" | "summary" | "progress" | "live";
type Entry = { id: string; original: string; revision?: string; cue: string };
const clean = (s: string) => s.trim().replace(/\s+/g, " ");
function Symbol({ name }: { name: "home" | "practice" | "record" | "arrow" }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "home" ? (
        <path d="m3 10 9-7 9 7v10H15v-7H9v7H3Z" />
      ) : name === "practice" ? (
        <path d="M4 4h16v13H9l-5 4V4Zm4 5h8m-8 4h5" />
      ) : name === "record" ? (
        <path d="M5 3h14v18H5V3Zm4 5h6m-6 4h6m-6 4h3" />
      ) : (
        <path d="M4 12h16m-6-6 6 6-6 6" />
      )}
    </svg>
  );
}
export default function CoachExperience() {
  const query = useSearchParams();
  const [view, setView] = useState<View>("home"),
    [scenario, setScenario] = useState<Scenario>(scenarios[0]),
    [tone, setTone] = useState<Tone>("firm_polite"),
    [index, setIndex] = useState(0),
    [demo, setDemo] = useState(false),
    [playing, setPlaying] = useState(true),
    [tick, setTick] = useState(0);
  const [reply, setReply] = useState(""),
    [review, setReview] = useState(false),
    [intent, setIntent] = useState(false),
    [action, setAction] = useState(false),
    [reveal, setReveal] = useState(false),
    [editing, setEditing] = useState(false),
    [entries, setEntries] = useState<Entry[]>([]),
    [progress, setProgress] = useState<Progress>({ awards: [] }),
    [notice, setNotice] = useState(""),
    [expanded, setExpanded] = useState(false);
  const round = scenario.rounds[index],
    current = entries.find((e) => e.id === round.id),
    record = stats(progress);
  useEffect(() => {
    setProgress(loadProgress());
    try {
      const saved = localStorage.getItem("ddeundeun-tone-v2");
      if (tones.some((t) => t.id === saved)) setTone(saved as Tone);
    } catch {}
    const update = () => setProgress(loadProgress());
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, []);
  useEffect(() => {
    if (query.get("demo") === "1") start(scenarios[0], true);
    else if (query.get("live") === "1") setView("live");
  }, [query]);
  useEffect(() => {
    if (!demo || view !== "lesson" || !playing) return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [demo, view, playing, index]);
  useEffect(() => {
    if (demo && view === "lesson" && tick >= 9) {
      if (index < scenario.rounds.length - 1) {
        setIndex((i) => i + 1);
        setTick(0);
      } else setView("summary");
    }
  }, [tick, demo, view, index, scenario]);
  function resetRound() {
    setReply("");
    setReview(false);
    setIntent(false);
    setAction(false);
    setReveal(false);
    setEditing(false);
    setNotice("");
    setTick(0);
  }
  function start(s: Scenario, sample = false) {
    setScenario(s);
    setIndex(0);
    setEntries([]);
    setDemo(sample);
    setPlaying(true);
    resetRound();
    setView("lesson");
    window.scrollTo({ top: 0 });
  }
  function next() {
    if (index === scenario.rounds.length - 1) {
      setView("summary");
      window.scrollTo({ top: 0 });
      return;
    }
    setIndex((i) => i + 1);
    resetRound();
  }
  function finish() {
    if (!intent || !action || clean(reply).length < 5 || demo) return;
    const revised = !!current && clean(reply) !== clean(current.original);
    const entry: Entry = {
      id: round.id,
      original: current?.original || clean(reply),
      revision: revised ? clean(reply) : current?.revision,
      cue: round.cues[tone],
    };
    setEntries((old) => [...old.filter((e) => e.id !== round.id), entry]);
    const latest = loadProgress();
    const merged = {
      awards: [
        ...new Map(
          [...latest.awards, ...progress.awards].map((a) => [a.key, a]),
        ).values(),
      ],
    };
    const updated = awardRound(merged, round.id, revised);
    setProgress(updated);
    saveProgress(updated);
    const gained = stats(updated).xp - stats(merged).xp;
    setNotice(
      gained
        ? `${gained} XP · ${revised ? "고쳐 쓴 시도" : "직접 답한 시도"}를 기록했어요.`
        : "오늘 이 구간의 참여 보상은 이미 받았어요.",
    );
    setReview(false);
    setEditing(false);
  }
  function changeTone(t: Tone) {
    setTone(t);
    try {
      localStorage.setItem("ddeundeun-tone-v2", t);
    } catch {}
  }
  function exportNotes() {
    const text =
      `# 곁말 · ${scenario.title}\n\n${localDay()} · ${demo ? "샘플 복기 (개인 평가 아님)" : "직접 답변 연습"}\n\n` +
      scenario.rounds
        .map((r, i) => {
          const e = entries.find((a) => a.id === r.id);
          return `## ${i + 1}. ${r.pattern}\n상대: ${r.opponent}\n\n내 첫 답변: ${e?.original || "미작성"}\n\n다시 쓴 답변: ${e?.revision || "미작성"}\n\n사전 작성 예시: ${e?.cue || r.cues[tone]}\n\n`;
        })
        .join("") +
      "참여 XP는 대화 실력이나 실제 통화 성공률이 아닙니다.\n";
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/markdown;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "ddeundeun-practice.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const nav = [
    { name: "home" as const, label: "홈", go: () => setView("home") },
    { name: "practice" as const, label: "연습", go: () => start(scenario) },
    {
      name: "record" as const,
      label: "내 기록",
      go: () => setView("progress"),
    },
  ];
  return (
    <div className="dd-root">
      <aside className="dd-sidebar">
        <a href="/" className="dd-brand">
          <span className="dd-logo" aria-hidden="true">
            ··
          </span>
          곁말<span className="dd-beta">beta</span>
        </a>
        <p className="dd-tagline">
          말하기 어려운 순간,
          <br />내 편이 되는 한 문장.
        </p>
        <nav aria-label="주 메뉴">
          {nav.map((n) => (
            <button
              key={n.name}
              onClick={n.go}
              className={
                (n.name === "home" && (view === "home" || view === "live")) ||
                (n.name === "practice" &&
                  (view === "lesson" || view === "summary")) ||
                (n.name === "record" && view === "progress")
                  ? "active"
                  : ""
              }
            >
              <Symbol name={n.name} />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="dd-sidebar-bottom">
          <span className="dd-face" aria-hidden="true">
            ··
          </span>
          <p>
            잘 말하는 것보다
            <br />내 뜻을 전하는 것부터.
          </p>
          <a href="/evidence">프로젝트 안내 ↗</a>
        </div>
      </aside>
      <main className="dd-main">
        <div className="dd-topbar">
          <span>
            {view === "live"
              ? "지금 대화"
              : view === "progress"
                ? "나의 작은 변화"
                : "오늘도, 내 말로"}
          </span>
          {view !== "live" && (
            <button onClick={() => setView("progress")}>
              Lv. {record.level}
              <span>{record.xp} XP</span>
            </button>
          )}
        </div>
        {view === "home" && (
          <>
            <header className="dd-heading">
              <p className="dd-eyebrow">YOUR WORDS, YOUR PACE</p>
              <h1>
                대화가 막히는 순간,
                <br />
                <span>내 편이 되는 한 문장.</span>
              </h1>
              <p>거절도, 부탁도, 설명도. 혼자 준비하지 않아도 괜찮아요.</p>
            </header>
            <section className="dd-live-banner">
              <div>
                <span className="dd-source">대면 · 스피커폰 보조</span>
                <h2>지금 대화 중인가요?</h2>
                <p>상대 말을 짧게 듣고, 내가 말할 문장을 함께 정리해요.</p>
                <button className="dd-primary" onClick={() => setView("live")}>
                  지금 대화 코칭 <Symbol name="arrow" />
                </button>
                <button
                  className="dd-demo-link"
                  onClick={() => start(scenarios[0], true)}
                >
                  샘플로 30초 체험 →
                </button>
              </div>
              <div className="dd-conversation-art" aria-hidden="true">
                <div className="dd-art-bubble">
                  “지금 가입해야
                  <br />
                  혜택을 받을 수 있어요.”
                </div>
                <div className="dd-art-answer">
                  제 선택은 같아요.
                  <br />
                  가입하지 않겠습니다.<span>내 뜻을, 내 말로</span>
                </div>
                <span className="dd-face">··</span>
              </div>
            </section>
            <section className="dd-daily">
              <div>
                <span className="dd-eyebrow">오늘의 짧은 연습</span>
                <h2>권유에 흔들리지 않는 거절</h2>
                <p>3개의 상황 · 직접 답하고 고쳐 쓰기</p>
              </div>
              <button
                className="dd-secondary"
                onClick={() => start(scenarios[0])}
              >
                연습 시작 <Symbol name="arrow" />
              </button>
            </section>
            <section className="dd-scenarios">
              <div className="dd-section-title">
                <h2>어떤 말이 어려우세요?</h2>
                <button
                  className="dd-link"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? "접기" : "모두 보기"}
                </button>
              </div>
              <div className="dd-scenario-grid">
                {scenarios.slice(0, expanded ? 7 : 4).map((s, i) => (
                  <button
                    className="dd-scenario"
                    onClick={() => start(s)}
                    key={s.id}
                  >
                    <div className={`dd-avatar color-${i % 4}`}>
                      <img src={s.avatar} alt="" />
                    </div>
                    <div>
                      <h3>{s.title}</h3>
                      <p>{s.description}</p>
                      <small>{s.rounds.length}개 상황</small>
                    </div>
                    <Symbol name="arrow" />
                  </button>
                ))}
              </div>
            </section>
            <p className="dd-small dd-center">
              연습은 가입 없이 시작해요. 샘플 시연에는 API 키가 필요 없어요.
            </p>
          </>
        )}
        {view === "live" && (
          <LiveCoach
            onBack={() => setView("home")}
            onDemo={() => start(scenarios[0], true)}
          />
        )}
        {view === "lesson" && (
          <>
            <button className="dd-back" onClick={() => setView("home")}>
              ← 홈으로
            </button>
            <header className="dd-heading dd-compact">
              <p className="dd-eyebrow">
                {demo ? "샘플 시연" : "직접 답변 연습"} · {index + 1} /{" "}
                {scenario.rounds.length}
              </p>
              <h1>{scenario.title}</h1>
              <p>{scenario.goal}</p>
            </header>
            <div
              className="dd-steps"
              aria-label={`${scenario.rounds.length}개 중 ${index + 1}번째 상황`}
            >
              {scenario.rounds.map((r, i) => (
                <span key={r.id} className={i <= index ? "done" : ""} />
              ))}
            </div>
            {demo && (
              <div className="dd-demo-bar">
                <span>사전 작성된 샘플 · 실제 녹음·AI 생성·개인 평가 아님</span>
                <button onClick={() => setPlaying(!playing)}>
                  {playing ? "일시정지" : "재생"}
                </button>
              </div>
            )}
            <div className="dd-two">
              <section className="dd-card dd-lesson">
                <div className="dd-person">
                  <img src={scenario.avatar} alt="" />
                  <div>
                    <span>상대의 말</span>
                    <small>{scenario.title}</small>
                  </div>
                </div>
                <blockquote key={round.id}>{round.opponent}</blockquote>
                <div className="dd-round-goal">
                  <span>이번에 해볼 일</span>
                  <p>{round.hint}</p>
                </div>
                {!demo && (
                  <>
                    <label htmlFor="practice-reply">나는 이렇게 말할래요</label>
                    <textarea
                      id="practice-reply"
                      value={reply}
                      readOnly={!!current && !editing && !review}
                      maxLength={1000}
                      onChange={(e) => {
                        setReply(e.target.value);
                        setReview(false);
                        setIntent(false);
                        setAction(false);
                      }}
                      placeholder="정답보다, 지금 내 마음에 맞는 말로 적어보세요."
                    />
                    <p className="dd-small">
                      {reply.length}/1,000자 · 최소 5자 · 답변은 이 화면에서만
                      유지돼요.
                    </p>
                    {current && !editing && !review ? (
                      <div className="dd-complete">
                        <p role="status">{notice}</p>
                        <button
                          className="dd-link"
                          onClick={() => {
                            setEditing(true);
                            setIntent(false);
                            setAction(false);
                          }}
                        >
                          한 번 더 고쳐 쓰기 →
                        </button>
                      </div>
                    ) : review ? (
                      <div className="dd-self-check">
                        <strong>내 답변, 두 가지만 확인해요</strong>
                        <label className="dd-check">
                          <input
                            type="checkbox"
                            checked={intent}
                            onChange={(e) => setIntent(e.target.checked)}
                          />
                          내 의사나 입장을 분명히 말했어요.
                        </label>
                        <label className="dd-check">
                          <input
                            type="checkbox"
                            checked={action}
                            onChange={(e) => setAction(e.target.checked)}
                          />
                          다음 행동이나 가능한 범위를 담았어요.
                        </label>
                        <button
                          className="dd-primary dd-full"
                          onClick={finish}
                          disabled={!intent || !action}
                        >
                          이 답변으로 마치기
                        </button>
                      </div>
                    ) : (
                      <button
                        className="dd-primary dd-full"
                        disabled={clean(reply).length < 5}
                        onClick={() => {
                          setReview(true);
                          setReveal(true);
                        }}
                      >
                        내 답변 점검하기
                      </button>
                    )}
                  </>
                )}
              </section>
              <aside className="dd-cue">
                <div className="dd-cue-top">
                  <span className="dd-face" aria-hidden="true">
                    ··
                  </span>
                  <span>옆자리 코치</span>
                </div>
                <div className="dd-tones" aria-label="예시 말투">
                  {tones.map((t) => (
                    <button
                      key={t.id}
                      aria-pressed={tone === t.id}
                      onClick={() => changeTone(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {demo || reveal ? (
                  <>
                    <span className="dd-source">사전 작성 예시</span>
                    <blockquote>{round.cues[tone]}</blockquote>
                    <details open>
                      <summary>{round.pattern}</summary>
                      <p>{round.hint}</p>
                      <q>{round.opponent}</q>
                    </details>
                  </>
                ) : (
                  <div className="dd-wait">
                    <span aria-hidden="true">“</span>
                    <p>
                      먼저 내 문장을 써볼까요?
                      <br />
                      막히면 예시를 참고해도 좋아요.
                    </p>
                    <button
                      className="dd-secondary"
                      onClick={() => setReveal(true)}
                    >
                      예시 문장 보기
                    </button>
                  </div>
                )}
                <p className="dd-small">
                  예시는 정답이 아니에요. 상황에 맞게 내 말로 바꿔 보세요.
                </p>
              </aside>
            </div>
            <div className="dd-lesson-footer">
              <span>
                {demo
                  ? `${Math.max(0, 9 - tick)}초 후 다음 상황`
                  : "점수는 실력이 아닌 참여 기록이에요."}
              </span>
              <button
                className="dd-primary"
                disabled={!demo && (!current || review || editing)}
                onClick={next}
              >
                {index === scenario.rounds.length - 1
                  ? "복기하기"
                  : "다음 상황"}{" "}
                <Symbol name="arrow" />
              </button>
            </div>
          </>
        )}
        {view === "summary" && (
          <>
            <header className="dd-heading">
              <p className="dd-eyebrow">
                {demo ? "샘플 체험 완료" : "오늘의 연습 완료"}
              </p>
              <h1>
                {demo
                  ? "이제, 내 말로 해볼까요?"
                  : "내 뜻을 전하는 연습, 해냈어요."}
              </h1>
              <p>
                {demo
                  ? "방금 본 문장은 샘플이에요. XP나 개인 평가 결과는 만들지 않았어요."
                  : "처음 쓴 문장과 고쳐 쓴 문장을 함께 돌아봐요."}
              </p>
            </header>
            <div className="dd-recap">
              {scenario.rounds.map((r, i) => {
                const e = entries.find((a) => a.id === r.id);
                return (
                  <details className="dd-card" key={r.id} open={i === 0}>
                    <summary>
                      <span>0{i + 1}</span>
                      {r.pattern}
                    </summary>
                    <p className="dd-small">상대의 말</p>
                    <p>{r.opponent}</p>
                    {e && (
                      <>
                        <p className="dd-small">내 첫 답변</p>
                        <blockquote>{e.original}</blockquote>
                        {e.revision && (
                          <>
                            <p className="dd-small">고쳐 쓴 답변</p>
                            <blockquote className="dd-revision">
                              {e.revision}
                            </blockquote>
                          </>
                        )}
                      </>
                    )}
                    <p className="dd-small">사전 작성 예시</p>
                    <p>{e?.cue || r.cues[tone]}</p>
                  </details>
                );
              })}
            </div>
            <div className="dd-actions">
              <button className="dd-primary" onClick={() => start(scenario)}>
                {demo ? "직접 연습해 보기" : "다시 연습하기"}
              </button>
              <button className="dd-secondary" onClick={exportNotes}>
                복기 노트 내려받기
              </button>
              <button className="dd-link" onClick={() => setView("home")}>
                홈으로
              </button>
            </div>
          </>
        )}
        {view === "progress" && (
          <>
            <header className="dd-heading">
              <p className="dd-eyebrow">작은 시도를 모으면</p>
              <h1>내 말이 조금씩 편해져요.</h1>
              <p>누군가와의 순위보다, 내가 해본 시도를 남겨요.</p>
            </header>
            <div className="dd-stats">
              {[
                [record.xp + " XP", "누적 참여"],
                [record.streak + "일", "연속 연습"],
                [record.rounds + "개", "완료한 상황"],
              ].map(([n, label]) => (
                <div className="dd-card" key={label}>
                  <strong>{n}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <section className="dd-card dd-growth">
              <p className="dd-eyebrow">나의 연습 단계</p>
              <h2>
                Lv. {record.level} ·{" "}
                {record.xp < 50
                  ? "첫 문장을 꺼내는 중"
                  : record.xp < 150
                    ? "내 표현을 찾아가는 중"
                    : "내 말로 쌓아가는 중"}
              </h2>
              <progress value={record.xp % 50} max={50} />
              <p>다음 단계까지 {50 - (record.xp % 50)} XP</p>
            </section>
            <section className="dd-card">
              <h2>보상은 이렇게 쌓여요</h2>
              <div className="dd-reward">
                <span>직접 답변하고 자기 점검</span>
                <b>10 XP</b>
              </div>
              <div className="dd-reward">
                <span>다른 문장으로 고쳐 쓰기</span>
                <b>+5 XP</b>
              </div>
              <p className="dd-small">
                같은 날 같은 상황은 각각 한 번만 지급돼요. 샘플 보기에는 보상이
                없어요. 하루 쉬어도 누적 XP는 그대로예요. 참여 기록은 이
                브라우저에만 저장돼요.
              </p>
            </section>
            <div className="dd-actions">
              <button
                className="dd-primary"
                onClick={() => start(scenarios[0])}
              >
                오늘의 연습 시작
              </button>
              <button
                className="dd-link"
                onClick={() => {
                  if (window.confirm("이 브라우저의 연습 기록을 지울까요?")) {
                    try {
                      localStorage.removeItem(PROGRESS_KEY);
                    } catch {}
                    setProgress({ awards: [] });
                  }
                }}
              >
                참여 기록 초기화
              </button>
            </div>
          </>
        )}
        <footer className="dd-footer">
          곁말 · Wanted AI Championship 2026{" "}
          <a href="/evidence">구현 범위와 데이터 안내 ↗</a>
        </footer>
      </main>
      <nav className="dd-mobile-nav" aria-label="하단 메뉴">
        {nav.map((n) => (
          <button key={n.name} onClick={n.go}>
            <Symbol name={n.name} />
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
