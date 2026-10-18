"use client";

import type { WeekOpt, GuildOpt } from "./settlement-types";

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
