"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import InputDialog from "./InputDialog";

type Prompt = { id: string; priority: number; busy: boolean };
type SessionConsent = {
  allowed: boolean;
  setAllowed: (value: boolean) => void;
  prompts: Prompt[];
  register: (prompt: Prompt) => () => void;
};
const ConsentContext = createContext<SessionConsent | null>(null);

// Authorization belongs to this browser-tab visit, never to a saved conversation.
// Keep it across refreshes in the same tab, but clear it when the tab/session ends.
const SESSION_KEY = "speakcoaching-ai-consent-session-v1";

export function ConsentSessionProvider({ children }: { children: ReactNode }) {
  const [allowedState, setAllowedState] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "allowed")
        setAllowedState(true);
    } catch {}
  }, []);
  const setAllowed = useCallback((value: boolean) => {
    setAllowedState(value);
    try {
      if (value) sessionStorage.setItem(SESSION_KEY, "allowed");
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {}
  }, []);
  const allowed = allowedState;
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const register = useCallback((prompt: Prompt) => {
    setPrompts((items) => [...items.filter((p) => p.id !== prompt.id), prompt]);
    return () => setPrompts((items) => items.filter((p) => p.id !== prompt.id));
  }, []);
  return (
    <ConsentContext.Provider value={{ allowed, setAllowed, prompts, register }}>
      {children}
    </ConsentContext.Provider>
  );
}

export function useAIConsent(): [boolean, (value: boolean) => void] {
  const session = useContext(ConsentContext);
  const local = useState(false);
  return session ? [session.allowed, session.setAllowed] : local;
}

export function useConsentPrompt(
  complete: boolean,
  busy = false,
  priority = 1,
) {
  const session = useContext(ConsentContext);
  const id = useId();
  const register = session?.register;
  useEffect(
    () => register?.({ id, priority, busy }),
    [register, id, priority, busy],
  );
  if (!session) return true;
  if (complete) return false;
  const first = [...session.prompts].sort((a, b) => a.priority - b.priority)[0];
  return first?.id === id;
}

export function ConsentSettings() {
  const session = useContext(ConsentContext);
  const [open, setOpen] = useState(false);
  if (!session?.allowed) return null;
  const busy = session.prompts.some((p) => p.busy);
  return (
    <>
      <button
        type="button"
        className="consent-settings"
        disabled={busy}
        onClick={() => setOpen(true)}
        aria-label="AI 전송 동의 설정"
      >
        <span aria-hidden="true">✓</span>
        <span>AI 동의 완료</span>
      </button>
      <InputDialog
        open={open}
        title="AI 전송 동의"
        onClose={() => setOpen(false)}
      >
        <div className="consent-settings-content">
          <p>
            이번 이용 중 문자 변환·코칭·복기·용어 설명에 필요한 음성과 문장을
            Google Gemini로 보내는 데 동의했어요. 실시간 자막을 사용할 때는
            브라우저 음성 인식 서비스가 음성을 글로 바꾸는 과정도 포함돼요.
          </p>
          <p>
            화면을 이동하거나 새로고침해도 같은 탭에서는 다시 묻지 않아요. 탭을
            닫으면 초기화돼요. 동의는 대화 기록에 저장하지 않아요.
          </p>
          <p>
            개인정보·기밀 없는 자작 연습만 보내주세요. 다른 사람의 말을 보낼
            때에는 먼저 참여자에게 알리고 동의를 받아주세요.
          </p>
          <button
            className="dd-secondary"
            onClick={() => {
              session.setAllowed(false);
              setOpen(false);
            }}
          >
            동의 철회
          </button>
        </div>
      </InputDialog>
    </>
  );
}
