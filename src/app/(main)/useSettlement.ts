"use client";

import { useCallback, useEffect, useState } from "react";
import type { SettlementResult, WeekOpt, GuildOpt } from "./settlement-types";

export function useSettlement(weeks: WeekOpt[], guilds: GuildOpt[]) {
  const [weekId, setWeekId] = useState<number | null>(weeks[0]?.id ?? null);
  const [guildId, setGuildId] = useState<number | null>(guilds[0]?.id ?? null);
  const [data, setData] = useState<SettlementResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!weekId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ weekId: String(weekId) });
      if (guildId) params.set("guildId", String(guildId));
      const res = await fetch(`/api/settlement?${params.toString()}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "불러오기 실패");
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [weekId, guildId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    weekId,
    setWeekId,
    guildId,
    setGuildId,
    data,
    setData,
    loading,
    error,
    reload,
  };
}
