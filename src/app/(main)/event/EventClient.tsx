"use client";

import { useEffect, useState } from "react";

export interface EventRow {
  id: number;
  name: string;
  active: boolean;
  weekId: number | null;
  weekName: string | null;
  itemCount: number;
  createdAt: string;
}
export interface WeekOpt {
  id: number;
  label: string;
}

export default function EventClient({
  initialRows,
  weeks,
}: {
  initialRows: EventRow[];
  weeks: WeekOpt[];
}) {
  const [rows, setRows] = useState<EventRow[]>(initialRows);
  const [name, setName] = useState("");
  const [weekId, setWeekId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<EventRow | null>(null);

  function flash(m: string) {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 3500);
  }

  async function createEvent() {
    if (!name.trim()) return flash("이벤트 이름을 입력하세요.");
    setBusy(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          weekId: weekId ? Number(weekId) : null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "생성 실패");
      const e = d.event;
      setRows((rs) => [
        {
          id: e.id,
          name: e.name,
          active: e.active,
          weekId: e.weekId,
          weekName: e.week?.name ?? (e.week ? `${e.week.number}주차` : null),
          itemCount: e._count.items,
          createdAt: e.createdAt,
        },
        ...rs,
      ]);
      setName("");
      flash("이벤트가 생성되었습니다.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: EventRow) {
    const next = !row.active;
    setRows((rs) =>
      rs.map((r) => (r.id === row.id ? { ...r, active: next } : r))
    );
    const res = await fetch(`/api/events/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: next }),
    });
    if (!res.ok) {
      setRows((rs) =>
        rs.map((r) => (r.id === row.id ? { ...r, active: row.active } : r))
      );
      flash("상태 변경 실패");
    }
  }

  async function rename(row: EventRow, newName: string) {
    if (newName === row.name || !newName.trim()) {
      setRows((rs) =>
        rs.map((r) => (r.id === row.id ? { ...r, name: row.name } : r))
      );
      return;
    }
    const res = await fetch(`/api/events/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (!res.ok) {
      setRows((rs) =>
        rs.map((r) => (r.id === row.id ? { ...r, name: row.name } : r))
      );
      flash("이름 변경 실패");
    } else {
      setRows((rs) =>
        rs.map((r) => (r.id === row.id ? { ...r, name: newName.trim() } : r))
      );
    }
  }

  async function changeWeek(row: EventRow, weekId: number | null) {
    const prev = { weekId: row.weekId, weekName: row.weekName };
    const w = weeks.find((x) => x.id === weekId);
    setRows((rs) =>
      rs.map((r) =>
        r.id === row.id ? { ...r, weekId, weekName: w?.label ?? null } : r
      )
    );
    const res = await fetch(`/api/events/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekId }),
    });
    if (!res.ok) {
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...prev } : r)));
      flash("출석 연동 변경 실패");
    } else {
      flash(
        weekId
          ? `출석 연동: ${w?.label} (해당 주차 출석자만 입찰 가능)`
          : "출석 연동 해제 (누구나 입찰 가능)"
      );
    }
  }

  async function removeEvent(row: EventRow) {
    if (!confirm(`'${row.name}' 이벤트를 삭제할까요? 등록된 아이템/신청도 함께 삭제됩니다.`))
      return;
    const res = await fetch(`/api/events/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      setRows((rs) => rs.filter((r) => r.id !== row.id));
      flash("삭제되었습니다.");
    } else {
      flash("삭제 실패");
    }
  }

  return (
    <section>
      <h2 className="mb-2 text-base font-bold">이벤트 등록</h2>
      <p className="mb-3 rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-500">
        출석을 연동하면 입찰 자격에 제한을 둘 수 있습니다. 연동된 출석이 없으면 모든
        길드원이 입찰 권한을 갖습니다.
      </p>

      <div className="rounded-lg border border-neutral-200 bg-white p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={weekId}
            onChange={(e) => setWeekId(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2 text-sm sm:w-56"
          >
            <option value="">출석 연동 안 함</option>
            {weeks.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label} 출석 연동
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createEvent()}
            placeholder="분배할 이벤트 이름 ex) 10.17 - 21시 30분 보스"
            className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
          />
        </div>
        <button
          onClick={createEvent}
          disabled={busy}
          className="mt-2 w-full rounded bg-neutral-100 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-200 disabled:opacity-50"
        >
          이벤트 생성
        </button>
      </div>

      {msg && (
        <div className="mt-3 rounded border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700">
          {msg}
        </div>
      )}

      <h3 className="mb-2 mt-6 text-sm font-bold">이벤트 목록</h3>
      <div className="grid gap-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3"
          >
            <button
              onClick={() => toggleActive(row)}
              title={row.active ? "진행중 (클릭시 종료)" : "종료 (클릭시 진행)"}
              className={[
                "h-6 w-11 shrink-0 rounded-full p-0.5 transition",
                row.active ? "bg-emerald-400" : "bg-neutral-300",
              ].join(" ")}
            >
              <span
                className={[
                  "block h-5 w-5 rounded-full bg-white transition",
                  row.active ? "translate-x-5" : "translate-x-0",
                ].join(" ")}
              />
            </button>

            <input
              defaultValue={row.name}
              onBlur={(e) => rename(row, e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.target as HTMLInputElement).blur()
              }
              className="flex-1 rounded border border-transparent px-2 py-1.5 text-sm hover:border-neutral-200 focus:border-sky-400 focus:outline-none"
            />

            <select
              value={row.weekId ?? ""}
              onChange={(e) =>
                changeWeek(row, e.target.value ? Number(e.target.value) : null)
              }
              title="출석 연동 주차 (연동 안 함 = 출석 무관 입찰 가능)"
              className="shrink-0 rounded border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs text-neutral-600 focus:border-sky-400 focus:outline-none"
            >
              <option value="">출석 연동 안 함</option>
              {weeks.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label} 연동
                </option>
              ))}
            </select>

            <span
              className={[
                "shrink-0 rounded px-2 py-1 text-xs",
                row.weekId
                  ? "bg-amber-50 text-amber-600"
                  : "bg-emerald-50 text-emerald-600",
              ].join(" ")}
            >
              {row.weekId ? "출석필수" : "누구나"}
            </span>

            <button
              onClick={() => setEditing(row)}
              className="shrink-0 rounded border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100"
            >
              아이템 등록 ({row.itemCount})
            </button>
            <button
              onClick={() => removeEvent(row)}
              title="삭제"
              className="shrink-0 text-neutral-300 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white py-8 text-center text-sm text-neutral-400">
            등록된 이벤트가 없습니다.
          </div>
        )}
      </div>

      {editing && (
        <ItemRegisterModal
          event={editing}
          onClose={() => setEditing(null)}
          onCountChange={(c) =>
            setRows((rs) =>
              rs.map((r) => (r.id === editing.id ? { ...r, itemCount: c } : r))
            )
          }
        />
      )}
    </section>
  );
}

