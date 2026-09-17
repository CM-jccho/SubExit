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
  children,
}: {
  open: boolean;
  title: string;
  busy?: boolean;
  onClose: () => void;
  focusTarget?: RefObject<HTMLElement>;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
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
    };
    resize();
    document.body.style.overflow = "hidden";
    element.showModal();
    (focusTarget?.current || heading.current)?.focus({ preventScroll: true });
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    return () => {
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
      className="input-dialog"
      aria-labelledby={titleId}
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
            <button
              type="button"
              className="dd-link"
              disabled={busy}
              onClick={onClose}
              aria-label={`${title} 닫기`}
            >
              닫기
            </button>
          </header>
          {children}
        </>
      )}
    </dialog>
  );
}
