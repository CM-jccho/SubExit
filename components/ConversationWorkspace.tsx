"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import LiveCoach from "./LiveCoach";
import { tones } from "@/lib/scenarios";
import {
  emptyProfile,
  exampleProfile,
  guidedReply,
  parseProfile,
  readCards,
  writeCards,
  saveCard,
  searchCards,
  markUsed,
  type ContextProfile,
  type ConversationCard,
  type SetupMessage,
} from "@/lib/conversation-cards";
type View = "library" | "setup" | "detail" | "live" | "demo";
const labels: Record<keyof Omit<ContextProfile, "tone">, string> = {
  title: "카드 이름",
  myRole: "내 역할",
  partner: "대화 상대",
  situation: "어떤 상황인가요?",
  goal: "내가 원하는 결과",
  boundaries: "꼭 지킬 선",
};
const maxima = {
  title: 60,
  myRole: 120,
  partner: 160,
  situation: 800,
  goal: 400,
  boundaries: 400,
};
function ProfileEditor({
  profile,
  onChange,
}: {
  profile: ContextProfile;
  onChange: (p: ContextProfile) => void;
}) {
  return (
    <div className="dc-editor">
      {(Object.keys(labels) as (keyof typeof labels)[]).map((k) => (
        <label key={k} htmlFor={"profile-" + k}>
          {labels[k]}
          {["title", "partner", "situation", "goal"].includes(k) && (
            <span>필수</span>
          )}
          {["situation", "goal", "boundaries"].includes(k) ? (
            <textarea
              id={"profile-" + k}
              rows={2}
              maxLength={maxima[k]}
              value={profile[k]}
              onChange={(e) => onChange({ ...profile, [k]: e.target.value })}
            />
          ) : (
            <input
              id={"profile-" + k}
              maxLength={maxima[k]}
              value={profile[k]}
              onChange={(e) => onChange({ ...profile, [k]: e.target.value })}
            />
          )}
        </label>
      ))}
      <label htmlFor="profile-tone">
        내 말투
        <select
          id="profile-tone"
          value={profile.tone}
          onChange={(e) =>
            onChange({
              ...profile,
              tone: e.target.value as ContextProfile["tone"],
            })
          }
        >
          {tones.map((t) => (
            <option value={t.id} key={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
function ContextFacts({ profile }: { profile: ContextProfile }) {
  return (
    <dl className="dc-facts">
      <div>
        <dt>상대</dt>
        <dd>{profile.partner || "아직 정리 전이에요"}</dd>
      </div>
      <div>
        <dt>내 역할</dt>
        <dd>{profile.myRole || "필요하면 추가해요"}</dd>
      </div>
      <div>
        <dt>상황</dt>
        <dd>{profile.situation || "어떤 대화인지 알려주세요"}</dd>
      </div>
      <div className="dc-goal">
        <dt>원하는 결과</dt>
        <dd>{profile.goal || "이번 대화의 목표를 정해요"}</dd>
      </div>
      <div>
        <dt>지킬 선</dt>
        <dd>{profile.boundaries || "필요하면 추가해요"}</dd>
      </div>
      <div>
        <dt>말투</dt>
        <dd>{tones.find((t) => t.id === profile.tone)?.label}</dd>
      </div>
    </dl>
  );
}
export default function ConversationWorkspace() {
  const query = useSearchParams();
  const [view, setView] = useState<View>("library"),
    [cards, setCards] = useState<ConversationCard[]>([]),
    [search, setSearch] = useState(""),
    [active, setActive] = useState<ConversationCard | null>(null);
  const [profile, setProfile] = useState<ContextProfile>(emptyProfile()),
    [messages, setMessages] = useState<SetupMessage[]>([]),
    [input, setInput] = useState(""),
    [editingId, setEditingId] = useState<string | undefined>(),
    [review, setReview] = useState(false),
    [source, setSource] = useState<ConversationCard["source"]>("guided");
  const [config, setConfig] = useState({ available: false, sampleOnly: true }),
    [ai, setAi] = useState(false),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const controller = useRef<AbortController | null>(null),
    generation = useRef(0),
    chatEnd = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setCards(readCards());
    const abort = new AbortController();
    fetch("/api/coach", { signal: abort.signal })
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});
    const sync = () => setCards(readCards());
    window.addEventListener("storage", sync);
    return () => {
      abort.abort();
      controller.current?.abort();
      generation.current++;
      window.removeEventListener("storage", sync);
    };
  }, []);
  useEffect(() => {
    if (query.get("demo") === "1") setView("demo");
    else if (query.get("live") === "1") {
      setView("library");
      setToast("코칭에 사용할 카드를 선택하거나 새로 만들어 주세요.");
    }
  }, [query]);
  useEffect(() => {
    if (review && view === "setup") window.scrollTo({ top: 0 });
  }, [review, view]);
  useEffect(() => {
    if (messages.length > 1)
      chatEnd.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);
  function cancelRequest() {
    generation.current++;
    controller.current?.abort();
    setBusy(false);
  }
  function home() {
    cancelRequest();
    setError("");
    setView("library");
    setCards(readCards());
  }
  function start(existing?: ConversationCard) {
    cancelRequest();
    setEditingId(existing?.id);
    setProfile(existing || emptyProfile());
    setMessages(
      existing ? [] : [{ role: "assistant", text: guidedReply([]).question }],
    );
    setInput("");
    setReview(!!existing);
    setSource(existing?.source || "guided");
    setAi(false);
    setConsent(false);
    setError("");
    setToast("");
    setView("setup");
    window.scrollTo({ top: 0 });
  }
  async function send() {
    if (!input.trim() || busy) return;
    const next: SetupMessage[] = [
      ...messages,
      { role: "user", text: input.trim() },
    ];
    if (next.length > 12) {
      setError(
        "이제 카드 내용을 확인해 주세요. 필요한 내용은 직접 수정할 수 있어요.",
      );
      setReview(true);
      return;
    }
    setInput("");
    setMessages(next);
    setError("");
    if (!ai) {
      const d = guidedReply(next);
      setProfile(d.profile);
      setSource("guided");
      setMessages([...next, { role: "assistant", text: d.question }]);
      if (next.filter((m) => m.role === "user").length >= 4) setReview(true);
      return;
    }
    if (!consent) {
      setError("AI 전송 안내를 확인해 주세요.");
      return;
    }
    const id = ++generation.current,
      abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    const timeout = setTimeout(() => abort.abort(), 25000);
    try {
      const r = await fetch("/api/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({
          messages: next,
          consent,
          adultConsent: consent,
          sampleConsent: consent,
        }),
      });
      const d = await r.json();
      if (generation.current !== id) return;
      if (!r.ok) throw new Error(d.error || "정리 요청을 완료하지 못했어요.");
      const p = parseProfile(d.profile, false);
      setProfile(p);
      setSource("ai");
      setMessages([
        ...next,
        {
          role: "assistant",
          text:
            d.question ||
            "카드 초안을 정리했어요. 제가 이해한 내용이 맞는지 확인해 주세요.",
        },
      ]);
      if (!d.question) setReview(true);
    } catch (e) {
      if (generation.current === id) {
        setError(
          e instanceof Error && e.name === "AbortError"
            ? "요청 시간이 초과됐어요. 직접 카드 내용을 작성할 수도 있어요."
            : e instanceof Error
              ? e.message
              : "정리 요청을 완료하지 못했어요.",
        );
      }
    } finally {
      clearTimeout(timeout);
      if (generation.current === id) setBusy(false);
    }
  }
  function save() {
    try {
      const next = saveCard(profile, source, editingId);
      setCards(next);
      setActive(next[0]);
      setView("detail");
      setError("");
      setToast("이 기기에 대화 카드를 저장했어요.");
      setMessages([]);
    } catch {
      setError(
        "필수 내용을 확인해 주세요. 저장 공간이 부족하거나 차단되어도 저장되지 않을 수 있어요.",
      );
    }
  }
  function useCard(c: ConversationCard) {
    try {
      const next = markUsed(c.id);
      setCards(next);
      setActive(next.find((x) => x.id === c.id) || c);
    } catch {
      setActive(c);
    }
    setError("");
    setToast("");
    setView("live");
    window.scrollTo({ top: 0 });
  }
  function duplicate(c: ConversationCard) {
    start();
    setProfile({ ...c, title: (c.title + " · 복사").slice(0, 60) });
    setSource("manual");
    setReview(true);
  }
  function remove(c: ConversationCard) {
    if (!window.confirm(`“${c.title}” 카드를 이 기기에서 지울까요?`)) return;
    try {
      const next = readCards().filter((x) => x.id !== c.id);
      writeCards(next);
      setCards(next);
      setView("library");
      setToast("카드를 삭제했어요.");
    } catch {
      setError("카드를 삭제하지 못했어요.");
    }
  }
  function exportData() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 1,
            exportedAt: new Date().toISOString(),
            cards: readCards(),
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "ddeundeun-my-conversations.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const visible = searchCards(cards, search);
  const canSave = (() => {
    try {
      parseProfile(profile);
      return true;
    } catch {
      return false;
    }
  })();
  return (
    <div className="dd-root dc-root">
      <div className="dc-shell">
        <header className="dc-header">
          <button className="dc-brand" onClick={home}>
            <span className="dd-logo" aria-hidden="true">
              ··
            </span>
            든든콜
          </button>
          <span>내 상황을 기억하는 대화 코치</span>
          <button className="dc-home" onClick={home}>
            내 대화
          </button>
        </header>
        <main>
          {toast && (
            <p className="dc-toast" role="status">
              {toast}
            </p>
          )}
          {view === "library" && (
            <>
              <section className="dc-hero">
                <p className="dc-overline">내 대화</p>
                <h1>
                  {cards.length
                    ? "다시 설명하지 않아도,\n내 상황을 아는 코치."
                    : "어떤 대화를\n앞두고 있나요?"}
                </h1>
                <p>
                  상대와 내 목표를 한 번 정리해 두세요.
                  <br />
                  필요한 순간, 저장한 맥락으로 다음 말을 준비해요.
                </p>
                <button className="dd-primary" onClick={() => start()}>
                  + 대화 카드 만들기
                </button>
              </section>
              {cards.length > 0 ? (
                <section>
                  <div className="dc-list-heading">
                    <h2>
                      저장한 대화 <span>{cards.length}</span>
                    </h2>
                    <button className="dd-link" onClick={exportData}>
                      데이터 내려받기
                    </button>
                  </div>
                  <label className="dc-search" htmlFor="card-search">
                    <span>찾기</span>
                    <input
                      id="card-search"
                      type="search"
                      placeholder="상대, 상황, 목표로 찾아보세요"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <div className="dc-card-grid">
                    {visible.map((c) => (
                      <button
                        className="dc-saved-card"
                        key={c.id}
                        onClick={() => {
                          setActive(c);
                          setToast("");
                          setView("detail");
                        }}
                      >
                        <span className="dc-partner">{c.partner}</span>
                        <h3>{c.title}</h3>
                        <p>{c.goal}</p>
                        <footer>
                          <span>
                            {c.lastUsedAt
                              ? "최근 사용 " +
                                new Date(c.lastUsedAt).toLocaleDateString(
                                  "ko-KR",
                                )
                              : "아직 코칭에 사용하지 않았어요"}
                          </span>
                          <b>열기 ↗</b>
                        </footer>
                      </button>
                    ))}
                  </div>
                  {visible.length === 0 && (
                    <p className="dc-empty">
                      찾는 카드가 없어요. 다른 단어로 검색해 보세요.
                    </p>
                  )}
                </section>
              ) : (
                <section className="dc-first">
                  <div className="dc-empty-card">
                    <span>01 · 내 상황</span>
                    <strong>
                      “마감은 급한데,
                      <br />
                      이미 맡은 일이 많아요.”
                    </strong>
                    <p>상대 · 내 목표 · 지킬 선</p>
                  </div>
                  <div>
                    <h2>
                      정해진 시나리오를
                      <br />
                      고르지 않아도 괜찮아요.
                    </h2>
                    <ol>
                      <li>편하게 이야기해 주세요.</li>
                      <li>정리된 내용을 카드로 저장해요.</li>
                      <li>필요할 때 꺼내 코칭받아요.</li>
                    </ol>
                    <button className="dd-link" onClick={() => setView("demo")}>
                      예시 카드로 흐름 보기 →
                    </button>
                  </div>
                </section>
              )}
              <p className="dc-storage">
                카드는 이 기기에 저장돼요. 다른 기기와 자동 동기화되지 않아요.
              </p>
            </>
          )}
          {view === "setup" && (
            <>
              <button className="dd-back" onClick={home}>
                ← 내 대화로
              </button>
              <section className="dc-title">
                <p className="dc-overline">
                  {editingId
                    ? "카드 수정"
                    : review
                      ? "카드 확인"
                      : "대화로 정리"}
                </p>
                <h1>
                  {editingId
                    ? "달라진 상황을 반영해요."
                    : review
                      ? "내 상황이 맞는지 확인해요."
                      : "설정 대신, 이야기부터."}
                </h1>
                <p>
                  {review
                    ? "상대의 성격을 단정하기보다 역할과 상황을 적어 주세요."
                    : "실명 대신 역할이나 관계로 적어도 충분해요."}
                </p>
              </section>
              <div className={"dc-setup-grid" + (review ? " dc-review" : "")}>
                {!review && (
                  <section className="dc-chat">
                    <div className="dc-chat-heading">
                      <strong>대화 도우미</strong>
                      <span>{ai ? "AI로 정리" : "질문 안내"}</span>
                    </div>
                    {!review && (
                      <details className="dc-ai-option">
                        <summary>
                          {config.available
                            ? "AI와 자유롭게 정리하기"
                            : "AI 연결 전에도 카드를 만들 수 있어요"}
                        </summary>
                        {config.available ? (
                          <>
                            <label className="dd-check">
                              <input
                                type="checkbox"
                                checked={ai}
                                disabled={busy || messages.length > 1}
                                onChange={(e) => setAi(e.target.checked)}
                              />
                              AI가 대화를 읽고 필요한 내용만 물어봐요.
                            </label>
                            {ai && (
                              <label className="dd-check">
                                <input
                                  type="checkbox"
                                  checked={consent}
                                  onChange={(e) => setConsent(e.target.checked)}
                                />
                                만 18세 이상이며, 입력을 Google Gemini로
                                전송하는 데 동의해요.
                                {config.sampleOnly
                                  ? " 개인정보·기밀 없는 자작 대화만 쓰고, 무료 API 입력이 제품 개선에 쓰일 수 있음을 확인했어요."
                                  : ""}
                              </label>
                            )}
                          </>
                        ) : (
                          <p>
                            현재는 질문 안내를 따라 자유롭게 답하거나 직접
                            작성할 수 있어요. 외부 AI로 전송하지 않아요.
                          </p>
                        )}
                      </details>
                    )}
                    <div className="dc-messages" aria-live="polite">
                      {messages.map((m, i) => (
                        <p key={i} className={"dc-message " + m.role}>
                          {m.text}
                        </p>
                      ))}
                      {messages.length === 0 && (
                        <p className="dc-message assistant">
                          저장된 내용을 수정하고 다시 사용해 보세요.
                        </p>
                      )}
                      {busy && (
                        <p className="dc-message assistant">
                          말씀하신 내용을 정리하고 있어요…
                        </p>
                      )}
                      <div ref={chatEnd} />
                    </div>
                    {!review && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void send();
                        }}
                        className="dc-composer"
                      >
                        <label className="dc-sr" htmlFor="setup-message">
                          대화 내용
                        </label>
                        <textarea
                          id="setup-message"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          maxLength={
                            ai
                              ? 800
                              : [800, 160, 400, 400][
                                  messages.filter((m) => m.role === "user")
                                    .length
                                ] || 400
                          }
                          rows={3}
                          disabled={busy}
                          placeholder="예: 팀장님께 보고서 마감을 조율하고 싶어요."
                        />
                        <div>
                          <span>
                            {input.length}/
                            {ai
                              ? 800
                              : [800, 160, 400, 400][
                                  messages.filter((m) => m.role === "user")
                                    .length
                                ] || 400}
                          </span>
                          <button
                            className="dd-primary"
                            type="submit"
                            disabled={busy || !input.trim() || (ai && !consent)}
                          >
                            보내기 ↑
                          </button>
                        </div>
                      </form>
                    )}
                    {!review && (
                      <button
                        className="dd-link"
                        disabled={busy}
                        onClick={() => {
                          setReview(true);
                          setSource("manual");
                        }}
                      >
                        직접 카드 작성·확인하기 →
                      </button>
                    )}
                  </section>
                )}
                <section className="dc-profile-panel">
                  {review && messages.length > 0 && (
                    <button
                      className="dd-link"
                      onClick={() => setReview(false)}
                    >
                      ← 대화 내용 다시 보기
                    </button>
                  )}
                  <p className="dc-overline">저장할 내용</p>
                  <h2>{profile.title || "나의 대화 카드"}</h2>
                  {review ? (
                    <ProfileEditor profile={profile} onChange={setProfile} />
                  ) : (
                    <ContextFacts profile={profile} />
                  )}
                  <p className="dd-small">
                    설정 대화 전체와 통화 원문은 저장하지 않아요. 확인한 카드
                    내용만 남겨요.
                  </p>
                  {error && (
                    <p className="dd-error" role="alert">
                      {error}
                    </p>
                  )}
                  {review ? (
                    <button
                      className="dd-primary dd-full"
                      disabled={!canSave || busy}
                      onClick={save}
                    >
                      {editingId ? "수정 내용 저장" : "대화 카드 저장"}
                    </button>
                  ) : (
                    <button
                      className="dd-secondary dd-full"
                      disabled={busy}
                      onClick={() => setReview(true)}
                    >
                      카드 내용 확인하기
                    </button>
                  )}
                </section>
              </div>
            </>
          )}
          {view === "detail" && active && (
            <>
              <button className="dd-back" onClick={home}>
                ← 내 대화로
              </button>
              <section className="dc-title">
                <p className="dc-overline">저장한 대화</p>
                <h1>{active.title}</h1>
                <p>이 맥락을 바탕으로 다음에 말할 문장을 제안해요.</p>
              </section>
              <div className="dc-detail-grid">
                <section className="dc-profile-panel">
                  <ContextFacts profile={active} />
                  <button className="dd-link" onClick={() => start(active)}>
                    설정 수정하기 →
                  </button>
                </section>
                <aside className="dc-start-panel">
                  <span className="dd-face" aria-hidden="true">
                    ··
                  </span>
                  <h2>이제, 대화해 볼까요?</h2>
                  <p>
                    상대의 말을 적거나 짧게 들려주세요.
                    <br />
                    저장한 목표와 지킬 선을 함께 참고해요.
                  </p>
                  <button
                    className="dd-primary dd-full"
                    onClick={() => useCard(active)}
                  >
                    이 카드로 코칭 시작
                  </button>
                  <p className="dd-small">
                    {config.available
                      ? "실제 AI 결과는 상황에 맞는지 확인한 뒤 사용하세요."
                      : "AI 연결은 아직 준비 중이에요. 카드 저장·수정은 지금 사용할 수 있어요."}
                  </p>
                </aside>
              </div>
              <div className="dc-card-tools">
                <span>
                  코칭 화면을 연 횟수 {active.useCount}회 · 수정{" "}
                  {new Date(active.updatedAt).toLocaleDateString("ko-KR")}
                </span>
                <button onClick={() => duplicate(active)}>
                  복사해서 만들기
                </button>
                <button onClick={() => remove(active)}>카드 삭제</button>
              </div>
              {error && (
                <p className="dd-error" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
          {view === "live" && active && (
            <LiveCoach
              key={active.id}
              profile={active}
              onBack={() => {
                setView("detail");
                setToast("");
              }}
              onDemo={() => setView("demo")}
            />
          )}
          {view === "demo" && (
            <>
              <button className="dd-back" onClick={home}>
                ← 내 대화로
              </button>
              <section className="dc-title">
                <p className="dc-overline">흐름 예시 · 실제 AI 결과 아님</p>
                <h1>
                  같은 말도,
                  <br />내 목표에 맞게.
                </h1>
                <p>
                  “금요일까지 가능하죠?”에 무조건 거절하는 답을 주는 대신,
                  <br />
                  저장한 상황과 목표를 함께 참고하는 방식이에요.
                </p>
              </section>
              <div className="dc-detail-grid">
                <section className="dc-profile-panel">
                  <h2>{exampleProfile.title}</h2>
                  <ContextFacts profile={exampleProfile} />
                </section>
                <aside className="dc-demo-cue">
                  <span>상대의 말</span>
                  <p>“보고서, 금요일까지 가능하죠?”</p>
                  <span>이 카드에 맞춰 준비한 예시</span>
                  <blockquote>
                    현재 업무를 유지하면 금요일 완료는 어렵습니다. 어떤 일을
                    먼저 진행할지 정해 주시면, 가능한 일정을 말씀드리겠습니다.
                  </blockquote>
                  <small>
                    사전 작성된 예시이며 실시간 분석 결과가 아닙니다.
                  </small>
                </aside>
              </div>
              <div className="dd-actions">
                <button
                  className="dd-primary"
                  onClick={() => {
                    start();
                    setProfile({ ...exampleProfile });
                    setReview(true);
                    setSource("manual");
                  }}
                >
                  이 예시를 내 카드로 바꾸기
                </button>
                <button className="dd-link" onClick={() => start()}>
                  내 이야기로 처음부터 시작
                </button>
              </div>
            </>
          )}
        </main>
        <footer className="dc-footer">
          <span>든든콜 · 내 맥락으로, 내 말답게.</span>
          <div>
            <a href="/practice?demo=1">문장 연습</a>
            <a href="/evidence">서비스·데이터 안내 ↗</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
