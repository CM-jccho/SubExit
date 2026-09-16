"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
export default function StickyPageTop({ children }: { children: ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    let observer: IntersectionObserver;
    const observe = () => {
      observer?.disconnect();
      if (!sentinel.current) return;
      const height =
        parseFloat(
          window
            .getComputedStyle(sentinel.current)
            .getPropertyValue("--header-height"),
        ) || 76;
      observer = new IntersectionObserver(
        ([entry]) => setCompact(!entry.isIntersecting),
        { rootMargin: `-${height}px 0px 0px 0px` },
      );
      observer.observe(sentinel.current);
    };
    observe();
    window.addEventListener("resize", observe);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", observe);
    };
  }, []);
  return (
    <>
      <div ref={sentinel} className="dc-sticky-sentinel" aria-hidden="true" />
      <section
        className={
          "dc-page-top dc-sticky-actions" + (compact ? " is-compact" : "")
        }
      >
        {children}
      </section>
    </>
  );
}
