"use client";

import { useEffect } from "react";

// 상단 메뉴바(비고정). 서브바는 화면 최상단(top:0)에 고정되도록 --nav-h=0.
export default function StickyHeader({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.style.setProperty("--nav-h", "0px");
  }, []);

  return (
    <header className="-mx-4 border-b border-neutral-200 bg-white px-4 py-3">
      {children}
    </header>
  );
}
