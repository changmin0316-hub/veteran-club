"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// managerOnly: 운영진(COMMANDER)/관리자(ADMIN) 전용 탭 — 길드원(MEMBER)에게는 숨김
const TABS = [
  { href: "/request", label: "분배 현황", managerOnly: false },
  { href: "/event", label: "분배 등록", managerOnly: true },
  { href: "/", label: "아이템 신청", managerOnly: false },
  { href: "/users", label: "길드원", managerOnly: false },
  { href: "/attendance", label: "출석 현황", managerOnly: false },
  { href: "/closing", label: "주차(시즌) 결산", managerOnly: true },
  { href: "/adjustment", label: "분배금 정산", managerOnly: true },
];

export default function NavTabs({ isManager }: { isManager: boolean }) {
  const pathname = usePathname();
  const tabs = TABS.filter((t) => isManager || !t.managerOnly);
  const cols =
    tabs.length >= 7 ? "lg:grid-cols-7" : "lg:grid-cols-4";
  return (
    <nav className={`grid grid-cols-2 gap-1 sm:grid-cols-4 ${cols}`}>
      {tabs.map((t) => {
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