/* ---------- 아이템 등록 모달 ---------- */

interface EventItem {
  id: number;
  item: { id: number; name: string; rarity: string; category: string };
  _count: { bids: number };
}
interface ItemMaster {
  id: number;
  name: string;
  rarity: string;
  category: string;
}

function ItemRegisterModal({
  event,
  onClose,
  onCountChange,
}: {
  event: EventRow;
  onClose: () => void;
  onCountChange: (count: number) => void;
}) {
  const [items, setItems] = useState<EventItem[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ItemMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/events/${event.id}/items`);
      const d = await res.json();
      setItems(d.items ?? []);
      setLoading(false);
    })();
  }, [event.id]);

  useEffect(() => {
    const q2 = q.trim();
    if (!q2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/items?q=${encodeURIComponent(q2)}`);
      const d = await res.json();
      setResults(d.items ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const addedItemIds = new Set(items.map((i) => i.item.id));

  async function addItem(itemId: number) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/events/${event.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "추가 실패");
      const next = [...items, d.eventItem];
      setItems(next);
      onCountChange(next.length);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  async function createAndAdd() {
    const name = q.trim();
    if (!name) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const d = await res.json();
      const item = d.item;
      if (!res.ok && res.status !== 409) throw new Error(d.message ?? "등록 실패");
      await addItem(item.id);
      setQ("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(eventItemId: number) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/events/${event.id}/items?eventItemId=${eventItemId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      const next = items.filter((i) => i.id !== eventItemId);
      setItems(next);
      onCountChange(next.length);
    } catch {
      setErr("삭제 실패");
    } finally {
      setBusy(false);
    }
  }

  const exactExists = results.some((r) => r.name === q.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-100 p-4">
          <h3 className="text-base font-bold">아이템 등록 · {event.name}</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            ✕
          </button>
        </div>

        <div className="border-b border-neutral-100 p-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="아이템 이름 검색"
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
          />
          {q.trim() && (
            <div className="mt-2 max-h-40 overflow-y-auto rounded border border-neutral-100">
              {results
                .filter((r) => !addedItemIds.has(r.id))
                .map((r) => (
                  <button
                    key={r.id}
                    onClick={() => addItem(r.id)}
                    disabled={busy}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-sky-50"
                  >
                    <span>{r.name}</span>
                    <span className="text-xs text-neutral-400">
                      {r.rarity} · {r.category}
                    </span>
                  </button>
                ))}
              {!exactExists && (
                <button
                  onClick={createAndAdd}
                  disabled={busy}
                  className="w-full px-3 py-2 text-left text-sm text-sky-600 hover:bg-sky-50"
                >
                  “{q.trim()}” 신규 아이템으로 등록하고 추가
                </button>
              )}
            </div>
          )}
          {err && <p className="mt-2 text-sm text-red-500">{err}</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-2 text-xs font-semibold text-neutral-500">
            등록된 입찰 아이템 ({items.length})
          </p>
          {loading ? (
            <p className="py-6 text-center text-sm text-neutral-400">불러오는 중...</p>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-400">
              아직 등록된 아이템이 없습니다.
            </p>
          ) : (
            <ul className="grid gap-1.5">
              {items.map((ei) => (
                <li
                  key={ei.id}
                  className="flex items-center justify-between rounded border border-neutral-100 px-3 py-2 text-sm"
                >
                  <span>{ei.item.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-neutral-400">
                      신청 {ei._count.bids}
                    </span>
                    <button
                      onClick={() => removeItem(ei.id)}
                      disabled={busy}
                      className="text-neutral-300 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-neutral-100 p-3 text-right">
          <button
            onClick={onClose}
            className="rounded bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
          >
            완료
          </button>
        </div>
      </div>
    </div>
  );
}
