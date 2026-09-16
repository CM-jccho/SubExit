"use client";
import { useEffect, useState } from "react";
import { Companion, Icon } from "./CompanionUI";
export default function CompanionNudge({
  mood = "hello",
  text,
  dismissible = false,
}: {
  mood?: "hello" | "listen" | "done" | "think" | "speak" | "rest";
  text: string;
  dismissible?: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => setDismissed(false), [text]);
  if (dismissed) return null;
  return (
    <div className={"vn-nudge state-" + mood} role="status">
      <Companion small mood={mood} />
      <span>
        <small>곁이</small>
        {text}
      </span>
      {dismissible && (
        <button
          type="button"
          className="vn-icon"
          aria-label="곁이 안내 닫기"
          onClick={() => setDismissed(true)}
        >
          <Icon name="close" size={15} />
        </button>
      )}
    </div>
  );
}
