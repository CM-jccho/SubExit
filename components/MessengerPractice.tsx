"use client";
import { useAIConsent } from "./ConsentSession";
import { useEffect, useRef, useState } from "react";
import {
  blankMessenger,
  messengerRelations,
  messengerIntents,
  messengerExamples,
  messengerKey,
  parseMessengerInput,
  parseMessengerCandidates,
  type MessengerInput,
  type MessengerRecord,
  type MessengerCandidate,
} from "@/lib/messenger";
import {
  putSession,
  deleteSession,
  type VoiceSession,
} from "@/lib/voice-notebook";
import { dailyTurn } from "@/lib/daily-talk";
import { aiFetch, AIServiceError, outageMessage } from "@/lib/ai-client";
import { AIConsent, type AIConfig } from "./VoiceComposer";
import { Companion } from "./CompanionUI";
import { useCompanion } from "./CompanionTheme";
import InputDialog from "./InputDialog";
import { WORKSPACE_LEAVE_EVENT } from "@/lib/navigation-guard";
type ReplyFeedback = {
  kind: "info" | "pending" | "success" | "error";
  text: string;
};
export default function MessengerPractice({
  config,
  initialSession,
  onRecords,
}: {
  config: AIConfig;
  initialSession?: VoiceSession;
  onRecords: () => void;
}) {
  const friend = useCompanion(),
    [session, setSession] = useState(initialSession),
    [input, setInput] = useState<MessengerInput>(
      initialSession?.messenger?.input || { ...blankMessenger },
    ),
    [editing, setEditing] = useState(!initialSession),
    [draft, setDraft] = useState(initialSession?.messenger?.draft || ""),
    [tone, setTone] = useState(initialSession?.messenger?.selectedTone),
    [draftSource, setDraftSource] = useState<MessengerRecord["draftSource"]>(
      initialSession?.messenger?.draftSource || "manual",
    ),
    [consent, setConsent] = useAIConsent(),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [copying, setCopying] = useState(false),
    [copiedText, setCopiedText] = useState(""),
    [replyFeedback, setReplyFeedback] = useState<ReplyFeedback | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [inputOpen, setInputOpen] = useState(false),
    [replyOpen, setReplyOpen] = useState(false);
  const selectAfterCopy = useRef(false);
  const latest = useRef(initialSession);
  const draftRevision = useRef(0),
    allowNavigation = useRef(false);
  const alive = useRef(true),
    lock = useRef(false),
    abort = useRef<AbortController | null>(null),
    editor = useRef<HTMLTextAreaElement>(null);
  const record = session?.messenger;
  let valid = false;
  try {
    parseMessengerInput(input);
    valid = true;
  } catch {}
  const draftDirty =
    !!record &&
    (draft.trim() !== record.draft ||
      tone !== record.selectedTone ||
      draftSource !== (record.draftSource || "manual"));
  const savedReply = !!record?.draft && !draftDirty;
  const dirty =
    draftDirty ||
    (editing &&
      (record
        ? messengerKey(input) !== messengerKey(record.input)
        : messengerKey(input) !== messengerKey(blankMessenger)));
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    if (dirty) window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    const guard = (event: Event) => {
      if (
        !allowNavigation.current &&
        dirty &&
        !window.confirm(
          "아직 저장하지 않은 입력이 있어요. 저장하지 않고 이동할까요?",
        )
      )
        event.preventDefault();
    };
    window.addEventListener(WORKSPACE_LEAVE_EVENT, guard);
    return () => window.removeEventListener(WORKSPACE_LEAVE_EVENT, guard);
  }, [dirty]);
  useEffect(() => {
    if (replyOpen && selectAfterCopy.current && editor.current) {
      editor.current.focus({ preventScroll: true });
      editor.current.select();
      selectAfterCopy.current = false;
    }
  }, [replyOpen, replyFeedback]);
  function leave(fn: () => void) {
    if (
      !dirty ||
      window.confirm(
        "아직 저장하지 않은 입력이 있어요. 저장하지 않고 이동할까요?",
      )
    ) {
      allowNavigation.current = true;
      try {
        fn();
      } finally {
        allowNavigation.current = false;
      }
    }
  }
  async function action(fn: () => Promise<void>, saveReply = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setSaving(saveReply);
    setReplyFeedback(
      saveReply ? { kind: "pending", text: "답장을 저장하고 있어요…" } : null,
    );
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      if (alive.current && saveReply) {
        setReplyFeedback({
          kind: "error",
          text:
            "답장을 저장하지 못했어요. 입력은 그대로 남아 있어요. " +
            (e instanceof Error ? e.message : "다시 저장해 주세요."),
        });
      } else if (alive.current)
        setError(
          e instanceof AIServiceError
            ? outageMessage(e.outage) +
                " 입력은 남아 있어요. 직접 답장을 작성하거나 아래 예시를 볼 수 있어요."
            : e instanceof Error && e.name === "AbortError"
              ? "응답을 기다리다 중단했어요. 저장한 입력으로 다시 시도할 수 있어요."
              : e instanceof Error
                ? e.message
                : "처리하지 못했어요. 입력은 유지돼요.",
        );
    } finally {
      lock.current = false;
      abort.current = null;
      if (alive.current) {
        setBusy(false);
        setSaving(false);
      }
    }
  }
  async function persist(next: MessengerRecord, forceNew = false) {
    const now = new Date().toISOString(),
      same =
        !forceNew &&
        latest.current?.messenger &&
        messengerKey(latest.current.messenger.input) ===
          messengerKey(next.input),
      s: VoiceSession = {
        id: same ? latest.current!.id : "session-" + crypto.randomUUID(),
        title: "메시지 답장 · " + next.input.intent,
        kind: "chat",
        industry: "메신저 · " + next.input.relation,
        companion: session?.companion || friend,
        createdAt: same ? latest.current!.createdAt : now,
        updatedAt: now,
        messenger: { ...next, updatedAt: now },
        turns: [
          dailyTurn(next.input.message, "assistant"),
          ...(next.draft.trim() ? [dailyTurn(next.draft, "user")] : []),
        ],
      };
    await putSession(s);
    latest.current = s;
    if (alive.current) setSession(s);
    return s;
  }
  function base(): MessengerRecord {
    const clean = parseMessengerInput(input);
    return record && messengerKey(clean) === messengerKey(record.input)
      ? { ...record, draft, selectedTone: tone, draftSource }
      : {
          version: 1,
          input: clean,
          candidates: [],
          source: "manual",
          draft: "",
          draftSource: "manual",
          updatedAt: new Date().toISOString(),
        };
  }
  async function prepare() {
    if (!valid) return;
    await action(async () => {
      const b = base();
      await persist(b);
      if (alive.current) {
        setDraft(b.draft);
        setTone(b.selectedTone);
        setDraftSource(b.draftSource);
        setEditing(false);
        setInputOpen(false);
        setNotice(
          "상대 메시지와 조건을 저장했어요. 답장을 직접 적어도 좋아요.",
        );
      }
    });
  }
  async function generate() {
    if (!valid || !consent || !config.available) return;
    await action(async () => {
      const b = base();
      await persist(b);
      if (!alive.current) return;
      setEditing(false);
      setDraft(b.draft);
      setTone(b.selectedTone);
      setDraftSource(b.draftSource);
      const c = new AbortController();
      abort.current = c;
      const timer = setTimeout(() => c.abort(), 25000);
      try {
        const r = await aiFetch("/api/messenger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: c.signal,
          body: JSON.stringify({
            input: b.input,
            consent,
            adultConsent: consent,
            sampleConsent: consent,
          }),
        });
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "후보를 받지 못했어요.");
        const candidates = parseMessengerCandidates(d.candidates);
        if (!alive.current) return;
        await persist({ ...b, candidates, source: "ai" });
        if (alive.current)
          setNotice(
            "말투별 후보를 준비했어요. 하나를 골라 내 표현으로 바꿔보세요.",
          );
      } finally {
        clearTimeout(timer);
      }
    });
  }
  async function example(id: string) {
    const ex = messengerExamples.find((e) => e.id === id)!;
    leave(
      () =>
        void action(async () => {
          const s = await persist(
            {
              version: 1,
              input: { ...ex.input },
              candidates: ex.candidates,
              source: "sample",
              draft: "",
              draftSource: "manual",
              updatedAt: new Date().toISOString(),
            },
            true,
          );
          if (alive.current) {
            setInput(s.messenger!.input);
            setDraft("");
            setTone(undefined);
            setDraftSource("manual");
            setEditing(false);
            setInputOpen(false);
            setReplyOpen(true);
            setNotice(
              "사전 작성된 가상 예시를 열었어요. AI를 호출하지 않았어요.",
            );
          }
        }),
    );
  }
  function pick(c: MessengerCandidate) {
    if (
      draft.trim() &&
      draft !== record?.draft &&
      !window.confirm("작성 중인 답장을 선택한 후보로 바꿀까요?")
    )
      return;
    setDraft(c.text);
    setTone(c.tone);
    setDraftSource(record?.source || "manual");
    draftRevision.current++;
    setCopiedText("");
    setNotice("");
    setError("");
    setReplyFeedback({
      kind: "info",
      text: "후보를 답장 칸에 넣었어요. 수정한 뒤 복사하거나 저장하세요.",
    });
    editor.current?.focus({ preventScroll: true });
  }
  async function save() {
    if (!record || !draft.trim()) return;
    await action(async () => {
      await persist({
        ...record,
        draft: draft.trim(),
        selectedTone: tone,
        draftSource,
      });
      if (alive.current) {
        setDraft(draft.trim());
        setReplyOpen(false);
        setReplyFeedback({
          kind: "success",
          text: "답장을 이 브라우저에 저장했어요. ‘저장한 답장 보기’에서 다시 열 수 있어요.",
        });
      }
    }, true);
  }
  async function copy() {
    if (!draft.trim() || lock.current) return;
    const text = draft.trim(),
      revision = draftRevision.current;
    lock.current = true;
    setCopying(true);
    setCopiedText("");
    setError("");
    setNotice("");
    setReplyFeedback({ kind: "pending", text: "답장을 복사하고 있어요…" });
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(text);
      if (alive.current && revision === draftRevision.current) {
        setCopiedText(text);
        setReplyFeedback({
          kind: "success",
          text: "답장을 복사했어요. 메신저에 붙여넣어 확인한 뒤 보내세요. 복사는 저장과 별개예요.",
        });
      }
    } catch {
      if (alive.current && revision === draftRevision.current) {
        selectAfterCopy.current = true;
        setReplyOpen(true);
        editor.current?.focus({ preventScroll: true });
        editor.current?.select();
        editor.current?.setSelectionRange(0, draft.length);
        setReplyFeedback({
          kind: "error",
          text: "자동 복사가 차단됐어요. 선택된 답장을 길게 누르거나 Ctrl/Cmd+C로 복사해 주세요.",
        });
      }
    } finally {
      lock.current = false;
      if (alive.current) setCopying(false);
    }
  }
  const aiControls = (
    <details className="dc-guide-faq">
      <summary>AI 답장 후보 받기 · 선택</summary>
      <p>
        상대 메시지와 선택한 관계·의도·목표·지킬 선만 전송해요. 다른 대화 기록은
        보내지 않아요.
      </p>
      <AIConsent
        config={config}
        checked={consent}
        onChange={setConsent}
        disabled={busy || copying}
      />
      <button
        className="dd-secondary"
        disabled={busy || copying || !valid || !consent || !config.available}
        onClick={() => void generate()}
      >
        말투별 AI 후보 받기
      </button>
      {!config.available && (
        <p>AI 연결 전에는 작성된 예시나 직접 작성을 이용할 수 있어요.</p>
      )}
    </details>
  );
  const sampleChoices = (
    <div className="daily-topic-grid">
      {messengerExamples.map((e) => (
        <button
          key={e.id}
          disabled={busy || copying}
          onClick={() => void example(e.id)}
        >
          <small>사전 작성 가상 예시 · AI 호출 없음</small>
          <strong>{e.title}</strong>
          <span>{e.input.message}</span>
        </button>
      ))}
    </div>
  );
  return (
    <section className="messenger-practice" aria-label="메시지 답장">
      <div className="dc-page-top">
        <div>
          <p className="dc-overline">보내기 전에, 내 의도가 전해지도록</p>
          <h1>메시지 답장</h1>
        </div>
        <button
          className="dd-link"
          disabled={busy || copying}
          onClick={() => leave(onRecords)}
        >
          저장한 답장 보기
        </button>
      </div>
      <p>
        카톡·문자·메신저의 상대 메시지를 붙여넣고 답장을 준비해요. 완성한 답장은
        복사해서 직접 보내세요.
      </p>
      {error && !inputOpen && !replyOpen && (
        <p role="alert" className="dc-error">
          {error}
        </p>
      )}
      {notice && !inputOpen && !replyOpen && (
        <p role="status" className="dc-toast">
          {notice}
        </p>
      )}
      {!record && (
        <>
          {sampleChoices}
          <button
            className="dd-primary"
            onClick={() => {
              setEditing(true);
              setInputOpen(true);
            }}
          >
            {input.message || input.goal
              ? "메시지 입력 이어쓰기"
              : "메시지 입력"}
          </button>
        </>
      )}
      <InputDialog
        open={inputOpen}
        title="메시지와 목표 입력"
        busy={busy || copying}
        onClose={() => setInputOpen(false)}
      >
        {record && (
          <details className="dc-guide-faq">
            <summary>가상 예시로 새로 시작</summary>
            {sampleChoices}
          </details>
        )}
        {error && (
          <p role="alert" className="dc-error">
            {error}
          </p>
        )}
        <label className="messenger-field">
          상대가 보낸 메시지
          <textarea
            aria-label="상대가 보낸 메시지"
            rows={4}
            maxLength={4000}
            value={input.message}
            disabled={busy || copying}
            onChange={(e) => setInput({ ...input, message: e.target.value })}
            placeholder="상대 메시지를 붙여넣어 주세요."
          />
        </label>
        <p className="vn-caption">
          이름·연락처 등 식별 정보는 빼 주세요.
          {config.sampleOnly
            ? " 현재 AI는 개인정보·기밀 없는 자작 연습으로 이용해 주세요."
            : ""}
        </p>
        <div className="messenger-settings">
          <label>
            상대와의 관계
            <select
              aria-label="상대와의 관계"
              disabled={busy || copying}
              value={input.relation}
              onChange={(e) => setInput({ ...input, relation: e.target.value })}
            >
              {messengerRelations.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            이번 답장의 의도
            <select
              aria-label="이번 답장의 의도"
              disabled={busy || copying}
              value={input.intent}
              onChange={(e) => setInput({ ...input, intent: e.target.value })}
            >
              {messengerIntents.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="messenger-field">
          내가 전하고 싶은 것
          <textarea
            aria-label="내가 전하고 싶은 것"
            rows={2}
            maxLength={500}
            value={input.goal}
            disabled={busy || copying}
            onChange={(e) => setInput({ ...input, goal: e.target.value })}
            placeholder="예: 가능한 시간을 먼저 확인하고 싶어요."
          />
        </label>
        <label className="messenger-field">
          지킬 선 · 선택
          <textarea
            aria-label="지킬 선"
            rows={2}
            maxLength={500}
            value={input.boundary}
            disabled={busy || copying}
            onChange={(e) => setInput({ ...input, boundary: e.target.value })}
            placeholder="예: 오늘 마치겠다고 약속하지 않기"
          />
        </label>
        <button
          className="dd-primary"
          disabled={busy || copying || !valid}
          onClick={() => void prepare()}
        >
          저장하고 답장 준비
        </button>
        <p className="vn-caption">
          상대 메시지와 목표를 입력하면 시작할 수 있어요. 저장 전 입력은 화면을
          나가면 사라질 수 있어요.
        </p>
      </InputDialog>
      {record && (
        <>
          <details className="dc-guide-faq" open>
            <summary>상대 메시지와 내 의도</summary>
            <div className="messenger-incoming">
              <small>상대가 보낸 말</small>
              <p>{record?.input.message}</p>
            </div>
            <p>
              {record?.input.relation} · {record?.input.intent}
            </p>
            <p>
              <strong>내 목표</strong> · {record?.input.goal}
            </p>
            {record?.input.boundary && (
              <p>
                <strong>지킬 선</strong> · {record.input.boundary}
              </p>
            )}
            <button
              className="dd-link"
              disabled={busy || copying}
              onClick={() => {
                setEditing(true);
                setInputOpen(true);
              }}
            >
              메시지·조건 수정
            </button>
          </details>
          <div className="input-launcher">
            <button
              className="dd-primary"
              disabled={busy || copying}
              onClick={() => setReplyOpen(true)}
            >
              {draft.trim() ? "답장 수정" : "답장 쓰기"}
            </button>
            {editing && messengerKey(input) !== messengerKey(record.input) && (
              <button className="dd-link" onClick={() => setInputOpen(true)}>
                조건 입력 이어쓰기
              </button>
            )}
          </div>
          {record.draft && !replyOpen && (
            <article className="input-receipt" aria-label="저장한 답장">
              <small>저장한 답장</small>
              <p>{record.draft}</p>
              <button
                className="dd-secondary"
                disabled={copying || busy || draftDirty}
                onClick={() => void copy()}
              >
                {copying
                  ? "복사 중…"
                  : copiedText === draft.trim()
                    ? "복사 완료"
                    : "답장 복사"}
              </button>
            </article>
          )}
          {!replyOpen && (
            <div className="messenger-reply-actions">
              {replyFeedback && (
                <p
                  role={replyFeedback.kind === "error" ? "alert" : "status"}
                  className={"messenger-feedback " + replyFeedback.kind}
                >
                  {replyFeedback.text}
                </p>
              )}
              {draftDirty && (
                <p className="vn-caption">
                  수정 중인 답장이 있어요. ‘답장 수정’에서 이어서 저장해 주세요.
                </p>
              )}
            </div>
          )}
          <InputDialog
            open={replyOpen}
            title="답장 작성"
            busy={busy || copying}
            onClose={() => setReplyOpen(false)}
            focusTarget={editor}
          >
            {error && (
              <p role="alert" className="dc-error">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="dc-toast">
                {notice}
              </p>
            )}
            {aiControls}
            {!!record?.candidates.length && (
              <>
                <h2>말투를 골라 내 표현으로 고쳐보세요</h2>
                <p className="messenger-source">
                  {record.source === "sample"
                    ? "사전 작성 샘플 · 이 가상 상황을 위한 예시예요."
                    : "AI가 생성한 제안 · 없는 약속이나 사실이 들어갔는지 확인해 주세요."}
                </p>
                <div className="messenger-candidates">
                  {record.candidates.map((c) => (
                    <article key={c.tone}>
                      <h3>{c.tone}</h3>
                      <p>{c.text}</p>
                      <small>{c.note}</small>
                      <button
                        className="dd-secondary"
                        disabled={busy || copying}
                        onClick={() => pick(c)}
                      >
                        {c.tone} 후보 고르기
                      </button>
                    </article>
                  ))}
                </div>
              </>
            )}
            <div className="messenger-editor">
              <Companion
                small
                mood={busy ? "think" : "hello"}
                character={session?.companion || friend}
              />
              <label className="messenger-field">
                보낼 답장
                <textarea
                  ref={editor}
                  aria-label="보낼 답장"
                  rows={5}
                  maxLength={2000}
                  value={draft}
                  disabled={busy}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    draftRevision.current++;
                    setCopiedText("");
                    setReplyFeedback(null);
                    if (!tone) setDraftSource("manual");
                  }}
                  placeholder="후보를 고르거나 직접 답장을 써보세요."
                />
              </label>
            </div>
            {tone && (
              <p className="vn-caption">
                {tone} 후보에서 시작한 초안 ·{" "}
                {draftSource === "sample"
                  ? "사전 작성 예시"
                  : draftSource === "ai"
                    ? "AI 제안"
                    : "직접 작성"}
              </p>
            )}
            <div className="messenger-reply-actions">
              <div className="dc-inline-actions">
                <button
                  className="dd-primary"
                  disabled={busy || copying || !draft.trim()}
                  aria-busy={copying}
                  onClick={() => void copy()}
                >
                  {copying
                    ? "복사 중…"
                    : copiedText && copiedText === draft.trim()
                      ? "복사 완료"
                      : "답장 복사"}
                </button>
                <button
                  className="dd-secondary"
                  disabled={busy || copying || !draft.trim() || savedReply}
                  aria-busy={saving}
                  onClick={() => void save()}
                >
                  {saving ? "저장 중…" : savedReply ? "저장됨" : "답장 저장"}
                </button>
              </div>
              <div
                className="messenger-action-feedback"
                aria-live="polite"
                aria-atomic="true"
              >
                {replyFeedback && (
                  <p
                    role={replyFeedback.kind === "error" ? "alert" : "status"}
                    className={"messenger-feedback " + replyFeedback.kind}
                  >
                    {replyFeedback.text}
                  </p>
                )}
                {!replyFeedback && (
                  <p className="vn-caption">
                    {!draft.trim()
                      ? "후보를 고르거나 답장을 입력하면 복사·저장할 수 있어요."
                      : savedReply
                        ? "이 답장은 이 브라우저에 저장돼 있어요."
                        : "아직 저장하지 않은 답장이에요."}
                  </p>
                )}
              </div>
              {savedReply && (
                <button
                  className="dd-link"
                  disabled={busy || copying}
                  onClick={() => leave(onRecords)}
                >
                  저장한 답장 보기
                </button>
              )}
            </div>
            {error && (
              <details className="dc-guide-faq">
                <summary>AI 없이 작성된 답장 예시 보기</summary>
                <p>
                  현재 메시지의 분석이 아닌 별도의 가상 예시예요. 내 입력은
                  바뀌지 않아요.
                </p>
                {messengerExamples.map((e) => (
                  <article key={e.id}>
                    <h3>{e.title}</h3>
                    <blockquote>{e.input.message}</blockquote>
                    <p>{e.candidates[0].text}</p>
                  </article>
                ))}
              </details>
            )}
            <p className="input-dialog-note">
              닫으면 초안을 잠시 보관해요. 저장해야 기록에 남아요.
            </p>
          </InputDialog>
          <p className="vn-caption">
            복사와 저장은 별개예요. 자동 전송·카카오톡 연결은 없으며, 저장한
            답장은 ‘대화 기록’에서 다시 열 수 있어요.
          </p>
        </>
      )}
      {busy && <p role="status">{friend.name}가 답장 준비를 돕고 있어요…</p>}
      {session && (
        <details className="dc-guide-faq">
          <summary>기록 관리</summary>
          <button
            className="dd-link"
            disabled={busy || copying}
            onClick={() =>
              leave(() => {
                latest.current = undefined;
                setSession(undefined);
                setInput({ ...blankMessenger });
                setDraft("");
                setTone(undefined);
                setDraftSource("manual");
                setEditing(true);
                setInputOpen(true);
                setReplyOpen(false);
                setReplyFeedback(null);
                setError("");
                setNotice("");
              })
            }
          >
            새 답장 준비
          </button>
          <button
            className="dd-link"
            disabled={busy || copying}
            onClick={() => {
              if (
                window.confirm("상대 메시지와 저장한 답장 초안을 삭제할까요?")
              )
                void action(async () => {
                  await deleteSession(session.id);
                  if (alive.current) {
                    latest.current = undefined;
                    setSession(undefined);
                    setInput({ ...blankMessenger });
                    setDraft("");
                    setTone(undefined);
                    setDraftSource("manual");
                    setEditing(true);
                    setNotice("기록을 삭제했어요.");
                  }
                });
            }}
          >
            이 답장 기록 삭제
          </button>
        </details>
      )}
    </section>
  );
}
