"use client";
import { useEffect, useState } from "react";
import {
  gardenItems,
  gardenStage,
  freshAnswers,
  validReflection,
  reflectionDrill,
  type GardenState,
  type GardenItem,
} from "@/lib/practice-garden";
import {
  readGarden,
  buyGardenItem,
  type VoiceSession,
} from "@/lib/voice-notebook";
import { requestCards } from "@/lib/starter-data";
import type { ConversationCard } from "@/lib/conversation-cards";

function useGarden() {
  const [garden, setGarden] = useState<GardenState | null>(null);
  const [error, setError] = useState("");
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
            setError("새싹 기록을 불러오지 못했어요. 다시 방문해 주세요.");
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
function Plant({ garden }: { garden: GardenState }) {
  const stage = gardenStage(garden.earned);
  return (
    <div
      className="garden-shelf"
      role="img"
      aria-label={`${stage}, ${garden.equipped.map((id) => gardenItems.find((i) => i.id === id)?.name).join(" · ") || "기본 화분"}`}
    >
      {garden.equipped.includes("star") && (
        <span className="garden-star" aria-hidden="true">
          ✦
        </span>
      )}
      <div
        className={`garden-plant ${garden.earned >= 6 ? "sprouted" : ""} ${garden.earned >= 12 ? "grown" : ""}`}
        aria-hidden="true"
      >
        <span className="garden-stem">
          <i />
          <i />
          {garden.earned >= 24 && <b>✿</b>}
        </span>
        <span
          className={`garden-pot ${garden.equipped.includes("clay") ? "clay" : ""}`}
        />
      </div>
      {garden.equipped.includes("mug") && (
        <span className="garden-mug" aria-hidden="true" />
      )}
    </div>
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
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const eligible = sessions
    .filter(
      (s) =>
        s.kind === "practice" && !s.isSample && freshAnswers(s).length >= 2,
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const reflection = eligible.find((s) => !validReflection(s)) || eligible[0];
  const retry = eligible.find(validReflection);
  async function decorate(id: GardenItem) {
    if (busy) return;
    setBusy(true);
    try {
      const next = await buyGardenItem(id);
      setNotice(
        next.equipped.includes(id)
          ? "친구방 선반에 놓았어요."
          : "소품을 보관했어요. 다시 꺼낼 수 있어요.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "소품을 저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }
  const completed = (quest: string) =>
    garden && Object.values(garden.events).some((e) => e.quest === quest);
  return (
    <section className="practice-garden" aria-label="내 새싹과 연습 퀘스트">
      <div className="garden-header">
        <div>
          <p className="dc-overline">연습이 쌓이는 내 선반</p>
          <h2>내 새싹</h2>
        </div>
        <span className="garden-balance" aria-live="polite">
          물방울 {garden ? garden.earned - garden.spent : "…"}
        </span>
      </div>
      {error && <p role="alert">{error}</p>}
      {garden && (
        <div className="garden-growth">
          <Plant garden={garden} />
          <div>
            <strong>{gardenStage(garden.earned)}</strong>
            <p>
              {garden.earned < 6
                ? "첫 연습과 고쳐 말하기를 마치면 싹이 나요."
                : "조금씩 다시 말해본 시간이 쌓이고 있어요."}
            </p>
            <progress
              aria-label="새싹 성장"
              value={Math.min(garden.earned, 24)}
              max={24}
            />
            <small>
              누적 물방울 {garden.earned} · 6에 새싹 / 12에 성장 / 24에 꽃
            </small>
          </div>
        </div>
      )}
      <ol className="garden-quests">
        <li>
          <span>{completed("speak") ? "✓" : "1"}</span>
          <div>
            <strong>내 말로 두 번 답하기</strong>
            <small>대화 연습에서 직접 답하기 · 물방울 +2</small>
          </div>
          <button
            className="dd-secondary"
            onClick={() => onPractice(requestCards[0])}
          >
            부탁 연습
          </button>
        </li>
        <li>
          <span>{completed("reflect") ? "✓" : "2"}</span>
          <div>
            <strong>한 문장 고쳐 쓰기</strong>
            <small>
              {reflection
                ? "연습 기록 아래에서 직접 복기 · +1"
                : "두 번 답한 뒤 열려요 · +1"}
            </small>
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
          <span>{completed("retry") ? "✓" : "3"}</span>
          <div>
            <strong>같은 장면에 다시 답하기</strong>
            <small>
              {retry
                ? "저장한 문장으로 재연습 시작 · +3"
                : "고쳐 쓴 문장을 저장하면 열려요 · +3"}
            </small>
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
      <details className="garden-shop">
        <summary>친구방 선반 꾸미기 · 소품 3개</summary>
        <div className="garden-items">
          {gardenItems.map((item) => {
            const owned = garden?.owned.includes(item.id);
            const equipped = garden?.equipped.includes(item.id);
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
                    : `물방울 ${item.cost}로 교환`}
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
        샘플 보기·답변 후보 그대로 보내기에는 보상이 없어요. 한 대화에서 각
        보상은 한 번만 받아요. 쉬어도 시들지 않고, 꾸며도 성장 기록은 유지돼요.
        이 브라우저에 저장되며 현금 가치는 없어요.
      </small>
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
        <strong>내 새싹 키우기</strong>
        <span role="status">이 대화 물방울 +{earned}</span>
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
            : `직접 쓰거나 후보를 고쳐서 두 번 답해보세요. ${answers.length}/2 · 물방울 +2`}
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
