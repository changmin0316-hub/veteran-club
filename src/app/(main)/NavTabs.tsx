"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/request", label: "분배 현황" },
  { href: "/event", label: "분배 등록" },
  { href: "/", label: "아이템 신청" },
  { href: "/users", label: "길드원" },
  { href: "/attendance", label: "출석 현황" },
  { href: "/closing", label: "주차(시즌) 결산" },
  { href: "/adjustment", label: "분배금 정산" },
];

export default function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-7">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={[
              "rounded px-3 py-2.5 text-center text-sm transition",
              active
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
            ].join(" ")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
