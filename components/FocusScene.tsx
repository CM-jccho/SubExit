import { Companion } from "./CompanionUI";
import { resolveCompanion } from "@/lib/companions";
import type { ConversationFocus } from "@/lib/conversation-focus";

// Decorative, original vector scenes: all choices remain native text-labelled buttons.
export default function FocusScene({
  focus = "all",
  compact = false,
}: {
  focus?: ConversationFocus;
  compact?: boolean;
}) {
  const general = focus === "all" || focus === "custom";
  const character = resolveCompanion(
    focus === "daily"
      ? "tori"
      : focus === "service" || focus === "education"
        ? "coco"
        : "dundi",
  );
  return (
    <div
      className={`focus-scene scene-${focus}${compact ? " is-compact" : ""}`}
      aria-hidden="true"
    >
      <svg className="focus-scene-backdrop" viewBox="0 0 360 230" fill="none">
        <path d="M38 195V107a90 90 0 0 1 180 0v88" fill="var(--scene-wall)" />
        <rect
          x="229"
          y="35"
          width="75"
          height="94"
          rx="36"
          fill="var(--scene-window)"
        />
        <path
          d="M266 37v90M231 84h72"
          stroke="var(--scene-paper)"
          strokeWidth="5"
        />
        <circle cx="285" cy="60" r="12" fill="#E7BA71" />
        <ellipse
          cx="177"
          cy="210"
          rx="155"
          ry="14"
          fill="var(--scene-shadow)"
        />
        {focus === "work" && (
          <g stroke="#55725C" strokeWidth="3" strokeLinejoin="round">
            <rect
              x="220"
              y="132"
              width="73"
              height="46"
              rx="4"
              fill="#F8F7EC"
            />
            <path d="m217 184 8-7h65l10 7z" fill="#A8B99A" />
            <path d="M239 146h30m-30 9h21" stroke="#BAC8AE" />
          </g>
        )}
        {focus === "service" && (
          <g>
            <path d="M236 118h39v56l-6-4-6 4-7-4-6 4-7-4-7 4z" fill="#FFFCF5" />
            <path
              d="M245 130h20m-20 9h20m-20 9h12"
              stroke="#C18E72"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M285 168h35m-31-4a13 13 0 0 1 26 0"
              stroke="#886946"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx="302" cy="148" r="3" fill="#886946" />
          </g>
        )}
        {focus === "education" && (
          <g>
            <rect
              x="212"
              y="115"
              width="93"
              height="57"
              rx="5"
              fill="#F9F7EF"
              stroke="#9E90B0"
              strokeWidth="3"
            />
            <path
              d="M258 119v48m-35-35h24m21 0h24m-69 12h24m21 0h18"
              stroke="#C5BBD0"
              strokeWidth="3"
            />
            <path
              d="m293 186 12-26"
              stroke="#D99466"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </g>
        )}
        {focus === "daily" && (
          <g>
            <path
              d="M228 151h75m-70 13h65m-62-28v56m60-56v56"
              stroke="#A38161"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M310 196v-40m0 23c-19-1-20-15-20-15 19-1 20 15 20 15m1-10c-1-18 14-24 14-24 8 18-14 24-14 24"
              fill="#9BAD87"
              stroke="#7B9166"
              strokeWidth="2"
            />
          </g>
        )}
        {general && (
          <g>
            <path
              d="M42 190v-38m0 22c-24 0-22-23-22-23 24 1 22 23 22 23m0-12c0-22 22-27 22-27 2 26-22 27-22 27"
              fill="#8DA882"
            />
            <path d="m30 185 3 25h20l3-25" fill="#C88E70" />
          </g>
        )}
      </svg>
      <div className="focus-scene-character">
        <Companion small character={character} mood="hello" />
      </div>
      {general && (
        <div className="focus-scene-friend">
          <Companion small character={resolveCompanion("tori")} mood="listen" />
        </div>
      )}
      <svg className="focus-scene-front" viewBox="0 0 360 230" fill="none">
        {general ? (
          <g>
            <path
              d="M139 191v25m84-25v25"
              stroke="#AA8665"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <ellipse cx="181" cy="187" rx="66" ry="13" fill="#DABB94" />
            <path d="M153 165h15v16h-15zm42 0h15v16h-15z" fill="#FFFAEB" />
            <path
              d="M168 168h4v8h-4m42-8h4v8h-4"
              stroke="#FFFAEB"
              strokeWidth="3"
            />
          </g>
        ) : (
          focus !== "daily" && (
            <g>
              <path
                d="M199 186h118m-110 3v25m100-25v25"
                stroke="#B49777"
                strokeWidth="7"
                strokeLinecap="round"
              />
            </g>
          )
        )}
        <g className="focus-scene-bubble">
          <path
            d="M118 31a12 12 0 0 1 12-12h61a12 12 0 0 1 12 12v22a12 12 0 0 1-12 12h-35l-16 11 3-11h-13a12 12 0 0 1-12-12z"
            fill="#FFFEF7"
            stroke="var(--scene-outline)"
            strokeWidth="2"
          />
          <circle cx="145" cy="43" r="3" fill="var(--scene-ink)" />
          <circle cx="160" cy="43" r="3" fill="var(--scene-ink)" />
          <circle cx="175" cy="43" r="3" fill="var(--scene-ink)" />
        </g>
      </svg>
    </div>
  );
}
