"use client";

import { useEffect, useRef } from "react";

// 상단 메뉴바. 높이를 측정해 --nav-h 로 노출 → 각 페이지 서브바가 그 아래에 고정됨.
export default function StickyHeader({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () =>
      document.documentElement.style.setProperty("--nav-h", `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);

  return (
    <header
      ref={ref}
      className="sticky top-0 z-30 -mx-4 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80"
    >
      {children}
    </header>
  );
}
