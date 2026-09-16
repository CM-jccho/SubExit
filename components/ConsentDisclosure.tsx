"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./CompanionUI";
export default function ConsentDisclosure({
  complete,
  disabled,
  onRevoke,
  children,
}: {
  complete: boolean;
  disabled?: boolean;
  onRevoke: () => void;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const previous = useRef(complete),
    change = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (complete && !previous.current) {
      setExpanded(false);
      change.current?.focus({ preventScroll: true });
    }
    previous.current = complete;
  }, [complete]);
  return (
    <div className="dc-consent-disclosure">
      {complete && (
        <div className="dc-consent-summary">
          <span>
            <Icon name="check" size={15} /> AI 전송 동의 완료
          </span>
          <button
            ref={change}
            className="dd-link"
            aria-expanded={expanded}
            disabled={disabled}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "접기" : "내용 보기"}
          </button>
          <button
            className="dd-link"
            disabled={disabled}
            onClick={() => {
              onRevoke();
              setExpanded(false);
            }}
          >
            동의 철회
          </button>
        </div>
      )}
      {(!complete || expanded) && children}
    </div>
  );
}
