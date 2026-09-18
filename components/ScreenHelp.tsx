"use client";
import InputDialog from "./InputDialog";
import type {
  WorkspacePurpose,
  WorkspaceView,
} from "@/lib/workspace-navigation";

type Help = { title: string; text: string; action: string };
const content: Record<WorkspaceView, Help> = {
  home: {
    title: "어떤 도움이 필요하세요?",
    text: "대화 중 말이 막혔다면 ‘답변 추천받기’, 미리 준비하려면 ‘대화 연습하기’를 골라주세요.",
    action: "홈에서 선택하기",
  },
  library: {
    title: "연습할 상황을 골라주세요",
    text: "카드를 누르면 상대와 대화 목표를 확인할 수 있어요. 예시로 바로 시작하거나 ‘내 상황 만들기’로 직접 준비해 보세요.",
    action: "돌아가서 상황 고르기",
  },
  detail: {
    title: "상대와 목표를 확인해 주세요",
    text: "내 상황에 맞으면 아래 연습 버튼을 눌러주세요. 바꾸고 싶은 내용은 먼저 수정할 수 있어요.",
    action: "상황 확인 이어하기",
  },
  setup: {
    title: "하고 싶은 말을 편하게 적어주세요",
    text: "누구와 어떤 대화를 할지, 원하는 결과가 무엇인지 알려주세요. 작성한 내용은 저장 전에 고칠 수 있어요.",
    action: "이어서 입력하기",
  },
  voicePractice: {
    title: "상대 말에 한마디 답해보세요",
    text: "직접 답하거나 답변 후보를 골라 보낼 수 있어요. 시작 전이라면 샘플 또는 AI 모드를 고른 뒤 연습을 시작해 주세요.",
    action: "대화 연습으로 돌아가기",
  },
  live: {
    title: "상대가 한 말을 알려주세요",
    text: "말을 들려주거나 직접 입력하면 내 목표에 맞는 다음 한마디를 도와드려요. 마이크 연결이 어렵다면 직접 입력으로 이어가세요.",
    action: "대화 도움으로 돌아가기",
  },
  quick: {
    title: "방금 들은 말부터 알려주세요",
    text: "상대의 말을 입력하거나 들려주세요. 상대·목표는 필요할 때만 바꿀 수 있어요. AI 전송에 동의한 뒤 ‘다음 한마디 받기’를 누르면 됩니다.",
    action: "입력 이어하기",
  },
  recording: {
    title: "대화를 남기고 돌아보세요",
    text: "녹음·파일 또는 문자로 기록을 남기세요. 코칭을 받기 전에는 변환된 문자와 누가 한 말인지 확인해 주세요.",
    action: "기록 작성 이어하기",
  },
  records: {
    title: "저장한 대화를 다시 꺼내보세요",
    text: "목록에서 기록을 선택하면 대화 내용과 코칭을 다시 볼 수 있어요. 열어둔 기록이 있다면 그 자리에서 이어가세요.",
    action: "내 기록으로 돌아가기",
  },
  terms: {
    title: "기억하고 싶은 표현을 모아보세요",
    text: "‘용어 추가’로 직접 적거나 ‘분야별 표현 찾기’에서 골라 저장하세요. 저장한 표현은 ‘내 노트’에서 다시 볼 수 있어요.",
    action: "용어 노트로 돌아가기",
  },
  messenger: {
    title: "받은 메시지를 알려주세요",
    text: "메시지와 원하는 답장 방향을 입력하면 초안을 준비해 드려요. 내 말투로 고친 뒤 복사하거나 저장하세요.",
    action: "답장 준비 이어하기",
  },
  room: {
    title: "연습할 대화 상대를 골라주세요",
    text: "상대를 선택해 대화를 시작하거나 원하는 역할의 상대를 직접 만들 수 있어요.",
    action: "상대 선택 이어하기",
  },
  friendChat: {
    title: "편하게 한마디 건네보세요",
    text: "말하거나 글로 입력해 대화를 이어가세요. 답변을 준비하는 동안에는 현재 대화창에서 기다려주세요.",
    action: "대화로 돌아가기",
  },
  training: {
    title: "짧은 연습부터 시작해 보세요",
    text: "연습할 항목을 선택하고 안내에 따라 내 답을 입력하세요. 피드백을 읽고 다시 시도할 수 있어요.",
    action: "연습으로 돌아가기",
  },
  daily: {
    title: "가벼운 대화부터 연습해 보세요",
    text: "화면에서 대화 주제를 선택하고 내 답을 적어보세요. 부담 없이 짧은 문장으로 시작해도 괜찮아요.",
    action: "연습으로 돌아가기",
  },
  prompts: {
    title: "AI에게 원하는 결과를 알려주세요",
    text: "하려는 일과 필요한 조건을 구체적으로 적어보세요. 결과를 확인하고 요청을 고쳐 연습할 수 있어요.",
    action: "요청 작성 이어하기",
  },
  demo: {
    title: "예시를 내 상황에 맞게 바꿔보세요",
    text: "상대·상황·목표를 살펴본 뒤 ‘이 예시로 내 카드 만들기’를 눌러 수정할 수 있어요.",
    action: "예시로 돌아가기",
  },
  more: {
    title: "필요한 도구를 골라주세요",
    text: "메시지 답장, 용어 노트, AI 대화 상대를 여기서 열 수 있어요. 처음부터 따라 하려면 ‘사용·저장 안내’를 선택하세요.",
    action: "도구 선택하기",
  },
  guide: {
    title: "필요한 안내만 확인하세요",
    text: "사용 방법과 기록 저장 위치를 확인할 수 있어요. 순서대로 체험하려면 ‘직접 해보는 30초 가이드’를 선택하세요.",
    action: "안내로 돌아가기",
  },
};
export default function ScreenHelp({
  view,
  purpose,
  choosingFocus,
  onClose,
}: {
  view: WorkspaceView;
  purpose: WorkspacePurpose;
  choosingFocus: boolean;
  onClose: () => void;
}) {
  const help =
    view === "library" && choosingFocus
      ? {
          title: "어떤 대화를 준비하시나요?",
          text: "직장, 친구·가족 등 가까운 상황을 선택해 주세요. 맞는 분야가 없으면 직접 상황을 만들 수 있어요.",
          action: "돌아가서 관심 상황 고르기",
        }
      : view === "library" && purpose === "live"
        ? {
            title: "지금 나누는 대화와 가까운 상황을 골라주세요",
            text: "선택한 상대와 목표를 바탕으로 다음 한마디를 도와드려요. 맞는 예시가 없으면 ‘내 상황 만들기’를 눌러주세요.",
            action: "돌아가서 상황 고르기",
          }
        : view === "detail" && purpose === "live"
          ? {
              title: "지금 대화의 목표를 확인해 주세요",
              text: "상대와 목표가 맞으면 ‘답변 추천받기’를 눌러주세요. 상황이 다르면 먼저 수정할 수 있어요.",
              action: "상황 확인 이어하기",
            }
          : content[view];
  return (
    <InputDialog
      open
      title="이 화면 사용법"
      className="screen-help"
      showCloseButton={false}
      onClose={onClose}
    >
      <h3>{help.title}</h3>
      <p>{help.text}</p>
      <button className="dd-primary dd-full" onClick={onClose}>
        {help.action}
      </button>
    </InputDialog>
  );
}
