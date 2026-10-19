"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
export interface DonationRow {
  id: number;
  itemName: string;
  occasion: string | null;
  memberId: number;
  memberName: string;
  guildId: number | null;
  quantity: number;
}
export type PayoutRow = DonationRow;
export interface MemberOpt {
  id: number;
  name: string;
  guildId: number | null;
}

export default function AwardsClient({
  awards,
  guilds,
  payStats,
  donations,
  payouts,
  members,
}: {
  awards: Award[];
  guilds: GuildOpt[];
  payStats: PayStat[];
  donations: DonationRow[];
  payouts: PayoutRow[];
  members: MemberOpt[];
}) {
  const router = useRouter();
  const [view, setView] = useState<"items" | "pay" | "gift">("items");
  const [guildId, setGuildId] = useState<number | "all">("all");
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  // 길드기부 입력
  const [dItem, setDItem] = useState("");
  const [dOccasion, setDOccasion] = useState("");
  const [dMember, setDMember] = useState<number | "">("");
  const [dQty, setDQty] = useState("");
  const [dBusy, setDBusy] = useState(false);
  const [dErr, setDErr] = useState("");

  async function addDonation() {
    setDErr("");
    const qty = Number(dQty);
    if (!dItem.trim()) return setDErr("아이템명을 입력하세요.");
    if (!dMember) return setDErr("길드원을 선택하세요.");
    if (!Number.isInteger(qty) || qty <= 0) return setDErr("수량을 확인하세요.");
    setDBusy(true);
    try {
      const res = await fetch("/api/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: dItem.trim(),
          occasion: dOccasion.trim() || undefined,
          memberId: dMember,
          quantity: qty,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDErr(data?.message ?? "등록에 실패했습니다.");
        return;
      }
      setDQty("");
      router.refresh();
    } finally {
      setDBusy(false);
    }
  }

  async function removeDonation(id: number) {
    const res = await fetch(`/api/donations/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  // 길드기부 필터 (소속/검색)
  const donateFiltered = useMemo(() => {
    const q = search.trim();
    return donations.filter(
      (d) =>
        (guildId === "all" || d.guildId === guildId) &&
        (!q ||
          d.memberName.includes(q) ||
          d.itemName.includes(q) ||
          (d.occasion ?? "").includes(q))
    );
  }, [donations, guildId, search]);

  // 아이템별 그룹
  const donateByItem = useMemo(() => {
    const map = new Map<string, { total: number; rows: DonationRow[] }>();
    for (const d of donateFiltered) {
      if (!map.has(d.itemName)) map.set(d.itemName, { total: 0, rows: [] });
      const e = map.get(d.itemName)!;
      e.total += d.quantity;
      e.rows.push(d);
    }
    return [...map.entries()]
      .map(([itemName, v]) => ({ itemName, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [donateFiltered]);

  const donateTotal = useMemo(
    () => donateFiltered.reduce((s, d) => s + d.quantity, 0),
    [donateFiltered]
  );

  // 지급 입력
  const [pItem, setPItem] = useState("");
  const [pMember, setPMember] = useState<number | "">("");
  const [pQty, setPQty] = useState("");
  const [pBusy, setPBusy] = useState(false);
  const [pErr, setPErr] = useState("");

  async function addPayout() {
    setPErr("");
    const qty = Number(pQty);
    if (!pItem.trim()) return setPErr("아이템명을 입력하세요.");
    if (!pMember) return setPErr("길드원을 선택하세요.");
    if (!Number.isInteger(qty) || qty <= 0) return setPErr("수량을 확인하세요.");
    setPBusy(true);
    try {
      const res = await fetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName: pItem.trim(), memberId: pMember, quantity: qty }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPErr(data?.message ?? "등록에 실패했습니다.");
        return;
      }
      setPQty("");
      router.refresh();
    } finally {
      setPBusy(false);
    }
  }

  async function removePayout(id: number) {
    const res = await fetch(`/api/payouts/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  const payoutFiltered = useMemo(() => {
    const q = search.trim();
    return payouts.filter(
      (d) =>
        (guildId === "all" || d.guildId === guildId) &&
        (!q || d.memberName.includes(q) || d.itemName.includes(q))
    );
  }, [payouts, guildId, search]);

  const payoutByItem = useMemo(() => {
    const map = new Map<string, { total: number; rows: PayoutRow[] }>();
    for (const d of payoutFiltered) {
      if (!map.has(d.itemName)) map.set(d.itemName, { total: 0, rows: [] });
      const e = map.get(d.itemName)!;
      e.total += d.quantity;
      e.rows.push(d);
    }
    return [...map.entries()]
      .map(([itemName, v]) => ({ itemName, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [payoutFiltered]);

  const payoutTotal = useMemo(
    () => payoutFiltered.reduce((s, d) => s + d.quantity, 0),
    [payoutFiltered]
  );

  // 기부 + 지급 통합 길드원별 통계 (아이템별 총 수량만)
  const giftByMember = useMemo(() => {
    type Row = {
      memberId: number;
      name: string;
      guildId: number | null;
      donate: Map<string, number>;
      payout: Map<string, number>;
      order: number; // 정렬용 합계(기부+지급), 표시는 안 함
    };
    const map = new Map<number, Row>();
    const ensure = (d: DonationRow) => {
      if (!map.has(d.memberId))
        map.set(d.memberId, {
          memberId: d.memberId,
          name: d.memberName,
          guildId: d.guildId,
          donate: new Map(),
          payout: new Map(),
          order: 0,
        });
      return map.get(d.memberId)!;
    };
    for (const d of donateFiltered) {
      const r = ensure(d);
      r.donate.set(d.itemName, (r.donate.get(d.itemName) ?? 0) + d.quantity);
      r.order += d.quantity;
    }
    for (const d of payoutFiltered) {
      const r = ensure(d);
      r.payout.set(d.itemName, (r.payout.get(d.itemName) ?? 0) + d.quantity);
      r.order += d.quantity;
    }
    const toItems = (m: Map<string, number>) =>
      [...m.entries()]
        .map(([itemName, qty]) => ({ itemName, qty }))
        .sort((a, b) => b.qty - a.qty);
    return [...map.values()]
      .map((r) => ({
        memberId: r.memberId,
        name: r.name,
        guildId: r.guildId,
        donate: toItems(r.donate),
        payout: toItems(r.payout),
        order: r.order,
      }))
      .sort((a, b) => b.order - a.order);
  }, [donateFiltered, payoutFiltered]);

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
        <Tab active={view === "gift"} onClick={() => setView("gift")}>
          기부/지급 통계
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
      ) : view === "pay" ? (
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
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Card label="총 기부 수량" value={`${donateTotal.toLocaleString()}개`} tone="sky" />
          <Card label="총 지급 수량" value={`${payoutTotal.toLocaleString()}개`} tone="emerald" />
          <Card label="기부 품목" value={`${donateByItem.length}종`} />
          <Card label="지급 품목" value={`${payoutByItem.length}종`} />
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

      {/* 기부/지급 통계 (통합) */}
      {view === "gift" && (
        <div className="grid gap-4">
          {/* 기부 입력 폼 */}
          <div className="rounded-lg border border-sky-200 bg-sky-50/40 p-4">
            <p className="mb-2 text-sm font-semibold text-sky-700">기부 등록</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[150px]">
                <label className="mb-1 block text-xs text-neutral-500">아이템명</label>
                <input
                  value={dItem}
                  onChange={(e) => setDItem(e.target.value)}
                  placeholder="예) 고룡의 핏줄"
                  className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
                />
              </div>
              <div className="w-28">
                <label className="mb-1 block text-xs text-neutral-500">날짜/회차</label>
                <input
                  value={dOccasion}
                  onChange={(e) => setDOccasion(e.target.value)}
                  placeholder="예) 10월3일 · 1차"
                  className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
                />
              </div>
              <div className="min-w-[130px]">
                <label className="mb-1 block text-xs text-neutral-500">캐릭명</label>
                <select
                  value={dMember}
                  onChange={(e) => setDMember(e.target.value ? Number(e.target.value) : "")}
                  className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
                >
                  <option value="">선택</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="mb-1 block text-xs text-neutral-500">수량(개)</label>
                <input
                  type="number"
                  min={1}
                  value={dQty}
                  onChange={(e) => setDQty(e.target.value)}
                  placeholder="10"
                  className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm tabular-nums focus:border-sky-400 focus:outline-none"
                />
              </div>
              <button
                onClick={addDonation}
                disabled={dBusy}
                className="rounded bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                추가
              </button>
            </div>
            {dErr && <p className="mt-2 text-xs text-red-500">{dErr}</p>}
            <p className="mt-2 text-[11px] text-neutral-400">
              같은 아이템은 아이템명을 동일하게 입력하면 자동으로 묶여서 집계됩니다.
            </p>
          </div>

          {/* 아이템별 기부 내역 */}
          {donateByItem.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white py-10 text-center text-sm text-neutral-400">
              기부 내역이 없습니다.
            </div>
          ) : (
            <div className="grid gap-3">
              {donateByItem.map((it) => (
                <div
                  key={it.itemName}
                  className="rounded-lg border border-neutral-200 bg-white p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-semibold">{it.itemName}</span>
                    <span className="ml-auto rounded bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                      총 {it.total.toLocaleString()}개
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {it.rows.map((r) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1.5 rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-700"
                      >
                        {r.occasion && (
                          <span className="rounded bg-white px-1.5 py-0.5 text-[11px] text-neutral-500 ring-1 ring-neutral-200">
                            {r.occasion}
                          </span>
                        )}
                        <span className="font-medium">{r.memberName}</span>
                        <span className="tabular-nums">{r.quantity.toLocaleString()}개</span>
                        <button
                          onClick={() => removeDonation(r.id)}
                          className="text-neutral-400 hover:text-red-500"
                          title="삭제"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 지급 입력 폼 */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
            <p className="mb-2 text-sm font-semibold text-emerald-700">지급 등록</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[150px]">
                <label className="mb-1 block text-xs text-neutral-500">아이템명</label>
                <input
                  value={pItem}
                  onChange={(e) => setPItem(e.target.value)}
                  placeholder="예) 고룡의 핏줄"
                  className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
                />
              </div>
              <div className="min-w-[130px]">
                <label className="mb-1 block text-xs text-neutral-500">지급받은 길드원</label>
                <select
                  value={pMember}
                  onChange={(e) => setPMember(e.target.value ? Number(e.target.value) : "")}
                  className="w-full rounded border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
                >
                  <option value="">선택</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="mb-1 block text-xs text-neutral-500">수량(개)</label>
                <input
                  type="number"
                  min={1}
                  value={pQty}
                  onChange={(e) => setPQty(e.target.value)}
                  placeholder="10"
                  className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm tabular-nums focus:border-sky-400 focus:outline-none"
                />
              </div>
              <button
                onClick={addPayout}
                disabled={pBusy}
                className="rounded bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                추가
              </button>
            </div>
            {pErr && <p className="mt-2 text-xs text-red-500">{pErr}</p>}
            <p className="mt-2 text-[11px] text-neutral-400">
              기부받은 아이템을 길드원에게 지급(분배)한 내역입니다. 같은 아이템명은 자동으로 묶여서 집계됩니다.
            </p>
          </div>

          {/* 아이템별 지급 내역 */}
          {payoutByItem.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white py-10 text-center text-sm text-neutral-400">
              지급 내역이 없습니다.
            </div>
          ) : (
            <div className="grid gap-3">
              {payoutByItem.map((it) => (
                <div
                  key={it.itemName}
                  className="rounded-lg border border-neutral-200 bg-white p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-semibold">{it.itemName}</span>
                    <span className="ml-auto rounded bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      총 {it.total.toLocaleString()}개
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {it.rows.map((r) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1.5 rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-700"
                      >
                        <span className="font-medium">{r.memberName}</span>
                        <span className="tabular-nums">{r.quantity.toLocaleString()}개</span>
                        <button
                          onClick={() => removePayout(r.id)}
                          className="text-neutral-400 hover:text-red-500"
                          title="삭제"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 전체 통계 (길드원별) - 기부/지급 통합, 아이템별 총 수량 */}
          {giftByMember.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
              <div className="border-b border-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-700">
                전체 통계 (길드원별)
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
                    <th className="px-3 py-2.5 text-left font-semibold">순위</th>
                    <th className="px-3 py-2.5 text-left font-semibold">길드원</th>
                    <th className="px-3 py-2.5 text-left font-semibold">소속</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-sky-700">
                      기부 (아이템별)
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold text-emerald-700">
                      지급 (아이템별)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {giftByMember.map((m, i) => (
                    <tr key={m.memberId} className="border-b border-neutral-50 align-top">
                      <td className="px-3 py-2 text-neutral-400">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{m.name}</td>
                      <td className="px-3 py-2 text-neutral-500">{guildName(m.guildId)}</td>
                      <td className="px-3 py-2">
                        <ItemChips items={m.donate} tone="sky" />
                      </td>
                      <td className="px-3 py-2">
                        <ItemChips items={m.payout} tone="emerald" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ItemChips({
  items,
  tone,
}: {
  items: { itemName: string; qty: number }[];
  tone: "sky" | "emerald";
}) {
  if (items.length === 0)
    return <span className="text-xs text-neutral-300">-</span>;
  const qtyCls = tone === "sky" ? "text-sky-700" : "text-emerald-700";
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it) => (
        <span
          key={it.itemName}
          className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
        >
          <span>{it.itemName}</span>
          <span className={`font-semibold tabular-nums ${qtyCls}`}>
            {it.qty.toLocaleString()}개
          </span>
        </span>
      ))}
    </div>
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
  tone?: "neutral" | "sky" | "amber" | "emerald";
}) {
  const cls =
    tone === "sky"
      ? "border-sky-200 bg-sky-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : tone === "emerald"
          ? "border-emerald-200 bg-emerald-50"
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
