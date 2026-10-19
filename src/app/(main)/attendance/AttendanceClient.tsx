"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { WeekOpt, GuildOpt } from "../settlement-types";
import { useSettlement } from "../useSettlement";
import { WeekSelect, GuildTabs } from "../SettlementControls";

type Edits = Record<string, number>; // `${memberId}:${categoryId}` -> count

export default function AttendanceClient({
  weeks,
  guilds,
  isManager,
  myName,
}: {
  weeks: WeekOpt[];
  guilds: GuildOpt[];
  isManager: boolean;
  myName: string | null;
}) {
  const router = useRouter();
  const { weekId, setWeekId, guildId, setGuildId, data, loading, error, reload } =
    useSettlement(weeks, guilds);
  const [edits, setEdits] = useState<Edits>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 주차/군 변경 시 편집 초기화
  useEffect(() => {
    setEdits({});
  }, [weekId, guildId]);

  function flash(m: string) {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 3000);
  }

  function cellValue(memberId: number, categoryId: number): number {
    const key = `${memberId}:${categoryId}`;
    if (key in edits) return edits[key];
    const row = data?.rows.find((r) => r.memberId === memberId);
    return row?.counts[categoryId] ?? 0;
  }

  function setCell(memberId: number, categoryId: number, v: number) {
    setEdits((e) => ({ ...e, [`${memberId}:${categoryId}`]: Math.max(0, v) }));
  }

  async function save() {
    if (!weekId || Object.keys(edits).length === 0) {
      flash("변경된 출석이 없습니다.");
      return;
    }
    setBusy(true);
    try {
      const entries = Object.entries(edits).map(([k, count]) => {
        const [memberId, categoryId] = k.split(":").map(Number);
        return { memberId, categoryId, count };
      });
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekId, entries }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "저장 실패");
      setEdits({});
      await reload();
      flash(`${d.saved}건 출석 저장 완료`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  const dirtyCount = Object.keys(edits).length;
  const baseCols = isManager ? 5 : 3; // 캐릭명·출석율·적용횟수(+분배율·분배금)
  // 길드원(비관리자)은 본인 행만 표시
  const rowsToShow = data
    ? isManager
      ? data.rows
      : data.rows.filter((r) => myName != null && r.name === myName)
    : [];

  return (
    <section>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="sm:w-72">
          <WeekSelect weeks={weeks} weekId={weekId} onChange={setWeekId} />
        </div>
        <div className="flex-1" />
        {isManager && (
          <>
            <button
              onClick={() =>
                router.push(`/attendance/new${guildId ? `?squad=${guildId}` : ""}`)
              }
              className="rounded border border-sky-300 bg-white px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50"
            >
              출석등록
            </button>
            <button
              onClick={save}
              disabled={busy || dirtyCount === 0}
              className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              출석 저장{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
            </button>
          </>
        )}
      </div>

      <div className="mb-3">
        <GuildTabs guilds={guilds} guildId={guildId} onChange={setGuildId} />
      </div>

      {msg && (
        <div className="mb-3 rounded border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700">
          {msg}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
              <th className="px-3 py-2.5 text-left font-semibold">캐릭명</th>
              <th className="px-3 py-2.5 text-left font-semibold">출석율</th>
              {isManager && (
                <>
                  <th className="px-3 py-2.5 text-right font-semibold">분배율</th>
                  <th className="px-3 py-2.5 text-right font-semibold">분배금</th>
                </>
              )}
              <th className="px-3 py-2.5 text-right font-semibold">적용횟수</th>
              {data?.categories.map((c) => (
                <th key={c.id} className="px-2 py-2.5 text-center font-semibold">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={baseCols + (data?.categories.length ?? 0)} className="py-8 text-center text-neutral-400">
                  불러오는 중...
                </td>
              </tr>
            )}
            {!loading &&
              rowsToShow.map((r) => {
                const mine = myName != null && r.name === myName;
                return (
                <tr
                  key={r.memberId}
                  className={`border-b border-neutral-50 ${
                    mine
                      ? "bg-sky-50"
                      : r.excluded
                        ? "bg-neutral-50 text-neutral-400"
                        : ""
                  }`}
                >
                  <td className="px-3 py-2 font-medium">
                    {r.name}
                    {mine && (
                      <span className="ml-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                        나
                      </span>
                    )}
                    {r.excluded && (
                      <span className="ml-1 text-xs text-red-400">(제외)</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className="h-full rounded-full bg-emerald-400"
                          style={{ width: `${Math.round(r.attendanceRate * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-neutral-500">
                        {(r.attendanceRate * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  {isManager && (
                    <>
                      <td className="px-3 py-2 text-right text-neutral-500">
                        {(r.shareRatio * 100).toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {r.share.toLocaleString()}
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2 text-right text-neutral-500">
                    {r.applied}
                  </td>
                  {(data?.categories ?? []).map((c) => (
                    <td key={c.id} className="px-2 py-1.5 text-center">
                      {isManager ? (
                        <input
                          type="number"
                          min={0}
                          value={cellValue(r.memberId, c.id)}
                          onChange={(e) =>
                            setCell(r.memberId, c.id, Number(e.target.value))
                          }
                          className="w-14 rounded border border-transparent bg-transparent px-1 py-1 text-center hover:border-neutral-200 focus:border-sky-400 focus:bg-white focus:outline-none"
                        />
                      ) : (
                        <span className="text-neutral-700">
                          {r.counts[c.id] ?? 0}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
                );
              })}
            {!loading && data && rowsToShow.length === 0 && (
              <tr>
                <td colSpan={baseCols + data.categories.length} className="py-8 text-center text-neutral-400">
                  {isManager ? "해당 군에 길드원이 없습니다." : "본인 출석 정보가 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-neutral-400">
        {isManager
          ? "출석 점수 = Σ(횟수 × 카테고리 가중치) · 분배율 = 내 점수 / 제외 제외한 전체 점수 · 분배금은 [분배금 정산]의 다이아 재원과 [결산]의 힐비 비율을 반영합니다."
          : "출석율은 최고 출석자 대비 비율입니다. 파란 '나' 표시가 본인 행입니다."}
      </p>

    </section>
  );
}
