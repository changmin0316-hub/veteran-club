"use client";

import { useEffect, useState } from "react";

export interface ItemRow {
  id: number;
  name: string;
  rarity: string;
  category: string;
  basePrice: number;
}

const RARITIES = ["일반", "고급", "희귀", "영웅", "전설"];
const CATEGORIES = ["무기", "방어구", "장신구", "기타"];

export default function ItemClient({
  initialRows,
  total,
}: {
  initialRows: ItemRow[];
  total: number;
}) {
  const [rows, setRows] = useState<ItemRow[]>(initialRows);
  const [count, setCount] = useState(total);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 등록 폼
  const [newName, setNewName] = useState("");
  const [newRarity, setNewRarity] = useState("일반");
  const [newCategory, setNewCategory] = useState("무기");
  const [newPrice, setNewPrice] = useState(0);

  function flash(m: string) {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 3000);
  }

  // 검색 (디바운스)
  useEffect(() => {
    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/items?limit=100${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`
      );
      const d = await res.json();
      setRows(d.items ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function create() {
    if (!newName.trim()) return flash("아이템 이름을 입력하세요.");
    setBusy(true);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          rarity: newRarity,
          category: newCategory,
          basePrice: newPrice,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "등록 실패");
      setRows((r) => [d.item, ...r]);
      setCount((c) => c + 1);
      setNewName("");
      setNewPrice(0);
      flash("아이템이 등록되었습니다.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  async function patch(row: ItemRow, p: Partial<ItemRow>) {
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...p } : r)));
    const res = await fetch(`/api/items/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (!res.ok) {
      setRows((rs) => rs.map((r) => (r.id === row.id ? row : r)));
      flash("저장 실패");
    }
  }

  async function remove(row: ItemRow) {
    if (!confirm(`'${row.name}' 아이템을 삭제할까요?`)) return;
    const res = await fetch(`/api/items/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      setRows((rs) => rs.filter((r) => r.id !== row.id));
      setCount((c) => c - 1);
      flash("삭제되었습니다.");
    } else {
      flash("삭제 실패");
    }
  }

  return (
    <section>
      <h2 className="mb-2 text-base font-bold">아이템 등록</h2>
      <p className="mb-3 rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-500">
        아이템을 등록·수정·삭제합니다. 이름으로 검색할 수 있습니다.
      </p>

      {/* 등록 폼 */}
      <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="아이템 이름"
            className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
          />
          <select
            value={newRarity}
            onChange={(e) => setNewRarity(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          >
            {RARITIES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={newPrice}
            onChange={(e) => setNewPrice(Number(e.target.value))}
            placeholder="기본가격"
            className="w-28 rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            onClick={create}
            disabled={busy}
            className="rounded bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            등록
          </button>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="아이템 검색"
          className="w-full max-w-xs rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
        />
        <span className="shrink-0 text-sm text-neutral-400">
          아이템 리스트 {count}
        </span>
      </div>

      {msg && (
        <div className="mb-3 rounded border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700">
          {msg}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
              <th className="px-3 py-2.5 text-left font-semibold">아이템 이름</th>
              <th className="px-3 py-2.5 text-left font-semibold">등급</th>
              <th className="px-3 py-2.5 text-left font-semibold">카테고리</th>
              <th className="px-3 py-2.5 text-right font-semibold">기본가격</th>
              <th className="w-12 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-neutral-50 hover:bg-neutral-50">
                <td className="px-3 py-1.5">
                  <input
                    defaultValue={r.name}
                    onBlur={(e) =>
                      e.target.value !== r.name &&
                      patch(r, { name: e.target.value })
                    }
                    className="w-full rounded border border-transparent px-2 py-1 hover:border-neutral-200 focus:border-sky-400 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <select
                    value={r.rarity}
                    onChange={(e) => patch(r, { rarity: e.target.value })}
                    className="rounded border border-transparent px-1 py-1 hover:border-neutral-200 focus:border-sky-400 focus:outline-none"
                  >
                    {RARITIES.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <select
                    value={r.category}
                    onChange={(e) => patch(r, { category: e.target.value })}
                    className="rounded border border-transparent px-1 py-1 hover:border-neutral-200 focus:border-sky-400 focus:outline-none"
                  >
                    {CATEGORIES.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-1.5 text-right">
                  <input
                    type="number"
                    min={0}
                    defaultValue={r.basePrice}
                    onBlur={(e) =>
                      Number(e.target.value) !== r.basePrice &&
                      patch(r, { basePrice: Number(e.target.value) })
                    }
                    className="w-24 rounded border border-transparent px-2 py-1 text-right hover:border-neutral-200 focus:border-sky-400 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-1.5 text-center">
                  <button
                    onClick={() => remove(r)}
                    className="rounded bg-red-500 px-2.5 py-1 text-xs text-white hover:bg-red-600"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-neutral-400">
                  {q ? "검색 결과가 없습니다." : "등록된 아이템이 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!q && count > rows.length && (
        <p className="mt-2 text-xs text-neutral-400">
          전체 {count}개 중 {rows.length}개 표시. 검색으로 원하는 아이템을 찾으세요.
        </p>
      )}
    </section>
  );
}
