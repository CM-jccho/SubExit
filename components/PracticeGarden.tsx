"use client";
import { useEffect, useRef, useState } from "react";
import {
  gardenItems,
  freshAnswers,
  validReflection,
  reflectionDrill,
  type GardenState,
  type GardenItem,
} from "@/lib/practice-garden";
import {
  ajitScenes,
  ajitCard,
  sceneForSession,
  conversationRoot,
  type AjitScene,
  type SceneStamp,
} from "@/lib/ajit-scenes";
import {
  readGarden,
  buyGardenItem,
  putSession,
  type VoiceSession,
} from "@/lib/voice-notebook";
import { reviewDrill, reviewKey } from "@/lib/practice-review";
import { defaultCompanions } from "@/lib/companions";
import { Companion, Icon } from "./CompanionUI";
import type { ConversationCard } from "@/lib/conversation-cards";

function useGarden() {
  const [garden, setGarden] = useState<GardenState | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      void readGarden()
        .then((g) => {
          if (alive) {
            setGarden(g);
            setError("");
          }
        })
        .catch(() => {
          if (alive)
            setError("아지트 기록을 불러오지 못했어요. 다시 방문해 주세요.");
        });
    refresh();
    window.addEventListener("practice-garden-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      alive = false;
      window.removeEventListener("practice-garden-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return { garden, error };
}
function Souvenir({ scene }: { scene: AjitScene }) {
  return (
    <span className={`ajit-object ajit-${scene.id}`} aria-hidden="true">
      <i />
      <b />
      <em />
    </span>
  );
}
function MemoryCard({
  scene,
  stamp,
  sessions,
  onClose,
  onSession,
  onPractice,
}: {
  scene: AjitScene;
  stamp?: SceneStamp;
  sessions: VoiceSession[];
  onClose: () => void;
  onSession: (id: string) => void;
  onPractice: (c: ConversationCard) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const source = sessions.find(
    (s) => s.id === stamp?.sourceSessionId && !s.isSample,
  );
  const replay = sessions.find(
    (s) => s.id === stamp?.replaySessionId && !s.isSample,
  );
  const manual =
    source && validReflection(source) ? source.gardenReflection : undefined;
  const ai =
    source?.review &&
    source.context &&
    source.review.sourceKey === reviewKey(source.context, source.turns)
      ? source.review
      : undefined;
  const guide = defaultCompanions.find((c) => c.id === scene.guide)!;
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);
  async function rehearse() {
    if (!source || busy) return;
    setBusy(true);
    try {
      const next = manual
        ? reflectionDrill(source)
        : ai
          ? reviewDrill(source, ai)
          : null;
      if (!next)
        throw new Error("현재 기록에서 복기를 다시 확인한 뒤 재연습해 주세요.");
      await putSession(next);
      onSession(next.id);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "재연습을 열지 못했어요.");
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="vn-dialog ajit-memory"
      aria-labelledby="ajit-memory-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="vn-dialog-head">
        <div>
          <p className="dc-overline">
            {stamp ? "완료한 장면 · 기록은 이 기기에" : "연습하면 남는 기념품"}
          </p>
          <h2 id="ajit-memory-title">{scene.souvenir}</h2>
        </div>
        <button
          className="vn-icon"
          aria-label="기념품 닫기"
          disabled={busy}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="ajit-memory-art">
        <Souvenir scene={scene} />
        <span>
          {scene.label}
          {stamp ? " · 스탬프 획득" : " · 아직 연습 전"}
        </span>
      </div>
      {!stamp ? (
        <>
          <div className="ajit-invitation">
            <Companion small character={guide} />
            <p>
              <strong>{guide.name}의 연습 제안</strong>
              {scene.invitation}
            </p>
          </div>
          <p>
            직접 두 번 답하기 → 한 문장 고쳐 쓰기 → 같은 장면에 다시 답하기를
            마치면 이 기념품이 생겨요.
          </p>
          <p className="learn-callout">
            말을 잘해야 받는 점수가 아니라, 연습해 본 장면의 기록이에요.
          </p>
        </>
      ) : (
        <>
          <p>이 장면을 다시 말해본 기록이 아지트에 남았어요.</p>
          {source ? (
            <>
              <p>
                <strong>내 목표</strong> · {source.context?.goal}
              </p>
              <p>
                <strong>내가 지킬 선</strong> · {source.context?.boundaries}
              </p>
              {manual || ai ? (
                <>
                  <p className="dc-overline">
                    {manual
                      ? "기록에 저장한 나의 고쳐 쓴 문장"
                      : "기록에 저장한 AI 코칭 문장"}
                  </p>
                  <blockquote>
                    {manual?.rewrite || ai?.improvement.rewrite}
                  </blockquote>
                </>
              ) : (
                <p>현재 기록에서 고쳐 쓴 문장을 다시 확인해 주세요.</p>
              )}
              <button
                className="dd-secondary"
                disabled={busy}
                onClick={() => onSession(source.id)}
              >
                복기 기록 열기
              </button>
              <button
                className="dd-primary"
                disabled={busy || (!manual && !ai)}
                onClick={() => void rehearse()}
              >
                같은 장면 다시 연습
              </button>
            </>
          ) : (
            <p role="status">
              연결된 원본 기록이 삭제되었거나 이 기기에 없어요. 완료 스탬프와
              기념품은 그대로 남아요.
            </p>
          )}
          {replay && (
            <button
              className="dd-link"
              disabled={busy}
              onClick={() => onSession(replay.id)}
            >
              완료했던 재연습 기록 보기
            </button>
          )}
        </>
      )}
      <p role="status">{notice}</p>
      <div className="ajit-next">
        <strong>{stamp ? "다음에는 이런 조건으로" : "이번 장면"}</strong>
        <p>{stamp ? scene.challenge : scene.context.goal}</p>
        <button
          className="dd-secondary"
          disabled={busy}
          onClick={() => onPractice(ajitCard(scene, !!stamp))}
        >
          {stamp ? "조건을 바꿔 새 연습" : "이 장면 연습 시작"}
        </button>
      </div>
    </dialog>
  );
}
export default function PracticeGarden({
  sessions,
  onPractice,
  onSession,
}: {
  sessions: VoiceSession[];
  onPractice: (card: ConversationCard) => void;
  onSession: (id: string) => void;
}) {
  const { garden, error } = useGarden();
  const [selected, setSelected] = useState<AjitScene | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const stamps = garden?.stamps || {};
  const eligible = sessions
    .filter(
      (s) =>
        s.kind === "practice" && !s.isSample && freshAnswers(s).length >= 2,
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const reflection = eligible.find((s) => !validReflection(s)) || eligible[0],
    retry = eligible.find(validReflection);
  async function decorate(id: GardenItem) {
    if (busy) return;
    setBusy(true);
    try {
      const next = await buyGardenItem(id);
      setNotice(
        next.equipped.includes(id)
          ? "아지트 선반에 놓았어요."
          : "소품을 보관했어요. 다시 꺼낼 수 있어요.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "소품을 저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="practice-garden ajit" aria-label="대화 아지트">
      <div className="garden-header">
        <div>
          <p className="dc-overline">다시 꺼내볼 수 있는 나의 대화</p>
          <h2>대화 아지트</h2>
        </div>
        <span className="garden-balance" aria-live="polite">
          꾸미기 티켓 {garden ? garden.earned - garden.spent : "…"}
        </span>
      </div>
      <p className="ajit-intro">
        친구와 연습한 장면이 기념품으로 남아요. 물건을 눌러 그때의 문장을 다시
        꺼내보세요.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="ajit-stamp-count">
        장면 스탬프 {Object.keys(stamps).length}/3{" "}
        <span>부탁 · 거절 · 어려운 응대</span>
      </div>
      <div className="ajit-souvenirs">
        {ajitScenes.map((scene) => {
          const stamp = stamps[scene.id];
          const continuing = sessions
            .filter(
              (s) =>
                !s.isSample &&
                s.kind === "practice" &&
                sceneForSession(s)?.id === scene.id &&
                !Object.hasOwn(
                  garden?.events || {},
                  `${conversationRoot(s)}:retry`,
                ),
            )
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
          return (
            <article
              key={scene.id}
              className={stamp ? "collected" : "uncollected"}
            >
              <button
                className="ajit-souvenir"
                aria-haspopup="dialog"
                disabled={!garden}
                onClick={() => setSelected(scene)}
                aria-label={`${scene.souvenir} · ${stamp ? "내 기록 열기" : "획득 방법 보기"}`}
              >
                <Souvenir scene={scene} />
                <strong>{scene.souvenir}</strong>
                <span>
                  {stamp
                    ? "✓ " + scene.label + " 장면 스탬프"
                    : scene.label + " 연습으로 채워요"}
                </span>
              </button>
              <button
                className="dd-link"
                onClick={() =>
                  continuing ? onSession(continuing.id) : setSelected(scene)
                }
              >
                {continuing
                  ? "이 장면 이어서 연습"
                  : stamp
                    ? "기록과 다음 연습"
                    : "친구의 연습 제안"}
              </button>
            </article>
          );
        })}
      </div>
      {garden && (
        <div className="ajit-decor" aria-label="보유 소품 선반">
          {garden.equipped.length ? (
            garden.equipped.map((id) => (
              <span key={id} className={`ajit-decor-${id}`}>
                <i aria-hidden="true">
                  {id === "clay" ? "▰" : id === "mug" ? "☕" : "✦"}
                </i>
                {gardenItems.find((item) => item.id === id)?.name}
              </span>
            ))
          ) : (
            <p>연습으로 모은 티켓으로 이 선반을 꾸밀 수 있어요.</p>
          )}
        </div>
      )}
      <details className="garden-shop">
        <summary>꾸미기 티켓 모으기 · 연습 → 복기 → 재연습</summary>
        <ol className="garden-quests">
          <li>
            <span>1</span>
            <div>
              <strong>직접 두 번 답하기</strong>
              <small>후보는 내 말로 고쳐서 보내요 · 티켓 +2</small>
            </div>
            <button
              className="dd-secondary"
              onClick={() => setSelected(ajitScenes[0])}
            >
              장면 고르기
            </button>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>한 문장 고쳐 쓰기</strong>
              <small>내가 바꿔 말할 문장을 저장해요 · +1</small>
            </div>
            <button
              className="dd-secondary"
              disabled={!reflection}
              onClick={() => reflection && onSession(reflection.id)}
            >
              복기하기
            </button>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>같은 장면에 다시 답하기</strong>
              <small>고쳐 쓴 말을 참고해 다시 연습해요 · +3</small>
            </div>
            <button
              className="dd-secondary"
              disabled={!retry}
              onClick={() => retry && onSession(retry.id)}
            >
              재연습
            </button>
          </li>
        </ol>
      </details>
      <details className="garden-shop">
        <summary>아지트 소품 고르기 · 각 티켓 2장</summary>
        <div className="garden-items">
          {gardenItems.map((item) => {
            const owned = garden?.owned.includes(item.id),
              equipped = garden?.equipped.includes(item.id);
            return (
              <button
                key={item.id}
                disabled={
                  !garden ||
                  busy ||
                  (!owned && garden.earned - garden.spent < item.cost)
                }
                onClick={() => void decorate(item.id)}
              >
                <strong>{item.name}</strong>
                <span>
                  {owned
                    ? equipped
                      ? "보관하기"
                      : "꺼내 놓기"
                    : `티켓 ${item.cost}장으로 교환`}
                </span>
              </button>
            );
          })}
        </div>
      </details>
      <p className="garden-notice" role="status">
        {notice}
      </p>
      <small className="garden-policy">
        기념품은 세 단계를 마친 장면의 기록이에요. 각 티켓 보상은 원본 대화별 한
        번이며, 샘플 보기·후보 그대로 전송은 제외돼요. 기존 물방울 잔액과 소품을
        그대로 이어받았어요. 이 브라우저에 저장되며 현금 가치는 없어요.
      </small>
      {selected && (
        <MemoryCard
          scene={selected}
          stamp={stamps[selected.id]}
          sessions={sessions}
          onClose={() => setSelected(null)}
          onSession={onSession}
          onPractice={onPractice}
        />
      )}
    </section>
  );
}

export function GardenPractice({
  session,
  disabled,
  onSave,
  onPractice,
  onRoom,
}: {
  session: VoiceSession;
  disabled: boolean;
  onSave: (s: VoiceSession) => Promise<void>;
  onPractice: (s: VoiceSession) => Promise<void>;
  onRoom?: () => void;
}) {
  const { garden, error } = useGarden();
  const answers = freshAnswers(session),
    latest = answers.at(-1);
  const [rewrite, setRewrite] = useState(
    session.gardenReflection?.rewrite || "",
  );
  const [turnId, setTurnId] = useState(
    session.gardenReflection?.turnId || latest?.id || "",
  );
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const selected = answers.find((t) => t.id === turnId) || latest;
  async function save() {
    if (!selected || busy) return;
    const next = {
      ...session,
      gardenReflection: {
        turnId: selected.id,
        original: selected.text,
        rewrite: rewrite.trim(),
      },
      updatedAt: new Date().toISOString(),
    };
    if (!validReflection(next)) {
      setNotice("원래 답변과 다르게, 4자 이상으로 고쳐 써 주세요.");
      return;
    }
    setBusy(true);
    try {
      await onSave(next);
      setNotice("고쳐 쓴 문장을 저장했어요. 같은 장면을 다시 연습해 보세요.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }
  async function retry() {
    if (busy) return;
    setBusy(true);
    try {
      await onPractice(reflectionDrill(session));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "재연습을 열지 못했어요.");
    } finally {
      setBusy(false);
    }
  }
  const root =
    session.gardenRootId || session.practicePlan?.sourceSessionId || session.id;
  const earned = garden
    ? Object.entries(garden.events)
        .filter(([id]) => id.startsWith(root + ":"))
        .reduce((sum, [, e]) => sum + e.amount, 0)
    : 0;
  return (
    <section className="garden-practice" aria-label="연습 퀘스트">
      <div className="garden-header">
        <strong>이번 장면의 연습 기록</strong>
        <span role="status">이 대화 꾸미기 티켓 +{earned}</span>
        {onRoom && (
          <button
            className="dd-link"
            onClick={onRoom}
            disabled={disabled || busy}
          >
            친구방에서 보기
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {answers.length < 2 ? (
        <p>
          {session.practicePlan
            ? "앞의 말풍선은 지난 기록이에요. 마지막 상대 말에 새 답변을 남겨보세요."
            : `직접 쓰거나 후보를 고쳐서 두 번 답해보세요. ${answers.length}/2 · 티켓 +2`}
        </p>
      ) : (
        <details>
          <summary>한 문장 고쳐 쓰기 · AI 없이도 할 수 있어요</summary>
          <label className="vn-label">
            돌아볼 내 답변
            <select
              value={selected?.id || ""}
              disabled={disabled || busy}
              onChange={(e) => {
                setTurnId(e.target.value);
                setRewrite("");
              }}
            >
              {answers.map((t, i) => (
                <option key={t.id} value={t.id}>
                  {i + 1}. {t.text.slice(0, 70)}
                </option>
              ))}
            </select>
          </label>
          <blockquote>{selected?.text}</blockquote>
          <label className="vn-label">
            다음에는 이렇게 말할래요
            <textarea
              value={rewrite}
              maxLength={800}
              rows={3}
              disabled={disabled || busy}
              onChange={(e) => setRewrite(e.target.value)}
              placeholder="AI 코칭을 참고하거나, 내 목표에 맞게 직접 고쳐 써 보세요."
            />
          </label>
          <div className="garden-actions">
            <button
              className="dd-secondary"
              disabled={disabled || busy}
              onClick={() => void save()}
            >
              고쳐 쓴 문장 저장
            </button>
          </div>
        </details>
      )}
      {validReflection(session) && (
        <button
          className="dd-primary"
          disabled={disabled || busy}
          onClick={() => void retry()}
        >
          저장한 문장으로 같은 장면 재연습
        </button>
      )}
      <p role="status">{notice}</p>
    </section>
  );
}
