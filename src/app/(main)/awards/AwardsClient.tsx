"use client";

import { useMemo, useState } from "react";

export interface Award {
  eventItemId: number;
  itemName: string;
  category: string;
  rarity: string;
  eventName: string;
  eventDate: string;
  winnerId: number;
  winnerName: string;
  winnerGuildId: number | null;
}
export interface GuildOpt {
  id: number;
  order: number;
  name: string;
}
export interface PayStat {
  memberId: number;
  name: string;
  guildId: number | null;
  total: number;
  weeks: { label: string; share: number }[];
}

export default function AwardsClient({
  awards,
  guilds,
  payStats,
}: {
  awards: Award[];
  guilds: GuildOpt[];
  payStats: PayStat[];
}) {
  const [view, setView] = useState<"items" | "pay">("items");
  const [guildId, setGuildId] = useState<number | "all">("all");
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  const payFiltered = useMemo(() => {
    const q = search.trim();
    return payStats.filter(
      (p) =>
        (guildId === "all" || p.guildId === guildId) &&
        (!q || p.name.includes(q))
    );
  }, [payStats, guildId, search]);
  const payTotal = useMemo(
    () => payFiltered.reduce((s, p) => s + p.total, 0),
    [payFiltered]
  );

  const categories = useMemo(
    () => Array.from(new Set(awards.map((a) => a.category))).sort(),
    [awards]
  );

  const filtered = useMemo(() => {
    const q = search.trim();
    return awards.filter(
      (a) =>
        (guildId === "all" || a.winnerGuildId === guildId) &&
        (category === "all" || a.category === category) &&
        (!q || a.winnerName.includes(q) || a.itemName.includes(q))
    );
  }, [awards, guildId, category, search]);

  // 길드원별 그룹 (낙찰 수 내림차순)
  const byMember = useMemo(() => {
    const map = new Map<
      number,
      { name: string; guildId: number | null; items: Award[] }
    >();
    for (const a of filtered) {
      if (!map.has(a.winnerId))
        map.set(a.winnerId, {
          name: a.winnerName,
          guildId: a.winnerGuildId,
          items: [],
        });
      map.get(a.winnerId)!.items.push(a);
    }
    return [...map.values()].sort((a, b) => b.items.length - a.items.length);
  }, [filtered]);

  const catCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of filtered) m[a.category] = (m[a.category] ?? 0) + 1;
    return m;
  }, [filtered]);

  const guildName = (gid: number | null) =>
    guilds.find((g) => g.id === gid)?.name ?? "미지정";

  return (
    <section>
      {/* 뷰 전환 */}
      <div className="mb-3 flex gap-1.5">
        <Tab active={view === "items"} onClick={() => setView("items")}>
          낙찰 아이템
        </Tab>
        <Tab active={view === "pay"} onClick={() => setView("pay")}>
          분배금 통계
        </Tab>
      </div>

      {/* 요약 */}
      {view === "items" ? (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Card label="총 낙찰" value={`${filtered.length}건`} tone="sky" />
          <Card label="낙찰 인원" value={`${byMember.length}명`} />
          <Card
            label="카테고리"
            value={`${Object.keys(catCount).length}종`}
            sub={
              Object.entries(catCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 2)
                .map(([c, n]) => `${c} ${n}`)
                .join(" · ") || "-"
            }
          />
          <Card
            label="최다 낙찰"
            value={byMember[0]?.name ?? "-"}
            sub={byMember[0] ? `${byMember[0].items.length}건` : undefined}
            tone="amber"
          />
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Card label="총 분배금" value={`${payTotal.toLocaleString()}원`} tone="sky" />
          <Card label="수령 인원" value={`${payFiltered.length}명`} />
          <Card
            label="1인 평균"
            value={`${(payFiltered.length ? Math.round(payTotal / payFiltered.length) : 0).toLocaleString()}원`}
          />
          <Card
            label="최다 수령"
            value={payFiltered[0]?.name ?? "-"}
            sub={payFiltered[0] ? `${payFiltered[0].total.toLocaleString()}원` : undefined}
            tone="amber"
          />
        </div>
      )}

      {/* 필터 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Tab active={guildId === "all"} onClick={() => setGuildId("all")}>
            전체
          </Tab>
          {guilds.map((g) => (
            <Tab key={g.id} active={guildId === g.id} onClick={() => setGuildId(g.id)}>
              {g.order}군
            </Tab>
          ))}
        </div>
        {view === "items" && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
          >
            <option value="all">전체 카테고리</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="캐릭명·아이템 검색"
          className="ml-auto w-44 rounded border border-neutral-300 px-3 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
        />
      </div>

      {/* 분배금 통계 */}
      {view === "pay" &&
        (payFiltered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white py-10 text-center text-sm text-neutral-400">
            분배금 내역이 없습니다.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
                  <th className="px-3 py-2.5 text-left font-semibold">길드원</th>
                  <th className="px-3 py-2.5 text-left font-semibold">소속</th>
                  <th className="px-3 py-2.5 text-right font-semibold">총 분배금</th>
                  <th className="px-3 py-2.5 text-left font-semibold">주차별 내역</th>
                </tr>
              </thead>
              <tbody>
                {payFiltered.map((p) => (
                  <tr key={p.memberId} className="border-b border-neutral-50">
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-neutral-500">
                      {guildName(p.guildId)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-sky-700">
                      {p.total.toLocaleString()}원
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {p.weeks.map((w, i) => (
                          <span
                            key={i}
                            className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
                          >
                            {w.label} {w.share.toLocaleString()}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {/* 길드원별 낙찰 내역 */}
      {view === "items" &&
        (byMember.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white py-10 text-center text-sm text-neutral-400">
          낙찰 내역이 없습니다.
        </div>
      ) : (
        <div className="grid gap-3">
          {byMember.map((m) => (
            <div
              key={m.name}
              className="rounded-lg border border-neutral-200 bg-white p-4"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="font-semibold">{m.name}</span>
                <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                  {guildName(m.guildId)}
                </span>
                <span className="ml-auto rounded bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  낙찰 {m.items.length}건
                </span>
              </div>
              <div className="overflow-hidden rounded border border-neutral-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-50 text-neutral-500">
                      <th className="px-3 py-1.5 text-left font-medium">아이템</th>
                      <th className="px-3 py-1.5 text-left font-medium">카테고리</th>
                      <th className="px-3 py-1.5 text-left font-medium">이벤트</th>
                      <th className="px-3 py-1.5 text-right font-medium">일시</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.items.map((a) => (
                      <tr key={a.eventItemId} className="border-t border-neutral-50">
                        <td className="px-3 py-1.5 font-medium">{a.itemName}</td>
                        <td className="px-3 py-1.5">
                          <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                            {a.category}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-neutral-500">{a.eventName}</td>
                        <td className="px-3 py-1.5 text-right text-xs text-neutral-400">
                          {new Date(a.eventDate).toLocaleDateString("ko-KR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
        ))}
    </section>
  );
}

function Card({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "sky" | "amber";
}) {
  const cls =
    tone === "sky"
      ? "border-sky-200 bg-sky-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : "border-neutral-200 bg-white";
  return (
    <div className={`rounded-lg border ${cls} px-4 py-3`}>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-neutral-800">{value}</p>
      {sub && <p className="text-[11px] text-neutral-400">{sub}</p>}
    </div>
  );
}

function Tab({
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
