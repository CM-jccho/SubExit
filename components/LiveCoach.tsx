"use client";
import { AIConsent } from "./VoiceComposer";
import { useAIConsent } from "./ConsentSession";
import LiveSpeechPanel from "./LiveSpeechPanel";
import CoachingInputTabs from "./CoachingInputTabs";
import {
  speechSupport,
  speechSupportMessage,
  type SpeechSupportReason,
} from "@/lib/live-speech";
import { requestMicrophone } from "@/lib/microphone";
import SampleNotice, { SampleSwitch } from "./SampleNotice";
import { sampledRequest } from "@/lib/resilient-ai";
import { practiceSampleContext } from "@/lib/demo-bank";
import { aiFetch } from "@/lib/ai-client";
import QuotaHelp from "./QuotaHelp";
import SamplePreview from "./SamplePreview";
import { useEffect, useRef, useState } from "react";
import AudioPlayer, { inspectAudio } from "./AudioPlayer";
import { useCompanion } from "./CompanionTheme";
import CompanionNudge from "./CompanionNudge";
import {
  listSessions,
  putSession,
  type AudioClip,
  type VoiceSession,
  type VoiceTurn,
} from "@/lib/voice-notebook";
import {
  extractConversationSignals,
  mergeConversationSignals,
  partnerGroupKey,
} from "@/lib/conversation-signals";
import { scenarios, tones, type Tone } from "@/lib/scenarios";
import {
  emptyProfile,
  type ContextProfile,
  type ConversationCard,
} from "@/lib/conversation-cards";
import { WORKSPACE_LEAVE_EVENT } from "@/lib/navigation-guard";
import type { CoachResponse } from "@/lib/coach-contract";
import { Companion, HelpTip, Icon, Waveform } from "./CompanionUI";
type Phase = "idle" | "permission" | "listening" | "transcribing" | "coaching";

const QUICK_PARTNERS = ["상사", "동료", "고객", "친구", "가족", "연인"] as const;
const QUICK_GOALS = [
  { label: "뜻 확인", value: "상대의 뜻을 확인하고 싶어요" },
  { label: "정중한 거절", value: "정중하게 거절하고 싶어요" },
  { label: "일정 조율", value: "일정을 다시 조율하고 싶어요" },
  { label: "내 입장 설명", value: "내 입장을 차분히 설명하고 싶어요" },
  { label: "요청·부탁", value: "상대에게 요청하거나 부탁하고 싶어요" },
  { label: "갈등 정리", value: "감정을 키우지 않고 갈등을 정리하고 싶어요" },
] as const;

