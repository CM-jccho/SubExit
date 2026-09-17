"use client";
import InputDialog from "./InputDialog";
import { useAIConsent } from "./ConsentSession";
import type { ConversationFocus } from "@/lib/conversation-focus";
import CommunicationTips from "./CommunicationTips";
import StickyPageTop from "./StickyPageTop";
import TrendSearch from "./TrendSearch";
import TermCatalogue from "./TermCatalogue";
import { termGroups } from "@/lib/term-catalogue";
import type { CompanionCharacter } from "@/lib/companions";
import { aiFetch } from "@/lib/ai-client";
import QuotaHelp from "./QuotaHelp";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./CompanionUI";
import CompanionNudge from "./CompanionNudge";
import { AIConsent, type AIConfig } from "./VoiceComposer";
import {
  deleteTerm,
  downloadBlob,
  guideMarkdown,
  importTerms,
  listTerms,
  parseTermImport,
  putTerm,
  type TermNote,
} from "@/lib/voice-notebook";
export function TermText({
  text,
  candidates = [],
  onTerm,
}: {
  text: string;
  candidates?: string[];
  onTerm: (term: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? text : text.slice(0, 2400);
  const words = [...candidates]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(
    `(${words.length ? words.join("|") + "|" : ""}[\\p{L}\\p{N}_+#-]+)`,
    "giu",
  );
  return (
    <>
      <p className="vn-transcript-text">
        {shown.split(regex).map((part, i) =>
          /^[\p{L}\p{N}]/u.test(part) ? (
            <button
              type="button"
              key={i}
              className={
                "vn-word " +
                (candidates.some((t) => t.toLowerCase() === part.toLowerCase())
                  ? "is-term"
                  : "")
              }
              onClick={() => onTerm(part)}
              aria-label={part + " 용어 메모 열기"}
            >
              {part}
            </button>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </p>
      {text.length > 2400 && (
        <button className="dd-link" onClick={() => setExpanded((v) => !v)}>
          {expanded
            ? "문자 접기"
            : `전체 문자 보기 · ${text.length.toLocaleString()}자`}
        </button>
      )}
    </>
  );
}
export type TermSeed = {
  term: string;
  quote: string;
  industry: string;
  sessionId: string;
  note?: TermNote;
};
export function TermEditor({
  seed,
  config,
  onClose,
  onSaved,
}: {
  seed: TermSeed;
  config: AIConfig;
  onClose: () => void;
  onSaved: () => void;
}) {
  const abort = useRef<AbortController | null>(null);
  const [note, setNote] = useState<TermNote>(
    () =>
      seed.note || {
        id: "term-" + crypto.randomUUID(),
        term: seed.term,
        industry: seed.industry,
        meaning: "",
        usage: "",
        caution: "",
        memo: "",
        quote: seed.quote.slice(
          Math.max(0, seed.quote.indexOf(seed.term) - 500),
          Math.max(0, seed.quote.indexOf(seed.term) - 500) + 1500,
        ),
        sessionId: seed.sessionId,
        source: "manual",
        reviewed: false,
        updatedAt: new Date().toISOString(),
      },
  );
  const [consent, setConsent] = useAIConsent(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    return () => {
      abort.current?.abort();
    };
  }, []);
  async function explain() {
    setBusy(true);
    setError("");
    const c = new AbortController();
    abort.current = c;
    const timeout = setTimeout(() => c.abort(), 25000);
    try {
      const r = await aiFetch("/api/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "explain",
          term: note.term,
          text: note.quote,
          industry: note.industry,
          consent,
          adultConsent: consent,
          sampleConsent: consent,
        }),
        signal: c.signal,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setNote((n) => ({
        ...n,
        meaning: d.meaning,
        usage: d.usage,
        caution: d.caution.slice(0, 600),
        source: "ai",
        reviewed: false,
      }));
    } catch (e) {
      if (!c.signal.aborted)
        setError(e instanceof Error ? e.message : "뜻을 가져오지 못했어요.");
      else setError("응답이 지연됐어요. 직접 작성하거나 다시 시도해 주세요.");
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  }
  async function save() {
    setError("");
    setBusy(true);
    try {
      const existing = (await listTerms()).find(
        (t) =>
          t.id !== note.id &&
          t.term.toLocaleLowerCase() === note.term.trim().toLocaleLowerCase() &&
          t.industry.toLocaleLowerCase() ===
            note.industry.trim().toLocaleLowerCase(),
      );
      if (existing) {
        setError(
          "같은 업종의 용어가 이미 있어요. 용어 노트에서 기존 메모를 수정해 주세요.",
        );
        return;
      }
      await putTerm(note);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }
  const edit = (field: keyof TermNote, value: string) =>
    setNote((n) => ({ ...n, [field]: value, reviewed: false }));
  return (
    <InputDialog
      open
      title={"용어 메모"}
      className="vn-dialog"
      closeLabel="용어 메모 닫기"
      onClose={onClose}
    >
      <label className="vn-label">
        용어·표현
        <input
          value={note.term}
          disabled={busy}
          maxLength={80}
          placeholder="저장할 단어나 표현을 입력해 주세요"
          onChange={(e) => edit("term", e.target.value)}
        />
      </label>
      {!seed.note && (
        <>
          <p className="vn-caption">
            표현만 먼저 저장해도 돼요. 뜻과 예문은 나중에 용어 노트에서 추가할
            수 있어요.
          </p>
          <button
            className="dd-primary dd-full"
            disabled={busy || !note.term.trim()}
            onClick={() => void save()}
          >
            이 표현 바로 저장
          </button>
        </>
      )}
      <label className="vn-label">
        분야 · 업종 · 세대
        <input
          list="term-fields"
          value={note.industry}
          disabled={busy}
          maxLength={120}
          onChange={(e) => edit("industry", e.target.value)}
          placeholder="예: IT 서비스 기획, 중학교 생활"
        />
      </label>
      <datalist id="term-fields">
        {Object.values(termGroups).map((label) => (
          <option key={label} value={label} />
        ))}
      </datalist>
      {note.quote && (
        <details className="vn-quote">
          <summary>이 말을 만난 대화</summary>
          <p>{note.quote}</p>
        </details>
      )}
      <AIConsent
        priority={-1}
        config={config}
        checked={consent}
        onChange={setConsent}
        disabled={busy}
      />
      <button
        className="dd-secondary"
        disabled={busy || !consent || !config.available || !note.term.trim()}
        onClick={() => void explain()}
      >
        <Icon name="search" size={17} />
        {busy ? "확인 중" : "맥락에 맞는 뜻 알아보기"}
      </button>
      {busy && (
        <CompanionNudge
          mood="think"
          text="이 말이 쓰인 맥락을 살펴보고 있어요."
        />
      )}
      {note.source === "ai" && (
        <p className="vn-caption">
          AI 설명 초안이에요. 사내 은어와 약어는 동료·공식 자료로 확인해 주세요.
        </p>
      )}
      {(
        [
          { k: "meaning", title: "뜻", max: 1000 },
          { k: "usage", title: "자연스러운 사용 예", max: 1000 },
          { k: "caution", title: "누구에게, 언제 쓰면 좋을까", max: 600 },
          { k: "memo", title: "내 메모 · 함께 쓰는 가이드", max: 2000 },
        ] as const
      ).map((f) => (
        <label className="vn-label" key={f.k}>
          {f.title}
          <textarea
            value={note[f.k]}
            maxLength={f.max}
            disabled={busy}
            rows={2}
            onChange={(e) => edit(f.k, e.target.value)}
          />
        </label>
      ))}
      <div className="vn-reference-links">
        <span>자료 찾아 확인하기</span>
        {["한국어", "English", "日本語"].map((lang, i) => (
          <a
            target="_blank"
            rel="noreferrer"
            key={lang}
            href={
              "https://www.google.com/search?q=" +
              encodeURIComponent(
                note.term +
                  " " +
                  note.industry +
                  " " +
                  ["뜻 사용", "meaning usage", "意味 使い方"][i],
              )
            }
          >
            {lang}
            <Icon name="arrow" size={13} />
          </a>
        ))}
      </div>
      <label className="dd-check">
        <input
          type="checkbox"
          checked={note.reviewed}
          disabled={busy}
          onChange={(e) =>
            setNote((n) => ({ ...n, reviewed: e.target.checked }))
          }
        />
        뜻과 이 상황에서의 사용을 직접 확인했어요.
      </label>
      {error && (
        <>
          <p className="dd-error" role="alert">
            {error}
          </p>
          <QuotaHelp error={error} />
        </>
      )}
      <button
        className="dd-primary dd-full"
        disabled={busy || !note.term.trim()}
        onClick={() => void save()}
      >
        용어 노트에 저장
        <Icon name="check" size={18} />
      </button>
    </InputDialog>
  );
}
export default function TermNotebook({
  focus = null,
  config,
  onAsk,
}: {
  config: AIConfig;
  onAsk?: (c: CompanionCharacter) => void;
  focus?: ConversationFocus | null;
}) {
  const [tab, setTab] = useState<"notes" | "catalogue" | "tips">(
    focus && focus !== "all" ? "catalogue" : "notes",
  );
  const [terms, setTerms] = useState<TermNote[]>([]),
    [query, setQuery] = useState(""),
    [seed, setSeed] = useState<TermSeed | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [preview, setPreview] = useState(false);
  const file = useRef<HTMLInputElement>(null),
    shareDialog = useRef<HTMLDialogElement>(null);
  const refresh = () =>
    listTerms()
      .then(setTerms)
      .catch(() =>
        setError(
          "용어 노트를 불러오지 못했어요. 브라우저 저장 권한을 확인해 주세요.",
        ),
      );
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    if (preview) shareDialog.current?.showModal();
    else shareDialog.current?.close();
  }, [preview]);
  const visible = terms
    .filter((t) =>
      [t.term, t.industry, t.meaning, t.memo]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const chosen = terms.filter((t) => selected.includes(t.id)),
    guide = guideMarkdown(chosen);
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "우리 일의 말 사전", text: guide });
        setNotice("공유 창을 열었어요.");
      } else {
        downloadBlob(
          new Blob([guide], { type: "text/markdown;charset=utf-8" }),
          "ddeundeun-work-guide.md",
        );
        setNotice("공유할 가이드 파일을 내려받았어요.");
      }
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        setError(
          "공유 창을 열지 못했어요. Markdown 파일을 내려받아 공유해 주세요.",
        );
    }
  }
  return (
    <>
      <StickyPageTop>
        <div>
          <p className="dc-overline">일과 일상, 세대를 잇는 말</p>
          <h1>
            용어 노트 <span className="dc-count">{terms.length}</span>
          </h1>
        </div>
        <button
          className="dd-primary"
          onClick={() =>
            setSeed({ term: "", quote: "", industry: "", sessionId: "" })
          }
        >
          <Icon name="plus" size={18} />
          용어 추가
        </button>
      </StickyPageTop>
      <aside className="vn-privacy-note" aria-label="용어 노트 공개 범위">
        <strong>
          <Icon name="shield" size={16} /> 나만 보는 노트 · 이 브라우저에 저장
        </strong>
        <p>
          다른 이용자에게 공개되지 않아요. 선택한 노트만 공유 창이나 내려받은
          파일로 직접 전달할 수 있어요.
        </p>
        <details>
          <summary>저장·AI 전송 안내</summary>
          <p>
            계정 동기화는 없으며 브라우저 데이터를 지우면 노트가 사라질 수
            있어요. AI 뜻풀이를 요청하면 선택한 용어·업종·해당 대화 문맥을
            Gemini에 전송해요. 파일 공유에는 뜻·예문·주의사항·내 메모가
            포함되므로 내용을 확인해 주세요. 대화 원문과 음성은 제외돼요.
          </p>
        </details>
      </aside>
      <div className="dc-mode-switch" aria-label="용어 보기">
        <button
          aria-pressed={tab === "notes"}
          className={tab === "notes" ? "active" : ""}
          onClick={() => setTab("notes")}
        >
          내 노트
        </button>
        <button
          aria-pressed={tab === "catalogue"}
          className={tab === "catalogue" ? "active" : ""}
          onClick={() => setTab("catalogue")}
        >
          분야별 표현 찾기 · {Object.keys(termGroups).length}개 분야
        </button>
        <button
          aria-pressed={tab === "tips"}
          className={tab === "tips" ? "active" : ""}
          onClick={() => setTab("tips")}
        >
          소통 팁
        </button>
      </div>
      {tab === "catalogue" && <TrendSearch config={config} />}
      {tab === "tips" ? (
        <CommunicationTips
          onSave={(tip) => {
            const existing = terms.find(
              (t) =>
                t.term === tip.title &&
                t.industry === "소통 팁 · " + tip.context,
            );
            setSeed({
              term: tip.title,
              quote: "",
              industry: "소통 팁 · " + tip.context,
              sessionId: "",
              note: existing || {
                id: "term-" + crypto.randomUUID(),
                term: tip.title,
                industry: "소통 팁 · " + tip.context,
                meaning: tip.why,
                usage: tip.after,
                caution: "관계와 상황에 맞게 고쳐 쓰는 사전 작성 예시입니다.",
                memo: "",
                quote: "",
                sessionId: "",
                source: "manual",
                reviewed: false,
                updatedAt: new Date().toISOString(),
              },
            });
          }}
        />
      ) : tab === "catalogue" ? (
        <TermCatalogue
          key={focus || "unset"}
          focus={focus}
          onAsk={onAsk}
          onSelect={(note) => {
            const existing = terms.find(
              (t) => t.term === note.term && t.industry === note.industry,
            );
            setSeed({
              term: note.term,
              quote: "",
              industry: note.industry,
              sessionId: "",
              note: existing || { ...note, id: "term-" + crypto.randomUUID() },
            });
          }}
        />
      ) : (
        <>
          <label className="dc-search">
            <Icon name="search" size={20} />
            <input
              type="search"
              aria-label="용어 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="용어, 업종, 메모로 찾기"
            />
          </label>
          <div className="vn-toolbar">
            <button
              className="dd-secondary"
              disabled={!selected.length}
              onClick={() => setPreview(true)}
            >
              <Icon name="book" size={17} />
              선택한 {selected.length}개로 가이드 공유
            </button>
            <button className="dd-link" onClick={() => file.current?.click()}>
              용어 파일 가져오기
            </button>
            <input
              hidden
              ref={file}
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  if (f.size > 1000000)
                    throw new Error("1MB 이하 파일을 선택해 주세요.");
                  const rows = parseTermImport(await f.text());
                  const old = await listTerms();
                  const keys = new Set(
                    old.map(
                      (t) =>
                        t.term.toLocaleLowerCase() +
                        "|" +
                        t.industry.toLocaleLowerCase(),
                    ),
                  );
                  const fresh = rows.filter((t) => {
                    const k =
                      t.term.toLocaleLowerCase() +
                      "|" +
                      t.industry.toLocaleLowerCase();
                    if (keys.has(k)) return false;
                    keys.add(k);
                    return true;
                  });
                  await importTerms(fresh);
                  await refresh();
                  setNotice(
                    `${fresh.length}개 용어를 가져왔어요. 중복 용어는 유지했어요.`,
                  );
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "파일을 가져오지 못했어요.",
                  );
                }
              }}
            />
          </div>
          {notice && <CompanionNudge mood="done" text={notice} dismissible />}
          {error && (
            <>
              <p className="dd-error" role="alert">
                {error}
              </p>
              <QuotaHelp error={error} />
            </>
          )}
          <div className="vn-term-list">
            {visible.map((t) => (
              <article key={t.id} className="vn-term-card">
                <label className="vn-term-select">
                  <input
                    type="checkbox"
                    checked={selected.includes(t.id)}
                    aria-label={t.term + " 공유 선택"}
                    onChange={(e) =>
                      setSelected((ids) =>
                        e.target.checked
                          ? [...ids, t.id]
                          : ids.filter((id) => id !== t.id),
                      )
                    }
                  />
                </label>
                <button
                  className="vn-term-open"
                  onClick={() =>
                    setSeed({
                      term: t.term,
                      industry: t.industry,
                      quote: t.quote,
                      sessionId: t.sessionId,
                      note: t,
                    })
                  }
                >
                  <small>
                    {t.isSample && (
                      <span className="dc-sample-badge">샘플</span>
                    )}
                    {t.industry || "업종 미지정"} ·{" "}
                    {t.reviewed
                      ? "직접 확인함"
                      : t.isSample
                        ? "사전 작성 예시"
                        : t.source === "ai"
                          ? "AI 초안"
                          : "직접 작성"}
                  </small>
                  <h2>{t.term}</h2>
                  <p>
                    {t.meaning || "이 말의 뜻과 우리 팀 메모를 남겨보세요."}
                  </p>
                  {t.memo && <p className="vn-team-memo">{t.memo}</p>}
                </button>
                <button
                  className="vn-icon"
                  aria-label={t.term + " 삭제"}
                  onClick={async () => {
                    if (!confirm("이 용어와 메모를 삭제할까요?")) return;
                    try {
                      await deleteTerm(t.id);
                      setSelected((s) => s.filter((id) => id !== t.id));
                      await refresh();
                    } catch {
                      setError("삭제하지 못했어요.");
                    }
                  }}
                >
                  <Icon name="close" size={16} />
                </button>
              </article>
            ))}
          </div>
          {!visible.length && (
            <div className="dc-empty-state">
              <Icon name="book" size={32} />
              <h2>
                {query
                  ? "찾는 용어가 없어요"
                  : "대화하다 만난 말, 놓치지 마세요"}
              </h2>
              <p>대화 문자의 단어를 누르거나 직접 추가하세요.</p>
            </div>
          )}
        </>
      )}
      {seed && (
        <TermEditor
          key={seed.note?.id || seed.term}
          seed={seed}
          config={config}
          onClose={() => setSeed(null)}
          onSaved={() => {
            void refresh();
            setNotice("용어와 메모를 저장했어요.");
          }}
        />
      )}
      <dialog
        ref={shareDialog}
        className="vn-dialog"
        aria-labelledby="share-title"
        onCancel={() => setPreview(false)}
      >
        <div className="vn-dialog-head">
          <h2 id="share-title">공유할 가이드 확인</h2>
          <button
            className="vn-icon"
            aria-label="공유 미리보기 닫기"
            onClick={() => setPreview(false)}
          >
            <Icon name="close" />
          </button>
        </div>
        <p className="vn-caption">
          선택한 용어의 뜻·예문·주의사항·팀 메모가 포함돼요. 대화 원문과 음성은
          포함하지 않아요.
        </p>
        <pre className="vn-guide-preview">{guide}</pre>
        <div className="vn-toolbar">
          <button className="dd-primary" onClick={() => void share()}>
            공유하기
          </button>
          <button
            className="dd-secondary"
            onClick={() =>
              downloadBlob(
                new Blob([guide], { type: "text/markdown;charset=utf-8" }),
                "ddeundeun-work-guide.md",
              )
            }
          >
            가이드 내려받기
          </button>
          <button
            className="dd-link"
            onClick={() =>
              downloadBlob(
                new Blob(
                  [
                    JSON.stringify(
                      {
                        version: 1,
                        terms: chosen.map((t) => ({
                          ...t,
                          quote: "",
                          sessionId: "",
                        })),
                      },
                      null,
                      2,
                    ),
                  ],
                  { type: "application/json" },
                ),
                "ddeundeun-terms.json",
              )
            }
          >
            다른 기기로 가져갈 JSON
          </button>
        </div>
      </dialog>
    </>
  );
}
