"use client";

import { useCallback, useEffect, useState } from "react";

export interface EventOpt {
  id: number;
  name: string;
  active: boolean;
}
export interface GuildOpt {
  id: number;
  order: number;
  name: string;
}

interface Bidder {
  memberId: number;
  name: string;
  guildId: number | null;
  job: string | null;
  statTotal: number;
}
interface ResultItem {
  eventItemId: number;
  itemName: string;
  rarity: string;
  winnerId: number | null;
  bidders: Bidder[];
}

export default function RequestClient({
  events,
  guilds,
}: {
  events: EventOpt[];
  guilds: GuildOpt[];
}) {
  const [eventId, setEventId] = useState<number | null>(
    events.find((e) => e.active)?.id ?? events[0]?.id ?? null
  );
  const [guildId, setGuildId] = useState<number | "all">("all");
  const [items, setItems] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!eventId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/results`);
      const d = await res.json();
      setItems(d.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  function flash(m: string) {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 3000);
  }

  async function award(eventItemId: number, winnerId: number | null) {
    if (!eventId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventItemId, winnerId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "낙찰 실패");
      setItems((its) =>
        its.map((it) =>
          it.eventItemId === eventItemId ? { ...it, winnerId } : it
        )
      );
      flash(winnerId ? "낙찰 처리되었습니다." : "낙찰이 취소되었습니다.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  const guildName = (gid: number | null) =>
    guilds.find((g) => g.id === gid)?.name ?? "-";

  const totalBids = items.reduce((s, it) => s + it.bidders.length, 0);
  const awarded = items.filter((it) => it.winnerId).length;

  return (
    <section>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={eventId ?? ""}
          onChange={(e) => setEventId(Number(e.target.value))}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm sm:w-96 focus:border-sky-400 focus:outline-none"
        >
          {events.length === 0 && <option value="">이벤트 없음</option>}
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.active ? " (진행중)" : ""}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <span className="text-sm text-neutral-400">
          총 신청 {totalBids} · 낙찰 {awarded}/{items.length}
        </span>
      </div>

      {/* 군 필터 */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <GuildTab active={guildId === "all"} onClick={() => setGuildId("all")}>
          전체
        </GuildTab>
        {guilds.map((g) => (
          <GuildTab
            key={g.id}
            active={guildId === g.id}
            onClick={() => setGuildId(g.id)}
          >
            {g.order}군 - {g.name}
          </GuildTab>
        ))}
      </div>

      {msg && (
        <div className="mb-3 rounded border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700">
          {msg}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-neutral-200 bg-white py-10 text-center text-sm text-neutral-400">
          불러오는 중...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white py-10 text-center text-sm text-neutral-400">
          {eventId ? "등록된 입찰 아이템이 없습니다." : "이벤트를 선택하세요."}
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((it) => {
            const shown =
              guildId === "all"
                ? it.bidders
                : it.bidders.filter((b) => b.guildId === guildId);
            const winner = it.bidders.find((b) => b.memberId === it.winnerId);
            return (
              <div
                key={it.eventItemId}
                className="rounded-lg border border-neutral-200 bg-white p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{it.itemName}</span>
                    <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                      {it.rarity}
                    </span>
                    <span className="text-xs text-neutral-400">
                      신청 {it.bidders.length}명
                    </span>
                  </div>
                  {winner ? (
                    <span className="flex items-center gap-2">
                      <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                        🏆 낙찰: {winner.name}
                      </span>
                      <button
                        onClick={() => award(it.eventItemId, null)}
                        disabled={busy}
                        className="text-xs text-neutral-400 hover:text-red-500"
                      >
                        취소
                      </button>
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400">미낙찰</span>
                  )}
                </div>

                {shown.length === 0 ? (
                  <p className="py-2 text-sm text-neutral-400">
                    {it.bidders.length === 0
                      ? "신청자가 없습니다."
                      : "해당 군의 신청자가 없습니다."}
                  </p>
                ) : (
                  <div className="overflow-hidden rounded border border-neutral-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-neutral-50 text-neutral-500">
                          <th className="px-3 py-1.5 text-left font-medium">신청자</th>
                          <th className="px-3 py-1.5 text-left font-medium">직업</th>
                          <th className="px-3 py-1.5 text-left font-medium">소속</th>
                          <th className="px-3 py-1.5 text-right font-medium">3대</th>
                          <th className="w-20 px-3 py-1.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((b) => {
                          const isWinner = b.memberId === it.winnerId;
                          return (
                            <tr
                              key={b.memberId}
                              className={`border-t border-neutral-50 ${isWinner ? "bg-amber-50" : ""}`}
                            >
                              <td className="px-3 py-1.5 font-medium">{b.name}</td>
                              <td className="px-3 py-1.5 text-neutral-500">
                                {b.job ?? "-"}
                              </td>
                              <td className="px-3 py-1.5 text-neutral-500">
                                {guildName(b.guildId)}
                              </td>
                              <td className="px-3 py-1.5 text-right font-semibold">
                                {b.statTotal.toLocaleString()}
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                {isWinner ? (
                                  <span className="text-xs text-amber-600">낙찰됨</span>
                                ) : (
                                  <button
                                    onClick={() => award(it.eventItemId, b.memberId)}
                                    disabled={busy}
                                    className="rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-amber-50 hover:text-amber-700"
                                  >
                                    낙찰
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function GuildTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded px-3 py-1.5 text-xs font-medium transition",
        active
          ? "bg-sky-100 text-sky-700 ring-1 ring-sky-300"
          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
