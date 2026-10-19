"use client";

import { useMemo, useState } from "react";

export interface BidItem {
  eventItemId: number;
  name: string;
  rarity: string;
  bidCount: number;
  mine: boolean;
}

export interface EventOpt {
  id: number;
  name: string;
}

export interface BidView {
  eventId: number;
  eventName: string;
  eventCreatedAt: string;
  attendanceLinked: boolean;
  eligible: boolean;
  linkedWeekName: string | null;
  items: BidItem[];
}

export default function BidClient({
  events,
  initialView,
}: {
  events: EventOpt[];
  initialView: BidView;
}) {
  const [view, setView] = useState<BidView>(initialView);
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(initialView.items.filter((i) => i.mine).map((i) => i.eventItemId))
  );
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const dirty = useMemo(() => {
    const mineNow = new Set(
      view.items.filter((i) => i.mine).map((i) => i.eventItemId)
    );
    if (mineNow.size !== selected.size) return true;
    for (const id of selected) if (!mineNow.has(id)) return true;
    return false;
  }, [view, selected]);

  function flash(m: string) {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 3500);
  }

  function applyView(v: BidView) {
    setView(v);
    setSelected(new Set(v.items.filter((i) => i.mine).map((i) => i.eventItemId)));
  }

  async function selectEvent(eventId: number) {
    if (eventId === view.eventId) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/events/${eventId}/bid-view`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "불러오기 실패");
      applyView(d);
    } catch (e) {
      flash(e instanceof Error ? e.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: number) {
    if (!view.eligible) return;
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function apply() {
    setBusy(true);
    try {
      const res = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: view.eventId, eventItemIds: [...selected] }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "신청 실패");
      setView((v) => ({
        ...v,
        items: v.items.map((it) => {
          const nowMine = selected.has(it.eventItemId);
          if (nowMine === it.mine) return it;
          return { ...it, mine: nowMine, bidCount: it.bidCount + (nowMine ? 1 : -1) };
        }),
      }));
      flash(`신청 완료 (추가 ${d.added} · 취소 ${d.removed})`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-base font-bold">진행중인 이벤트</h2>

      {/* 이벤트 선택 드롭다운 */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <select
          value={view.eventId}
          onChange={(e) => selectEvent(Number(e.target.value))}
          disabled={loading}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm font-semibold text-sky-600 focus:border-sky-400 focus:outline-none"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id} className="text-neutral-800">
              {e.name}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-neutral-400">
          진행중인 이벤트 {events.length}개 · 선택:{" "}
          {new Date(view.eventCreatedAt).toLocaleString("ko-KR")}
        </p>
      </div>

      <h3 className="mb-2 mt-6 text-sm font-semibold">입찰할 아이템을 선택해주세요</h3>

      {view.attendanceLinked && (
        <div
          className={[
            "mb-3 rounded border px-4 py-2 text-sm",
            view.eligible
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700",
          ].join(" ")}
        >
          {view.eligible
            ? `출석 연동 이벤트${view.linkedWeekName ? ` (${view.linkedWeekName})` : ""} · 입찰 자격이 확인되었습니다.`
            : `출석 연동 이벤트입니다. ${view.linkedWeekName ? `'${view.linkedWeekName}' ` : "해당 주차 "}출석 기록이 있어야 신청할 수 있습니다. (분배 등록에서 연동 주차를 바꾸거나 '연동 안 함'으로 해제할 수 있습니다)`}
        </div>
      )}

      {msg && (
        <div className="mb-3 rounded border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700">
          {msg}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 px-4 py-2 text-xs text-neutral-500">
          공용입찰
        </div>
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-neutral-400">
            불러오는 중...
          </div>
        ) : view.items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-neutral-400">
            등록된 입찰 아이템이 없습니다.
          </div>
        ) : (
          <ul>
            {view.items.map((it) => {
              const sel = selected.has(it.eventItemId);
              return (
                <li key={it.eventItemId} className="border-b border-neutral-50 last:border-0">
                  <button
                    onClick={() => toggle(it.eventItemId)}
                    className={[
                      "flex w-full items-center justify-between px-4 py-3 text-left text-sm transition",
                      sel ? "bg-sky-50" : "hover:bg-neutral-50",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={[
                          "flex h-4 w-4 items-center justify-center rounded border text-[10px]",
                          sel
                            ? "border-sky-500 bg-sky-500 text-white"
                            : "border-neutral-300",
                        ].join(" ")}
                      >
                        {sel ? "✓" : ""}
                      </span>
                      <span className={sel ? "font-medium text-sky-700" : ""}>
                        {it.name}
                      </span>
                      <span className="text-neutral-400">/ {it.bidCount}</span>
                    </span>
                    <span className="text-xs text-neutral-400">
                      {sel ? "선택됨 (클릭시 취소)" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={apply}
          disabled={busy || loading || !dirty || !view.eligible}
          className="rounded bg-sky-600 py-3 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          신청{dirty ? " *" : ""}
        </button>
        <button
          onClick={async () => {
            setLoading(true);
            try {
              const res = await fetch(`/api/events/${view.eventId}/bid-view`);
              const d = await res.json();
              if (res.ok) applyView(d);
            } finally {
              setLoading(false);
            }
          }}
          disabled={busy || loading}
          className="rounded border border-neutral-200 bg-neutral-50 py-3 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          새로고침
        </button>
      </div>
    </section>
  );
}
