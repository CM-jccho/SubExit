"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
export default function StickyPageTop({ children }: { children: ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setCompact(!entry.isIntersecting),
      { rootMargin: "-100px 0px 0px 0px" },
    );
    if (sentinel.current) observer.observe(sentinel.current);
    return () => observer.disconnect();
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
