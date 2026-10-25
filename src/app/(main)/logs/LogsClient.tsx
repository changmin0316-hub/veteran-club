"use client";

import { useMemo, useState } from "react";

export interface LogRow {
  id: number;
  actorId: number | null;
  actorName: string;
  action: string;
  detail: string;
  targetMemberId: number | null;
  createdAt: string;
}
export interface MemberOpt {
  id: number;
  name: string;
}

const ACTION_CLS: Record<string, string> = {
  "길드원 삭제": "bg-red-500/15 text-red-400 ring-red-500/40",
  "비밀번호 초기화": "bg-amber-500/15 text-amber-400 ring-amber-500/40",
  "길드원 등록": "bg-emerald-500/15 text-emerald-400 ring-emerald-500/40",
  "아이템 신청": "bg-violet-500/15 text-violet-400 ring-violet-500/40",
};
const actionCls = (a: string) =>
  ACTION_CLS[a] ?? "bg-sky-500/15 text-sky-400 ring-sky-500/40";

export default function LogsClient({
  rows,
  members,
}: {
  rows: LogRow[];
  members: MemberOpt[];
}) {
  const [actorId, setActorId] = useState<number | "all">("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim();
    return rows.filter(
      (r) =>
        (actorId === "all" || r.actorId === actorId) &&
        (!query ||
          r.actorName.includes(query) ||
          r.action.includes(query) ||
          r.detail.includes(query))
    );
  }, [rows, actorId, q]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold">활동 로그</h2>
        <span className="text-xs text-neutral-400">최근 1,000건 · 관리자 전용</span>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={actorId}
            onChange={(e) =>
              setActorId(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
          >
            <option value="all">전체 길드원</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="동작·상세 검색"
            className="w-40 rounded border border-neutral-300 px-3 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
              <th className="w-28 px-3 py-2.5 text-left font-semibold">시간</th>
              <th className="w-28 px-3 py-2.5 text-left font-semibold">수행자</th>
              <th className="w-28 px-3 py-2.5 text-left font-semibold">동작</th>
              <th className="px-3 py-2.5 text-left font-semibold">상세</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-neutral-50">
                <td className="px-3 py-2 whitespace-nowrap text-neutral-500">
                  {fmt(r.createdAt)}
                </td>
                <td className="px-3 py-2 font-medium text-neutral-800">{r.actorName}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-bold ring-1 ${actionCls(r.action)}`}
                  >
                    {r.action}
                  </span>
                </td>
                <td className="px-3 py-2 text-neutral-600">{r.detail}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-neutral-400">
                  로그가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
