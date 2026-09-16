"use client";
import StickyPageTop from "./StickyPageTop";
import PersonaObserver from "./PersonaObserver";
import PracticeGarden from "./PracticeGarden";
import PracticalScenes from "./PracticalScenes";
import { responseFriends } from "@/lib/practical-scenes";
import type { ConversationCard } from "@/lib/conversation-cards";
import type { AIConfig } from "./VoiceComposer";
import CommunityPreview from "./CommunityPreview";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import RoomEnvironment from "./RoomEnvironment";
import { Companion, Icon } from "./CompanionUI";
import {
  allCompanions,
  companionColors,
  companionShapes,
  companionForSession,
  saveCompanion,
  type CompanionCharacter,
} from "@/lib/companions";
import { listSessions, type VoiceSession } from "@/lib/voice-notebook";
function CharacterEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: CompanionCharacter;
  onClose: () => void;
  onSaved: (rows: CompanionCharacter[], id: CompanionCharacter["id"]) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [draft, setDraft] = useState(initial),
    [error, setError] = useState("");
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="vn-term-dialog dc-character-editor"
      aria-labelledby="character-editor-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="vn-dialog-top">
        <h2 id="character-editor-title">
          {initial.name ? "친구 모습과 역할 바꾸기" : "내 친구 만들기"}
        </h2>
        <button
          className="vn-icon"
          onClick={onClose}
          aria-label="캐릭터 설정 닫기"
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="dc-character-preview">
        <Companion character={draft} />
        <strong>{draft.name || "어떤 이름으로 부를까요?"}</strong>
      </div>
      <label className="vn-label">
        이름
        <input
          maxLength={12}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="예: 루미"
        />
      </label>
      <fieldset className="dc-shape-picker">
        <legend>모습</legend>
        {Object.entries(companionShapes).map(([shape, label]) => (
          <label key={shape}>
            <input
              type="radio"
              name="character-shape"
              checked={draft.shape === shape}
              onChange={() =>
                setDraft({
                  ...draft,
                  shape: shape as CompanionCharacter["shape"],
                })
              }
            />
            <Companion
              small
              character={{
                ...draft,
                shape: shape as CompanionCharacter["shape"],
              }}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="dc-color-picker">
        <legend>색</legend>
        {Object.entries(companionColors).map(([color, c]) => (
          <label key={color} style={{ "--swatch": c.body } as CSSProperties}>
            <input
              type="radio"
              name="character-color"
              checked={draft.color === color}
              onChange={() =>
                setDraft({
                  ...draft,
                  color: color as CompanionCharacter["color"],
                })
              }
            />
            {c.label}
          </label>
        ))}
      </fieldset>
      <label className="vn-label">
        도와줄 일
        <input
          maxLength={80}
          value={draft.specialty}
          onChange={(e) => setDraft({ ...draft, specialty: e.target.value })}
          placeholder="예: 신입 기획자의 업무 용어와 질문 정리"
        />
      </label>
      <label className="vn-label">
        말투와 역할
        <textarea
          rows={3}
          maxLength={500}
          value={draft.persona}
          onChange={(e) => setDraft({ ...draft, persona: e.target.value })}
          placeholder="예: 다정한 선배처럼 존댓말로 설명하고, 짧은 예시를 들어줘요."
        />
      </label>
      <p className="vn-caption">
        이 설정은 친구방의 AI 대화에 사용해요. 카드로 역할 연습을 할 때는 카드의
        상대와 상황을 따라요. 이 브라우저에 보관되며, 이전 대화에 저장된 모습은
        유지돼요.
      </p>
      {error && (
        <p className="dd-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="dd-primary dd-full"
        onClick={() => {
          try {
            const rows = saveCompanion(draft);
            onSaved(rows, draft.id);
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "친구를 저장하지 못했어요.",
            );
          }
        }}
      >
        친구방에 저장 <Icon name="check" size={18} />
      </button>
    </dialog>
  );
}
function CompanionCard({
  selected,
  characters,
  history,
  samples,
  onSelect,
  onClose,
  onReturnFocus,
  onEdit,
  onChat,
  onSession,
  onCards,
}: {
  selected: CompanionCharacter;
  characters: CompanionCharacter[];
  history: VoiceSession[];
  samples: VoiceSession[];
  onSelect: (id: CompanionCharacter["id"]) => void;
  onClose: () => void;
  onReturnFocus: () => void;
  onEdit: () => void;
  onChat: () => void;
  onSession: (id: string) => void;
  onCards: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    content = useRef<HTMLDivElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const restoreFocus = useRef(onReturnFocus);
  restoreFocus.current = onReturnFocus;
  useEffect(() => {
    const el = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    el?.showModal();
    heading.current?.focus({ preventScroll: true });
    return () => {
      el?.close();
      document.body.style.overflow = overflow;
      restoreFocus.current();
    };
  }, []);
  useEffect(() => {
    if (content.current) content.current.scrollTop = 0;
  }, [selected.id]);
  const index = characters.findIndex((c) => c.id === selected.id);
  const historyItem = (s: VoiceSession) => (
    <button key={s.id} onClick={() => onSession(s.id)}>
      <strong>{s.title}</strong>
      <span>
        {new Date(s.updatedAt).toLocaleDateString("ko-KR")} · {s.turns.length}개
        대화
      </span>
      <Icon name="arrow" size={16} />
    </button>
  );
  return (
    <dialog
      ref={dialog}
      className="dc-room-dialog"
      aria-labelledby="room-card-name"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          onClose();
      }}
    >
      <div className="dc-room-card-head">
        <div className="dc-room-card-toolbar">
          <span>친구의 대화 카드</span>
          <div className="dc-room-switcher" aria-label="다른 친구 보기">
            <button
              className="vn-icon"
              aria-label="이전 친구"
              onClick={() =>
                onSelect(
                  characters[
                    (index - 1 + characters.length) % characters.length
                  ].id,
                )
              }
            >
              <Icon name="arrow" size={17} />
            </button>
            <span>
              {index + 1} / {characters.length}
            </span>
            <button
              className="vn-icon"
              aria-label="다음 친구"
              onClick={() =>
                onSelect(characters[(index + 1) % characters.length].id)
              }
            >
              <Icon name="arrow" size={17} />
            </button>
          </div>
          <button
            className="vn-icon"
            aria-label="친구방으로 돌아가기"
            onClick={onClose}
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="dc-room-selected">
          <Companion small character={selected} />
          <div>
            <span>{selected.custom ? "내가 만든 친구" : "기본 친구"}</span>
            <h2
              id="room-card-name"
              ref={heading}
              tabIndex={-1}
              aria-live="polite"
            >
              {selected.name}
            </h2>
            <p>{selected.specialty}</p>
          </div>
          <button
            className="vn-icon"
            aria-label={selected.name + " 설정 바꾸기"}
            onClick={onEdit}
          >
            <Icon name="edit" size={19} />
          </button>
        </div>
        <button className="dd-primary dd-full" onClick={onChat}>
          지금 이야기하기 <Icon name="chat" size={18} />
        </button>
      </div>
      <div className="dc-room-card-content" ref={content} key={selected.id}>
        <h3>
          최근 이야기 <span>{history.length}개</span>
        </h3>
        {history.length ? (
          <>
            <div className="dc-room-history">
              {history.slice(0, 3).map(historyItem)}
            </div>
            {history.length > 3 && (
              <details className="dc-room-older">
                <summary>이전 대화 {history.length - 3}개 더 보기</summary>
                <div className="dc-room-history">
                  {history.slice(3).map(historyItem)}
                </div>
              </details>
            )}
          </>
        ) : (
          <p className="dc-room-empty">
            아직 함께 나눈 이야기가 없어요. 위에서 첫 대화를 시작해 보세요.
          </p>
        )}
        <button className="dd-link dc-room-card-practice" onClick={onCards}>
          상황 카드로 대화 연습하기 <Icon name="arrow" size={16} />
        </button>
        {!!samples.length && (
          <details className="dc-room-samples">
            <summary>대화 예시 먼저 보기</summary>
            {samples.map((s) => (
              <button
                className="dd-link"
                key={s.id}
                onClick={() => onSession(s.id)}
              >
                {s.title}
                <Icon name="arrow" size={15} />
              </button>
            ))}
          </details>
        )}
        <small className="dc-room-note">
          AI 친구예요. 대화는 이 브라우저에 남아요. 새 대화에는 다른 기록을
          자동으로 보내지 않아요.
        </small>
      </div>
    </dialog>
  );
}
export default function CompanionRoom({
  config,
  onPractice,
  saved,
  onSaved,
  onChat,
  onSession,
  onCards,
}: {
  config: AIConfig;
  onPractice: (card: ConversationCard) => void;
  saved: CompanionCharacter[];
  onSaved: (rows: CompanionCharacter[]) => void;
  onChat: (c: CompanionCharacter) => void;
  onSession: (id: string) => void;
  onCards: () => void;
}) {
  const room = useRef<HTMLDivElement>(null),
    returnToCard = useRef(false);
  const characters = allCompanions(saved),
    [selectedId, setSelectedId] = useState(characters[0].id),
    [sessions, setSessions] = useState<VoiceSession[]>([]),
    [cardOpen, setCardOpen] = useState(false),
    [editing, setEditing] = useState<CompanionCharacter | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const selected = characters.find((c) => c.id === selectedId) || characters[0];
  useEffect(() => {
    let alive = true;
    listSessions()
      .then((rows) => {
        if (alive) setSessions(rows);
      })
      .catch(() => {
        if (alive)
          setError(
            "지난 대화를 읽지 못했어요. 새로고침 후 다시 확인해 주세요.",
          );
      });
    return () => {
      alive = false;
    };
  }, []);
  const history = sessions
    .filter((s) => !s.isSample && companionForSession(s).id === selected.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const samples = sessions.filter(
    (s) => s.isSample && companionForSession(s).id === selected.id,
  );
  return (
    <>
      <StickyPageTop>
        <div>
          <p className="dc-overline">이야기가 쌓이는 작은 공간</p>
          <h1>
            친구방 <span className="dc-count">{characters.length}</span>
          </h1>
        </div>
        <button
          className="dd-primary"
          onClick={() => {
            returnToCard.current = false;
            setEditing({
              id: `custom-${crypto.randomUUID()}`,
              name: "",
              shape: "round",
              color: "sage",
              specialty: "대화와 생각 정리",
              persona:
                "다정한 존댓말로 듣고, 짧은 예시와 함께 다음 행동을 정리해 줘요.",
              custom: true,
            });
          }}
        >
          <Icon name="plus" size={18} />
          친구 만들기
        </button>
      </StickyPageTop>
      <p className="dc-room-intro">
        친구를 누르면 대화 카드가 바로 열려요. 지난 이야기부터 이어가도 좋아요.
      </p>
      <div className="dc-room-layout" ref={room}>
        <RoomEnvironment>
          <div className="dc-room-actors">
            {characters.map((c, i) => (
              <button
                key={c.id}
                className={
                  "dc-room-actor " + (selected.id === c.id ? "selected" : "")
                }
                aria-pressed={selected.id === c.id}
                aria-label={c.name + " 선택"}
                aria-haspopup="dialog"
                data-companion-id={c.id}
                onClick={() => {
                  setSelectedId(c.id);
                  setCardOpen(true);
                }}
                style={
                  {
                    "--walk-delay": `${i * -1.9}s`,
                    "--walk-duration": `${8 + (i % 4)}s`,
                  } as CSSProperties
                }
              >
                <span className="dc-room-walker">
                  <Companion small character={c} />
                </span>
                <span className="dc-room-name">
                  {c.name}
                  {c.custom && <small>내 친구</small>}
                </span>
              </button>
            ))}
          </div>
        </RoomEnvironment>
      </div>
      <PracticeGarden
        sessions={sessions}
        onPractice={onPractice}
        onSession={onSession}
      />
      <PracticalScenes onPractice={onPractice} />
      <details className="dc-response-friends">
        <summary>응대 연습 친구 초대하기 · 4가지 역할</summary>
        <p>
          역할을 골라 친구방에 저장하세요. 모든 캐릭터는 연습을 위한 가상
          AI예요.
        </p>
        <div className="dc-invite-grid">
          {responseFriends.map((c) => (
            <article key={c.id}>
              <Companion small character={c} />
              <div>
                <strong>{c.name}</strong>
                <p>{c.specialty}</p>
                <button
                  className="dd-secondary"
                  disabled={saved.some((s) => s.id === c.id)}
                  onClick={() => {
                    try {
                      const rows = saveCompanion(c);
                      onSaved(rows);
                      setNotice(c.name + "를 친구방에 초대했어요.");
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "저장하지 못했어요.",
                      );
                    }
                  }}
                >
                  {saved.some((s) => s.id === c.id)
                    ? "초대 완료"
                    : c.name + " 초대하기"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </details>
      <details className="dc-guide-faq">
        <summary>더 둘러보기 · 친구들 대화 관찰과 라운지 미리보기</summary>
        <PersonaObserver config={config} characters={characters} />
        <CommunityPreview />
      </details>
      {cardOpen && (
        <CompanionCard
          selected={selected}
          characters={characters}
          history={history}
          samples={samples}
          onSelect={setSelectedId}
          onClose={() => setCardOpen(false)}
          onReturnFocus={() =>
            room.current
              ?.querySelector<HTMLButtonElement>(
                `[data-companion-id="${selected.id}"]`,
              )
              ?.focus({ preventScroll: true })
          }
          onEdit={() => {
            returnToCard.current = true;
            setCardOpen(false);
            setEditing(selected);
          }}
          onChat={() => onChat(selected)}
          onSession={onSession}
          onCards={onCards}
        />
      )}
      {notice && (
        <p className="dc-toast" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="dd-error" role="alert">
          {error}
        </p>
      )}
      {editing && (
        <CharacterEditor
          key={editing.id}
          initial={editing}
          onClose={() => {
            setEditing(null);
            if (returnToCard.current) setCardOpen(true);
          }}
          onSaved={(rows, id) => {
            onSaved(rows);
            setSelectedId(id);
            setEditing(null);
            setCardOpen(true);
            setNotice(
              "친구를 저장했어요. 다시 방문해도 이 방에서 만날 수 있어요.",
            );
          }}
        />
      )}
    </>
  );
}