function isQuickPartner(value: string) {
  return QUICK_PARTNERS.some((item) => item === value);
}
function isQuickGoal(value: string) {
  return QUICK_GOALS.some((item) => item.value === value);
}
export default function LiveCoach({
  onBack,
  onDemo,
  onPractice,
  onRecords,
  profile: initialProfile,
  directEntry = false,
  savedProfiles = [],
}: {
  onBack: () => void;
  onDemo: () => void;
  onPractice?: () => void;
  onRecords?: () => void;
  profile?: ContextProfile;
  directEntry?: boolean;
  savedProfiles?: ConversationCard[];
}) {
  const character = useCompanion();
  const [supportsLive, setSupportsLive] = useState(false);
  const [liveSupportReason, setLiveSupportReason] =
    useState<SpeechSupportReason>();
  const [samplePreviewOpen, setSamplePreviewOpen] = useState(false);
  const [voiceStyle, setVoiceStyle] = useState<"continuous" | "short">(
    "continuous",
  );
  const [liveActive, setLiveActive] = useState(false);
  const [scenario, setScenario] = useState("sales"),
    [tone, setTone] = useState<Tone>(initialProfile?.tone || "firm_polite");
  const [quickContext, setQuickContext] = useState<ContextProfile>(
    initialProfile || emptyProfile(),
  );
  const [customPartnerOpen, setCustomPartnerOpen] = useState(
    !!initialProfile?.partner && !isQuickPartner(initialProfile.partner),
  );
  const [customGoalOpen, setCustomGoalOpen] = useState(
    !!initialProfile?.goal && !isQuickGoal(initialProfile.goal),
  );
  const [configState, setConfigState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [configAttempt, setConfigAttempt] = useState(0);
  const [config, setConfig] = useState({
    available: false,
    voiceAvailable: false,
    sampleOnly: true,
    configurationStatus: "unknown" as
      | "unknown"
      | "missing_key"
      | "disabled"
      | "configured",
  });
  const [consent, setConsent] = useAIConsent();
  const adult = consent,
    sample = consent;
  const [automatic, setAutomatic] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle"),
    [seconds, setSeconds] = useState(0),
    [input, setInput] = useState(""),
    [result, setResult] = useState<CoachResponse | null>(null),
    [error, setError] = useState("");
  const [clip, setClip] = useState<AudioClip | null>(null),
    [notice, setNotice] = useState("");
  const [prepared, setPrepared] = useState(directEntry),
    [inputMode, setInputMode] = useState<"voice" | "text">("voice"),
    [copied, setCopied] = useState(false);
  const sampleHistory = useRef<string[]>([]);
  const [recentCues, setRecentCues] = useState<
    { opponent: string; response: CoachResponse; goal?: string }[]
  >([]);
  const [historyStatus, setHistoryStatus] = useState("");
  const [partnerHistoryCount, setPartnerHistoryCount] = useState(0);
  const [savingHistory, setSavingHistory] = useState(false);
  const [historySaved, setHistorySaved] = useState(false);
  const profile: ContextProfile | undefined = directEntry
    ? {
        ...quickContext,
        title: quickContext.title || "지금 나누는 대화",
        partner: quickContext.partner.trim() || "대화 상대",
        situation: quickContext.situation.trim() || "현재 나누는 대화",
        goal:
          quickContext.goal.trim() ||
          "상대의 뜻을 확인하고 내 입장을 차분히 전달하기",
        tone,
      }
    : initialProfile;
  function updateContext(next: ContextProfile) {
    setQuickContext(next);
    setTone(next.tone);
    setCustomPartnerOpen(!!next.partner && !isQuickPartner(next.partner));
    setCustomGoalOpen(!!next.goal && !isQuickGoal(next.goal));
    setResult(null);
    sampleHistory.current = [];
    setNotice("상대와 목표를 바꿨어요. 입력한 상대 말은 그대로예요.");
  }
  function addRecentCue(cue: {
    opponent: string;
    response: CoachResponse;
    goal?: string;
  }) {
    setHistorySaved(false);
    setRecentCues((items) => {
      const previous = items.at(-1);
      const duplicate =
        previous?.opponent === cue.opponent &&
        previous?.response.suggestion === cue.response.suggestion;
      return duplicate ? items : [...items.slice(-11), cue];
    });
  }
  useEffect(() => {
    const key = partnerGroupKey(quickContext.partner);
    if (!directEntry || !key) {
      setPartnerHistoryCount(0);
      return;
    }
    let active = true;
    void listSessions()
      .then((rows) => {
        if (!active) return;
        setPartnerHistoryCount(
          rows.filter(
            (session) =>
              session.liveMeta?.groupKey === key ||
              partnerGroupKey(session.context?.partner || "") === key,
          ).length,
        );
      })
      .catch(() => {
        if (active) setPartnerHistoryCount(0);
      });
    return () => {
      active = false;
    };
  }, [directEntry, quickContext.partner]);

  async function saveLiveConversation() {
    if (!profile || recentCues.length === 0 || savingHistory) return;
    setSavingHistory(true);
    setHistoryStatus("");
    try {
      const now = new Date().toISOString();
      const cleanPartner = profile.partner.trim() || "대화 상대";
      const signals = mergeConversationSignals(
        ...recentCues.map((cue) =>
          extractConversationSignals(
            cue.opponent + "\n" + cue.response.suggestion,
          ),
        ),
      );
      const turns: VoiceTurn[] = recentCues.map((cue, index) => ({
        id: "turn-" + crypto.randomUUID(),
        role: "recording",
        text: cue.opponent,
        suggestions: [cue.response.suggestion],
        terms: mergeConversationSignals(
          extractConversationSignals(cue.opponent),
          extractConversationSignals(cue.response.suggestion),
        ).terms,
        createdAt: new Date(Date.now() + index).toISOString(),
      }));
      const groupKey = partnerGroupKey(cleanPartner);
      const session: VoiceSession = {
        id: "session-" + crypto.randomUUID(),
        title: (cleanPartner + " · 실시간 대화").slice(0, 80),
        kind: "recording",
        context: {
          ...profile,
          title:
            profile.title && profile.title !== "지금 나누는 대화"
              ? profile.title
              : cleanPartner + " 대화",
        },
        industry: "",
        turns,
        createdAt: now,
        updatedAt: now,
        liveMeta: {
          version: 1,
          source: "live-help",
          groupKey,
          partner: cleanPartner,
          signals,
        },
      };
      await putSession(session);
      const rows = await listSessions();
      const count = rows.filter(
        (item) =>
          item.liveMeta?.groupKey === groupKey ||
          partnerGroupKey(item.context?.partner || "") === groupKey,
      ).length;
      setPartnerHistoryCount(count);
      const parts = ["내 기록에 저장했어요."];
      if (count > 1) parts.push("같은 상대 기록 " + count + "건으로 묶여요.");
      if (signals.numbers.length)
        parts.push("숫자·날짜·금액 " + signals.numbers.length + "개");
      if (signals.terms.length) parts.push("용어 " + signals.terms.length + "개");
      setHistoryStatus(parts.join(" "));
      setHistorySaved(true);
    } catch (e) {
      setHistoryStatus(
        e instanceof Error
          ? e.message
          : "대화를 저장하지 못했어요. 다시 시도해 주세요.",
      );
    } finally {
      setSavingHistory(false);
    }
  }
  const version = useRef(0),
    busy = useRef(false),
    phaseRef = useRef<Phase>("idle"),
    liveActiveRef = useRef(false),
    recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    ticker = useRef<ReturnType<typeof setInterval> | null>(null),
    request = useRef<AbortController | null>(null),
    panel = useRef<HTMLElement | null>(null);
  const allowed = consent && adult && (!config.sampleOnly || sample);
  const aiUnavailableMessage =
    configState === "loading"
      ? "AI 연결을 확인하고 있어요."
      : configState === "error"
        ? "AI 연결 상태를 불러오지 못했어요. 연결을 다시 확인해 주세요."
        : config.configurationStatus === "missing_key"
          ? "현재 운영 서버에 AI 연결 키가 없어 음성·문자 코칭을 시작할 수 없어요."
          : config.configurationStatus === "disabled"
            ? "현재 운영 설정에서 AI 코칭이 꺼져 있어요."
            : "현재 AI 연결을 사용할 수 없어요. 잠시 후 다시 확인해 주세요.";
  const voiceUnavailableMessage = !config.available
    ? aiUnavailableMessage
    : "현재 운영 설정에서 음성 인식이 꺼져 있어요. 직접 입력은 사용할 수 있어요.";
  const previousConsent = useRef(consent);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    liveActiveRef.current = liveActive;
  }, [liveActive]);
  useEffect(() => {
    const revoked = previousConsent.current && !consent;
    previousConsent.current = consent;
    if (!consent && prepared && (!directEntry || revoked)) {
      cancel();
      setLiveActive(false);
      if (!directEntry) setPrepared(false);
    }
  }, [consent, prepared]);
  const quickDirty =
    directEntry &&
    !historySaved &&
    (!!input.trim() ||
      !!clip ||
      recentCues.length > 0 ||
      !!quickContext.goal.trim() ||
      !!quickContext.partner.trim() ||
      !!quickContext.situation.trim() ||
      !!quickContext.boundaries.trim() ||
      phase !== "idle" ||
      liveActive);
  useEffect(() => {
    if (!quickDirty) return;
    const leaving = (event: Event) => {
      if (
        !event.defaultPrevented &&
        !window.confirm(
          "입력한 말과 추천은 이 화면에만 남아요. 화면을 나갈까요?",
        )
      )
        event.preventDefault();
    };
    const unloading = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener(WORKSPACE_LEAVE_EVENT, leaving);
    window.addEventListener("beforeunload", unloading);
    return () => {
      window.removeEventListener(WORKSPACE_LEAVE_EVENT, leaving);
      window.removeEventListener("beforeunload", unloading);
    };
  }, [quickDirty]);
  function release() {
    if (timer.current) clearTimeout(timer.current);
    if (ticker.current) clearInterval(ticker.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }
  function cancel() {
    setNotice("작업을 취소했어요. 다시 녹음하거나 직접 입력할 수 있어요.");
    version.current++;
    request.current?.abort();
    if (recorder.current) {
      recorder.current.onstop = null;
      if (recorder.current.state !== "inactive") recorder.current.stop();
    }
    release();
    busy.current = false;
    setPhase("idle");
  }
  useEffect(() => {
    const support = speechSupport();
    setSupportsLive(!!support.Engine);
    setLiveSupportReason(support.reason);
    setConfigState("loading");
    const abort = new AbortController();
    fetch("/api/coach", { signal: abort.signal, cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("configuration");
        return r.json();
      })
      .then((value) => {
        if (!abort.signal.aborted) {
          setConfig(value);
          setConfigState("ready");
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) setConfigState("error");
      });
    const hide = () => {
      if (!document.hidden) return;
      // iOS can briefly mark the page hidden while a native microphone or
      // speech-recognition permission sheet is open. Do not cancel the user's
      // permission request; only stop once capture/processing is actually active.
      if (
        phaseRef.current === "listening" ||
        phaseRef.current === "transcribing" ||
        phaseRef.current === "coaching" ||
        liveActiveRef.current
      ) {
        cancel();
        setLiveActive(false);
        setError("화면이 비활성화되어 마이크와 요청을 중단했어요.");
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      abort.abort();
      version.current++;
      request.current?.abort();
      if (recorder.current) {
        recorder.current.onstop = null;
        if (recorder.current.state !== "inactive") recorder.current.stop();
      }
      release();
      document.removeEventListener("visibilitychange", hide);
    };
  }, [configAttempt]);
  useEffect(() => {
    if (result && window.matchMedia("(max-width: 850px)").matches)
      panel.current?.scrollIntoView({ block: "start" });
  }, [result]);
  async function call(
    url: string,
    body: BodyInit,
    id: number,
    headers?: HeadersInit,
  ) {
    const abort = new AbortController();
    request.current = abort;
    const timeout = setTimeout(() => abort.abort(), 25000);
    try {
      const r = await aiFetch(url, {
        method: "POST",
        headers,
        body,
        signal: abort.signal,
      });
      const data = await r.json();
      if (version.current !== id) throw new Error("cancelled");
      if (!r.ok) throw new Error(data.error || "요청을 완료하지 못했어요.");
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }
  async function coach(
    text: string,
    requestedTone: Tone = tone,
    id = ++version.current,
  ) {
    if (!allowed || !config.available || text.trim().length < 2) return;
    const requestProfile =
      directEntry && profile
        ? {
            ...profile,
            tone: requestedTone,
            situation:
              quickContext.situation.trim() || text.trim().slice(0, 800),
          }
        : profile
          ? { ...profile, tone: requestedTone }
          : profile;
    busy.current = true;
    setPhase("coaching");
    setNotice("인식한 말을 바탕으로 답변 힌트를 준비하고 있어요.");
    setError("");
    setResult(null);
    setCopied(false);
    try {
      const abort = new AbortController();
      request.current = abort;
      const timeout = setTimeout(() => abort.abort(), 25000);
      let data;
      try {
        data = await sampledRequest({
          operation: "coach",
          context: [
            practiceSampleContext(requestProfile) ||
              scenarios.find((s) => s.id === scenario)?.title,
            text,
          ]
            .filter(Boolean)
            .join(" "),
          previous: sampleHistory.current,
          manual: false,
          url: "/api/coach",
          init: {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: abort.signal,
            body: JSON.stringify({
              mode: "ai",
              quick: true,
              scenario,
              context: requestProfile,
              tone: requestedTone,
              opponent: text,
              reply: "",
              consent,
              adultConsent: adult,
              sampleConsent: sample,
            }),
          },
        });
      } finally {
        clearTimeout(timeout);
      }
      if (version.current === id) {
        setResult(data);
        addRecentCue({
          opponent: text,
          response: data,
          goal: profile?.goal,
        });
        if (data.sample)
          sampleHistory.current = [
            ...sampleHistory.current.slice(-11),
            data.suggestion,
          ];
        setNotice(
          data.sample
            ? "사전 작성한 샘플 문장을 보여드려요. 현재 상황에 맞게 고쳐보세요."
            : "답변 힌트가 준비됐어요. 내 상황에 맞게 활용해 보세요.",
        );
      }
    } catch (e) {
      if (version.current === id) {
        setNotice(
          "AI 답변을 받지 못했어요. 입력한 말과 최근 추천은 그대로예요. 샘플로 자동 전환하지 않아요.",
        );
        setError(
          e instanceof Error && e.name === "AbortError"
            ? "응답이 늦어 요청을 중단했어요. 다시 시도해 주세요."
            : e instanceof Error
              ? e.message
              : "연결을 확인해 주세요.",
        );
      }
    } finally {
      if (version.current === id) {
        busy.current = false;
        setPhase("idle");
      }
    }
  }
  async function listen() {
    if (busy.current) {
      setError("이전 작업을 처리하고 있어요. 잠시 후 다시 눌러주세요.");
      return;
    }
    if (!allowed) {
      setError("먼저 상단의 AI 전송 동의를 확인해 주세요.");
      setNotice("마이크를 시작하지 않았어요.");
      return;
    }
    if (!config.voiceAvailable) {
      setError(voiceUnavailableMessage);
      setNotice("마이크를 시작하지 않았어요.");
      return;
    }
    const id = ++version.current;
    busy.current = true;
    setPhase("permission");
    setError("");
    setResult(null);
    if (!directEntry) setInput("");
    setSeconds(0);
    setNotice("마이크 권한을 확인하고 있어요.");
    setClip(null);
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "이 브라우저에서는 마이크 입력을 지원하지 않아요. 직접 입력해 주세요.",
        );
      // Keep the permission request in the direct tap call stack. Safari is
      // strict about media permission prompts originating from a user gesture.
      const permission = new AbortController();
      request.current = permission;
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (permission.signal.aborted || version.current !== id) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const mime = [
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
      ].find((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(
        media,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = rec;
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onerror = () => {
        if (version.current === id) {
          cancel();
          setError("마이크 입력이 중단됐어요. 다시 시작해 주세요.");
        }
      };
      rec.onstop = async () => {
        release();
        if (version.current !== id) return;
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 100) {
          busy.current = false;
          setPhase("idle");
          setError(
            "녹음된 음성이 없거나 너무 짧아요. 한 문장을 말한 뒤 녹음 끝내기를 눌러주세요.",
          );
          return;
        }
        const captured: AudioClip = {
          blob,
          duration: 0,
          peaks: [],
          name: "상대의 말",
        };
        setClip(captured);
        void inspectAudio(blob)
          .then((c) => {
            if (version.current === id) setClip(c);
          })
          .catch(() => {});
        await transcribeBlob(blob, id);
      };
      rec.start();
      setPhase("listening");
      const started = Date.now();
      ticker.current = setInterval(
        () =>
          setSeconds(Math.min(8, Math.floor((Date.now() - started) / 1000))),
        200,
      );
      timer.current = setTimeout(() => {
        if (rec.state === "recording") rec.stop();
      }, 4000);
    } catch (e) {
      if (version.current === id) {
        release();
        busy.current = false;
        setPhase("idle");
        setInputMode("text");
        setError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "마이크 사용이 거부됐어요. 다시 눌러 권한을 허용하거나, 이전에 거부했다면 브라우저의 사이트 설정에서 마이크를 허용해 주세요."
            : e instanceof Error
              ? e.message
              : "마이크를 시작하지 못했어요.",
        );
      }
    }
  }
  function finishRecording() {
    if (recorder.current?.state === "recording") {
      setPhase("transcribing");
      setNotice("녹음을 마쳤어요. 음성을 글로 바꾸고 있어요.");
      recorder.current.stop();
    }
  }
  async function transcribeBlob(blob: Blob, id = ++version.current) {
    if (!allowed || !config.voiceAvailable) return;
    busy.current = true;
    setPhase("transcribing");
    setError("");
    setNotice("녹음 완료 · 음성 인식 중이에요. 잠시 기다려 주세요.");
    try {
      const form = new FormData();
      form.append("audio", blob, "conversation");
      form.append("consent", String(consent));
      form.append("adultConsent", String(adult));
      form.append("sampleConsent", String(sample));
      const data = await call("/api/transcribe", form, id);
      if (version.current !== id) return;
      if (typeof data.text !== "string" || !data.text.trim())
        throw new Error(
          "음성에서 말을 인식하지 못했어요. 아래에서 녹음을 재생해 확인하고 다시 시도해 주세요.",
        );
      setInput(data.text.slice(0, 1000));
      setNotice(
        "음성 인식이 끝났어요. 아래 문장을 확인하고 ‘다음 한마디 받기’를 눌러주세요.",
      );
      if (automatic) await coach(data.text.slice(0, 1000), tone, id);
    } catch (e) {
      if (version.current === id) {
        setNotice("");
        setError(
          e instanceof Error && e.name === "AbortError"
            ? "음성 인식이 지연되어 중단했어요. 녹음은 아래에 남아 있으니 ‘음성 인식 다시 시도’를 눌러주세요."
            : e instanceof Error
              ? e.message
              : "음성을 인식하지 못했어요. 다시 시도해 주세요.",
        );
      }
    } finally {
      if (version.current === id) {
        busy.current = false;
        setPhase("idle");
      }
    }
  }
  const status = {
    idle: input
      ? "상대 말을 확인해 주세요 · 마이크 꺼짐"
      : clip
        ? "녹음 완료 · 아래에서 확인해 주세요"
        : "마이크 꺼짐",
    permission: "마이크 권한 확인 중",
    listening: `듣는 중 · ${seconds}/4초`,
    transcribing: "들린 말을 글로 바꾸는 중 · 마이크 꺼짐",
    coaching: "다음 한 문장을 준비 중 · 마이크 꺼짐",
  }[phase];
  const liveSignals = mergeConversationSignals(
    ...recentCues.map((cue) =>
      extractConversationSignals(
        cue.opponent + "\n" + cue.response.suggestion,
      ),
    ),
  );
  const liveSetupComplete =
    !directEntry ||
    (!!quickContext.partner.trim() && !!quickContext.goal.trim());
  const contextControl = directEntry ? (
    <section
      className={
        "quick-context live-context-setup" +
        (liveActive ? " is-running" : "")
      }
      aria-label="이번 대화 설정"
    >
      <div className="live-context-setup-head">
        <div>
          <span>대화 시작 전</span>
          <strong>누구와, 무엇을 말할지 먼저 정해요.</strong>
        </div>
        {partnerHistoryCount > 0 && (
          <span className="live-history-count">
            같은 상대 기록 {partnerHistoryCount}건
          </span>
        )}
      </div>
      {liveActive ? (
        <div className="live-context-running-summary">
          <span>
            <strong>상대</strong>
            {quickContext.partner || "대화 상대"}
          </span>
          <span>
            <strong>목표</strong>
            {quickContext.goal || "내 뜻 전달하기"}
          </span>
        </div>
      ) : (
      <fieldset disabled={phase !== "idle"}>
        <div className="live-context-primary-fields">
          <div className="live-choice-field">
            <span>대화 상대</span>
            <div className="live-choice-grid" role="group" aria-label="대화 상대 빠른 선택">
              {QUICK_PARTNERS.map((partner) => (
                <button
                  type="button"
                  key={partner}
                  className={
                    quickContext.partner === partner && !customPartnerOpen
                      ? "active"
                      : ""
                  }
                  aria-pressed={
                    quickContext.partner === partner && !customPartnerOpen
                  }
                  onClick={() => {
                    setCustomPartnerOpen(false);
                    updateContext({
                      ...quickContext,
                      title: "",
                      partner,
                    });
                  }}
                >
                  {partner}
                </button>
              ))}
              <button
                type="button"
                className={customPartnerOpen ? "active" : ""}
                aria-pressed={customPartnerOpen}
                onClick={() => {
                  setCustomPartnerOpen(true);
                  if (isQuickPartner(quickContext.partner))
                    setQuickContext((current) => ({
                      ...current,
                      title: "",
                      partner: "",
                    }));
                }}
              >
                직접 입력
              </button>
            </div>
            {customPartnerOpen && (
              <input
                autoFocus
                maxLength={160}
                id="quick-partner"
                name="partner"
                value={quickContext.partner}
                placeholder="예: 마케팅팀 김팀장"
                onChange={(e) =>
                  setQuickContext((current) => ({
                    ...current,
                    title: "",
                    partner: e.target.value,
                  }))
                }
              />
            )}
          </div>

          <div className="live-choice-field">
            <span>이번 대화 목표</span>
            <div className="live-choice-grid live-choice-goals" role="group" aria-label="대화 목표 빠른 선택">
              {QUICK_GOALS.map((goal) => (
                <button
                  type="button"
                  key={goal.value}
                  className={
                    quickContext.goal === goal.value && !customGoalOpen
                      ? "active"
                      : ""
                  }
                  aria-pressed={
                    quickContext.goal === goal.value && !customGoalOpen
                  }
                  onClick={() => {
                    setCustomGoalOpen(false);
                    updateContext({
                      ...quickContext,
                      goal: goal.value,
                    });
                  }}
                >
                  {goal.label}
                </button>
              ))}
              <button
                type="button"
                className={customGoalOpen ? "active" : ""}
                aria-pressed={customGoalOpen}
                onClick={() => {
                  setCustomGoalOpen(true);
                  if (isQuickGoal(quickContext.goal))
                    setQuickContext((current) => ({
                      ...current,
                      goal: "",
                    }));
                }}
              >
                직접 입력
              </button>
            </div>
            {customGoalOpen && (
              <input
                autoFocus
                maxLength={400}
                id="quick-goal"
                name="goal"
                value={quickContext.goal}
                placeholder="이번 대화에서 얻고 싶은 결과를 적어주세요"
                onChange={(e) =>
                  setQuickContext((current) => ({
                    ...current,
                    goal: e.target.value,
                  }))
                }
              />
            )}
          </div>
        </div>
        <details className="live-context-more">
          <summary>상황·지킬 선·말투 더 설정</summary>
          <div className="live-context-more-fields">
            {savedProfiles.length > 0 && (
              <label>
                저장한 상황 불러오기
                <select
                  value=""
                  onChange={(e) => {
                    const card = savedProfiles.find(
                      (item) => item.id === e.target.value,
                    );
                    if (card) updateContext(card);
                  }}
                >
                  <option value="">저장한 상황 선택</option>
                  {[...savedProfiles]
                    .sort((a, b) =>
                      (b.lastUsedAt || b.updatedAt).localeCompare(
                        a.lastUsedAt || a.updatedAt,
                      ),
                    )
                    .map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.title}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label>
              상황 설명 · 선택
              <input
                maxLength={800}
                id="quick-situation"
                name="situation"
                value={quickContext.situation}
                placeholder="필요한 배경만 짧게"
                onChange={(e) =>
                  updateContext({
                    ...quickContext,
                    situation: e.target.value,
                  })
                }
              />
            </label>
            <label>
              지킬 선 · 선택
              <input
                maxLength={400}
                id="quick-boundaries"
                name="boundaries"
                value={quickContext.boundaries}
                placeholder="예: 확정 전 완료 시간을 약속하지 않기"
                onChange={(e) =>
                  updateContext({
                    ...quickContext,
                    boundaries: e.target.value,
                  })
                }
              />
            </label>
            <label>
              내 말투
              <select
                value={tone}
                onChange={(e) =>
                  updateContext({
                    ...quickContext,
                    tone: e.target.value as Tone,
                  })
                }
              >
                {tones.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="dd-link"
              onClick={() => updateContext(emptyProfile())}
            >
              기본값으로 되돌리기
            </button>
          </div>
        </details>
      </fieldset>
      )}
    </section>
  ) : undefined;
  const inputTabs = (
    <CoachingInputTabs
      value={
        supportsLive && voiceStyle === "continuous" ? "continuous" : inputMode
      }
      supportsLive={supportsLive}
      unsupportedMessage={
        !supportsLive ? speechSupportMessage(liveSupportReason) : undefined
      }
      busy={phase !== "idle" || liveActive}
      onChange={(mode) => {
        setVoiceStyle(mode === "continuous" ? "continuous" : "short");
        if (mode !== "continuous") setInputMode(mode);
      }}
    />
  );
  const liveMemoryPanel =
    recentCues.length > 0 && (
                <section
                  className="live-recent-cues live-conversation-memory"
                  aria-label="이번 대화 기록"
                >
                  <div className="live-memory-head">
                    <div>
                      <span>이번 대화</span>
                      <h2>
                        {quickContext.partner.trim()
                          ? quickContext.partner + "와의 대화"
                          : "방금 대화"}
                      </h2>
                    </div>
                    {partnerHistoryCount > 0 && (
                      <span className="live-history-count">
                        같은 상대 기록 {partnerHistoryCount}건
                      </span>
                    )}
                  </div>
                  <p className="vn-caption">
                    상대 말과 받은 제안을 저장하면 다음 대화와 연습에 다시 쓸 수 있어요.
                  </p>
                  {(result ? recentCues.slice(0, -1) : recentCues)
                    .slice(-2)
                    .map((cue, index) => (
                      <article key={index}>
                        <p>
                          <span>상대</span> {cue.opponent}
                        </p>
                        <blockquote>{cue.response.suggestion}</blockquote>
                        <small>
                          {cue.response.sample ? "사전 작성 샘플" : "AI 제안"}
                          {cue.goal ? ` · 목표: ${cue.goal}` : ""}
                        </small>
                      </article>
                    ))}
                  {(liveSignals.numbers.length > 0 ||
                    liveSignals.terms.length > 0) && (
                    <div className="live-signal-summary" aria-label="대화에서 찾은 정보">
                      <strong>대화에서 찾은 정보</strong>
                      <div>
                        {liveSignals.numbers.slice(0, 6).map((value) => (
                          <span key={"number-" + value}># {value}</span>
                        ))}
                        {liveSignals.terms.slice(0, 6).map((value) => (
                          <span key={"term-" + value}>{value}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="live-memory-actions">
                    <button
                      type="button"
                      className="dd-primary"
                      disabled={
                        savingHistory ||
                        phase !== "idle" ||
                        recentCues.every((cue) => cue.response.sample)
                      }
                      onClick={() => void saveLiveConversation()}
                    >
                      <Icon name="book" size={18} />
                      {savingHistory ? "저장 중" : "이번 대화 저장"}
                    </button>
                    {onPractice && (
                      <button
                        type="button"
                        className="dd-secondary"
                        disabled={phase !== "idle"}
                        onClick={() => {
                          if (!directEntry) cancel();
                          onPractice();
                        }}
                      >
                        <Icon name="chat" size={18} />
                        이 흐름으로 다시 연습
                      </button>
                    )}
                    {onRecords && partnerHistoryCount > 0 && (
                      <button
                        type="button"
                        className="dd-link"
                        onClick={onRecords}
                      >
                        같은 상대 기록 보기
                        <Icon name="arrow" size={16} />
                      </button>
                    )}
                  </div>
                  {recentCues.every((cue) => cue.response.sample) && (
                    <p className="vn-caption">
                      샘플 대화는 내 기록에 저장하지 않아요.
                    </p>
                  )}
                  {historyStatus && (
                    <p className="live-history-status" role="status">
                      {historyStatus}
                    </p>
                  )}
                </section>
              );

  return (
    <div
      className={"dd-live dc-live-app" + (directEntry ? " dc-quick-help" : "")}
      data-coach-phase={liveActive ? "listening" : phase}
    >
      <SamplePreview
        open={samplePreviewOpen}
        onClose={() => setSamplePreviewOpen(false)}
      />
      <nav className="purpose-breadcrumb" aria-label="현재 코칭 위치">
        <button
          className="dd-back"
          onClick={() => {
            if (!directEntry) cancel();
            onBack();
          }}
        >
          <Icon name="back" size={18} />
          {directEntry ? "홈으로" : "대화 카드로"}
        </button>
        <span className="breadcrumb-separator" aria-hidden="true">
          /
        </span>
        <span aria-current="location">실시간 대화 도움</span>
      </nav>
      <header className="dc-live-heading">
        <div>
          {!directEntry && (
            <p className="dc-overline">
              {prepared ? "내 옆의 대화 코치" : "시작하기 전에"}
            </p>
          )}
          <h1>실시간 대화 도움</h1>
          {directEntry && (
            <p>
              상대 말을 들으면 지금 필요한 다음 한마디를 바로 제안해요.
              짧게 듣기와 직접 입력은 필요할 때 사용할 수 있어요.
            </p>
          )}
        </div>
      </header>
      {!consent && (
        <section className="live-entry-consent" aria-label="AI 사용 전 한 번 확인">
          <div className="live-entry-consent-copy">
            <span>처음 한 번만 확인해요</span>
            <strong>AI 대화 도움을 사용하려면 전송 동의가 필요해요.</strong>
            <p>
              음성·문장은 코칭을 위해 Gemini에 전송돼요. 실시간 자막을 쓰면
              브라우저 음성 인식 서비스가 음성을 글로 바꿔요. 동의하면 이번 이용
              중 다시 묻지 않고, 마이크 권한은 실제 기능을 누를 때 Safari·Chrome이
              별도로 물어봐요.
            </p>
          </div>
          <AIConsent
            config={config}
            checked={consent}
            onChange={setConsent}
            disabled={phase !== "idle" || liveActive}
            priority={-10}
          />
        </section>
      )}
      {(!directEntry || phase !== "idle" || liveActive || result) && (
        <div
          className="coach-live-presence"
          aria-label="코치 상태"
          role="status"
        >
          <Companion
            small
            mood={
              liveActive || phase === "listening"
                ? "listen"
                : phase === "coaching" || phase === "transcribing"
                  ? "think"
                  : result
                    ? "done"
                    : "rest"
            }
          />
          <div>
            <strong>
              {liveActive || phase === "listening"
                ? "상대 말을 듣고 있어요"
                : phase === "coaching"
                  ? "내 목표에 맞는 말을 찾고 있어요"
                  : phase === "transcribing"
                    ? "들린 말을 확인하고 있어요"
                    : result
                      ? "다음 한마디가 도착했어요"
                      : "필요한 순간, 함께 준비해요"}
            </strong>
            <span
              className={
                "mic-status " +
                (liveActive || phase === "listening" ? "is-listening" : "")
              }
            >
              <i aria-hidden="true" />
              {liveActive ? "듣는 중 · 상대 말과 다음 한마디" : status}
            </span>
          </div>
        </div>
      )}
      {!prepared ? (
        <section className="dc-preflight">
          <div className="dc-preflight-intro">
            <Companion small mood="listen" />
            <div>
              <h2>{character.name}와 함께 준비해요.</h2>
              <p>상대 말을 듣고, 내 목표에 맞는 문장을 준비해요.</p>
            </div>
          </div>
          {profile ? (
            <div className="dc-context-brief">
              <span>
                <Icon name="cards" size={17} />
                {profile.title}
              </span>
              <p>{profile.goal}</p>
            </div>
          ) : (
            <label>
              상황
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
              >
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="dc-tone-label">
            내 말투
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
            >
              {tones.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <div className="dc-use-hint">
            <Icon name="mic" size={18} />
            <p>
              대면 또는 <strong>다른 기기의 스피커폰 옆</strong>에서 사용해요.
              {supportsLive
                ? " 자막을 보며 계속 듣고, 말이 정리되면 코칭받아요."
                : " 이 브라우저에서는 최대 4초씩 녹음해요. 이 방식은 처리 중에는 마이크가 꺼져요. 직접 입력도 가능해요."}
            </p>
          </div>
          <AIConsent
            config={config}
            checked={consent}
            onChange={setConsent}
            disabled={phase !== "idle" || liveActive}
          />
          {!config.available && (
            <p className="dd-notice">
              AI 연결을 확인하고 있어요. 기다리는 동안 아래에서 준비된 상황을
              샘플로 체험할 수 있어요.
            </p>
          )}
          <button
            className="dd-primary dd-full"
            aria-describedby="live-start-reason"
            disabled={!allowed || !config.available}
            onClick={() => {
              setPrepared(true);
            }}
          >
            이 설정으로 시작
            <Icon name="arrow" size={19} />
          </button>
          {(!allowed || !config.available) && (
            <p id="live-start-reason" className="action-reason" role="status">
              {!consent
                ? "위의 AI 전송 동의에 체크하면 시작할 수 있어요. 동의 없이 샘플도 체험할 수 있어요."
                : "AI 연결을 확인한 뒤 시작할 수 있어요. 지금은 샘플로 체험해 보세요."}
            </p>
          )}
          <button
            className="dd-secondary dd-full"
            onClick={() => setSamplePreviewOpen(true)}
          >
            준비된 샘플 체험하기
          </button>
          <p className="dc-small-caption">
            AI 전송이나 동의 없이 사전 작성 예시로 체험해요.
          </p>
        </section>
      ) : (
        <>
          {!directEntry && (
            <div className="dc-session-bar">
              <span>
                <Icon name="cards" size={17} />
                {profile?.title ||
                  scenarios.find((s) => s.id === scenario)?.title}
              </span>
              <button
                className="dd-link"
                disabled={phase !== "idle" || liveActive}
                onClick={() => {
                  setPrepared(false);
                  setResult(null);
                }}
              >
                설정
              </button>
            </div>
          )}
          {!directEntry && (
            <SampleSwitch
              label="AI 없이 샘플 체험하기"
              description="준비된 가상 상황과 답변을 별도로 봐요. 입력한 대화는 그대로예요."
              checked={samplePreviewOpen}
              disabled={phase !== "idle" || liveActive}
              onChange={setSamplePreviewOpen}
            />
          )}
          {supportsLive && voiceStyle === "continuous" ? (
            <>
              <LiveSpeechPanel
                inputTabs={inputTabs}
                contextControl={contextControl}
                available={config.available}
                unavailableMessage={aiUnavailableMessage}
                onUseText={(text) => {
                  if (text.trim())
                    setInput((previous) =>
                      previous.trim() && previous.trim() !== text.trim()
                        ? previous.trim() + "\n" + text.trim()
                        : text.trim(),
                    );
                  setVoiceStyle("short");
                  setInputMode("text");
                  setNotice(
                    text.trim()
                      ? "인식된 자막을 가져왔어요. 내용을 확인한 뒤 답변 코칭을 요청해 주세요."
                      : "직접 입력으로 바꿨어요. 상대가 한 말을 적어 주세요.",
                  );
                }}
                consentControl={undefined}
                profile={profile}
                scenario={scenario}
                tone={tone}
                consent={consent}
                adult={adult}
                sample={sample}
                onActiveChange={setLiveActive}
                readyToStart={liveSetupComplete}
                onCue={(cue) =>
                  addRecentCue({
                    ...cue,
                    goal: profile?.goal,
                  })
                }
              />
            </>
          ) : (
            <div className={"dc-coaching-grid " + (result ? "has-result" : "")}>
              <section className="dc-listen-panel">
                {inputTabs}
                {directEntry && contextControl}
                {inputMode === "voice" && (
                  <div
                    className={
                      "dc-mic-stage " +
                      (phase === "listening" ? "is-listening" : "")
                    }
                  >
                    <Waveform active={phase === "listening"} />
                    <p role="status">{status}</p>
                    <button
                      type="button"
                      className="dc-mic-button"
                      aria-label={
                        phase === "listening"
                          ? "여기까지 듣기"
                          : "상대 말 4초 듣기"
                      }
                      disabled={
                        phase !== "listening" && phase !== "idle"
                      }
                      onClick={
                        phase === "listening"
                          ? finishRecording
                          : () => void listen()
                      }
                    >
                      <Icon
                        name={phase === "listening" ? "pause" : "mic"}
                        size={34}
                      />
                    </button>
                    <strong>
                      {phase === "listening"
                        ? "다 들었다면 눌러주세요"
                        : "눌러서 상대 말 듣기"}
                    </strong>
                    <span>
                      한 번에 최대 4초
                      <HelpTip label="마이크 사용 안내">
                        상대 말이 끝나면 버튼을 다시 눌러도 돼요. 인식된 문장을
                        확인한 뒤 코칭을 요청하세요. 자동 화자 구분은 지원하지
                        않아요.
                      </HelpTip>
                    </span>
                    {phase === "idle" && (!allowed || !config.voiceAvailable) && (
                      <div className="voice-availability-note" role="status">
                        {!allowed && (
                          <p className="dd-small">
                            AI 전송 동의를 확인한 뒤 마이크를 시작할 수 있어요.
                          </p>
                        )}
                        {!config.voiceAvailable && (
                          <>
                            <p className="dd-small">{voiceUnavailableMessage}</p>
                            <button
                              type="button"
                              className="dd-link"
                              disabled={phase !== "idle"}
                              onClick={() => setConfigAttempt((n) => n + 1)}
                            >
                              AI 연결 다시 확인
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {phase !== "idle" && (
                  <button
                    className="dd-secondary dd-full"
                    onClick={phase === "listening" ? finishRecording : cancel}
                  >
                    {phase === "listening"
                      ? "녹음 끝내고 음성 인식"
                      : "처리 취소"}
                  </button>
                )}
                {phase === "permission" && (
                  <button
                    className="dd-secondary dd-full"
                    onClick={() => {
                      cancel();
                      setInputMode("text");
                      setNotice(
                        "마이크 대기를 중단했어요. 상대 말을 직접 입력해 주세요.",
                      );
                    }}
                  >
                    기다리지 않고 직접 입력
                  </button>
                )}
                {(!directEntry || phase !== "idle" || notice) && (
                  <CompanionNudge
                    mood={
                      phase === "listening"
                        ? "listen"
                        : phase === "transcribing" || phase === "coaching"
                          ? "think"
                          : input
                            ? "done"
                            : "hello"
                    }
                    text={
                      phase === "listening"
                        ? "다 말했으면 녹음 끝내기를 눌러주세요."
                        : phase === "coaching"
                          ? "내 목표와 지킬 선을 보고 답변을 준비하고 있어요."
                          : notice ||
                            (inputMode === "text"
                              ? "상대가 방금 한 말을 아래에 적어주세요."
                              : "마이크를 누르고 한 문장을 들려주세요.")
                    }
                  />
                )}
                {clip && (
                  <div className="vn-live-clip">
                    <AudioPlayer clip={clip} />
                    {error && phase === "idle" && (
                      <button
                        className="dd-secondary"
                        onClick={() => void transcribeBlob(clip.blob)}
                      >
                        음성 인식 다시 시도
                      </button>
                    )}
                  </div>
                )}

                {(directEntry || inputMode === "text" || !!input) && (
                  <div className="dc-transcript">
                    <label htmlFor="live-text">
                      {inputMode === "text"
                        ? "상대가 어떤 말을 했나요?"
                        : "들린 말이 맞는지 확인해요"}
                    </label>
                    <textarea
                      id="live-text"
                      name="opponent"
                      maxLength={1000}
                      value={input}
                      disabled={phase !== "idle"}
                      onChange={(e) => {
                        setHistorySaved(false);
                        setInput(e.target.value);
                        setResult(null);
                      }}
                      placeholder="상대가 방금 한 말을 적어주세요."
                      rows={3}
                    />
                    <button
                      className={
                        (result ? "dd-secondary" : "dd-primary") + " dd-full"
                      }
                      disabled={
                        !allowed ||
                        !config.available ||
                        phase !== "idle" ||
                        input.trim().length < 2
                      }
                      onClick={() => void coach(input)}
                    >
                      {phase === "coaching"
                        ? "한마디를 준비하는 중"
                        : "다음 한마디 받기"}
                      <Icon name="arrow" size={18} />
                    </button>
                    {phase === "idle" && input.trim().length < 2 && (
                      <p className="action-reason">
                        상대가 한 말을 두 글자 이상 입력해 주세요.
                      </p>
                    )}
                    {directEntry && (!allowed || !config.available) && (
                      <p className="action-reason" role="status">
                        {!config.available
                          ? aiUnavailableMessage +
                            " 입력은 유지되며, 아래 샘플로 화면을 체험할 수 있어요."
                          : "AI 전송에 동의하면 다음 한마디를 받을 수 있어요."}
                        {!config.available && configState !== "loading" && (
                          <button
                            type="button"
                            className="dd-link"
                            disabled={phase !== "idle"}
                            onClick={() => setConfigAttempt((n) => n + 1)}
                          >
                            연결 다시 확인
                          </button>
                        )}
                      </p>
                    )}
                  </div>
                )}
                {directEntry && (
                  <div className="quick-sample-option">
                    <SampleSwitch
                      label="AI 없이 샘플 체험하기"
                      description="준비된 가상 상황과 답변을 별도로 봐요. 입력한 대화는 그대로예요."
                      checked={samplePreviewOpen}
                      disabled={phase !== "idle"}
                      onChange={setSamplePreviewOpen}
                    />
                    <p className="dd-small">
                      준비된 상황을 골라 예시를 봐요. 입력한 대화는 분석하지
                      않아요.
                    </p>
                  </div>
                )}
                {inputMode === "voice" && (
                  <details className="dc-auto-option">
                    <summary>더 빠르게 코칭받고 싶다면</summary>
                    <label className="dd-check">
                      <input
                        type="checkbox"
                        checked={automatic}
                        disabled={phase !== "idle"}
                        onChange={(e) => setAutomatic(e.target.checked)}
                      />
                      인식된 말 확인 없이 바로 코칭받기
                    </label>
                    <p className="dd-small">
                      내 목소리도 상대 말로 처리될 수 있어요.
                    </p>
                  </details>
                )}
                {error && (
                  <>
                    <p className="dd-error" role="alert">
                      {error}
                    </p>
                    <QuotaHelp error={error} />
                  </>
                )}
              </section>
              <aside
                className={
                  "dc-answer-panel " +
                  (result
                    ? "is-ready"
                    : directEntry && phase === "idle"
                      ? "quick-answer-empty"
                      : "")
                }
                ref={panel}
                aria-live="polite"
                aria-busy={phase === "coaching"}
              >
                <div className="dc-answer-heading">
                  <Icon name="chat" size={20} />
                  <span>지금 필요한 한마디</span>
                  {result?.sample ? (
                    <SampleNotice sample={result.sample} compact badge />
                  ) : result ? (
                    <span className="dc-ai-label">AI 제안</span>
                  ) : null}
                </div>
                {result ? (
                  <>
                    {result.sample && (
                      <p className="dc-sample-context" role="status">
                        {result.sample.outage.reason === "manual"
                          ? "AI를 사용하지 않는 예시 모드예요."
                          : "AI 답변을 받지 못해 미리 작성한 예시를 보여드려요."}{" "}
                        현재 대화를 분석한 결과가 아니에요.
                      </p>
                    )}
                    <p className="dc-answer-label">
                      {result.sample
                        ? "참고할 표현 예시"
                        : "다음 한마디"}
                    </p>
                    {profile && (
                      <p className="dc-answer-goal">
                        <Icon name="target" size={14} />
                        <span>내 목표 · {profile.goal}</span>
                      </p>
                    )}
                    <blockquote
                      className="coach-reply-arrival"
                      key={result.suggestion}
                    >
                      {result.suggestion}
                    </blockquote>
                    {!result.sample && (
                      <div
                        className="dc-answer-variants"
                        role="group"
                        aria-label="답변 말투 바꾸기"
                      >
                        <span>이 한마디를</span>
                        {([
                          { id: "warm", label: "부드럽게" },
                          { id: "firm_polite", label: "분명하게" },
                          { id: "cold", label: "짧게" },
                        ] as { id: Tone; label: string }[]).map((option) => (
                          <button
                            type="button"
                            key={option.id}
                            className={tone === option.id ? "active" : ""}
                            aria-pressed={tone === option.id}
                            disabled={phase !== "idle" || input.trim().length < 2}
                            onClick={() => {
                              setTone(option.id);
                              if (directEntry)
                                setQuickContext((current) => ({
                                  ...current,
                                  tone: option.id,
                                }));
                              void coach(input, option.id);
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="dc-answer-actions">
                      <button
                        className="dd-primary"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              result.suggestion,
                            );
                            setCopied(true);
                          } catch {
                            setError(
                              "복사하지 못했어요. 문장을 길게 눌러 복사해 주세요.",
                            );
                          }
                        }}
                      >
                        <Icon name={copied ? "check" : "cards"} size={17} />
                        {copied ? "복사했어요" : "문장 복사"}
                      </button>
                      <button
                        className="dd-secondary"
                        disabled={phase !== "idle"}
                        onClick={() => {
                          setResult(null);
                          setInput("");
                          setCopied(false);
                        }}
                      >
                        다음 말 준비
                        <Icon name="arrow" size={16} />
                      </button>
                    </div>
                    {!result.sample && (
                      <details className="dc-evidence">
                        <summary>왜 이 문장을 제안했나요?</summary>
                        <p>
                          <strong>상대 말에서 확인한 표현</strong>
                        </p>
                        <q>{result.evidence}</q>
                        <p>
                          <strong>AI의 제안 이유</strong> · {result.reason}
                        </p>
                        <small>
                          {result.provider} · {result.model} · 코칭{" "}
                          {(result.latencyMs / 1000).toFixed(1)}초
                        </small>
                      </details>
                    )}
                    <p className="dc-answer-footnote">
                      상황에 맞는지 확인하고, 내 말로 전하세요.
                    </p>
                  </>
                ) : (
                  <div className="dc-answer-wait">
                    {profile && (
                      <div className="live-goal-brief">
                        <h2>이번 대화에서 기억할 것</h2>
                        <p>
                          <strong>원하는 결과</strong>
                          {profile.goal}
                        </p>
                        {profile.boundaries && (
                          <p className="live-boundary">
                            <strong>지킬 선</strong>
                            {profile.boundaries}
                          </p>
                        )}
                      </div>
                    )}
                    <Companion
                      small
                      mood={
                        phase === "coaching" || phase === "transcribing"
                          ? "think"
                          : "listen"
                      }
                    />
                    <h2>
                      {phase === "coaching"
                        ? "내 목표에 맞게 생각 중이에요"
                        : "듣고 나서, 함께 생각해요"}
                    </h2>
                    <p>
                      {phase === "coaching"
                        ? "잠시만 기다려 주세요."
                        : "상대의 말을 전달하면\n이곳에 다음 한마디가 나타나요."}
                    </p>
                  </div>
                )}
              </aside>

            </div>
          )}
          {liveMemoryPanel}
          <details className="dc-pause-guide">
            <summary>
              <Icon name="pause" size={17} />
              지금 당장 말문이 막혔다면
            </summary>
            <blockquote>“잠시만요. 생각해 보고 말씀드릴게요.”</blockquote>
            <small>
              잠깐 여유를 만드는 기본 문장입니다. AI 분석 결과가 아니에요.
            </small>
          </details>
        </>
      )}
      {onPractice && (
        <button
          className="dd-link"
          disabled={phase !== "idle"}
          onClick={() => {
            if (!directEntry) cancel();
            onPractice();
          }}
        >
          {directEntry ? "AI 상대와 대화 연습하기" : "이 상황으로 연습하기"}{" "}
          <Icon name="chat" size={18} />
        </button>
      )}
    </div>
  );
}
