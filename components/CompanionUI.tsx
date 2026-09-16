import type { CSSProperties } from "react";

export type IconName =
  | "home"
  | "cards"
  | "help"
  | "arrow"
  | "back"
  | "plus"
  | "search"
  | "mic"
  | "check"
  | "close"
  | "edit"
  | "shield"
  | "chat"
  | "download"
  | "send"
  | "keyboard"
  | "target"
  | "pause";
const paths: Record<IconName, string> = {
  home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z",
  cards: "M7 7h13v14H7z M3 17V3h13",
  help: "M9.2 8a3 3 0 1 1 5 2.2c-1.6 1-2.2 1.5-2.2 3 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  arrow: "M4 12h16 m-6-6 6 6-6 6",
  back: "M20 12H4 m6-6-6 6 6 6",
  plus: "M12 5v14 M5 12h14",
  search: "m16 16 5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  mic: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0z M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3 M8 22h8",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12 M6 18 18 6",
  edit: "m4 16 12-12 4 4L8 20H4z M13 7l4 4",
  shield: "m12 2 8 3v6c0 5-8 10-8 10S4 16 4 11V5z m-4 9 3 3 5-6",
  chat: "M21 11c0 5-4 8-9 8H7l-5 3 1-7a8 8 0 0 1-1-4c0-5 4-9 10-9s9 4 9 9 M7 10h.01 M12 10h.01 M17 10h.01",
  download: "M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5",
  send: "m3 3 19 9-19 9 4-9z M7 12h15",
  keyboard: "M2 5h20v14H2z M6 9h.01 M10 9h.01 M14 9h.01 M18 9h.01 M7 15h10",
  target: "M21 12a9 9 0 1 1-9-9 M17 12a5 5 0 1 1-5-5 M12 12l9-9 M16 3h5v5",
  pause: "M8 5v14 M16 5v14",
};
export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

// An original, lightweight vector companion. Motion is limited to idle breathing.
export function Companion({
  mood = "hello",
  small = false,
}: {
  mood?: "hello" | "listen" | "done";
  small?: boolean;
}) {
  return (
    <svg
      className={"dc-companion " + (small ? "is-small" : "") + " mood-" + mood}
      viewBox="0 0 280 230"
      fill="none"
      aria-hidden="true"
    >
      {!small && (
        <>
          <ellipse cx="142" cy="210" rx="87" ry="9" fill="#DCE0D4" />
          <path d="M38 176c-8-12-6-25-3-25 9 0 19 16 17 26" fill="#AEC4A3" />
          <path d="M48 182c2-18 12-25 16-22 5 6-4 21-13 27" fill="#6F9476" />
          <path
            d="M48 190v-27"
            stroke="#496A4F"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      )}
      <g className="dc-companion-body">
        <path
          d="M94 188c-12 4-16 14-10 19 7 5 28-2 35-12 M163 190c8 15 29 20 34 12 3-7-9-17-22-20"
          fill="#344B40"
        />
        <path
          d="M78 132c-15 4-22 20-13 26 6 4 16-3 24-10"
          fill="#C8D6AC"
          stroke="#344B40"
          strokeWidth="2.5"
        />
        <path
          d={
            mood === "hello"
              ? "M191 119c13-1 21-17 29-12 10 8-6 31-22 34"
              : "M190 132c18-2 25 13 18 20-7 5-16-2-22-8"
          }
          fill="#C8D6AC"
          stroke="#344B40"
          strokeWidth="2.5"
        />
        <path
          d="M80 95c0-37 25-59 59-59s62 23 63 59l3 59c1 29-26 46-63 46-38 0-66-16-65-44z"
          fill="#CFDDB9"
          stroke="#344B40"
          strokeWidth="2.5"
        />
        <path
          d="M93 139c18 10 72 11 95-1l2 35c-11 16-29 21-49 21-22 0-39-6-50-19z"
          fill="#F9F6E7"
        />
        <path
          d="M86 142c23 12 73 16 110 0"
          stroke="#344B40"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="m134 147 8 13 12-12"
          fill="#D67651"
          stroke="#344B40"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <g className="dc-companion-eyes" fill="#344B40">
          <ellipse cx="118" cy="104" rx="3.5" ry="5" />
          <ellipse cx="160" cy="104" rx="3.5" ry="5" />
        </g>
        <path
          d={mood === "done" ? "M128 117q12 16 23 0z" : "M131 119q9 7 18-1"}
          stroke="#344B40"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill={mood === "done" ? "#D67651" : "none"}
        />
        <ellipse cx="104" cy="118" rx="9" ry="4" fill="#E7AF8C" />
        <ellipse cx="176" cy="118" rx="9" ry="4" fill="#E7AF8C" />
        <path
          d="M110 47q13-15 28-8"
          stroke="#344B40"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>
      {!small && (
        <g className="dc-companion-note">
          <path
            d="M203 35h38a12 12 0 0 1 12 12v16a12 12 0 0 1-12 12h-18l-12 10 1-10h-9a12 12 0 0 1-12-12V47a12 12 0 0 1 12-12"
            fill="#FFFDF6"
            stroke="#344B40"
            strokeWidth="2"
          />
          {mood === "done" ? (
            <path
              d="m209 55 8 8 15-17"
              stroke="#507451"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ) : (
            <g fill="#D67651">
              <circle cx="208" cy="55" r="3" />
              <circle cx="221" cy="55" r="3" />
              <circle cx="234" cy="55" r="3" />
            </g>
          )}
        </g>
      )}
    </svg>
  );
}

export function HelpTip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <details className="dc-tip">
      <summary aria-label={label}>
        <Icon name="help" size={18} />
      </summary>
      <div className="dc-tip-content">
        <strong>{label}</strong>
        <p>{children}</p>
      </div>
    </details>
  );
}

export function Waveform({ active = false }: { active?: boolean }) {
  return (
    <span
      className={"dc-wave " + (active ? "is-active" : "")}
      aria-hidden="true"
    >
      {[8, 15, 24, 13, 31, 20, 11, 27, 17, 9, 21, 12].map((h, i) => (
        <i
          key={i}
          style={{ height: h, "--delay": `${i * 70}ms` } as CSSProperties}
        />
      ))}
    </span>
  );
}
