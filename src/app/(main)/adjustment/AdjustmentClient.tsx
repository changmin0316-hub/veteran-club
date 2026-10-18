"use client";

import { useEffect, useState } from "react";
import type { WeekOpt, GuildOpt } from "../settlement-types";
import { useSettlement } from "../useSettlement";
import { WeekSelect, GuildTabs } from "../SettlementControls";

export default function AdjustmentClient({
  weeks,
  guilds,
}: {
  weeks: WeekOpt[];
  guilds: GuildOpt[];
}) {
  const { weekId, setWeekId, guildId, setGuildId, data, loading, reload } =
    useSettlement(weeks, guilds);

  const [diamond, setDiamond] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (data) setDiamond(data.week.diamond);
  }, [data]);

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

  const included = data?.rows.filter((r) => !r.excluded) ?? [];
  const totalShare = included.reduce((s, r) => s + r.share, 0);

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
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
                  onChange={(e) => setDiamond(Math.max(0, Number(e.target.value)))}
                  className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                />
                <button
                  onClick={saveDiamond}
                  disabled={busy}
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
                  <th className="px-3 py-2.5 text-left font-semibold">이름</th>
                  <th className="px-3 py-2.5 text-right font-semibold">분배율</th>
                  <th className="px-3 py-2.5 text-right font-semibold">분배금</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-neutral-100 bg-red-50/40">
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
                    <td colSpan={3} className="py-8 text-center text-neutral-400">
                      불러오는 중...
                    </td>
                  </tr>
                )}
                {!loading &&
                  data?.rows.map((r) => (
                    <tr
                      key={r.memberId}
                      className={`border-b border-neutral-50 ${r.excluded ? "text-neutral-300" : ""}`}
                    >
                      <td className="px-3 py-2 font-medium">
                        {r.name}
                        {r.excluded && <span className="ml-1 text-xs">(제외)</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-neutral-500">
                        {(r.shareRatio * 100).toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {r.share.toLocaleString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            분배금 = 실 분배 재원 × (내 출석점수 / 제외 제외한 전체 점수), 원 단위 내림.
          </p>
        </div>
      </div>
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
