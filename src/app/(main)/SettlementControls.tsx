"use client";

import { useMemo, useState } from "react";
import type { WeekOpt, GuildOpt, SettlementRow } from "./settlement-types";

export type RowSortKey =
  | "name"
  | "statTotal"
  | "attendanceRate"
  | "applied"
  | "shareRatio"
  | "share";

// 정산/출석 표 정렬 훅 (오름/내림 토글)
export function useRowSort(rows: SettlementRow[]) {
  const [sort, setSort] = useState<{ key: RowSortKey; dir: "asc" | "desc" } | null>(
    null
  );
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort.key === "name") return a.name.localeCompare(b.name) * dir;
      return ((a[sort.key] as number) - (b[sort.key] as number)) * dir;
    });
  }, [rows, sort]);
  const toggle = (k: RowSortKey) =>
    setSort((p) =>
      p && p.key === k
        ? { key: k, dir: p.dir === "asc" ? "desc" : "asc" }
        : { key: k, dir: k === "name" ? "asc" : "desc" }
    );
  return { sorted, sort, toggle };
}

export function SortTh({
  label,
  k,
  sort,
  onSort,
  align = "right",
}: {
  label: string;
  k: RowSortKey;
  sort: { key: RowSortKey; dir: "asc" | "desc" } | null;
  onSort: (k: RowSortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort?.key === k;
  return (
    <th
      onClick={() => onSort(k)}
      className={`cursor-pointer select-none px-3 py-2.5 font-semibold hover:text-sky-600 ${
        align === "left" ? "text-left" : "text-right"
      }`}
    >
      {label}
      <span className={`ml-0.5 text-[10px] ${active ? "text-sky-500" : "text-neutral-400"}`}>
        {active ? (sort!.dir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </th>
  );
}

export function WeekSelect({
  weeks,
  weekId,
  onChange,
}: {
  weeks: WeekOpt[];
  weekId: number | null;
  onChange: (id: number) => void;
}) {
  return (
    <select
      value={weekId ?? ""}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
    >
      {weeks.length === 0 && <option value="">주차 없음</option>}
      {weeks.map((w) => (
        <option key={w.id} value={w.id}>
          {w.label}
        </option>
      ))}
    </select>
  );
}

export function GuildTabs({
  guilds,
  guildId,
  onChange,
}: {
  guilds: GuildOpt[];
  guildId: number | null;
  onChange: (id: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {guilds.map((g) => (
        <button
          key={g.id}
          onClick={() => onChange(g.id)}
          className={[
            "rounded px-3 py-1.5 text-xs font-medium transition",
            guildId === g.id
              ? "bg-sky-100 text-sky-700 ring-1 ring-sky-300"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
          ].join(" ")}
        >
          {g.order}군 - {g.name}
        </button>
      ))}
    </div>
  );
}
