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

// Authorization belongs to this app visit, never to a saved conversation.
// Deliberately memory-only: reloading/closing the page starts a new visit.
export function ConsentSessionProvider({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState(false);
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
            Google Gemini로 보내는 데 동의했어요.
          </p>
          <p>
            화면을 이동해도 다시 묻지 않아요. 새로고침하거나 페이지를 닫으면
            초기화돼요. 동의는 대화 기록에 저장하지 않아요.
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
