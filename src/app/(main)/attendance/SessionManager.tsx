"use client";

import { useCallback, useEffect, useState } from "react";

interface SessMember {
  id: number;
  name: string;
}
interface RosterMember {
  id: number;
  name: string;
  guildId: number | null;
}
interface Session {
  id: number;
  time: string;
  plays: number;
  actorName: string;
  createdAt: string;
  categoryId: number;
  categoryName: string;
  guildId: number | null;
  guildName: string;
  members: SessMember[];
}

export default function SessionManager({
  weekId,
  settled,
  onChanged,
}: {
  weekId: number | null;
  settled: boolean;
  onChanged: () => void;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!weekId) {
      setSessions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/sessions?weekId=${weekId}`);
      const d = await res.json();
      setSessions(d.sessions ?? []);
      setRoster(d.roster ?? []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [weekId]);

  useEffect(() => {
    load();
    setEditId(null);
  }, [load]);

  function flash(m: string) {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 3000);
  }

  function startEdit(s: Session) {
    setEditId(s.id);
    setDraft(new Set(s.members.map((m) => m.id)));
  }

  function toggle(id: number) {
    setDraft((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function saveEdit(s: Session) {
    setBusy(true);
    try {
      const res = await fetch(`/api/attendance/sessions/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds: [...draft] }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "저장 실패");
      setEditId(null);
      await load();
      onChanged();
      flash("참석자 수정 완료");
    } catch (e) {
      flash(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: Session) {
    if (!window.confirm(`이 출석 기록(${s.categoryName}, ${s.members.length}명)을 삭제할까요? 누적 출석에서 차감됩니다.`))
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/attendance/sessions/${s.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "삭제 실패");
      await load();
      onChanged();
      flash("출석 기록 삭제 완료");
    } catch (e) {
      flash(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  // 편집 중인 세션의 소속에 맞는 후보 길드원
  const candidates = (s: Session) =>
    roster.filter((m) => (s.guildId ? m.guildId === s.guildId : true));

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">
          출석 등록 기록{" "}
          <span className="text-neutral-400">({sessions.length})</span>
        </h3>
        {msg && <span className="text-xs text-sky-600">{msg}</span>}
      </div>
      <p className="mb-2 text-xs text-neutral-400">
        각 출석 등록 건을 개별로 확인·수정할 수 있습니다. 참석자를 바꾸거나 삭제하면 위의 누적 출석현황에 자동 반영됩니다.
      </p>

      {loading && <p className="py-4 text-center text-sm text-neutral-400">불러오는 중...</p>}
      {!loading && sessions.length === 0 && (
        <p className="rounded-lg border border-dashed border-neutral-200 py-6 text-center text-sm text-neutral-400">
          이 주차의 출석 등록 기록이 없습니다.
        </p>
      )}

      <div className="space-y-2">
        {sessions.map((s) => (
          <div
            key={s.id}
            className="rounded-lg border border-neutral-200 bg-white p-3"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                {s.guildName}
              </span>
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                {s.categoryName}
              </span>
              {s.time && (
                <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                  ⏱ {s.time}
                </span>
              )}
              <span className="text-xs text-neutral-400">×{s.plays}회</span>
              <span className="text-xs text-neutral-400">
                {s.members.length}명
              </span>
              <span className="ml-auto text-xs text-neutral-400">
                {fmt(s.createdAt)}
                {s.actorName ? ` · ${s.actorName}` : ""}
              </span>
            </div>

            {editId === s.id ? (
              <div className="mt-3">
                <div className="mb-2 text-xs text-neutral-500">
                  참석자 선택 ({draft.size}/{candidates(s).length})
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {candidates(s).map((m) => {
                    const on = draft.has(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggle(m.id)}
                        className={[
                          "rounded px-2.5 py-1.5 text-left text-xs transition",
                          on
                            ? "bg-sky-100 text-sky-700 ring-1 ring-sky-300"
                            : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
                        ].join(" ")}
                      >
                        {on ? "✓ " : ""}
                        {m.name}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => setEditId(null)}
                    disabled={busy}
                    className="rounded border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => saveEdit(s)}
                    disabled={busy}
                    className="rounded bg-sky-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    {busy ? "저장 중..." : "참석자 저장"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-start gap-2">
                <div className="flex-1 flex flex-wrap gap-1">
                  {s.members.map((m) => (
                    <span
                      key={m.id}
                      className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
                    >
                      {m.name}
                    </span>
                  ))}
                  {s.members.length === 0 && (
                    <span className="text-xs text-neutral-400">참석자 없음</span>
                  )}
                </div>
                {!settled && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => startEdit(s)}
                      className="rounded border border-sky-300 px-2.5 py-1 text-xs text-sky-700 hover:bg-sky-50"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => remove(s)}
                      disabled={busy}
                      className="rounded border border-red-300 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
