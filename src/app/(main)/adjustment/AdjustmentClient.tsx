"use client";

import { useEffect, useState } from "react";
import type { WeekOpt, GuildOpt } from "../settlement-types";
import { useSettlement } from "../useSettlement";
import { WeekSelect, GuildTabs, SortTh, useRowSort } from "../SettlementControls";

export default function AdjustmentClient({
  weeks,
  guilds,
}: {
  weeks: WeekOpt[];
  guilds: GuildOpt[];
}) {
  const { weekId, setWeekId, guildId, setGuildId, data, loading, reload } =
    useSettlement(weeks, guilds);
  const { sorted, sort, toggle } = useRowSort(data?.rows ?? []);

  const [diamond, setDiamond] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [paidSet, setPaidSet] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (data) {
      setDiamond(data.week.diamond);
      setPaidSet(new Set(data.rows.filter((r) => r.paid).map((r) => r.memberId)));
    }
  }, [data]);

  // 분배금 선지급 완료 표시 토글 (낙관적 업데이트 + 저장)
  async function togglePaid(memberId: number) {
    if (!weekId) return;
    const next = !paidSet.has(memberId);
    setPaidSet((prev) => {
      const s = new Set(prev);
      if (next) s.add(memberId);
      else s.delete(memberId);
      return s;
    });
    try {
      await fetch(`/api/weeks/${weekId}/paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, paid: next }),
      });
    } catch {
      // 실패 시 되돌리기
      setPaidSet((prev) => {
        const s = new Set(prev);
        if (next) s.delete(memberId);
        else s.add(memberId);
        return s;
      });
    }
  }

  function flash(m: string) {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 3000);
  }

  async function saveDiamond() {
    if (!weekId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/weeks/${weekId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diamond }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "입력 실패");
      await reload();
      flash("길드 정산금(다이아)이 반영되었습니다.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  const settled = data?.week.settled ?? false;

  // 현재 주차 다음 주차(주차 번호 오름차순 기준). weeks는 번호 내림차순 정렬 → 이전 인덱스가 다음 주차.
  const nextWeek = (() => {
    const idx = weeks.findIndex((w) => w.id === weekId);
    return idx > 0 ? weeks[idx - 1] : null;
  })();

  async function completeSettle() {
    if (!weekId || !data) return;
    const label = weeks.find((w) => w.id === weekId)?.label ?? "이 주차";
    if (
      !window.confirm(
        `${label} 분배를 완료 처리할까요?\n완료 후에는 해당 주차의 출석·정산 입력이 불가합니다.`
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`/api/weeks/${weekId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settled: true }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "처리 실패");
      if (nextWeek) {
        setWeekId(nextWeek.id);
        flash(`분배 완료 처리되었습니다. ${nextWeek.label}로 이동합니다.`);
      } else {
        await reload();
        flash("분배 완료 처리되었습니다. (마지막 주차)");
      }
    } catch (e) {
      flash(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  async function cancelSettle() {
    if (!weekId) return;
    if (!window.confirm("분배 완료를 취소하고 다시 입력 가능하게 할까요?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/weeks/${weekId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settled: false }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "처리 실패");
      await reload();
      flash("분배 완료가 취소되었습니다.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  const included = data?.rows.filter((r) => !r.excluded) ?? [];
  const totalShare = included.reduce((s, r) => s + r.share, 0);

  return (
    <section>
      <div className="subbar-sticky mb-3 flex items-center gap-2">
        <div className="w-72">
          <WeekSelect weeks={weeks} weekId={weekId} onChange={setWeekId} />
        </div>
      </div>

      <p className="mb-3 rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-500">
        길드 정산금(다이아)을 입력하면 출석 점수·힐비 비율을 반영해 분배금이 계산됩니다.
      </p>

      <div className="mb-3">
        <GuildTabs guilds={guilds} guildId={guildId} onChange={setGuildId} />
      </div>

      {msg && (
        <div className="mb-3 rounded border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700">
          {msg}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* 길드 정산금 입력 + 요약 */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-bold">길드 정산금</h3>
            <label className="grid gap-1 text-xs text-neutral-500">
              <span>다이아 입력</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={diamond}
                  disabled={settled}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setDiamond(Math.max(0, Number(e.target.value)))}
                  className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none disabled:opacity-60"
                />
                <button
                  onClick={saveDiamond}
                  disabled={busy || settled}
                  className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  입력
                </button>
              </div>
            </label>

            <dl className="mt-4 grid gap-2 text-sm">
              <Row label="총 재원(다이아)" value={data?.pool ?? 0} />
              <Row
                label={`제외금액(힐비 ${data?.week.excludeRatio ?? 0}%)`}
                value={data?.excludeAmount ?? 0}
                muted
              />
              <Row label="실 분배 재원" value={data?.distributable ?? 0} strong />
              <Row label="분배 합계" value={totalShare} />
            </dl>
          </div>
        </div>

        {/* 정산 테이블 */}
        <div className="lg:col-span-3">
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
                  <th className="w-10 px-2 py-2.5 text-center font-semibold">지급</th>
                  <SortTh label="이름" k="name" sort={sort} onSort={toggle} align="left" />
                  <SortTh label="분배율" k="shareRatio" sort={sort} onSort={toggle} />
                  <SortTh label="분배금" k="share" sort={sort} onSort={toggle} />
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-neutral-100 bg-red-50/40">
                  <td className="px-2 py-2" />
                  <td className="px-3 py-2 font-medium text-red-500">제외금액</td>
                  <td className="px-3 py-2 text-right text-neutral-400">
                    {data?.week.excludeRatio ?? 0}%
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-red-500">
                    {(data?.excludeAmount ?? 0).toLocaleString()}
                  </td>
                </tr>
                {loading && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-neutral-400">
                      불러오는 중...
                    </td>
                  </tr>
                )}
                {!loading &&
                  sorted.map((r) => {
                    const paid = paidSet.has(r.memberId);
                    return (
                    <tr
                      key={r.memberId}
                      className={`border-b border-neutral-50 ${
                        paid
                          ? "bg-emerald-50"
                          : r.excluded
                            ? "text-neutral-300"
                            : "hover:bg-neutral-50"
                      }`}
                    >
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={paid}
                          onChange={() => togglePaid(r.memberId)}
                          className="h-4 w-4 cursor-pointer accent-emerald-600"
                          title="분배금 지급 완료 표시"
                        />
                      </td>
                      <td
                        onClick={() => togglePaid(r.memberId)}
                        className={`cursor-pointer select-none px-3 py-2 font-medium ${
                          paid ? "text-emerald-700" : ""
                        }`}
                        title="클릭하면 지급 완료로 표시됩니다"
                      >
                        {r.name}
                        {paid && <span className="ml-1 text-xs text-emerald-600">✔ 지급</span>}
                        {r.excluded && <span className="ml-1 text-xs">(제외)</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-neutral-500">
                        {(r.shareRatio * 100).toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {r.share.toLocaleString()}
                      </td>
                    </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            분배금 = 실 분배 재원 × (내 출석점수 / 제외 제외한 전체 점수), 원 단위 내림.
          </p>
        </div>
      </div>

      {/* 분배 완료 처리 */}
      {weekId && (
        <div className="mt-5 flex flex-col items-center gap-2 border-t border-neutral-200 pt-5">
          {settled ? (
            <>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                ✔ 분배 완료된 주차입니다 (출석·정산 입력 잠김)
              </span>
              <button
                onClick={cancelSettle}
                disabled={busy}
                className="text-xs text-neutral-400 hover:text-red-500"
              >
                분배 완료 취소
              </button>
            </>
          ) : (
            <>
              <button
                onClick={completeSettle}
                disabled={busy || loading}
                className="rounded-lg bg-emerald-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                분배 완료
              </button>
              <p className="text-xs text-neutral-400">
                완료 시 이 주차의 출석·정산 입력이 잠기고
                {nextWeek ? ` ${nextWeek.label}로 자동 이동합니다.` : " (다음 주차 없음)"}
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: number;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className={muted ? "text-neutral-400" : "text-neutral-500"}>{label}</dt>
      <dd
        className={[
          "tabular-nums",
          strong ? "font-bold text-sky-700" : "font-semibold",
          muted ? "text-red-500" : "",
        ].join(" ")}
      >
        {value.toLocaleString()}
      </dd>
    </div>
  );
}
