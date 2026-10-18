"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export interface BidItem {
  eventItemId: number;
  name: string;
  rarity: string;
  bidCount: number;
  mine: boolean;
}

export default function BidClient({
  eventId,
  eventName,
  eventCreatedAt,
  initialItems,
  attendanceLinked = false,
  eligible = true,
}: {
  eventId: number;
  eventName: string;
  eventCreatedAt: string;
  initialItems: BidItem[];
  attendanceLinked?: boolean;
  eligible?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<BidItem[]>(initialItems);
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(initialItems.filter((i) => i.mine).map((i) => i.eventItemId))
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const dirty = useMemo(() => {
    const mineNow = new Set(
      items.filter((i) => i.mine).map((i) => i.eventItemId)
    );
    if (mineNow.size !== selected.size) return true;
    for (const id of selected) if (!mineNow.has(id)) return true;
    return false;
  }, [items, selected]);

  function toggle(id: number) {
    if (!eligible) return;
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function flash(m: string) {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 3500);
  }

  async function apply() {
    setBusy(true);
    try {
      const res = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, eventItemIds: [...selected] }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "신청 실패");
      // 로컬 반영: mine/bidCount 갱신
      setItems((its) =>
        its.map((it) => {
          const nowMine = selected.has(it.eventItemId);
          if (nowMine === it.mine) return it;
          return {
            ...it,
            mine: nowMine,
            bidCount: it.bidCount + (nowMine ? 1 : -1),
          };
        })
      );
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
      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <span className="font-semibold text-sky-600">{eventName}</span>
        <span className="ml-3 text-xs text-neutral-400">
          {new Date(eventCreatedAt).toLocaleString("ko-KR")}
        </span>
      </div>

      <h3 className="mb-2 mt-6 text-sm font-semibold">
        입찰할 아이템을 선택해주세요
      </h3>

      {attendanceLinked && (
        <div
          className={[
            "mb-3 rounded border px-4 py-2 text-sm",
            eligible
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700",
          ].join(" ")}
        >
          {eligible
            ? "출석 연동 이벤트 · 입찰 자격이 확인되었습니다."
            : "출석 연동 이벤트입니다. 해당 주차 출석 기록이 없어 신청할 수 없습니다."}
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
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-neutral-400">
            등록된 입찰 아이템이 없습니다.
          </div>
        ) : (
          <ul>
            {items.map((it) => {
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
          disabled={busy || !dirty || !eligible}
          className="rounded bg-sky-600 py-3 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          신청{dirty ? " *" : ""}
        </button>
        <button
          onClick={() => router.refresh()}
          disabled={busy}
          className="rounded border border-neutral-200 bg-neutral-50 py-3 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          새로고침
        </button>
      </div>
    </section>
  );
}
