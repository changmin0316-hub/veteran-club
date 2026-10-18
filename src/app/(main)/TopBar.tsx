"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function TopBar({
  name,
  role,
}: {
  name: string;
  role: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isAdmin = role === "ADMIN" || role === "COMMANDER";

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold tracking-wide">{name}</span>
        <Link href="/user" title="내 정보" className="text-neutral-500 hover:text-neutral-900">
          <Icon path="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5 0-9 2.5-9 6v1h18v-1c0-3.5-4-6-9-6z" />
        </Link>
        {isAdmin && (
          <>
            <Link href="/config" title="설정" className="text-neutral-500 hover:text-neutral-900">
              <Icon path="M12 8a4 4 0 100 8 4 4 0 000-8zm8.9 4a7.9 7.9 0 00-.15-1.5l2-1.55-2-3.45-2.35.95a8 8 0 00-2.6-1.5L15.4 2h-4l-.4 2.45a8 8 0 00-2.6 1.5L6.05 5l-2 3.45 2 1.55a8 8 0 000 3l-2 1.55 2 3.45 2.35-.95a8 8 0 002.6 1.5l.4 2.45h4l.4-2.45a8 8 0 002.6-1.5l2.35.95 2-3.45-2-1.55c.1-.5.15-1 .15-1.5z" />
            </Link>
            <Link href="/item" title="아이템 관리" className="text-neutral-500 hover:text-neutral-900">
              <Icon path="M3 6h18M3 12h18M3 18h12" stroke />
            </Link>
          </>
        )}
      </div>
      <button
        onClick={logout}
        disabled={loading}
        className="rounded border border-neutral-300 bg-neutral-50 px-4 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
      >
        {loading ? "..." : "로그아웃"}
      </button>
    </div>
  );
}

function Icon({ path, stroke }: { path: string; stroke?: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={stroke ? "none" : "currentColor"}
      stroke={stroke ? "currentColor" : "none"}
      strokeWidth={stroke ? 2 : undefined}
      strokeLinecap="round"
    >
      <path d={path} />
    </svg>
  );
}
