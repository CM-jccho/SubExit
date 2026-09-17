"use client";
import { useEffect } from "react";

// One viewport observer covers page forms, search, chat, and settings.
export default function MobileKeyboardViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let baseline = window.innerHeight;
    let open = false;
    let frame = 0;
    const isEditor = (element: Element | null): element is HTMLElement =>
      element instanceof window.HTMLElement &&
      element.matches(
        'textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="button"]):not([type="submit"]):not([type="hidden"]), [contenteditable="true"]',
      );
    const update = () => {
      const active = document.activeElement;
      const editing = isEditor(active);
      const mobile = window.matchMedia(
        "(max-width: 850px), (pointer: coarse)",
      ).matches;
      const height = viewport?.height || window.innerHeight;
      const top = viewport?.offsetTop || 0;
      if (!editing && !open) baseline = window.innerHeight;
      baseline = Math.max(baseline, window.innerHeight);
      open =
        mobile &&
        (viewport?.scale ?? 1) === 1 &&
        (editing || open) &&
        baseline - height > 120;
      root.style.setProperty("--visible-height", `${height}px`);
      root.style.setProperty("--visible-top", `${top}px`);
      root.toggleAttribute("data-keyboard-open", open);
      // InputDialog owns its scroll pane. Page forms use the document scroll.
      if (open && editing && !active.closest("dialog")) {
        const bounds = active.getBoundingClientRect();
        const available = height - 24;
        const delta =
          bounds.height > available || bounds.top < top + 12
            ? bounds.top - top - 12
            : bounds.bottom > top + height - 12
              ? bounds.bottom - top - height + 12
              : 0;
        if (delta) window.scrollBy({ top: delta, behavior: "instant" });
      }
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };
    const rotate = () => {
      baseline = window.innerHeight;
      schedule();
    };
    update();
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", rotate);
    viewport?.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", rotate);
      viewport?.removeEventListener("resize", schedule);
      root.removeAttribute("data-keyboard-open");
      root.style.removeProperty("--visible-height");
      root.style.removeProperty("--visible-top");
    };
  }, []);
  return null;
}
