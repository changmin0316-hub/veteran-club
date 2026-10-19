"use client";

import { useState } from "react";

interface Week {
  id: number;
  number: number;
  name: string;
}
interface Category {
  id: number;
  name: string;
  weight: number;
  sortOrder: number;
}
interface Guild {
  id: number;
  order: number;
  name: string;
}
interface Boss {
  id: number;
  name: string;
  sortOrder: number;
}

export default function ConfigClient({
  isAdmin,
  initialWeeks,
  initialCategories,
  initialGuilds,
  initialBosses,
}: {
  isAdmin: boolean;
  initialWeeks: Week[];
  initialCategories: Category[];
  initialGuilds: Guild[];
  initialBosses: Boss[];
}) {
  const [weeks, setWeeks] = useState(initialWeeks);
  const [categories, setCategories] = useState(initialCategories);
  const [guilds, setGuilds] = useState(initialGuilds);
  const [bosses, setBosses] = useState(initialBosses);
  const [msg, setMsg] = useState<string | null>(null);

  function flash(m: string) {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 3000);
  }

  async function api(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.message ?? "오류가 발생했습니다.");
    return d;
  }

  return (
    <section>
      <p className="mb-3 rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-500">
        주차·출석 카테고리·군·보스를 관리합니다. 삭제는 관련 데이터에 영향을 줄 수
        있으니 신중히 진행하세요.
      </p>

      {/* 출석 초기화 */}
      <AttendanceReset weeks={weeks} isAdmin={isAdmin} flash={flash} api={api} />

      {msg && (
        <div className="my-3 rounded border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700">
          {msg}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* 주차 */}
        <Panel title="주차">
          <AddRow
            placeholder="주차 이름 ex) 10월 3주차 - 쟁"
            onAdd={async (val) => {
              const d = await api("/api/weeks", "POST", { name: val });
              setWeeks((w) =>
                [
                  { id: d.week.id, number: d.week.number, name: d.week.name },
                  ...w,
                ].sort((a, b) => b.number - a.number)
              );
              flash("주차가 등록되었습니다.");
            }}
          />
          <ul className="mt-2 grid gap-1.5">
            {weeks.map((w) => (
              <EditableRow
                key={w.id}
                value={w.name}
                onSave={async (name) => {
                  await api(`/api/weeks/${w.id}`, "PATCH", { name });
                  setWeeks((ws) =>
                    ws.map((x) => (x.id === w.id ? { ...x, name } : x))
                  );
                  flash("저장되었습니다.");
                }}
              />
            ))}
          </ul>
        </Panel>

        {/* 출석 카테고리 */}
        <Panel title="출석 카테고리">
          <p className="mb-2 text-xs text-neutral-400">
            출석 1건이 몇 점(가중치)으로 반영되는지 설정합니다.
          </p>
          <CategoryAdd
            onAdd={async (name, weight, sortOrder) => {
              const d = await api("/api/categories", "POST", {
                name,
                weight,
                sortOrder,
              });
              setCategories((c) =>
                [...c, d.category].sort((a, b) => a.sortOrder - b.sortOrder)
              );
              flash("카테고리가 등록되었습니다.");
            }}
          />
          <ul className="mt-2 grid gap-1.5">
            {categories.map((c) => (
              <CategoryRow
                key={c.id}
                cat={c}
                isAdmin={isAdmin}
                onSave={async (name, weight) => {
                  await api(`/api/categories/${c.id}`, "PATCH", { name, weight });
                  setCategories((cs) =>
                    cs.map((x) => (x.id === c.id ? { ...x, name, weight } : x))
                  );
                  flash("저장되었습니다.");
                }}
                onDelete={async () => {
                  await api(`/api/categories/${c.id}`, "DELETE");
                  setCategories((cs) => cs.filter((x) => x.id !== c.id));
                  flash("삭제되었습니다.");
                }}
              />
            ))}
          </ul>
        </Panel>

        {/* 군 + 보스 */}
        <div className="grid gap-4">
          <Panel title="길드(군)">
            <GuildAdd
              nextOrder={Math.max(0, ...guilds.map((g) => g.order)) + 1}
              onAdd={async (order, name) => {
                const d = await api("/api/guilds", "POST", { order, name });
                setGuilds((g) =>
                  [...g, d.guild].sort((a, b) => a.order - b.order)
                );
                flash("군이 등록되었습니다.");
              }}
            />
            <ul className="mt-2 grid gap-1.5">
              {guilds.map((g) => (
                <div key={g.id} className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-center text-xs text-neutral-400">
                    {g.order}군
                  </span>
                  <EditableRow
                    value={g.name}
                    onSave={async (name) => {
                      await api(`/api/guilds/${g.id}`, "PATCH", { name });
                      setGuilds((gs) =>
                        gs.map((x) => (x.id === g.id ? { ...x, name } : x))
                      );
                      flash("저장되었습니다.");
                    }}
                  />
                </div>
              ))}
            </ul>
          </Panel>

          <Panel title="보스 (명예의전당)">
            <AddRow
              placeholder="보스 이름 ex) 4층 보스"
              onAdd={async (name) => {
                const d = await api("/api/bosses", "POST", {
                  name,
                  sortOrder: bosses.length,
                });
                setBosses((b) => [...b, d.boss]);
                flash("보스가 등록되었습니다.");
              }}
            />
            <ul className="mt-2 grid gap-1.5">
              {bosses.map((b) => (
                <EditableRow
                  key={b.id}
                  value={b.name}
                  onSave={async (name) => {
                    await api(`/api/bosses/${b.id}`, "PATCH", { name });
                    setBosses((bs) =>
                      bs.map((x) => (x.id === b.id ? { ...x, name } : x))
                    );
                    flash("저장되었습니다.");
                  }}
                  onDelete={async () => {
                    await api(`/api/bosses/${b.id}`, "DELETE");
                    setBosses((bs) => bs.filter((x) => x.id !== b.id));
                    flash("삭제되었습니다.");
                  }}
                />
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </section>
  );
}

/* ---------- 재사용 컴포넌트 ---------- */

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-bold">{title}</h3>
      {children}
    </div>
  );
}

function AddRow({
  placeholder,
  numeric,
  onAdd,
}: {
  placeholder: string;
  numeric?: boolean;
  onAdd: (val: string) => Promise<void>;
}) {
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!val.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await onAdd(val.trim());
      setVal("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex gap-1.5">
        <input
          value={val}
          type={numeric ? "number" : "text"}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={placeholder}
          className="flex-1 rounded border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="rounded bg-neutral-100 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-200 disabled:opacity-50"
        >
          등록
        </button>
      </div>
      {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
    </div>
  );
}

function EditableRow({
  value,
  onSave,
  onDelete,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [v, setV] = useState(value);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const dirty = v !== value;

  return (
    <li className="flex items-center gap-1.5">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="flex-1 rounded border border-neutral-200 px-2.5 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
      />
      <button
        onClick={async () => {
          setBusy(true);
          try {
            await onSave(v);
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy || !dirty}
        className="rounded border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
      >
        수정
      </button>
      {onDelete &&
        (confirming ? (
          <span className="flex items-center gap-1">
            <button
              onClick={async () => {
                setBusy(true);
                try {
                  await onDelete();
                } finally {
                  setBusy(false);
                  setConfirming(false);
                }
              }}
              disabled={busy}
              className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600 disabled:opacity-50"
            >
              삭제
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100"
            >
              취소
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="px-1 text-neutral-300 hover:text-red-500"
            title="삭제"
          >
            ✕
          </button>
        ))}
    </li>
  );
}

function CategoryAdd({
  onAdd,
}: {
  onAdd: (name: string, weight: number, sortOrder: number) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [weight, setWeight] = useState(1);
  const [sortOrder, setSortOrder] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await onAdd(name.trim(), weight, sortOrder);
      setName("");
      setWeight(1);
      setSortOrder(0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex gap-1.5">
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
          title="정렬순"
          className="w-14 rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="카테고리 이름 ex) 고대성채"
          className="flex-1 rounded border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
        />
        <input
          type="number"
          value={weight}
          onChange={(e) => setWeight(Number(e.target.value))}
          title="가중치"
          className="w-14 rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="rounded bg-neutral-100 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-200 disabled:opacity-50"
        >
          등록
        </button>
      </div>
      {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
    </div>
  );
}

function CategoryRow({
  cat,
  isAdmin,
  onSave,
  onDelete,
}: {
  cat: Category;
  isAdmin: boolean;
  onSave: (name: string, weight: number) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [name, setName] = useState(cat.name);
  const [weight, setWeight] = useState(cat.weight);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const dirty = name !== cat.name || weight !== cat.weight;

  return (
    <li className="flex items-center gap-1.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 rounded border border-neutral-200 px-2.5 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
      />
      <input
        type="number"
        value={weight}
        onChange={(e) => setWeight(Number(e.target.value))}
        className="w-14 rounded border border-neutral-200 px-2 py-1.5 text-sm"
      />
      <button
        onClick={async () => {
          setBusy(true);
          try {
            await onSave(name, weight);
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy || !dirty}
        className="rounded border border-neutral-200 px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
      >
        수정
      </button>
      {isAdmin &&
        (confirming ? (
          <span className="flex items-center gap-1">
            <button
              onClick={async () => {
                setBusy(true);
                try {
                  await onDelete();
                } finally {
                  setBusy(false);
                  setConfirming(false);
                }
              }}
              disabled={busy}
              className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600 disabled:opacity-50"
            >
              삭제
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100"
            >
              취소
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="px-1 text-neutral-300 hover:text-red-500"
            title="삭제(관리자)"
          >
            ✕
          </button>
        ))}
    </li>
  );
}

function GuildAdd({
  nextOrder,
  onAdd,
}: {
  nextOrder: number;
  onAdd: (order: number, name: string) => Promise<void>;
}) {
  const [order, setOrder] = useState(nextOrder);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await onAdd(order, name.trim());
      setName("");
      setOrder((o) => o + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex gap-1.5">
        <input
          type="number"
          value={order}
          onChange={(e) => setOrder(Number(e.target.value))}
          title="군 번호"
          className="w-14 rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="길드명"
          className="flex-1 rounded border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="rounded bg-neutral-100 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-200 disabled:opacity-50"
        >
          등록
        </button>
      </div>
      {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
    </div>
  );
}

function AttendanceReset({
  weeks,
  isAdmin,
  flash,
  api,
}: {
  weeks: Week[];
  isAdmin: boolean;
  flash: (m: string) => void;
  api: (url: string, method: string, body?: unknown) => Promise<{ deleted?: number }>;
}) {
  const [weekId, setWeekId] = useState<number | "">(weeks[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  async function reset() {
    if (!weekId) return;
    const wk = weeks.find((w) => w.id === weekId);
    if (!confirm(`'${wk?.name}' 출석 기록을 모두 초기화할까요? 되돌릴 수 없습니다.`))
      return;
    setBusy(true);
    try {
      const d = await api("/api/attendance/reset", "POST", { weekId });
      flash(`출석 ${d.deleted ?? 0}건이 초기화되었습니다.`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-neutral-500">출석 초기화</span>
      <select
        value={weekId}
        onChange={(e) => setWeekId(Number(e.target.value))}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
      >
        {weeks.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      <button
        onClick={reset}
        disabled={busy}
        className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-600 hover:bg-red-100 disabled:opacity-50"
      >
        초기화
      </button>
    </div>
  );
}
