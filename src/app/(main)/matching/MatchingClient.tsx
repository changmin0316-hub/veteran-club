"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type Side = "아군" | "적군" | "중립";
export interface MatchGuildRow {
  id: number;
  server: string;
  faction: string;
  name: string;
  side: Side;
  grade: number;
}

const SIDES: Side[] = ["아군", "적군", "중립"];
const SERVERS = ["럭스", "녹스", "비타", "마레", "솔라"];
const FACTIONS = ["피데스", "모르스", "살루스", "호노르", "메투스", "돌로르"];

export default function MatchingClient({ initial }: { initial: MatchGuildRow[] }) {
  const router = useRouter();
  const [server, setServer] = useState(SERVERS[0]);
  const [faction, setFaction] = useState(FACTIONS[0]);
  const [name, setName] = useState("");
  const [side, setSide] = useState<Side>("적군");
  const [grade, setGrade] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const byServer = useMemo(() => {
    const m = new Map<string, MatchGuildRow[]>();
    for (const g of initial) {
      if (!m.has(g.server)) m.set(g.server, []);
      m.get(g.server)!.push(g);
    }
    return [...m.entries()];
  }, [initial]);

  async function add() {
    setErr("");
    if (!server) return setErr("서버를 선택하세요.");
    if (!name.trim()) return setErr("길드 이름을 입력하세요.");
    setBusy(true);
    try {
      const res = await fetch("/api/matching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ server, faction, name: name.trim(), side, grade }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(d?.message ?? "등록 실패");
        return;
      }
      setName("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeGuild(id: number) {
    const res = await fetch(`/api/matching/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  async function resetServer(srv: string) {
    if (!window.confirm(`"${srv}" 서버의 길드 리스트를 전부 삭제할까요?`)) return;
    const res = await fetch(`/api/matching?server=${encodeURIComponent(srv)}`, {
      method: "DELETE",
    });
    if (res.ok) router.refresh();
  }

  return (
    <section>
      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
        매칭표(준비중) — 서버별 길드 정보를 등록해 두면, 추후 주단위 매칭 분석에 활용됩니다.
      </div>

      {/* 길드 등록 */}
      <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-neutral-700">길드 등록</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-28">
            <label className="mb-1 block text-xs text-neutral-500">서버</label>
            <select value={server} onChange={(e) => setServer(e.target.value)} className={input}>
              {SERVERS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label className="mb-1 block text-xs text-neutral-500">세력</label>
            <select value={faction} onChange={(e) => setFaction(e.target.value)} className={input}>
              {FACTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[150px] flex-1">
            <label className="mb-1 block text-xs text-neutral-500">길드 이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="길드 이름"
              className={input}
            />
          </div>
          <div className="w-28">
            <label className="mb-1 block text-xs text-neutral-500">아군/적군</label>
            <select value={side} onChange={(e) => setSide(e.target.value as Side)} className={input}>
              {SIDES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label className="mb-1 block text-xs text-neutral-500">등급</label>
            <select
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value))}
              className={input}
            >
              <option value={1}>★</option>
              <option value={2}>★★</option>
              <option value={3}>★★★</option>
            </select>
          </div>
          <button
            onClick={add}
            disabled={busy}
            className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            추가
          </button>
        </div>
        {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
      </div>

      {/* 서버별 길드 리스트 */}
      {byServer.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white py-10 text-center text-sm text-neutral-400">
          등록된 길드가 없습니다.
        </div>
      ) : (
        <div className="grid gap-3">
          {byServer.map(([srv, list]) => (
            <div key={srv} className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-semibold">{srv}</span>
                <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                  {list.length}개 길드
                </span>
                <button
                  onClick={() => resetServer(srv)}
                  className="ml-auto rounded border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-600 hover:bg-red-100"
                >
                  서버 리셋
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {list.map((g) => (
                  <span
                    key={g.id}
                    className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium ring-1 ${sideCls(g.side)}`}
                  >
                    <span className="rounded bg-black/10 px-1 text-[10px]">{g.side}</span>
                    {g.faction && (
                      <span className="rounded bg-black/10 px-1 text-[10px]">{g.faction}</span>
                    )}
                    <span>{g.name}</span>
                    <span className="text-amber-500">{"★".repeat(g.grade)}</span>
                    <button
                      onClick={() => removeGuild(g.id)}
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
    </section>
  );
}

const input =
  "w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none";

function sideCls(side: Side): string {
  if (side === "아군") return "bg-sky-500/15 text-sky-300 ring-sky-500/40";
  if (side === "적군") return "bg-red-500/15 text-red-300 ring-red-500/40";
  return "bg-neutral-500/15 text-neutral-300 ring-neutral-500/40";
}
