"use client";
import { useEffect, useState } from "react";
import { Icon } from "./CompanionUI";
import { readCards } from "@/lib/conversation-cards";
import { listSessions, listTerms } from "@/lib/voice-notebook";
export default function StorageStatus({
  onRestore,
  onCards,
  onRecords,
  onTerms,
}: {
  onRestore: () => Promise<void>;
  onCards: () => void;
  onRecords: () => void;
  onTerms: () => void;
}) {
  const [counts, setCounts] = useState<number[] | null>(null),
    [persistent, setPersistent] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      listSessions(),
      listTerms(),
      navigator.storage?.persisted?.() ?? false,
    ])
      .then(([sessions, terms, kept]) => {
        if (!active) return;
        setPersistent(kept);
        setCounts([
          readCards().filter((c) => !c.isSample).length,
          sessions.filter((s) => !s.isSample).length,
          terms.filter((t) => !t.isSample).length,
        ]);
      })
      .catch(() => {
        if (active)
          setNotice(
            "저장소 상태를 읽지 못했어요. 브라우저 저장 권한을 확인해 주세요.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  async function protect() {
    setBusy(true);
    try {
      if (!navigator.storage?.persist) {
        setNotice(
          "이 브라우저에서는 보관 보호를 요청할 수 없어요. 중요한 기록은 파일로 내려받아 주세요.",
        );
        return;
      }
      const granted = await navigator.storage.persist();
      setPersistent(granted);
      setNotice(
        granted
          ? "보관 보호가 적용됐어요. 직접 브라우저 데이터를 삭제하는 경우에는 지워져요."
          : "브라우저가 보관 보호를 허용하지 않았어요. 현재 저장된 기록은 그대로예요. 중요한 기록은 내려받아 주세요.",
      );
    } catch {
      setNotice("보관 보호 상태를 확인하지 못했어요. 기존 저장은 유지돼요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="dc-storage-panel" aria-labelledby="storage-title">
      <div className="dc-section-heading">
        <h2 id="storage-title">
          <Icon name="shield" size={20} /> 내 데이터 보관
        </h2>
        <span className="dc-storage-badge">이 브라우저에 저장</span>
      </div>
      <p>
        저장한 카드·음성·문자·용어는 새로고침하거나 다시 방문해도 남아요.
        계정이나 다른 기기로 자동 동기화되지는 않아요.
      </p>
      {counts && (
        <p className="dc-storage-counts">
          내 카드 {counts[0]}개 · 내 대화 기록 {counts[1]}개 · 내 용어{" "}
          {counts[2]}개 <small>샘플 제외</small>
        </p>
      )}
      <details>
        <summary>어떤 경우에 사라지나요?</summary>
        <p>
          직접 삭제하거나 브라우저의 사이트 데이터를 지우면 사라져요. 시크릿
          모드는 종료할 때 지워질 수 있고, 저장 공간이 부족하면 브라우저가
          정리할 수 있어요. 임시 입력과 실시간 코칭 내용은 저장되지 않아요. 음성
          기록에서는 ‘저장’, 카드에서는 ‘카드 저장’을 눌러주세요.
        </p>
        <p>
          다른 브라우저나 다른 사이트 주소에서는 이 기록이 보이지 않아요. 음성은
          각 재생기에서, 대화 문자는 기록 하단에서, 용어는 용어 노트에서
          내려받을 수 있어요.
        </p>
      </details>
      <div className="dc-storage-actions">
        <button
          className="dd-secondary"
          disabled={busy || persistent}
          onClick={() => void protect()}
        >
          {persistent ? "보관 보호 적용됨" : "브라우저에 보관 보호 요청"}
        </button>
        <button className="dd-link" onClick={onCards}>
          카드 내려받기
        </button>
        <button className="dd-link" onClick={onRecords}>
          음성·문자 기록 열기
        </button>
        <button className="dd-link" onClick={onTerms}>
          용어 내보내기
        </button>
      </div>
      <div className="dc-sample-settings">
        <div>
          <strong>샘플은 직접 지울 때까지 남아요</strong>
          <p>
            가상의 카드 2개 · 대화 기록 1개 · 용어 3개. 삭제한 샘플만 다시
            추가할 수 있어요. 수정한 샘플과 내 데이터는 유지돼요.
          </p>
        </div>
        <button
          className="dd-secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onRestore();
              setNotice("없는 샘플을 다시 추가했어요. 기존 내용은 그대로예요.");
            } catch (e) {
              setNotice(
                e instanceof Error ? e.message : "샘플을 복원하지 못했어요.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          샘플 다시 넣기
        </button>
      </div>
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
