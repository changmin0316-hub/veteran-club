"use client";

import { useEffect, useState } from "react";
import type { WeekOpt, GuildOpt } from "../settlement-types";
import { useSettlement } from "../useSettlement";
import { WeekSelect, GuildTabs } from "../SettlementControls";

export default function ClosingClient({
  weeks,
  guilds,
}: {
  weeks: WeekOpt[];
  guilds: GuildOpt[];
}) {
  const { weekId, setWeekId, guildId, setGuildId, data, loading, reload } =
    useSettlement(weeks, guilds);

  const [ratio, setRatio] = useState<number>(0);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [extraMemberId, setExtraMemberId] = useState<number | "">("");
  const [extraAmount, setExtraAmount] = useState<number>(0);

  // 데이터 로드 시 로컬 상태 동기화
  useEffect(() => {
    if (data) {
      setRatio(data.week.excludeRatio);
      setExcluded(new Set(data.rows.filter((r) => r.excluded).map((r) => r.memberId)));
    }
  }, [data]);

  function flash(m: string) {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 3000);
  }

  async function saveExtra() {
    if (!weekId) return;
    if (!extraMemberId) return flash("길드원을 선택하세요.");
    setBusy(true);
    try {
      const res = await fetch(`/api/weeks/${weekId}/extra`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: Number(extraMemberId),
          amount: extraAmount,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "변경 실패");
      const nm = data?.rows.find((r) => r.memberId === Number(extraMemberId))?.name;
      await reload();
      flash(
        extraAmount > 0
          ? `${nm} 추가 분배금 ${extraAmount.toLocaleString()}원 반영`
          : `${nm} 추가 분배금 해제`
      );
    } catch (e) {
      flash(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  async function saveRatio() {
    if (!weekId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/weeks/${weekId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excludeRatio: ratio }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "변경 실패");
      await reload();
      flash("힐비 비율이 변경되었습니다.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  async function saveExclusions() {
    if (!weekId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/weeks/${weekId}/exclusions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds: [...excluded] }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "저장 실패");
      await reload();
      flash("분배 제외 대상이 저장되었습니다.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  function toggle(memberId: number) {
    setExcluded((s) => {
      const next = new Set(s);
      next.has(memberId) ? next.delete(memberId) : next.add(memberId);
      return next;
    });
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <div className="w-72">
          <WeekSelect weeks={weeks} weekId={weekId} onChange={setWeekId} />
        </div>
      </div>

      <p className="mb-3 rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-500">
        누적 금액에서 제외금(힐비) 비율을 조정할 수 있습니다. 시즌별 분배 제외 대상을
        지정할 수 있습니다.
      </p>

      <div className="mb-3">
        <GuildTabs guilds={guilds} guildId={guildId} onChange={setGuildId} />
      </div>

      {/* 힐비 비율 */}
      <div className="mb-3 flex items-end gap-2">
        <label className="grid gap-1 text-xs text-neutral-500">
          <span>제외 분배금 비율(%)</span>
          <input
            type="number"
            min={0}
            max={100}
            value={ratio}
            onChange={(e) => setRatio(Math.min(100, Math.max(0, Number(e.target.value))))}
            className="w-40 rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
          />
        </label>
        <button
          onClick={saveRatio}
          disabled={busy}
          className="rounded border border-neutral-300 bg-neutral-50 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          변경
        </button>
      </div>

      {/* 추가 분배금 */}
      <div className="mb-3 rounded-lg border border-neutral-200 bg-white p-3">
        <p className="mb-2 text-xs font-medium text-neutral-600">추가 분배금</p>
        <div className="flex flex-wrap items-end gap-2">
          <select
            value={extraMemberId}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : "";
              setExtraMemberId(id);
              const cur = data?.rows.find((r) => r.memberId === id)?.extra ?? 0;
              setExtraAmount(cur);
            }}
            className="rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
          >
            <option value="">캐릭터 선택</option>
            {(data?.rows ?? []).map((r) => (
              <option key={r.memberId} value={r.memberId}>
                {r.name}
                {r.extra > 0 ? ` (현재 ${r.extra.toLocaleString()}원)` : ""}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              value={extraAmount}
              onChange={(e) => setExtraAmount(Math.max(0, Number(e.target.value)))}
              className="w-32 rounded border border-neutral-300 px-3 py-2 text-right text-sm focus:border-sky-400 focus:outline-none"
            />
            <span className="text-sm text-neutral-500">원</span>
          </div>
          <button
            onClick={saveExtra}
            disabled={busy}
            className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            변경
          </button>
        </div>
        {(data?.rows ?? []).some((r) => r.extra > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(data?.rows ?? [])
              .filter((r) => r.extra > 0)
              .map((r) => (
                <span
                  key={r.memberId}
                  className="rounded bg-sky-50 px-2 py-1 text-xs text-sky-700"
                >
                  {r.name} +{r.extra.toLocaleString()}원
                </span>
              ))}
          </div>
        )}
      </div>

      {msg && (
        <div className="mb-3 rounded border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700">
          {msg}
        </div>
      )}

      <div className="mb-2 flex items-center justify-between rounded-lg bg-neutral-100 px-4 py-2.5 text-sm text-neutral-500">
        <span>분배 제외시킬 길드원을 선택해주세요</span>
        <button
          onClick={saveExclusions}
          disabled={busy}
          className="rounded bg-sky-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          저장
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
              <th className="w-12 px-3 py-2.5" />
              <th className="px-3 py-2.5 text-left font-semibold">캐릭터이름</th>
              <th className="px-3 py-2.5 text-right font-semibold">3대</th>
              <th className="px-3 py-2.5 text-right font-semibold">출석율</th>
              <th className="px-3 py-2.5 text-right font-semibold">분배금</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-neutral-400">
                  불러오는 중...
                </td>
              </tr>
            )}
            {!loading &&
              data?.rows.map((r) => {
                const isExcluded = excluded.has(r.memberId);
                return (
                  <tr
                    key={r.memberId}
                    className={`border-b border-neutral-50 ${isExcluded ? "bg-red-50/40" : "hover:bg-neutral-50"}`}
                  >
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={isExcluded}
                        onChange={() => toggle(r.memberId)}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {r.statTotal.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-neutral-500">
                      {(r.attendanceRate * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isExcluded ? (
                        <span className="text-red-400">제외</span>
                      ) : (
                        r.share.toLocaleString()
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
