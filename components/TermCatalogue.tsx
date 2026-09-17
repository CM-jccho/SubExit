"use client";
import { focusInfo, type ConversationFocus } from "@/lib/conversation-focus";
import { useState } from "react";
import {
  termCatalogue,
  termGroups,
  schoolCompanion,
} from "@/lib/term-catalogue";
import type { TermNote } from "@/lib/voice-notebook";
import type { CompanionCharacter } from "@/lib/companions";
export default function TermCatalogue({
  onSelect,
  onAsk,
  focus = null,
}: {
  focus?: ConversationFocus | null;
  onSelect: (note: TermNote) => void;
  onAsk?: (c: CompanionCharacter) => void;
}) {
  const recommended: readonly string[] = focusInfo(focus)?.termGroups || [];
  const [group, setGroup] = useState(recommended.length ? "recommended" : ""),
    [query, setQuery] = useState("");
  const rows = termCatalogue.filter(
    (row) =>
      (!group ||
        group === row.group ||
        (group === "recommended" && recommended.includes(row.group))) &&
      [row.note.term, row.note.meaning, row.note.industry]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="learn-catalogue" aria-label="분야별 표현 둘러보기">
      <div className="vn-toolbar">
        <h2>분야별 표현 둘러보기</h2>
        <span>{termCatalogue.length}개 시작 예시</span>
      </div>
      <p>
        업무부터 학교·또래 대화까지. 필요한 표현을 골라 내 노트로 가져오세요.
      </p>
      <div className="learn-grid">
        <label className="vn-label">
          분야
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            {recommended.length > 0 && (
              <option value="recommended">
                {focusInfo(focus)?.label}에 맞는 분야
              </option>
            )}
            <option value="">모든 분야</option>
            {Object.entries(termGroups).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="vn-label">
          예시 표현 검색
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예: 최애, API, 피킹"
          />
        </label>
      </div>
      {(group === "teen" || group === "school") && (
        <div className="learn-callout">
          <strong>세대마다, 친구마다 말이 달라요.</strong>
          <p>
            ㅇㅈ·찐·꾸안꾸·최애는 여러 연령대에서 쓰는 온라인·일상 표현이에요.
            10대 전용 표현이나 최신 유행 순위가 아니에요. 문맥과 관계를 함께
            확인하세요.
          </p>
          {onAsk && (
            <button
              className="dd-secondary"
              onClick={() => onAsk(schoolCompanion)}
            >
              중학생 AI 역할에게 물어보기
            </button>
          )}
          <small>
            하루는 가상의 AI 역할이에요. 실제 중학생과 연결하지 않아요.
          </small>
        </div>
      )}
      <div className="learn-term-grid">
        {rows.map(({ note }) => (
          <button
            className="learn-term"
            key={note.id}
            onClick={() => onSelect(note)}
          >
            <small>{note.industry} · 작성 예시</small>
            <strong>{note.term}</strong>
            <span>{note.meaning}</span>
            <em>뜻 확인하고 내 노트에 추가 →</em>
          </button>
        ))}
      </div>
      {!rows.length && (
        <p role="status">
          일치하는 예시가 없어요. 내 노트에서 직접 추가할 수 있어요.
        </p>
      )}
    </section>
  );
}
