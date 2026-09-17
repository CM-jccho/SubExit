"use client";
import CompactField, { fieldExamples } from "./CompactField";
import { useAIConsent, ConsentSettings } from "./ConsentSession";
import HomeActions from "./HomeActions";
import { supportTools, supportLabel } from "@/lib/support-tools";
import MessengerPractice from "./MessengerPractice";
import { canLeaveWorkspace } from "@/lib/navigation-guard";
import ConversationFocusPicker from "./ConversationFocusPicker";
import FocusScene from "./FocusScene";
import {
  FOCUS_KEY,
  parseFocus,
  curatedCards,
  focusInfo,
  focusOptions,
  type ConversationFocus,
} from "@/lib/conversation-focus";
import PracticeNavigation from "./PracticeNavigation";
import ConversationTraining from "./ConversationTraining";
import DailyTalk from "./DailyTalk";
import PromptPractice from "./PromptPractice";
import { AIConsent } from "./VoiceComposer";
import { aiFetch } from "@/lib/ai-client";
import QuotaHelp from "./QuotaHelp";
import { useEffect, useRef, useState } from "react";
import {
  workspacePurpose,
  type WorkspacePurpose,
  workspaceSection,
  workspaceView,
  workspaceUrl,
  type WorkspaceView as View,
} from "@/lib/workspace-navigation";
import LiveCoach from "./LiveCoach";
import VoiceWorkspace from "./VoiceWorkspace";
import VoiceComposer from "./VoiceComposer";
import TermNotebook from "./TermNotebook";
import { Companion, HelpTip, Icon } from "./CompanionUI";
import FirstConversation, { TOUR_KEY } from "./FirstConversation";
import CompanionPicker from "./CompanionPicker";
import CompanionRoom from "./CompanionRoom";
import { CompanionProvider } from "./CompanionTheme";
import {
  resolveCompanion,
  readSavedCompanions,
  COMPANIONS_KEY,
  type CompanionChoice,
  type CompanionCharacter,
} from "@/lib/companions";
import StorageStatus from "./StorageStatus";
import {
  seedStarterData,
  starterCards,
  requestCards,
} from "@/lib/starter-data";
import { practicalCards } from "@/lib/practical-scenes";
import { downloadBlob } from "@/lib/voice-notebook";
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
        <CompactField
          key={k}
          label={
            labels[k] +
            (["title", "partner", "situation", "goal"].includes(k)
              ? " · 필수"
              : "")
          }
          value={profile[k]}
          maxLength={maxima[k]}
          examples={fieldExamples[k]}
          onChange={(value) => onChange({ ...profile, [k]: value })}
        />
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
function ContextFacts({
  profile,
  compact = false,
}: {
  profile: ContextProfile;
  compact?: boolean;
}) {
  return (
    <>
      <dl className="dc-facts">
        <div>
          <dt>상대</dt>
          <dd>{profile.partner || "아직 정리 전이에요"}</dd>
        </div>
        {!compact && (
          <div>
            <dt>내 역할</dt>
            <dd>{profile.myRole || "필요하면 추가해요"}</dd>
          </div>
        )}
        {!compact && (
          <div>
            <dt>상황</dt>
            <dd>{profile.situation || "어떤 대화인지 알려주세요"}</dd>
          </div>
        )}
        <div className="dc-goal" data-tour="conversation-goal">
          <dt>원하는 결과</dt>
          <dd>{profile.goal || "이번 대화의 목표를 정해요"}</dd>
        </div>
        <div>
          <dt>지킬 선</dt>
          <dd>{profile.boundaries || "필요하면 추가해요"}</dd>
        </div>
        {!compact && (
          <div>
            <dt>말투</dt>
            <dd>{tones.find((t) => t.id === profile.tone)?.label}</dd>
          </div>
        )}
      </dl>
      {compact && (
        <details className="dc-detail-extra">
          <summary>자세한 상황·말투</summary>
          <dl className="dc-facts">
            <div>
              <dt>내 역할</dt>
              <dd>{profile.myRole || "대화 참여자"}</dd>
            </div>
            <div>
              <dt>상황</dt>
              <dd>{profile.situation}</dd>
            </div>
            <div>
              <dt>말투</dt>
              <dd>{tones.find((t) => t.id === profile.tone)?.label}</dd>
            </div>
          </dl>
        </details>
      )}
    </>
  );
}
export default function ConversationWorkspace() {
  const [focus, setFocus] = useState<ConversationFocus | null>(null);
  const [purpose, setPurpose] = useState<WorkspacePurpose>("practice");
  const [focusEditing, setFocusEditing] = useState(false);
  const [browseAll, setBrowseAll] = useState(false);
  const [view, setViewState] = useState<View>("home"),
    [cards, setCards] = useState<ConversationCard[]>([]),
    [search, setSearch] = useState(""),
    [active, setActive] = useState<ConversationCard | null>(null);
  const effectiveFocus = view === "library" && browseAll ? "all" : focus;
  const [profile, setProfile] = useState<ContextProfile>(emptyProfile()),
    [messages, setMessages] = useState<SetupMessage[]>([]),
    [input, setInput] = useState(""),
    [editingId, setEditingId] = useState<string | undefined>(),
    [review, setReview] = useState(false),
    [source, setSource] = useState<ConversationCard["source"]>("guided");
  const [config, setConfig] = useState({
      available: false,
      voiceAvailable: false,
      sampleOnly: true,
    }),
    [ai, setAi] = useState(false),
    [consent, setConsent] = useAIConsent(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const [companions, setCompanions] = useState<CompanionCharacter[]>([]);
  const [companionChoice, setCompanionChoice] =
    useState<CompanionChoice>("auto");
  const [chatCharacter, setChatCharacter] = useState<CompanionCharacter>();
  const [recordId, setRecordId] = useState<string>();
  const [choices, setChoices] = useState<string[]>([]);
  const [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState("");
  const [tourStep, setTourStep] = useState(0);
  const [tour, setTour] = useState(false),
    [editFields, setEditFields] = useState(false);
  const controller = useRef<AbortController | null>(null),
    generation = useRef(0);
  const lastWorkspaceUrl = useRef("");
  useEffect(() => {
    let mounted = true;
    try {
      setFocus(parseFocus(localStorage.getItem(FOCUS_KEY)));
      setCompanions(readSavedCompanions());
    } catch (e) {
      setStorageError(
        e instanceof Error ? e.message : "친구를 불러오지 못했어요.",
      );
    }
    seedStarterData()
      .catch((e) => {
        if (mounted)
          setStorageError(
            e instanceof Error
              ? e.message
              : "저장소를 확인하지 못했어요. 브라우저 저장 권한을 확인해 주세요.",
          );
      })
      .finally(() => {
        if (!mounted) return;
        setCards(readCards());
        setReady(true);
        try {
          if (
            focusInfo(parseFocus(localStorage.getItem(FOCUS_KEY)))?.cardIds
              .length &&
            !localStorage.getItem(TOUR_KEY) &&
            workspaceView(window.location.search) === "library" &&
            workspacePurpose(window.location.search) === "practice"
          ) {
            setView("library");
            setTourStep(0);
            setTour(true);
          }
        } catch {}
      });
    const abort = new AbortController();
    fetch("/api/coach", { signal: abort.signal })
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});
    const sync = (event: StorageEvent) => {
      if (event.key === FOCUS_KEY || event.key === null)
        setFocus(parseFocus(localStorage.getItem(FOCUS_KEY)));
      setCards(readCards());
      if (event.key === COMPANIONS_KEY || event.key === null) {
        try {
          setCompanions(readSavedCompanions());
        } catch {}
      }
    };
    window.addEventListener("storage", sync);
    return () => {
      mounted = false;
      abort.abort();
      controller.current?.abort();
      generation.current++;
      window.removeEventListener("storage", sync);
    };
  }, []);
  function setView(next: View, intent: WorkspacePurpose = purpose) {
    setFocusEditing(false);
    const url = workspaceUrl(window.location.href, next, intent);
    setPurpose(intent);
    if (
      url !==
      window.location.pathname + window.location.search + window.location.hash
    )
      window.history.pushState(null, "", url);
    setViewState(next);
    lastWorkspaceUrl.current = url;
    window.scrollTo({ top: 0 });
  }
  useEffect(() => {
    const restore = () => {
      if (!canLeaveWorkspace()) {
        window.history.pushState(null, "", lastWorkspaceUrl.current);
        return;
      }
      lastWorkspaceUrl.current =
        window.location.pathname +
        window.location.search +
        window.location.hash;
      setFocusEditing(false);
      cancelRequest();
      setRecordId(undefined);
      setToast("");
      setError("");
      setTour(false);
      setPurpose(workspacePurpose(window.location.search));
      setViewState(workspaceView(window.location.search));
      window.scrollTo({ top: 0 });
    };
    lastWorkspaceUrl.current =
      window.location.pathname + window.location.search + window.location.hash;
    setPurpose(workspacePurpose(window.location.search));
    setViewState(workspaceView(window.location.search));
    const query = new URLSearchParams(window.location.search);
    if (query.get("tour") === "1") {
      setTourStep(0);
      setTour(true);
    }
    if (query.get("live") === "1")
      setToast("코칭에 사용할 카드를 선택하거나 새로 만들어 주세요.");
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    if (review && view === "setup") window.scrollTo({ top: 0 });
  }, [review, view]);
  function cancelRequest() {
    generation.current++;
    controller.current?.abort();
    setBusy(false);
  }
  function home() {
    if (!canLeaveWorkspace()) return;
    cancelRequest();
    setError("");
    setView("home");
    setCards(readCards());
  }
  function start(existing?: ConversationCard) {
    cancelRequest();
    setChoices([]);
    setEditingId(existing?.id);
    setCompanionChoice(existing?.companion || "auto");
    setProfile(existing || emptyProfile());
    setMessages(
      existing ? [] : [{ role: "assistant", text: guidedReply([]).question }],
    );
    setInput("");
    setReview(!!existing);
    setEditFields(!!existing);
    setSource(existing?.source || "guided");
    setAi(config.available);
    setError("");
    setToast("");
    setView("setup");
    window.scrollTo({ top: 0 });
  }
  async function send() {
    if (!input.trim() || busy || (ai && config.available && !consent)) return;
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
    if (ai && !config.available) {
      setProfile((p) => ({
        ...p,
        situation: [p.situation, input.trim()]
          .filter(Boolean)
          .join("\n")
          .slice(0, 800),
      }));
      setSource("manual");
      setReview(true);
      setEditFields(true);
      setToast(
        "AI 연결 전이라 이야기를 상황란에 옮겼어요. 상대와 목표를 직접 확인해 주세요.",
      );
      return;
    }
    if (!ai) {
      const d = guidedReply(next);
      setProfile(d.profile);
      setChoices([]);
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
      const r = await aiFetch("/api/context", {
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
      setChoices(Array.isArray(d.choices) ? d.choices : []);
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
        setInput(input);
        setMessages(messages);
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
      const next = saveCard(profile, source, editingId, companionChoice);
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
    setView("live", "live");
    window.scrollTo({ top: 0 });
  }
  function duplicate(c: ConversationCard) {
    start();
    setProfile({ ...c, title: (c.title + " · 복사").slice(0, 60) });
    setCompanionChoice(c.companion || "auto");
    setSource("manual");
    setEditFields(true);
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
    downloadBlob(blob, "ddeundeun-my-conversations.json");
  }
  function beginTour() {
    if (!canLeaveWorkspace()) return;
    setFocusEditing(false);
    cancelRequest();
    setView("library", "practice");
    setTourStep(0);
    setTour(true);
    setError("");
  }
  function changeTourStep(next: number) {
    setTourStep(next);
    if (next === 0) setView("library");
    else {
      setActive(
        (c) =>
          c ||
          curatedCards(cards, effectiveFocus).find((c) => c.isSample) ||
          tourCard,
      );
      setView(next === 3 ? "voicePractice" : "detail");
    }
  }
  const personalCards = cards.filter((c) => !c.isSample);
  const tourCard =
    curatedCards(
      [...starterCards, ...requestCards, ...practicalCards],
      effectiveFocus,
    )[0] || starterCards[0];
  const focusedCards = curatedCards(cards, effectiveFocus);
  const sampleCards = focusedCards.filter((c) => c.isSample);
  const allSampleCount = cards.filter((c) => c.isSample).length;
  const selectedSampleCount = curatedCards(cards, focus).filter(
    (c) => c.isSample,
  ).length;

  const visible = searchCards(focusedCards, search);
  const visiblePersonal = visible.filter((c) => !c.isSample);
  const visibleSamples = visible.filter((c) => c.isSample);
  const sampleGroups = focusOptions
    .filter((option) => option.id !== "custom")
    .map((option) => ({
      ...option,
      cards: visibleSamples.filter((c) =>
        (option.cardIds as readonly string[]).includes(c.id),
      ),
    }));
  const otherSamples = visibleSamples.filter(
    (c) =>
      !sampleGroups.some((group) =>
        group.cards.some((item) => item.id === c.id),
      ),
  );
  function chooseFocus(next: ConversationFocus) {
    setFocusEditing(false);
    setFocus(next);
    setBrowseAll(false);
    setSearch("");
    try {
      localStorage.setItem(
        FOCUS_KEY,
        JSON.stringify({ version: 1, focus: next }),
      );
      if (
        view === "library" &&
        purpose === "practice" &&
        next !== "all" &&
        next !== "custom" &&
        !localStorage.getItem(TOUR_KEY)
      ) {
        setTourStep(0);
        setTour(true);
      }
    } catch {
      setToast(
        "선택은 이번 화면에 적용했어요. 브라우저 저장이 제한되어 재방문하면 다시 선택해야 해요.",
      );
    }
  }
  const canSave = (() => {
    try {
      parseProfile(profile);
      return true;
    } catch {
      return false;
    }
  })();
  const currentQuestion =
    messages.filter((m) => m.role === "assistant").at(-1)?.text ||
    "어떤 대화를 준비하고 싶으세요?";
  const step = Math.min(messages.filter((m) => m.role === "user").length, 3);
  const suggestedChoices = choices.length
    ? choices
    : [
        [
          "팀장님과 업무 일정을 조율하고 싶어요.",
          "거래처의 무리한 요청에 답하고 싶어요.",
          "친구와 약속을 정하고 싶어요.",
        ],
        profile.situation.includes("친구")
          ? ["가까운 친구", "처음 만나는 지인", "함께하는 모임 사람"]
          : ["업무를 요청한 팀장", "함께 일하는 동료", "거래처 담당자"],
        [
          "서로 가능한 일정을 합의하기",
          "요청을 정중하게 거절하기",
          "상대의 생각을 먼저 확인하기",
        ],
        [
          "지킬 수 없는 약속은 하지 않기",
          "관계를 해치지 않고 분명히 말하기",
          "특별히 없어요",
        ],
      ][step];
  function navigate(next: View, intent: WorkspacePurpose = purpose) {
    if (!canLeaveWorkspace()) return;
    setFocusEditing(false);
    cancelRequest();
    setToast("");
    setError("");
    setView(next, intent);
    setRecordId(undefined);
    setCards(readCards());
    window.scrollTo({ top: 0 });
  }
  function openCard(c: ConversationCard) {
    setActive(c);
    setToast("");
    setView("detail");
    window.scrollTo({ top: 0 });
  }
  const cardList = (items: ConversationCard[], spotlight = false) => (
    <div className="dc-card-grid">
      {items.map((c, i) => (
        <button
          className="dc-saved-card"
          key={c.id}
          data-tour={spotlight && i === 0 ? "starter-card" : undefined}
          onClick={() => openCard(c)}
        >
          {spotlight ? (
            <FocusScene
              focus={
                focusOptions.find((option) =>
                  (option.cardIds as readonly string[]).includes(c.id),
                )?.id || "custom"
              }
              compact
            />
          ) : (
            <span className={"dc-card-avatar color-" + (i % 3)}>
              <Companion
                small
                character={resolveCompanion(c.companion, c, companions)}
              />
            </span>
          )}
          <span className="dc-card-body">
            <span className="dc-partner">
              {c.isSample && <span className="dc-sample-badge">샘플</span>}
              {spotlight
                ? focusOptions.find((option) =>
                    (option.cardIds as readonly string[]).includes(c.id),
                  )?.label || "내 상황"
                : c.partner}
            </span>
            <strong>{c.title}</strong>
            <span className="dc-card-goal">{c.goal}</span>
            <small>
              {spotlight
                ? "상황 확인하고 연습 →"
                : c.lastUsedAt
                  ? "최근 사용 " +
                    new Date(c.lastUsedAt).toLocaleDateString("ko-KR")
                  : "준비 완료 · 언제든 다시 꺼내세요"}
            </small>
          </span>
          <Icon name="arrow" size={20} />
        </button>
      ))}
    </div>
  );
  const choosingFocus = !tour && view === "library" && (!focus || focusEditing);
  const currentCharacter =
    view === "setup"
      ? resolveCompanion(companionChoice, profile, companions)
      : ["detail", "live", "voicePractice"].includes(view) && active
        ? resolveCompanion(active.companion, active, companions)
        : ["friendChat", "daily"].includes(view) && chatCharacter
          ? chatCharacter
          : resolveCompanion("dundi", undefined, companions);
  if (!ready)
    return (
      <div className="dd-root dc-root">
        <div className="dc-shell">
          <p className="dc-loading" role="status">
            저장한 대화와 첫 사용 샘플을 불러오고 있어요.
          </p>
        </div>
      </div>
    );
  return (
    <CompanionProvider value={currentCharacter}>
      <div className="dd-root dc-root">
        <div className="dc-shell">
          <header className="dc-header">
            <button
              className="dc-brand"
              onClick={home}
              aria-label="스픽코칭 홈"
            >
              <span className="dc-brand-mark">
                <Icon name="chat" size={22} />
              </span>
              스픽코칭<span className="dc-beta">BETA</span>
            </button>
            <nav className="dc-nav" aria-label="주 메뉴">
              {(
                [
                  { id: "home", text: "홈", icon: "home" },
                  { id: "records", text: "내 기록", icon: "book" },
                  { id: "more", text: "더보기", icon: "book" },
                ] as const
              ).map((n) => (
                <button
                  key={n.id}
                  aria-current={
                    workspaceSection(view) === n.id ? "page" : undefined
                  }
                  className={workspaceSection(view) === n.id ? "active" : ""}
                  onClick={() => navigate(n.id)}
                >
                  <Icon name={n.icon} size={21} />
                  <span>{n.text}</span>
                </button>
              ))}
            </nav>
            <button
              className="dc-help-button dc-icon-button"
              aria-label="첫 사용 가이드 다시 보기"
              onClick={beginTour}
            >
              <Icon name="help" />
            </button>
          </header>
          <ConsentSettings />
          <main id="main-content" key={view}>
            {storageError && (
              <p className="dd-error" role="alert">
                {storageError}
              </p>
            )}
            {toast && (
              <p className="dc-toast" role="status">
                <Icon name="check" size={18} />
                {toast}
              </p>
            )}
            <PracticeNavigation
              view={view}
              purpose={purpose}
              onNavigate={navigate}
            />
            {view === "library" && !tour && (
              <details className="purpose-alternatives">
                <summary>다른 연습 방법</summary>
                <div className="purpose-support" aria-label="대화 연습 도구">
                  <button
                    className="dd-link"
                    onClick={() => navigate("recording")}
                  >
                    <Icon name="mic" size={18} />내 녹음으로 복기
                  </button>
                  <button className="dd-link" onClick={() => navigate("room")}>
                    <Icon name="chat" size={18} />
                    연습 상대 선택
                  </button>
                </div>
              </details>
            )}
            {view === "library" && !tour && (
              <ConversationFocusPicker
                purpose={purpose}
                value={focus}
                editing={focusEditing}
                onEditingChange={setFocusEditing}
                onCreate={() => {
                  chooseFocus("custom");
                  start();
                }}
                onChange={chooseFocus}
              />
            )}
            <div
              className="focus-workspace-content"
              hidden={choosingFocus}
              style={{ display: choosingFocus ? "none" : "contents" }}
            >
              {view === "messenger" && (
                <MessengerPractice
                  config={config}
                  onRecords={() => navigate("records")}
                />
              )}
              {view === "training" && (
                <ConversationTraining
                  config={config}
                  onRecords={() => navigate("records")}
                  onSession={(s) => {
                    navigate("records");
                    setRecordId(s.id);
                  }}
                />
              )}
              {view === "prompts" && (
                <PromptPractice
                  config={config}
                  onRecords={() => navigate("records")}
                />
              )}
              {view === "home" && (
                <HomeActions
                  onLive={() => navigate("library", "live")}
                  onNavigate={(next) => navigate(next, "practice")}
                  onResume={(id) => {
                    navigate("records");
                    setRecordId(id);
                  }}
                />
              )}
              {view === "library" && tour && (
                <>
                  <section className="focus-home-heading">
                    <div>
                      <p className="dc-overline">
                        연습 → 내 말로 복기 → 같은 장면 다시 연습
                      </p>
                      <h1>
                        {focusInfo(focus)?.label
                          ? `${focusInfo(focus)!.label} 대화 연습`
                          : "대화 연습"}
                      </h1>
                    </div>
                  </section>
                  {(sampleCards.length > 0 || tour) && (
                    <section
                      className="dc-starter-section focus-practice-first"
                      aria-label="추천 연습 장면"
                    >
                      {cardList(
                        sampleCards.length
                          ? tour
                            ? sampleCards.slice(0, 1)
                            : [...sampleCards]
                                .sort(
                                  (a, b) =>
                                    Number(b.id.includes("request")) -
                                    Number(a.id.includes("request")),
                                )
                                .slice(0, 1)
                          : [tourCard],
                        true,
                      )}
                    </section>
                  )}
                  {!sampleCards.length && !tour && (
                    <p className="focus-empty">
                      연습할 대화를 직접 만들어 보세요.
                    </p>
                  )}
                  <div className="focus-home-controls">
                    <button
                      className={
                        sampleCards.length ? "dd-secondary" : "dd-primary"
                      }
                      onClick={() => start()}
                    >
                      <Icon name="plus" size={18} /> 내 상황 만들기
                    </button>
                    <button
                      className="dd-link"
                      onClick={() => {
                        setBrowseAll(true);
                        setSearch("");
                        navigate("library");
                      }}
                    >
                      모든 연습 상황 보기 ({allSampleCount}){" "}
                      <Icon name="arrow" size={16} />
                    </button>
                  </div>
                  {personalCards.length > 0 && (
                    <section className="dc-recent">
                      <div className="dc-section-heading">
                        <h2>내가 준비한 대화</h2>
                        <button
                          className="dd-link"
                          onClick={() => navigate("library")}
                        >
                          내 대화 모두 보기 <Icon name="arrow" size={16} />
                        </button>
                      </div>
                      {cardList(searchCards(personalCards, "").slice(0, 1))}
                    </section>
                  )}
                </>
              )}
              {view === "more" && (
                <section className="focus-more">
                  <div className="dc-title">
                    <h1>더보기</h1>
                    <p>대화를 준비할 때 쓰는 보조 도구예요.</p>
                    <button
                      type="button"
                      className="dd-secondary"
                      onClick={() =>
                        window.dispatchEvent(new Event("gyeotmal-show-intro"))
                      }
                    >
                      스픽코칭 소개 다시 보기
                    </button>
                  </div>
                  <div className="focus-tool-grid">
                    {supportTools.map((item) => (
                      <button
                        key={item.id}
                        aria-label={item.label}
                        onClick={() => {
                          navigate(item.id);
                        }}
                      >
                        <Icon name={item.icon} size={22} />
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </span>
                        <Icon name="arrow" size={16} />
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {view === "daily" && (
                <DailyTalk
                  config={config}
                  character={chatCharacter}
                  onRecords={() => navigate("records")}
                />
              )}
              {view === "room" && (
                <CompanionRoom
                  key={effectiveFocus || "unset"}
                  focus={effectiveFocus}
                  config={config}
                  onPractice={(card) => {
                    setActive(card);
                    setRecordId(undefined);
                    setChatCharacter(undefined);
                    setView("voicePractice", "practice");
                    window.scrollTo({ top: 0 });
                  }}
                  saved={companions}
                  onSaved={setCompanions}
                  onCards={() => navigate("library", "practice")}
                  onChat={(c) => {
                    setChatCharacter(c);
                    setView("friendChat");
                    window.scrollTo({ top: 0 });
                  }}
                  onSession={(id) => {
                    setRecordId(id);
                    setView("records");
                    window.scrollTo({ top: 0 });
                  }}
                />
              )}
              {(view === "records" ||
                view === "recording" ||
                view === "voicePractice" ||
                view === "friendChat") && (
                <VoiceWorkspace
                  onRecords={() => navigate("records")}
                  onRoom={() => navigate("room")}
                  key={
                    view +
                    (view === "voicePractice"
                      ? active?.id
                      : view === "friendChat"
                        ? chatCharacter?.id
                        : recordId || "")
                  }
                  mode={
                    view === "recording"
                      ? "recording"
                      : view === "friendChat"
                        ? "chat"
                        : view === "voicePractice"
                          ? "practice"
                          : "records"
                  }
                  initialCompanion={chatCharacter}
                  initialSessionId={recordId}
                  initialCard={
                    view === "voicePractice" && active ? active : undefined
                  }
                  config={config}
                  onChooseCard={() => {
                    navigate("library", "practice");
                  }}
                />
              )}
              {view === "terms" && (
                <TermNotebook
                  focus={effectiveFocus}
                  config={config}
                  onAsk={(c) => {
                    setChatCharacter(c);
                    setView("friendChat");
                    window.scrollTo({ top: 0 });
                  }}
                />
              )}
              {view === "library" && !tour && (
                <>
                  <section className="dc-page-top">
                    <div>
                      <p className="dc-overline">
                        {purpose === "live"
                          ? "지금 대화에 사용할 상황"
                          : "상황을 고르고 대화 연습"}
                      </p>
                      <h1>
                        {purpose === "live"
                          ? "대화 상황 선택"
                          : effectiveFocus === "all"
                            ? "모든 연습 상황"
                            : "대화 연습"}{" "}
                        <span className="dc-count">{focusedCards.length}</span>
                      </h1>
                    </div>
                    <button className="dd-primary" onClick={() => start()}>
                      <Icon name="plus" size={18} />내 상황 만들기
                    </button>
                  </section>
                  <p className="dc-room-intro">
                    {effectiveFocus === "all"
                      ? "업무·고객 응대·학부모 상담·일상 예시를 분야별로 모았어요."
                      : "관심 상황의 예시부터 연습하거나, 내 상황을 직접 만들어 보세요."}
                  </p>
                  {focus && focus !== "all" && (
                    <div
                      className="focus-list-filters"
                      role="group"
                      aria-label="연습 예시 범위"
                    >
                      <button
                        aria-pressed={!browseAll}
                        onClick={() => {
                          setBrowseAll(false);
                          setSearch("");
                        }}
                      >
                        {focusInfo(focus)?.label} 예시{" "}
                        <span>{selectedSampleCount}</span>
                      </button>
                      <button
                        aria-pressed={browseAll}
                        onClick={() => {
                          setBrowseAll(true);
                          setSearch("");
                        }}
                      >
                        모든 분야 예시 <span>{allSampleCount}</span>
                      </button>
                    </div>
                  )}
                  <p className="focus-results-status" role="status">
                    {search
                      ? `검색 결과 ${visible.length}개`
                      : `${effectiveFocus === "all" ? "모든 분야" : focusInfo(focus)?.label || "선택한 상황"} 예시 ${sampleCards.length}개 · 내가 만든 대화 ${personalCards.length}개`}
                    {browseAll && focus !== "all" && (
                      <span>
                        내 관심 상황은 {focusInfo(focus)?.label}으로 유지돼요.
                      </span>
                    )}
                  </p>
                  <label className="dc-search" htmlFor="card-search">
                    <Icon name="search" size={20} />
                    <input
                      id="card-search"
                      aria-label="대화 검색"
                      type="search"
                      placeholder="상대, 상황, 목표로 찾기"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  {cards.length ? (
                    <>
                      {visiblePersonal.length > 0 && (
                        <section
                          className="focus-card-group"
                          aria-label="내가 만든 대화"
                        >
                          <h2>
                            내가 만든 대화 <span>{visiblePersonal.length}</span>
                          </h2>
                          {cardList(visiblePersonal)}
                        </section>
                      )}
                      {sampleGroups
                        .filter((group) => group.cards.length > 0)
                        .map((group) => (
                          <section
                            key={group.id}
                            className="focus-card-group"
                            data-category={group.id}
                            aria-label={`${group.label} 연습 예시`}
                          >
                            <h2>
                              <Icon
                                name={
                                  group.id === "work"
                                    ? "cards"
                                    : group.id === "education"
                                      ? "book"
                                      : "chat"
                                }
                                size={20}
                              />
                              {group.label} <span>{group.cards.length}</span>
                            </h2>
                            {cardList(group.cards)}
                          </section>
                        ))}
                      {otherSamples.length > 0 && (
                        <section
                          className="focus-card-group"
                          aria-label="기타 연습 예시"
                        >
                          <h2>
                            기타 연습 예시 <span>{otherSamples.length}</span>
                          </h2>
                          {cardList(otherSamples)}
                        </section>
                      )}
                      {!visible.length && (
                        <div className="dc-empty-state">
                          <Icon name="search" size={32} />
                          <h2>
                            {search
                              ? "찾는 대화가 없어요"
                              : "선택한 맥락에 저장된 카드가 없어요"}
                          </h2>
                          <p>
                            {search
                              ? "다른 단어로 검색하거나 전체 둘러보기를 선택해 보세요."
                              : "새 대화를 만들거나 위에서 다른 맥락을 선택해 주세요."}
                          </p>
                        </div>
                      )}
                      <div className="dc-library-tools">
                        <span>
                          <Icon name="shield" size={16} /> 이 기기에 저장됨
                          <HelpTip label="내 대화 저장 안내">
                            확인한 카드를 이 브라우저에 저장해요. 브라우저
                            데이터를 지우면 사라질 수 있으니, 필요하면 데이터를
                            내려받아 보관하세요. 다른 기기와 자동 동기화되지
                            않아요.
                          </HelpTip>
                        </span>
                        <button className="dd-link" onClick={exportData}>
                          <Icon name="download" size={17} />
                          카드 내려받기
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="dc-empty-state">
                      <Companion mood="listen" />
                      <h2>첫 대화를 준비해 볼까요?</h2>
                      <p>정해진 유형 없이, 내 이야기를 적어주세요.</p>
                      <button className="dd-secondary" onClick={() => start()}>
                        첫 카드 만들기
                        <Icon name="plus" size={18} />
                      </button>
                    </div>
                  )}
                </>
              )}
              {view === "setup" && (
                <>
                  <button
                    className="dd-back"
                    onClick={() => navigate("library")}
                  >
                    <Icon name="back" size={18} />
                    {purpose === "live" ? "대화 상황 선택" : "대화 연습"}
                  </button>
                  <section className="dc-title">
                    <p className="dc-overline">
                      {editingId
                        ? "대화 카드 수정"
                        : review
                          ? "마지막으로 확인해요"
                          : "나의 대화 준비"}
                    </p>
                    <h1>
                      {editingId
                        ? "달라진 내용을 알려주세요"
                        : review
                          ? "이렇게 기억해 둘게요"
                          : "어떤 이야기를 하려 하나요?"}
                    </h1>
                  </section>
                  <div className="dc-setup-grid">
                    {!review ? (
                      <section className="dc-chat">
                        <div className="dc-mode-switch" aria-label="정리 방법">
                          <button
                            className={ai ? "active" : ""}
                            aria-pressed={ai}
                            disabled={busy}
                            onClick={() => setAi(true)}
                          >
                            <Icon name="chat" size={18} />
                            자유롭게 이야기
                          </button>
                          <button
                            className={!ai ? "active" : ""}
                            aria-pressed={!ai}
                            disabled={busy}
                            onClick={() => {
                              if (!ai) return;
                              setAi(false);
                              setChoices([]);
                              if (messages.length > 1) {
                                setProfile((p) => ({
                                  ...p,
                                  situation: [
                                    p.situation ||
                                      messages
                                        .filter((m) => m.role === "user")
                                        .map((m) => m.text)
                                        .join("\n"),
                                    input.trim(),
                                  ]
                                    .filter(Boolean)
                                    .join("\n")
                                    .slice(0, 800),
                                }));
                                setReview(true);
                                setEditFields(true);
                                setSource("manual");
                                setToast(
                                  "지금까지 이야기한 내용을 유지했어요. 카드 초안을 이어서 정리해 주세요.",
                                );
                              }
                            }}
                          >
                            <Icon name="edit" size={18} />
                            하나씩 정리
                          </button>
                        </div>
                        {!config.available && (
                          <p className="dd-small">
                            AI에 연결하지 못했어요. 자유롭게 적은 내용을 카드로
                            옮기거나, 하나씩 직접 정리할 수 있어요.
                          </p>
                        )}
                        {!ai && (
                          <div
                            className="dc-question-progress"
                            aria-label={`${step + 1} / 4 질문`}
                          >
                            {["상황", "상대", "목표", "지킬 선"].map(
                              (label, i) => (
                                <span
                                  key={label}
                                  className={i <= step ? "active" : ""}
                                >
                                  <i>
                                    {i < step ? (
                                      <Icon name="check" size={13} />
                                    ) : (
                                      i + 1
                                    )}
                                  </i>
                                  {label}
                                </span>
                              ),
                            )}
                          </div>
                        )}
                        <div className="dc-question">
                          <div className="dc-coach-avatar">
                            <Companion small mood={busy ? "think" : "listen"} />
                          </div>
                          <div>
                            <span className="dc-question-name">
                              {currentCharacter.name} · 대화 도우미
                            </span>
                            <p aria-live="polite">
                              {busy
                                ? "이야기에서 중요한 부분을 정리하고 있어요."
                                : currentQuestion}
                            </p>
                          </div>
                        </div>
                        {messages.length > 1 && (
                          <details className="dc-history">
                            <summary>지금까지 나눈 이야기</summary>
                            <div className="dc-messages">
                              {messages.map((m, i) => (
                                <p key={i} className={"dc-message " + m.role}>
                                  {m.text}
                                </p>
                              ))}
                            </div>
                          </details>
                        )}
                        <div className="vn-setup-choices">
                          <p>가까운 답을 고르거나, 내 이야기로 바꿔보세요.</p>
                          <div className="vn-choice-list">
                            {suggestedChoices.map((choice, i) => (
                              <button
                                key={choice}
                                disabled={busy}
                                onClick={() => setInput(choice)}
                              >
                                <span>0{i + 1}</span>
                                {choice}
                                <Icon name="plus" size={15} />
                              </button>
                            ))}
                          </div>
                        </div>
                        <details className="vn-setup-voice">
                          <summary>
                            <Icon name="mic" size={18} />
                            타이핑 대신 말로 상황 설명하기
                          </summary>
                          <VoiceComposer
                            config={config}
                            consent={consent}
                            disabled={busy}
                            requireText
                            submitLabel="인식한 말을 입력칸에 넣기"
                            onUse={async (draft) => {
                              const max = ai ? 800 : [800, 160, 400, 400][step];
                              setInput(draft.text.slice(0, max));
                              if (draft.text.length > max)
                                setToast(
                                  `질문 입력 한도 ${max}자까지 넣었어요. 나머지는 다음 질문에 이어서 알려주세요.`,
                                );
                            }}
                          />
                          <p className="vn-caption">
                            설정 음성은 입력 보조로 사용해요. 음성 원본을
                            보관하려면 ‘대화 기록’을 이용해 주세요.
                          </p>
                        </details>
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
                            maxLength={ai ? 800 : [800, 160, 400, 400][step]}
                            rows={4}
                            disabled={busy}
                            placeholder={
                              ai || step === 0
                                ? "예: 팀장님께 보고서 마감을 다음 주로 미루자고 이야기하고 싶어요."
                                : [
                                    "",
                                    "예: 함께 일하는 팀장님",
                                    "예: 보고서 마감을 다음 주로 조율하기",
                                    "예: 주말 근무는 약속하고 싶지 않아요",
                                  ][step]
                            }
                          />
                          <div>
                            <span>
                              {input.length}/
                              {ai ? 800 : [800, 160, 400, 400][step]}
                            </span>
                            <button
                              className="dd-primary"
                              type="submit"
                              disabled={
                                busy ||
                                !input.trim() ||
                                (ai && config.available && !consent)
                              }
                            >
                              {busy ? "정리 중" : ai ? "이야기 보내기" : "다음"}
                              <Icon name="send" size={17} />
                            </button>
                          </div>
                        </form>
                        {(ai || config.voiceAvailable) && (
                          <AIConsent
                            config={config}
                            checked={consent}
                            onChange={setConsent}
                            disabled={busy}
                          />
                        )}
                        {error && (
                          <>
                            <p className="dd-error" role="alert">
                              {error}
                            </p>
                            <QuotaHelp error={error} />
                          </>
                        )}
                        <CompanionPicker
                          value={companionChoice}
                          onChange={setCompanionChoice}
                          profile={profile}
                          custom={companions}
                          disabled={busy}
                        />
                        <div className="dc-setup-bottom">
                          <span>
                            <Icon name="shield" size={15} />
                            실명 대신 관계로 적어도 돼요.
                          </span>
                          <button
                            className="dd-link"
                            disabled={busy}
                            onClick={() => {
                              setEditFields(true);
                              setReview(true);
                              setSource("manual");
                            }}
                          >
                            직접 작성
                          </button>
                        </div>
                      </section>
                    ) : (
                      <section className="dc-profile-panel dc-review-panel">
                        <div className="dc-review-heading">
                          <span className="dc-round-icon">
                            <Icon name="cards" size={25} />
                          </span>
                          <div>
                            <p className="dc-overline">나의 대화 카드</p>
                            <h2>{profile.title || "제목을 정해 주세요"}</h2>
                          </div>
                          {!editingId && (
                            <span className="dc-ready-pill">
                              <Icon name="check" size={14} />
                              초안
                            </span>
                          )}
                        </div>
                        {editFields || !canSave ? (
                          <ProfileEditor
                            profile={profile}
                            onChange={setProfile}
                          />
                        ) : (
                          <ContextFacts profile={profile} />
                        )}
                        {!editFields && canSave && (
                          <button
                            className="dd-link"
                            onClick={() => setEditFields(true)}
                          >
                            <Icon name="edit" size={16} />
                            내용 수정하기
                          </button>
                        )}
                        <CompanionPicker
                          value={companionChoice}
                          onChange={setCompanionChoice}
                          profile={profile}
                          custom={companions}
                          disabled={busy}
                        />
                        <div className="dc-save-note">
                          <Icon name="shield" size={18} />
                          <span>
                            카드와 선택한 도우미를 이 기기에 저장해요.
                          </span>
                          <HelpTip label="무엇이 저장되나요?">
                            지금 보이는 상대·상황·목표·지킬 선을 저장해 다음
                            코칭에 사용해요. 설정 대화 전체나 통화 원문은
                            저장하지 않아요.
                          </HelpTip>
                        </div>
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
                          disabled={!canSave || busy}
                          onClick={save}
                        >
                          {editingId ? "수정 내용 저장" : "내 대화로 저장"}
                          <Icon name="check" size={18} />
                        </button>
                        {!!messages.length && (
                          <button
                            className="dd-link"
                            onClick={() => setReview(false)}
                          >
                            이야기 더 나누기
                          </button>
                        )}
                      </section>
                    )}
                  </div>
                </>
              )}
              {view === "detail" && active && (
                <>
                  <button
                    className="dd-back"
                    onClick={() => navigate("library")}
                  >
                    <Icon name="back" size={18} />
                    {purpose === "live" ? "대화 상황 선택" : "대화 연습"}
                  </button>
                  <section className="dc-title">
                    <p className="dc-overline">
                      {active.isSample
                        ? "샘플 · 가상의 상황"
                        : "준비해 둔 대화"}
                    </p>
                    <h1>{active.title}</h1>
                  </section>
                  <div className="dc-detail-compact">
                    <section className="dc-profile-panel">
                      <div className="dc-panel-heading">
                        <h2>
                          {purpose === "live"
                            ? "지금 대화에서 지킬 목표"
                            : "이번 연습에서 기억할 것"}
                        </h2>
                        <Companion small mood="listen" />
                      </div>
                      <ContextFacts profile={active} compact />
                      <button
                        className="dd-primary dd-full"
                        data-tour="practice-button"
                        onClick={() => {
                          if (purpose === "live") useCard(active);
                          else setView("voicePractice", "practice");
                          window.scrollTo({ top: 0 });
                        }}
                      >
                        <Icon name="chat" size={20} />
                        {purpose === "live"
                          ? "이 상황으로 도움받기"
                          : "상대와 대화 연습"}
                      </button>
                      <p className="dc-small-caption">
                        {purpose === "live"
                          ? "상대 말을 들려주거나 직접 입력해 답변 힌트를 받아요. 지원 브라우저에서는 계속 들으며 자막을 보여줘요."
                          : "문자나 목소리로 직접 답하고, 끝나면 내 말을 복기해요."}
                      </p>
                    </section>
                    <details className="dc-detail-alternative">
                      <summary>
                        {purpose === "live"
                          ? "이 상황을 미리 연습하려면"
                          : "실제 대화 중에 도움이 필요하다면"}
                      </summary>
                      <p>
                        {purpose === "live"
                          ? "AI가 상대 역할을 맡아요. 직접 답해보고 내 말을 복기해요."
                          : "대면 대화나 다른 기기의 스피커폰에서 짧게 듣고, 다음에 할 말의 힌트를 받아요."}
                      </p>
                      <button
                        className="dd-secondary"
                        onClick={() =>
                          purpose === "live"
                            ? setView("voicePractice", "practice")
                            : useCard(active)
                        }
                      >
                        <Icon name="mic" size={20} />
                        {purpose === "live"
                          ? "이 상황 미리 연습하기"
                          : "실제 대화에서 힌트 받기"}
                      </button>
                    </details>
                  </div>
                  <details className="dc-detail-extra dc-detail-tools">
                    <summary>상황 수정·복사·삭제</summary>
                    <div className="dc-card-tools">
                      <span>
                        최근 수정{" "}
                        {new Date(active.updatedAt).toLocaleDateString("ko-KR")}
                      </span>
                      <button onClick={() => start(active)}>수정</button>
                      <button onClick={() => duplicate(active)}>
                        복사해서 만들기
                      </button>
                      <button onClick={() => remove(active)}>삭제</button>
                    </div>
                  </details>
                  {error && (
                    <>
                      <p className="dd-error" role="alert">
                        {error}
                      </p>
                      <QuotaHelp error={error} />
                    </>
                  )}
                </>
              )}
              {view === "live" && active && (
                <LiveCoach
                  onPractice={() => setView("voicePractice", "practice")}
                  key={active.id}
                  profile={active}
                  onBack={() => {
                    setView("detail");
                    setToast("");
                  }}
                  onDemo={() => setView("demo")}
                />
              )}
              {view === "guide" && (
                <>
                  <section className="dc-title">
                    <p className="dc-overline">필요할 때, 가볍게</p>
                    <h1>{supportLabel("guide")}</h1>
                    <p>
                      대화 중에는 ‘지금 대화 도움받기’, 평소에는 ‘미리
                      연습하기’를 선택하세요. 저장한 연습과 녹음은 내 기록에서
                      이어보세요.
                    </p>
                  </section>
                  <button className="dc-guide-tour" onClick={beginTour}>
                    <Companion small />
                    <span>
                      <strong>직접 해보는 30초 가이드</strong>
                      <small>
                        상황 선택부터 AI 상대와 연습까지 따라 해봐요.
                      </small>
                    </span>
                    <Icon name="arrow" />
                  </button>
                  <StorageStatus
                    onRestore={async () => {
                      await seedStarterData(true);
                      setCards(readCards());
                    }}
                    onCards={exportData}
                    onRecords={() => navigate("records")}
                    onTerms={() => navigate("terms")}
                  />
                  <div className="dc-guide-steps">
                    {[
                      {
                        icon: "cards",
                        title: "내 상황과 목표 준비",
                        text: "누구와 어떤 말을 나눌지 저장해 두세요. 같은 설정을 실전 도움과 연습에 사용해요.",
                      },
                      {
                        icon: "mic",
                        title: "대화 중 다음 한마디",
                        text: "상대 말을 들려주거나 입력하면 AI가 내 목표에 맞는 답변을 제안해요. 지원 브라우저에서는 계속 듣고, 그 외에는 최대 4초씩 녹음한 뒤 처리해요.",
                      },
                      {
                        icon: "chat",
                        title: "평소에는 미리 연습",
                        text: "AI가 상대 역할을 맡아요. 직접 답하고 내 말의 근거로 복기한 뒤 다시 연습해요.",
                      },
                    ].map((s, i) => (
                      <article key={s.title}>
                        <span className="dc-guide-number">0{i + 1}</span>
                        <Icon
                          name={s.icon as "cards" | "mic" | "chat"}
                          size={27}
                        />
                        <h2>{s.title}</h2>
                        <p>{s.text}</p>
                      </article>
                    ))}
                  </div>
                  <details className="dc-guide-faq">
                    <summary>녹음하고 멈췄는데 다음엔 무엇을 하나요?</summary>
                    <p>
                      ‘녹음 끝내기’를 누르면 파형과 재생 버튼이 나타나요. AI
                      전송에 동의하면 문자로 바꾸며, 완료 후 인식한 말을 확인해
                      보내거나 저장하세요. 실패해도 녹음을 재생하거나 문자
                      변환을 다시 시도할 수 있어요. ‘처리 취소’는 진행 중인
                      인식을 중단해요.
                    </p>
                  </details>
                  <details className="dc-guide-faq">
                    <summary>상대와 음성 대화 연습은 어떻게 하나요?</summary>
                    <p>
                      홈의 ‘대화 연습’에서 카드를 고르고 ‘상대와 대화 연습’을
                      누르세요. AI가 상대 역할로 말하면 녹음하거나 직접 입력해
                      답해요. 한 번씩 주고받는 방식이며 상대의 말은 기기
                      음성으로 읽어줘요. 연습 음성과 문자는 대화 기록에
                      저장돼요.
                    </p>
                  </details>
                  <details className="dc-guide-faq">
                    <summary>용어를 모아 동료에게 공유하려면?</summary>
                    <p>
                      대화 문자의 단어를 누르거나 ‘중요 용어 찾기’를 사용하세요.
                      업종별 뜻·예문·우리 팀 메모를 저장하고, 용어 노트에서
                      필요한 항목을 선택해 가이드로 공유할 수 있어요. AI 설명은
                      초안이니 팀에서 쓰는 뜻을 확인해 주세요.
                    </p>
                  </details>
                  <details className="dc-guide-faq">
                    <summary>실제 통화에서도 쓸 수 있나요?</summary>
                    <p>
                      다른 기기로 스피커폰 통화를 하거나 대면 대화할 때
                      사용하세요. 같은 휴대폰의 통화 음성을 직접 가져오지는
                      못해요. 지원 브라우저에서는 계속 들을 수 있어요. 짧게
                      녹음하는 방식에서는 최대 4초씩 입력하며 처리 중에는
                      마이크가 꺼져요. 대화 참여자의 동의를 받은 뒤 사용해
                      주세요.
                    </p>
                  </details>
                  <details className="dc-guide-faq">
                    <summary>내 대화는 어디에 저장되나요?</summary>
                    <p>
                      캐릭터 설정과 카드, 음성·연습·친구 대화, 복기와 용어
                      노트는 이 브라우저에 저장돼요. 다른 기기로 자동 동기화되지
                      않으며, 브라우저 데이터를 지우면 사라질 수 있어요. 내
                      기록에서 음성과 문자를, 대화 연습에서 카드를 내려받을 수
                      있어요.
                    </p>
                  </details>
                  <details className="dc-guide-faq">
                    <summary>AI는 어떤 일을 하나요?</summary>
                    <p>
                      상황을 카드로 정리하고, 음성을 문자로 바꾸고, 상대 역할로
                      대화하고, 목표에 맞는 답변 후보와 용어 설명을 만들어요. 두
                      번 이상 답변한 연습에서는 ‘AI로 이 대화 복기하기’를 눌러
                      실제 내 말의 근거와 고쳐 말할 문장을 확인할 수 있어요.
                      이어서 그 장면부터 다시 연습하세요.
                    </p>
                    <p>
                      캐릭터 추천은 상황별 규칙으로 정하며, AI는 AI 대화
                      상대에서 설정한 역할과 말투로 대화해요. 저장한 다른 대화
                      전체를 자동으로 읽거나 기억하지는 않아요.
                    </p>
                  </details>
                  <QuotaHelp error="한도" />
                  <div className="dc-guide-links">
                    <a href="/evidence">
                      서비스·데이터 안내
                      <Icon name="arrow" size={18} />
                    </a>
                  </div>
                </>
              )}
              {view === "demo" && (
                <>
                  <button className="dd-back" onClick={home}>
                    <Icon name="back" size={18} />
                    홈으로
                  </button>
                  <section className="dc-title">
                    <p className="dc-overline">사전 작성된 흐름 예시</p>
                    <h1>같은 말도, 내 목표에 맞게.</h1>
                  </section>
                  <div className="dc-detail-grid">
                    <section className="dc-profile-panel">
                      <h2>{exampleProfile.title}</h2>
                      <ContextFacts profile={exampleProfile} />
                    </section>
                    <aside className="dc-demo-cue">
                      <span>상대의 말</span>
                      <p>“보고서, 금요일까지 가능하죠?”</p>
                      <span>내 목표를 담은 답변 예시</span>
                      <blockquote>
                        현재 업무를 유지하면 금요일 완료는 어렵습니다. 어떤 일을
                        먼저 진행할지 정해 주시면, 가능한 일정을
                        말씀드리겠습니다.
                      </blockquote>
                      <small>실시간 AI 결과가 아닌 사용법 예시예요.</small>
                    </aside>
                  </div>
                  <div className="dd-actions">
                    <button
                      className="dd-primary"
                      onClick={() => {
                        start();
                        setProfile({ ...exampleProfile });
                        setReview(true);
                        setEditFields(true);
                        setSource("manual");
                      }}
                    >
                      이 예시로 내 카드 만들기
                      <Icon name="arrow" size={18} />
                    </button>
                    <button className="dd-link" onClick={beginTour}>
                      한 단계씩 따라 해보기
                    </button>
                  </div>
                </>
              )}
            </div>
          </main>
          <footer className="dc-footer">
            <span>스픽코칭 · 당신의 말 곁에</span>
            <a href="/evidence">서비스·데이터 안내</a>
          </footer>
        </div>
        {tour && (
          <FirstConversation
            step={tourStep}
            onStep={changeTourStep}
            onClose={() => setTour(false)}
          />
        )}
      </div>
    </CompanionProvider>
  );
}
