"use client";
import { useEffect, useRef, type TouchEvent } from "react";

// Native vertical scrolling, pinch zoom and browser edge navigation stay intact.
export default function useHorizontalSwipe({
  enabled = true,
  inDialog = false,
  canNext = true,
  canPrevious = true,
  pageKey,
  onNext,
  onPrevious,
}: {
  enabled?: boolean;
  inDialog?: boolean;
  canNext?: boolean;
  canPrevious?: boolean;
  pageKey?: string | number;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const start = useRef<{ x: number; y: number; at: number } | null>(null);
  const surface = useRef<HTMLElement | null>(null);
  const motion = useRef<Animation | null>(null);
  const busy = useRef(false);
  function clearSurface() {
    surface.current?.style.removeProperty("transform");
    surface.current?.removeAttribute("data-swiping");
  }
  function cancel() {
    start.current = null;
    motion.current?.cancel();
    motion.current = null;
    busy.current = false;
    clearSurface();
  }
  useEffect(() => cancel, []);
  useEffect(() => {
    cancel();
  }, [enabled, pageKey]);
  function finish(next?: boolean) {
    const node = surface.current;
    if (!node) return;
    if (next === undefined && !node.style.transform) {
      clearSurface();
      return;
    }
    const from = node.style.transform || "translateX(0)";
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const done = () => {
      motion.current?.cancel();
      motion.current = null;
      busy.current = false;
      clearSurface();
      if (next !== undefined && node.isConnected) {
        if (next) onNext();
        else onPrevious();
      }
    };
    if (reduced || !node.animate) {
      done();
      return;
    }
    busy.current = true;
    motion.current = node.animate(
      [
        { transform: from, opacity: 1 },
        {
          transform:
            next === undefined
              ? "translateX(0) rotate(0deg)"
              : `translateX(${next ? "-" : ""}110%) rotate(${next ? "-" : ""}3deg)`,
          opacity: next === undefined ? 1 : 0,
        },
      ],
      {
        duration: next === undefined ? 200 : 180,
        easing: "cubic-bezier(.22,.8,.3,1)",
        fill: "forwards",
      },
    );
    motion.current.onfinish = done;
  }
  return {
    onTouchStart(event: TouchEvent<HTMLElement>) {
      start.current = null;
      if (busy.current) return;
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
      surface.current = event.currentTarget;
    },
    onTouchMove(event: TouchEvent<HTMLElement>) {
      const point = start.current;
      if (!point) return;
      if (event.touches.length !== 1) {
        cancel();
        return;
      }
      const dx = event.touches[0].clientX - point.x;
      const dy = event.touches[0].clientY - point.y;
      if (Math.abs(dy) > 16 && Math.abs(dy) > Math.abs(dx)) {
        start.current = null;
        finish();
        return;
      }
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        const boundary = dx < 0 ? !canNext : !canPrevious;
        const distance = Math.max(
          -window.innerWidth * 0.7,
          Math.min(window.innerWidth * 0.7, dx * (boundary ? 0.12 : 0.7)),
        );
        const node = surface.current;
        if (
          node &&
          !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ) {
          node.dataset.swiping = "true";
          node.style.transform = `translateX(${distance}px) rotate(${distance / 140}deg)`;
        }
      }
    },
    onTouchEnd(event: TouchEvent<HTMLElement>) {
      const point = start.current;
      start.current = null;
      if (!point || busy.current) return;
      if (!enabled || event.touches.length || !event.changedTouches.length) {
        finish();
        return;
      }
      const dx = event.changedTouches[0].clientX - point.x;
      const dy = event.changedTouches[0].clientY - point.y;
      if (
        Math.abs(dx) < 70 ||
        Math.abs(dx) < Math.abs(dy) * 1.8 ||
        (dx < 0 ? !canNext : !canPrevious) ||
        window.getSelection()?.toString()
      ) {
        finish();
        return;
      }
      finish(dx < 0);
    },
    onTouchCancel() {
      cancel();
    },
  };
}
