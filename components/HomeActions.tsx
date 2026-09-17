"use client";
import { useEffect, useState } from "react";
import { practiceModes } from "@/lib/practice-modes";
import { listSessions, type VoiceSession } from "@/lib/voice-notebook";
import type { WorkspaceView } from "@/lib/workspace-navigation";
import { Icon } from "./CompanionUI";

export default function HomeActions({
  onNavigate,
  onResume,
}: {
  onNavigate: (view: WorkspaceView) => void;
  onResume: (id: string) => void;
}) {
  const [recent, setRecent] = useState<VoiceSession>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    listSessions()
      .then((rows) => {
        if (active)
          setRecent(
            rows
              .filter((r) => !r.isSample)
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0],
          );
      })
      .catch(() => {
        if (active)
          setError(
            "최근 기록을 불러오지 못했어요. 내 기록에서 다시 확인해 주세요.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="purpose-home" aria-label="연습 시작">
      <div className="purpose-heading">
        <p>내 말을 준비하는 시간</p>
        <h1>어떤 연습을 해볼까요?</h1>
      </div>
      <div className="purpose-grid">
        {practiceModes.map((mode) => (
          <button
            key={mode.id}
            className={`purpose-card tone-${mode.color}`}
            data-purpose={mode.id}
            aria-label={mode.label}
            onClick={() => onNavigate(mode.id)}
          >
            <span className="purpose-card-art" aria-hidden="true">
              <Icon name={mode.icon} size={32} />
              <span>{mode.hint}</span>
            </span>
            <strong>{mode.label}</strong>
            <span className="purpose-description">{mode.description}</span>
            <span className="purpose-card-arrow" aria-hidden="true">
              <Icon name="arrow" size={20} />
            </span>
          </button>
        ))}
      </div>
      {recent && (
        <section className="purpose-recent" aria-label="최근 기록 이어하기">
          <span>이어서 해볼까요?</span>
          <button onClick={() => onResume(recent.id)}>
            <strong>{recent.title}</strong>
            <Icon name="arrow" size={20} />
          </button>
        </section>
      )}
      {error && (
        <p role="status" className="vn-caption">
          {error}
        </p>
      )}
    </section>
  );
}
