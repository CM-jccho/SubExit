"use client";
import {
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

export default function InputDialog({
  open,
  title,
  busy = false,
  onClose,
  focusTarget,
  className = "",
  closeLabel,
  showCloseButton = true,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  busy?: boolean;
  onClose: () => void;
  focusTarget?: RefObject<HTMLElement>;
  className?: string;
  closeLabel?: string;
  showCloseButton?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    body = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const viewport = window.visualViewport;
    const resize = () => {
      element.style.setProperty(
        "--input-height",
        `${viewport?.height || window.innerHeight}px`,
      );
      element.style.setProperty("--input-top", `${viewport?.offsetTop || 0}px`);
      // Scroll only the content pane; never pan the page or hide the header.
      const pane = body.current;
      const active = document.activeElement;
      if (
        pane &&
        active instanceof window.HTMLElement &&
        pane.contains(active)
      ) {
        const bounds = pane.getBoundingClientRect();
        const field = active.getBoundingClientRect();
        const label = active.closest("label")?.getBoundingClientRect();
        const top = Math.min(field.top, label?.top ?? field.top);
        if (top < bounds.top + 8 || field.bottom > bounds.bottom - 8) {
          pane.scrollTop += top - bounds.top - 8;
        }
      }
    };
    resize();
    document.body.style.overflow = "hidden";
    element.showModal();
    // Opening a mobile dialog should not summon the keyboard before the user
    // chooses typing, recording, or a file. Desktop keeps its typing shortcut.
    const mobile = window.matchMedia?.(
      "(max-width: 600px), (pointer: coarse)",
    )?.matches;
    (mobile ? heading.current : focusTarget?.current || heading.current)?.focus(
      {
        preventScroll: true,
      },
    );
    // Keep Tab within the dialog instead of handing the last control to browser
    // chrome. The native modal still provides background inertness and Escape.
    const cycleFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || event.ctrlKey || event.altKey || event.metaKey)
        return;
      if ((event.target as HTMLElement)?.closest("dialog") !== element) return;
      const controls = Array.from(
        element.querySelectorAll<HTMLElement>(
          'button, a[href], input, select, textarea, summary, [tabindex], [contenteditable="true"]',
        ),
      ).filter((node) => {
        if (
          node.tabIndex < 0 ||
          node.matches(':disabled, [type="hidden"]') ||
          node.closest('[hidden], [inert], [aria-hidden="true"]')
        )
          return false;
        const collapsed = node.closest("details:not([open])");
        if (collapsed && node !== collapsed.querySelector("summary"))
          return false;
        for (
          let parent: HTMLElement | null = node;
          parent && parent !== element;
          parent = parent.parentElement
        ) {
          const style = window.getComputedStyle(parent);
          if (style.display === "none" || style.visibility === "hidden")
            return false;
        }
        return true;
      });
      const first = controls[0],
        last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
        heading.current?.focus({ preventScroll: true });
      } else if (!controls.includes(document.activeElement as HTMLElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    element.addEventListener("keydown", cycleFocus);
    window.addEventListener("resize", resize);
    element.addEventListener("focusin", resize);
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    return () => {
      element.removeEventListener("keydown", cycleFocus);
      window.removeEventListener("resize", resize);
      element.removeEventListener("focusin", resize);
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      element.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, focusTarget]);
  return (
    <dialog
      ref={dialog}
      className={`input-dialog ${className}`}
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      {open && (
        <>
          <header className="input-dialog-head">
            <h2 id={titleId} ref={heading} tabIndex={-1}>
              {title}
            </h2>
            {showCloseButton &&
              (busy ? (
                <span className="input-dialog-busy" role="status">
                  처리 중
                </span>
              ) : (
                <button
                  type="button"
                  className="dd-link"
                  onClick={onClose}
                  aria-label={closeLabel || `${title} 닫기`}
                >
                  닫기
                </button>
              ))}
          </header>
          <div ref={body} className="input-dialog-body">
            {children}
          </div>
          {footer && <footer className="input-dialog-footer">{footer}</footer>}
        </>
      )}
    </dialog>
  );
}
