"use client";
import InputDialog from "./InputDialog";
import { useAIConsent } from "./ConsentSession";
import { useEffect, useRef, useState } from "react";
import { aiFetch } from "@/lib/ai-client";
import type { CompanionCharacter } from "@/lib/companions";
import { practicalScenes, responseFriends } from "@/lib/practical-scenes";
import {
  validateObservedTurns,
  type ObservedTurn,
} from "@/lib/persona-observer";
import { AIConsent, type AIConfig } from "./VoiceComposer";
import { Companion, Icon } from "./CompanionUI";

function ObserverDialog({
  characters,
  config,
  onClose,
}: {
  characters: CompanionCharacter[];
  config: AIConfig;
  onClose: () => void;
}) {
  const options = [
    ...characters,
    ...responseFriends.filter((c) => !characters.some((o) => o.id === c.id)),
  ];
  const [sceneId, setSceneId] = useState(practicalScenes[0].id),
    [pair, setPair] = useState<[string, string]>(
      practicalScenes[0].actors.map((c) => c.id) as [string, string],
    );
  const [topic, setTopic] = useState(practicalScenes[0].context.situation),
    [turns, setTurns] = useState<ObservedTurn[]>([]),
    [shown, setShown] = useState(0),
    [playing, setPlaying] = useState(false),
    [source, setSource] = useState<"sample" | "ai">("sample"),
    [consent, setConsent] = useAIConsent(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null),
    last = useRef<HTMLLIElement>(null);
  const scene = practicalScenes.find((s) => s.id === sceneId)!;
  const selected = pair.map((id) => options.find((c) => c.id === id)!) as [
    CompanionCharacter,
    CompanionCharacter,
  ];
  useEffect(() => {
    return () => {
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!playing || shown >= turns.length) return;
    const timer = setTimeout(() => setShown((n) => n + 1), 3200);
    return () => clearTimeout(timer);
  }, [playing, shown, turns.length]);
  useEffect(() => {
    if (shown >= turns.length) setPlaying(false);
    last.current?.scrollIntoView?.({ block: "nearest" });
  }, [shown, turns.length]);
  function reset() {
    setTurns([]);
    setShown(0);
    setPlaying(false);
    setError("");
  }
  function chooseScene(id: string) {
    const s = practicalScenes.find((s) => s.id === id)!;
    setSceneId(id);
    setPair(s.actors.map((c) => c.id) as [string, string]);
    setTopic(s.context.situation);
    reset();
  }
  function sample() {
    setPair(scene.actors.map((c) => c.id) as [string, string]);
    setTopic(scene.context.situation);
    setTurns(
      scene.lines.map((text, i) => ({ speaker: (i % 2) as 0 | 1, text })),
    );
    setSource("sample");
    setShown(1);
    setPlaying(false);
    setError("");
  }
  async function generate() {
    if (abort.current) return;
    const c = new AbortController();
    abort.current = c;
    const timer = setTimeout(() => c.abort(), 25000);
    reset();
    setBusy(true);
    try {
      const r = await aiFetch("/api/observe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          characters: selected,
          consent,
          adultConsent: consent,
          sampleConsent: consent,
        }),
        signal: c.signal,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setTurns(validateObservedTurns(d.turns));
      setSource("ai");
      setShown(1);
    } catch (e) {
      setError(
        c.signal.aborted
          ? "대화 생성이 지연됐어요. 작성 샘플을 보거나 다시 시도해 주세요."
          : e instanceof Error
            ? e.message
            : "대화를 준비하지 못했어요.",
      );
    } finally {
      clearTimeout(timer);
      abort.current = null;
      setBusy(false);
    }
  }
  return (
    <InputDialog
      open
      title={"두 친구의 대화 지켜보기"}
      className="vn-dialog dc-observer-dialog"
      closeLabel="대화 관찰 닫기"
      onClose={onClose}
    >
      <p>
        역할과 주제를 고르면 여섯 차례의 대화를 보여드려요. AI는 한 번에 대본을
        만들고, 화면에서 한 차례씩 재생해요.
      </p>
      <fieldset disabled={busy} className="dc-observer-settings">
        <legend>장면과 친구</legend>
        <label className="vn-label">
          시작 장면
          <select value={sceneId} onChange={(e) => chooseScene(e.target.value)}>
            {practicalScenes.map((s) => (
              <option value={s.id} key={s.id}>
                {s.hook}
              </option>
            ))}
          </select>
        </label>
        <div className="learn-grid">
          {[0, 1].map((i) => (
            <label className="vn-label" key={i}>
              {i ? "두 번째 친구" : "첫 번째 친구"}
              <select
                value={pair[i]}
                onChange={(e) => {
                  setPair((p) =>
                    i ? [p[0], e.target.value] : [e.target.value, p[1]],
                  );
                  reset();
                }}
              >
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.specialty}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <label className="vn-label">
          대화할 주제
          <textarea
            rows={2}
            maxLength={400}
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              reset();
            }}
          />
        </label>
      </fieldset>
      <div className="dc-observer-stage" aria-label="선택한 두 친구">
        {selected.map((c, i) => (
          <div
            key={i}
            className={
              shown > 0 && turns[shown - 1]?.speaker === i ? "is-speaking" : ""
            }
          >
            <Companion
              small
              character={c}
              mood={
                busy
                  ? "think"
                  : shown > 0 && turns[shown - 1]?.speaker === i
                    ? "speak"
                    : "listen"
              }
            />
            <strong>{c.name}</strong>
            <small>{c.specialty}</small>
          </div>
        ))}
      </div>
      <AIConsent
        config={config}
        checked={consent}
        onChange={setConsent}
        disabled={busy}
      />
      <div className="dc-inline-actions">
        <button
          className="dd-primary"
          onClick={generate}
          disabled={
            busy ||
            !consent ||
            !config.available ||
            !topic.trim() ||
            pair[0] === pair[1]
          }
        >
          {busy
            ? "두 역할의 대화를 준비하고 있어요…"
            : "선택한 친구로 AI 대화 만들기"}
        </button>
        <button className="dd-secondary" disabled={busy} onClick={sample}>
          이 장면의 작성 샘플 보기
        </button>
      </div>
      <small>
        작성 샘플은 위 장면의 정해진 역할·주제로 돌아가요. 내 친구의 설정을
        사용한 AI 응답과 구분해요. 닫으면 이 관찰 대본은 사라져요.
      </small>
      {pair[0] === pair[1] && (
        <p role="status">서로 다른 두 친구를 골라 주세요.</p>
      )}
      {error && (
        <p className="dd-error" role="alert">
          {error}
        </p>
      )}
      {turns.length > 0 && (
        <section className="dc-observer-playback" aria-label="대화 관찰 재생">
          <div className="vn-toolbar">
            <strong>
              {source === "sample" ? "사전 작성 샘플" : "AI 생성 대본"} ·{" "}
              {shown} / 6
            </strong>
            <div className="dc-inline-actions">
              <button
                className="dd-secondary"
                disabled={shown === turns.length}
                onClick={() => setPlaying(!playing)}
              >
                <Icon name={playing ? "pause" : "play"} size={16} />
                {playing ? "일시정지" : "자동 넘기기"}
              </button>
              <button
                className="dd-secondary"
                disabled={shown === turns.length}
                onClick={() => {
                  setPlaying(false);
                  setShown((n) => Math.min(n + 1, turns.length));
                }}
              >
                다음 말
              </button>
              <button
                className="dd-link"
                onClick={() => {
                  setShown(1);
                  setPlaying(false);
                }}
              >
                처음부터
              </button>
            </div>
          </div>
          <ol className="dc-observer-lines" aria-live="polite">
            {turns.slice(0, shown).map((t, i) => (
              <li
                key={i}
                ref={i === shown - 1 ? last : undefined}
                className={t.speaker === 1 ? "second" : ""}
              >
                <strong>{selected[t.speaker].name}</strong>
                <p>{t.text}</p>
              </li>
            ))}
          </ol>
          {shown === 6 && (
            <p role="status">
              대화를 다 봤어요. 도움이 된 표현과 실제로 말하기 어려울 표현을
              하나씩 골라 보세요.
            </p>
          )}
          {source === "sample" && <p className="learn-callout">{scene.tip}</p>}
        </section>
      )}
    </InputDialog>
  );
}
export default function PersonaObserver(props: {
  characters: CompanionCharacter[];
  config: AIConfig;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="dc-observer-invite"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Icon name="play" />
        <span>
          <strong>친구들 대화 지켜보기</strong>
          <small>두 역할이 같은 장면에서 어떻게 말할까요?</small>
        </span>
        <Icon name="arrow" />
      </button>
      {open && <ObserverDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}
