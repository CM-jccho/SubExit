"use client";
import { useEffect, useState } from "react";
import { useCompanion } from "./CompanionTheme";
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
  const character = useCompanion();
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => setDismissed(false), [text, character.id]);
  if (dismissed) return null;
  return (
    <div className={"vn-nudge state-" + mood} role="status">
      <Companion small mood={mood} />
      <span>
        <small>{character.name}</small>
        {text}
      </span>
      {dismissible && (
        <button
          type="button"
          className="vn-icon"
          aria-label={character.name + " 안내 닫기"}
          onClick={() => setDismissed(true)}
        >
          <Icon name="close" size={15} />
        </button>
      )}
    </div>
  );
}
