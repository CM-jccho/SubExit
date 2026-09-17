"use client";
import { useRef, type TouchEvent } from "react";

// Native vertical scrolling, pinch zoom and browser edge navigation stay intact.
export default function useHorizontalSwipe({
  enabled = true,
  inDialog = false,
  onNext,
  onPrevious,
}: {
  enabled?: boolean;
  inDialog?: boolean;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const start = useRef<{ x: number; y: number; at: number } | null>(null);
  return {
    onTouchStart(event: TouchEvent<HTMLElement>) {
      start.current = null;
      if (!enabled || event.touches.length !== 1 || window.innerWidth > 900)
        return;
      const target = event.target as HTMLElement;
      if (
        target.closest(
          "input, textarea, select, button, a, audio, video, [contenteditable], [data-no-swipe]",
        )
      )
        return;
      if (!inDialog && document.querySelector("dialog[open]")) return;
      if (
        document.activeElement?.matches(
          "input, textarea, select, [contenteditable]",
        )
      )
        return;
      if (window.getSelection()?.toString()) return;
      for (
        let node: HTMLElement | null = target;
        node && node !== event.currentTarget;
        node = node.parentElement
      ) {
        if (
          node.scrollWidth > node.clientWidth + 2 &&
          /auto|scroll/.test(window.getComputedStyle(node).overflowX)
        )
          return;
      }
      const { clientX: x, clientY: y } = event.touches[0];
      if (x < 28 || x > window.innerWidth - 28) return;
      start.current = { x, y, at: Date.now() };
    },
    onTouchMove(event: TouchEvent<HTMLElement>) {
      const point = start.current;
      if (!point) return;
      if (event.touches.length !== 1) {
        start.current = null;
        return;
      }
      const dx = event.touches[0].clientX - point.x;
      const dy = event.touches[0].clientY - point.y;
      if (Math.abs(dy) > 16 && Math.abs(dy) > Math.abs(dx))
        start.current = null;
    },
    onTouchEnd(event: TouchEvent<HTMLElement>) {
      const point = start.current;
      start.current = null;
      if (
        !enabled ||
        !point ||
        event.touches.length ||
        !event.changedTouches.length
      )
        return;
      const dx = event.changedTouches[0].clientX - point.x;
      const dy = event.changedTouches[0].clientY - point.y;
      if (
        Date.now() - point.at > 800 ||
        Math.abs(dx) < 70 ||
        Math.abs(dx) < Math.abs(dy) * 1.8
      )
        return;
      if (window.getSelection()?.toString()) return;
      if (dx < 0) onNext();
      else onPrevious();
    },
    onTouchCancel() {
      start.current = null;
    },
  };
}
