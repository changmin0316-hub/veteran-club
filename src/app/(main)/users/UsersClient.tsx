"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type RoleValue = "ADMIN" | "COMMANDER" | "MEMBER";

export interface MemberRow {
  id: number;
  name: string;
  job: string;
  role: RoleValue;
  guildId: number | null;
  attack: number;
  defense: number;
  accuracy: number;
  myth1: string;
  myth2: string;
  myth3: string;
  skill1: boolean;
  skill2: boolean;
  pvpKills: number;
  itemCollection: number;
  bossKills: Record<string, boolean>;
}

export interface GuildOpt {
  id: number;
  order: number;
  name: string;
  count: number;
}

export interface BossOpt {
  id: number;
  name: string;
}

export interface StatDelta {
  attack: number;
  defense: number;
  accuracy: number;
  total: number;
  itemCollection: number;
}
// 전월 말일 기준선 (멤버별). 현재 입력값과 비교해 증감을 계산.
export interface BaselineStat {
  attack: number;
  defense: number;
  accuracy: number;
  itemCollection: number;
}
export type BaselineMap = Record<number, BaselineStat | undefined>;

const ROLE_LABEL: Record<RoleValue, string> = {
  ADMIN: "관리자",
  COMMANDER: "운영진",
  MEMBER: "길드원",
};
// 직책 정렬 순서 (높을수록 위)
const ROLE_RANK: Record<RoleValue, number> = { ADMIN: 2, COMMANDER: 1, MEMBER: 0 };
// 캐릭명 색상 (직책 구분)
const ROLE_NAME_CLS: Record<RoleValue, string> = {
  ADMIN: "text-amber-600 font-bold",
  COMMANDER: "text-sky-600 font-semibold",
  MEMBER: "",
};
// 직업 축약
const JOBS_ALL = [
  "엘리멘탈리스트",
  "디바인캐스터",
  "데스브링어",
  "건슬링어",
  "워로드",
  "뱅가드",
  "나이트레인저",
  "디스트로이어",
  "버서커",
  "어쌔신",
];
const JOB_SHORT: Record<string, string> = {
  엘리멘탈리스트: "엘리",
  디바인캐스터: "디바인",
  데스브링어: "데브",
  건슬링어: "건슬",
  워로드: "워로드",
  뱅가드: "뱅가드",
  나이트레인저: "나레",
  디스트로이어: "디트",
  버서커: "버서",
  어쌔신: "어쌔",
};
const shortJob = (j: string) => JOB_SHORT[j] ?? j;

type SortKey =
  | "name"
  | "attack"
  | "defense"
  | "accuracy"
  | "total"
  | "itemCollection";

function bossKillsChanged(
  a: Record<string, boolean>,
  b: Record<string, boolean>,
  bosses: BossOpt[]
): boolean {
  return bosses.some((boss) => !!a[boss.id] !== !!b[boss.id]);
}

export default function UsersClient({
  initialRows,
  guilds,
  bosses,
  baseline,
  myRole,
}: {
  initialRows: MemberRow[];
  guilds: GuildOpt[];
  bosses: BossOpt[];
  baseline: BaselineMap;
  myRole: RoleValue;
}) {
  const isAdmin = myRole === "ADMIN";
  const isManager = myRole === "ADMIN" || myRole === "COMMANDER";

  // 현재 입력값(행) vs 전월 말일 기준선 → 실시간 증감 계산
  function rowDelta(r: MemberRow): StatDelta | null {
    const b = baseline[r.id];
    if (!b) return null;
    return {
      attack: r.attack - b.attack,
      defense: r.defense - b.defense,
      accuracy: r.accuracy - b.accuracy,
      total:
        r.attack + r.defense + r.accuracy - (b.attack + b.defense + b.accuracy),
      itemCollection: r.itemCollection - b.itemCollection,
    };
  }

  const [rows, setRows] = useState<MemberRow[]>(initialRows);
  const [original, setOriginal] = useState<Map<number, MemberRow>>(
    () => new Map(initialRows.map((r) => [r.id, { ...r }]))
  );
  const [activeGuild, setActiveGuild] = useState<number | "all">("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(
    null
  );

  const visible = useMemo(() => {
    const q = search.trim();
    const filtered = rows.filter(
      (r) =>
        (activeGuild === "all" || r.guildId === activeGuild) &&
        (!q || r.name.includes(q) || (r.job ?? "").includes(q))
    );
    // 관리자/운영진은 항상 상단 (직책순). 그 안에서 정렬/이름순 적용
    const dir = sort ? (sort.dir === "asc" ? 1 : -1) : 1;
    const val = (r: MemberRow) =>
      !sort
        ? r.name
        : sort.key === "name"
          ? r.name
          : sort.key === "total"
            ? r.attack + r.defense + r.accuracy
            : r[sort.key];
    return [...filtered].sort((a, b) => {
      const rr = ROLE_RANK[b.role] - ROLE_RANK[a.role];
      if (rr !== 0) return rr;
      const va = val(a);
      const vb = val(b);
      if (typeof va === "string" && typeof vb === "string")
        return va.localeCompare(vb) * dir;
      return ((va as number) - (vb as number)) * dir;
    });
  }, [rows, activeGuild, search, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev && prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" }
    );
  }

  // 요약 집계
  const summary = useMemo(() => {
    // 선택한 군(전체/1군/2군/…)에 맞춰 집계
    const scoped =
      activeGuild === "all" ? rows : rows.filter((r) => r.guildId === activeGuild);
    const byRole = { ADMIN: 0, COMMANDER: 0, MEMBER: 0 } as Record<RoleValue, number>;
    let totalSum = 0;
    for (const r of scoped) {
      byRole[r.role] = (byRole[r.role] ?? 0) + 1;
      totalSum += r.attack + r.defense + r.accuracy;
    }
    return {
      count: scoped.length,
      byRole,
      totalSum,
      avgTotal: scoped.length ? Math.round(totalSum / scoped.length) : 0,
    };
  }, [rows, activeGuild]);

  // 직업별 인원 통계 (인원 많은 순)
  const jobStats = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const j = r.job?.trim() || "미지정";
      m.set(j, (m.get(j) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([job, count]) => ({ job, count }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);
  const jobMax = jobStats[0]?.count ?? 1;

  const dirtyIds = useMemo(() => {
    const ids: number[] = [];
    for (const r of rows) {
      const o = original.get(r.id);
      if (!o) continue;
      if (
        o.job !== r.job ||
        o.role !== r.role ||
        o.guildId !== r.guildId ||
        o.attack !== r.attack ||
        o.defense !== r.defense ||
        o.accuracy !== r.accuracy ||
        o.myth1 !== r.myth1 ||
        o.myth2 !== r.myth2 ||
        o.myth3 !== r.myth3 ||
        o.skill1 !== r.skill1 ||
        o.skill2 !== r.skill2 ||
        o.pvpKills !== r.pvpKills ||
        bossKillsChanged(o.bossKills, r.bossKills, bosses)
      )
        ids.push(r.id);
    }
    return ids;
  }, [rows, original, bosses]);

  function patch(id: number, p: Partial<MemberRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }

  function toggleBoss(id: number, bossId: number) {
    setRows((rs) =>
      rs.map((r) =>
        r.id === id
          ? {
              ...r,
              bossKills: { ...r.bossKills, [bossId]: !r.bossKills[bossId] },
            }
          : r
      )
    );
  }

  function toggle(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const visibleIds = visible.map((v) => v.id);
    const allSelected = visibleIds.every((id) => selected.has(id));
    setSelected((s) => {
      const next = new Set(s);
      if (allSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function saveAll() {
    if (dirtyIds.length === 0) {
      flash("변경된 내용이 없습니다.");
      return;
    }
    setBusy(true);
    try {
      for (const id of dirtyIds) {
        const r = rows.find((x) => x.id === id)!;
        const res = await fetch(`/api/members/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job: r.job || null,
            role: r.role,
            guildId: r.guildId,
            attack: r.attack,
            defense: r.defense,
            accuracy: r.accuracy,
            myth1: r.myth1,
            myth2: r.myth2,
            myth3: r.myth3,
            skill1: r.skill1,
            skill2: r.skill2,
            pvpKills: r.pvpKills,
            bossKills: r.bossKills,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(`${r.name}: ${d.message ?? "저장 실패"}`);
        }
      }
      // 저장된 행을 원본 스냅샷으로 반영 → dirty 초기화
      setOriginal(new Map(rows.map((r) => [r.id, { ...r }])));
      flash(`${dirtyIds.length}명 저장 완료`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "저장 중 오류");
    } finally {
      setBusy(false);
    }
  }

  async function resetPasswords() {
    const ids = [...selected];
    if (ids.length === 0) {
      flash("비번 초기화할 길드원을 선택하세요.");
      return;
    }
    if (!confirm(`${ids.length}명의 비밀번호를 초기화할까요?`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/members/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "초기화 실패");
      setSelected(new Set());
      flash(`${d.count}명 초기화 완료 · 임시 비밀번호: ${d.tempPassword}`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "초기화 중 오류");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: MemberRow) {
    if (!confirm(`${row.name} 길드원을 삭제할까요?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/members/${row.id}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message ?? "삭제 실패");
      setRows((rs) => rs.filter((r) => r.id !== row.id));
      setOriginal((m) => {
        const next = new Map(m);
        next.delete(row.id);
        return next;
      });
      setSelected((s) => {
        const next = new Set(s);
        next.delete(row.id);
        return next;
      });
      flash(`${row.name} 삭제 완료`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "삭제 중 오류");
    } finally {
      setBusy(false);
    }
  }

  async function removeSelected() {
    const ids = [...selected].filter((id) => {
      const r = rows.find((x) => x.id === id);
      return r && (isAdmin || r.role !== "ADMIN");
    });
    if (ids.length === 0) {
      flash("삭제할 길드원을 체크하세요.");
      return;
    }
    const names = ids
      .map((id) => rows.find((r) => r.id === id)?.name)
      .filter(Boolean)
      .join(", ");
    if (!confirm(`선택한 ${ids.length}명(${names})을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setBusy(true);
    try {
      let ok = 0;
      for (const id of ids) {
        const res = await fetch(`/api/members/${id}`, { method: "DELETE" });
        if (res.ok) ok++;
      }
      setRows((rs) => rs.filter((r) => !ids.includes(r.id)));
      setOriginal((m) => {
        const next = new Map(m);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setSelected(new Set());
      flash(`${ok}명 삭제 완료`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "삭제 중 오류");
    } finally {
      setBusy(false);
    }
  }

  function flash(m: string) {
    setMsg(m);
    window.clearTimeout((flash as unknown as { t?: number }).t);
    (flash as unknown as { t?: number }).t = window.setTimeout(
      () => setMsg(null),
      4000
    );
  }

  const canEditRow = (r: MemberRow) => isAdmin || r.role !== "ADMIN";

  return (
    <section>
      {/* 요약 대시보드 */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="총 길드원" value={`${summary.count}명`} tone="sky" />
        <StatCard
          label="군 구성"
          value={guilds.map((g) => rows.filter((r) => r.guildId === g.id).length).join(" · ")}
          sub={guilds.map((g) => `${g.order}군`).join(" · ")}
        />
        <StatCard
          label="권한"
          value={`관리자 ${summary.byRole.ADMIN} · 운영진 ${summary.byRole.COMMANDER}`}
          sub={`길드원 ${summary.byRole.MEMBER}명`}
        />
        <StatCard
          label="평균 3대"
          value={summary.avgTotal.toLocaleString()}
          sub={`총합 ${summary.totalSum.toLocaleString()}`}
          tone="amber"
        />
      </div>

      {/* 직업별 인원 통계 */}
      <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="mb-2.5 flex items-center gap-2">
          <p className="text-sm font-semibold text-neutral-700">직업별 인원</p>
          <span className="text-xs text-neutral-400">{jobStats.length}개 직업</span>
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {jobStats.map((j) => (
            <div key={j.job} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate text-xs text-neutral-600">
                {j.job}
              </span>
              <div className="relative h-4 flex-1 overflow-hidden rounded bg-neutral-100">
                <div
                  className="h-full rounded bg-sky-400/70"
                  style={{ width: `${Math.round((j.count / jobMax) * 100)}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-neutral-700">
                {j.count}명
              </span>
            </div>
          ))}
        </div>
      </div>

      {isManager && (
        <p className="mb-3 rounded-lg bg-neutral-100 px-4 py-2.5 text-xs text-neutral-500">
          체크박스 선택 후 <b className="text-neutral-700">비번초기화</b> · 값 수정 후{" "}
          <b className="text-neutral-700">저장</b>. 스탯 옆 ▲빨강=상승 / ▼파랑=하락(전월 대비).
        </p>
      )}

      {/* 필터 · 검색 · 액션 */}
      <div className="subbar-sticky mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          <GuildTab active={activeGuild === "all"} onClick={() => setActiveGuild("all")}>
            전체 ({rows.length})
          </GuildTab>
          {guilds.map((g) => (
            <GuildTab
              key={g.id}
              active={activeGuild === g.id}
              onClick={() => setActiveGuild(g.id)}
            >
              {g.order}군 ({rows.filter((r) => r.guildId === g.id).length})
            </GuildTab>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="캐릭명·직업 검색"
          className="ml-auto w-40 rounded border border-neutral-300 px-3 py-1.5 text-sm focus:border-sky-400 focus:outline-none"
        />
        {isManager && (
          <div className="flex gap-1.5">
            <button onClick={resetPasswords} disabled={busy} className={btnGhost}>
              비번초기화
            </button>
            <button onClick={() => setShowAdd(true)} disabled={busy} className={btnGhost}>
              등록
            </button>
            {isAdmin && (
              <button
                onClick={removeSelected}
                disabled={busy || selected.size === 0}
                className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                선택 삭제{selected.size > 0 ? ` (${selected.size})` : ""}
              </button>
            )}
            <button
              onClick={saveAll}
              disabled={busy || dirtyIds.length === 0}
              className={btnPrimary}
            >
              저장{dirtyIds.length > 0 ? ` (${dirtyIds.length})` : ""}
            </button>
          </div>
        )}
      </div>

      {msg && (
        <div className="mb-3 rounded border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700">
          {msg}
        </div>
      )}

      <div className="tbl-sticky overflow-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm" style={{ minWidth: isManager ? 1140 : 520 }}>
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
              {isManager && (
                <th className="sticky left-0 z-20 w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={
                      visible.length > 0 && visible.every((v) => selected.has(v.id))
                    }
                    onChange={toggleAll}
                  />
                </th>
              )}
              <th
                className={`sticky z-20 px-3 py-2.5 text-left font-semibold ${isManager ? "left-10" : "left-0"}`}
              >
                <button
                  onClick={() => toggleSort("name")}
                  className="inline-flex items-center gap-1 font-semibold hover:text-sky-600"
                >
                  캐릭명
                  <SortArrow active={sort?.key === "name"} dir={sort?.dir} />
                </button>
              </th>
              <Th>직업</Th>
              <Th>소속</Th>
              {bosses.map((b) => (
                <th key={b.id} className="px-0.5 py-2 align-bottom">
                  <div className="mx-auto flex h-16 w-5 items-end justify-center">
                    <span
                      className="whitespace-nowrap text-[11px] font-semibold leading-none [writing-mode:vertical-rl]"
                      title={b.name}
                    >
                      {b.name}
                    </span>
                  </div>
                </th>
              ))}
              {isManager && (
                <>
                  <th className="px-1 py-2.5 text-right text-[11px] font-semibold leading-tight text-neutral-500">
                    신화<br />성의
                  </th>
                  <th className="px-1 py-2.5 text-right text-[11px] font-semibold leading-tight text-neutral-500">
                    신화<br />사역마
                  </th>
                  <th className="px-1 py-2.5 text-right text-[11px] font-semibold leading-tight text-neutral-500">
                    신화<br />공명
                  </th>
                  <th className="px-1 py-2.5 text-center text-[11px] font-semibold leading-tight text-neutral-500">
                    스킬<br />1전스
                  </th>
                  <th className="px-1 py-2.5 text-center text-[11px] font-semibold leading-tight text-neutral-500">
                    스킬<br />2전스
                  </th>
                  <Th right>쟁탈전</Th>
                  <SortTh label="공격" k="attack" sort={sort} onSort={toggleSort} />
                  <SortTh label="방어" k="defense" sort={sort} onSort={toggleSort} />
                  <SortTh label="명중" k="accuracy" sort={sort} onSort={toggleSort} />
                  <SortTh label="총합" k="total" sort={sort} onSort={toggleSort} />
                  <SortTh
                    label="템컬렉"
                    k="itemCollection"
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <Th>권한</Th>
                  <th className="w-12 px-3 py-2.5" />
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const editable = canEditRow(r);
              const g = guilds.find((x) => x.id === r.guildId);
              const d = rowDelta(r);
              return (
                <tr key={r.id} className="border-b border-neutral-50 hover:bg-neutral-50">
                  {isManager && (
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                      />
                    </td>
                  )}
                  <td
                    className={`sticky z-10 bg-white px-3 py-2 font-medium ${isManager ? "left-10" : "left-0"}`}
                  >
                    {isManager ? (
                      <Link
                        href={`/users/${r.id}`}
                        className={`hover:underline ${ROLE_NAME_CLS[r.role] || "text-sky-600"}`}
                        title="개인 정보 수정"
                      >
                        {r.name}
                      </Link>
                    ) : (
                      <span className={ROLE_NAME_CLS[r.role]}>{r.name}</span>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5">
                    {isManager ? (
                      <select
                        value={r.job}
                        disabled={!editable}
                        onChange={(e) => patch(r.id, { job: e.target.value })}
                        className={`${cellInput} w-16`}
                        title={r.job || "미지정"}
                      >
                        <option value="">-</option>
                        {!JOBS_ALL.includes(r.job) && r.job && (
                          <option value={r.job}>{shortJob(r.job)}</option>
                        )}
                        {JOBS_ALL.map((j) => (
                          <option key={j} value={j}>
                            {shortJob(j)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-neutral-700" title={r.job || "-"}>
                        {r.job ? shortJob(r.job) : "-"}
                      </span>
                    )}
                  </td>
                  <td className="px-1.5 py-1.5">
                    {isManager ? (
                      <select
                        value={r.guildId ?? ""}
                        disabled={!editable}
                        onChange={(e) =>
                          patch(r.id, {
                            guildId: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className={`${cellInput} w-16`}
                        title={g ? `${g.order}군 - ${g.name}` : "미지정"}
                      >
                        <option value="">미지정</option>
                        {guilds.map((gg) => (
                          <option key={gg.id} value={gg.id}>
                            {gg.order}군
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-neutral-700">
                        {g ? `${g.order}군 - ${g.name}` : "-"}
                      </span>
                    )}
                  </td>
                  {bosses.map((b) => {
                    const on = !!r.bossKills[b.id];
                    return (
                      <td key={b.id} className="px-0.5 py-1.5 text-center">
                        <button
                          type="button"
                          disabled={!isManager || !editable}
                          onClick={() => toggleBoss(r.id, b.id)}
                          title={`${b.name} · ${on ? "처치" : "미처치"}`}
                          className={[
                            "h-6 w-6 rounded text-xs font-bold",
                            on
                              ? "bg-emerald-500 text-white"
                              : "border border-neutral-300 bg-white text-neutral-400",
                            isManager && editable
                              ? "transition hover:opacity-80"
                              : "cursor-default",
                          ].join(" ")}
                        >
                          {on ? "✓" : "✕"}
                        </button>
                      </td>
                    );
                  })}
                  {isManager && (
                    <>
                      <TextCell
                        value={r.myth1}
                        width="w-12"
                        disabled={!editable}
                        onChange={(v) => patch(r.id, { myth1: v })}
                      />
                      <TextCell
                        value={r.myth2}
                        width="w-12"
                        disabled={!editable}
                        onChange={(v) => patch(r.id, { myth2: v })}
                      />
                      <TextCell
                        value={r.myth3}
                        width="w-12"
                        disabled={!editable}
                        onChange={(v) => patch(r.id, { myth3: v })}
                      />
                      <OXCell
                        on={r.skill1}
                        disabled={!editable}
                        onToggle={() => patch(r.id, { skill1: !r.skill1 })}
                      />
                      <OXCell
                        on={r.skill2}
                        disabled={!editable}
                        onToggle={() => patch(r.id, { skill2: !r.skill2 })}
                      />
                      <NumCell
                        value={r.pvpKills}
                        disabled={!editable}
                        onChange={(v) => patch(r.id, { pvpKills: v })}
                      />
                      <NumCell
                        value={r.attack}
                        delta={d?.attack}
                        disabled={!editable}
                        onChange={(v) => patch(r.id, { attack: v })}
                      />
                      <NumCell
                        value={r.defense}
                        delta={d?.defense}
                        disabled={!editable}
                        onChange={(v) => patch(r.id, { defense: v })}
                      />
                      <NumCell
                        value={r.accuracy}
                        delta={d?.accuracy}
                        disabled={!editable}
                        onChange={(v) => patch(r.id, { accuracy: v })}
                      />
                      <td className="px-1.5 py-1.5 text-right font-semibold">
                        <div>
                          {(r.attack + r.defense + r.accuracy).toLocaleString()}
                        </div>
                        <DeltaBadge value={d?.total} />
                      </td>
                      <td className="px-1.5 py-1.5 text-right tabular-nums text-neutral-700">
                        <div>{r.itemCollection.toFixed(2)}%</div>
                        <DeltaBadge value={d?.itemCollection} pct />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <select
                          value={r.role}
                          disabled={!editable}
                          onChange={(e) =>
                            patch(r.id, { role: e.target.value as RoleValue })
                          }
                          className={`${cellInput} w-16`}
                        >
                          <option value="MEMBER">{ROLE_LABEL.MEMBER}</option>
                          <option value="COMMANDER">{ROLE_LABEL.COMMANDER}</option>
                          {isAdmin && (
                            <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
                          )}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {isAdmin && editable && (
                          <button
                            onClick={() => remove(r)}
                            disabled={busy}
                            title="삭제"
                            className="text-neutral-300 hover:text-red-500"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={3 + bosses.length + (isManager ? 14 : 0)}
                  className="py-8 text-center text-neutral-400"
                >
                  해당 군에 길드원이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddMemberModal
          guilds={guilds}
          isAdmin={isAdmin}
          onClose={() => setShowAdd(false)}
          onCreated={(m) => {
            setRows((rs) => [...rs, m]);
            setOriginal((map) => new Map(map).set(m.id, { ...m }));
            setShowAdd(false);
            flash(`${m.name} 등록 완료`);
          }}
        />
      )}
    </section>
  );
}

function AddMemberModal({
  guilds,
  isAdmin,
  onClose,
  onCreated,
}: {
  guilds: GuildOpt[];
  isAdmin: boolean;
  onClose: () => void;
  onCreated: (m: MemberRow) => void;
}) {
  const [form, setForm] = useState<{
    name: string;
    password: string;
    job: string;
    guildId: number | "";
    role: RoleValue;
    attack: number;
    defense: number;
    accuracy: number;
  }>({
    name: "",
    password: "0000",
    job: "",
    guildId: guilds[0]?.id ?? "",
    role: "MEMBER",
    attack: 0,
    defense: 0,
    accuracy: 0,
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          password: form.password,
          job: form.job || null,
          guildId: form.guildId ? Number(form.guildId) : null,
          role: form.role,
          attack: Number(form.attack) || 0,
          defense: Number(form.defense) || 0,
          accuracy: Number(form.accuracy) || 0,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "등록 실패");
      const m = d.member;
      onCreated({
        id: m.id,
        name: m.name,
        job: m.job ?? "",
        role: m.role,
        guildId: m.guildId,
        attack: m.attack,
        defense: m.defense,
        accuracy: m.accuracy,
        myth1: m.myth1 ?? "0(0)",
        myth2: m.myth2 ?? "0(0)",
        myth3: m.myth3 ?? "0(0)",
        skill1: m.skill1 ?? false,
        skill2: m.skill2 ?? false,
        pvpKills: m.pvpKills ?? 0,
        itemCollection: m.itemCollection ?? 0,
        bossKills: {},
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "등록 중 오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h3 className="mb-4 text-base font-bold">길드원 등록</h3>
        <div className="grid gap-3">
          <Field label="캐릭터 이름">
            <input
              className={modalInput}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="로그인 아이디로 사용됩니다"
            />
          </Field>
          <Field label="초기 비밀번호">
            <input
              className={modalInput}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="직업">
              <input
                className={modalInput}
                value={form.job}
                onChange={(e) => setForm({ ...form, job: e.target.value })}
              />
            </Field>
            <Field label="소속">
              <select
                className={modalInput}
                value={form.guildId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    guildId: e.target.value ? Number(e.target.value) : "",
                  })
                }
              >
                <option value="">미지정</option>
                {guilds.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.order}군 - {g.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Field label="권한">
              <select
                className={modalInput}
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as RoleValue })
                }
              >
                <option value="MEMBER">{ROLE_LABEL.MEMBER}</option>
                <option value="COMMANDER">{ROLE_LABEL.COMMANDER}</option>
                {isAdmin && <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>}
              </select>
            </Field>
            <Field label="공격">
              <input
                type="number"
                className={modalInput}
                value={form.attack}
                onChange={(e) =>
                  setForm({ ...form, attack: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="방어">
              <input
                type="number"
                className={modalInput}
                value={form.defense}
                onChange={(e) =>
                  setForm({ ...form, defense: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="명중">
              <input
                type="number"
                className={modalInput}
                value={form.accuracy}
                onChange={(e) =>
                  setForm({ ...form, accuracy: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          {err && <p className="text-sm text-red-500">{err}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className={btnGhost}>
            취소
          </button>
          <button onClick={submit} disabled={busy} className={btnPrimary}>
            {busy ? "등록 중..." : "등록"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- 작은 컴포넌트/스타일 ---------- */

function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "sky" | "amber";
}) {
  const toneCls =
    tone === "sky"
      ? "border-sky-200 bg-sky-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : "border-neutral-200 bg-white";
  return (
    <div className={`rounded-lg border ${toneCls} px-4 py-3`}>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-neutral-800">{value}</p>
      {sub && <p className="text-[11px] text-neutral-400">{sub}</p>}
    </div>
  );
}

function GuildTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded px-3 py-1.5 text-xs font-medium transition",
        active
          ? "bg-sky-100 text-sky-700 ring-1 ring-sky-300"
          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// 텍스트 입력 셀 (신화성의/사역마 "4(4)" 등)
function TextCell({
  value,
  disabled,
  width = "w-14",
  onChange,
}: {
  value: string;
  disabled: boolean;
  width?: string;
  onChange: (v: string) => void;
}) {
  return (
    <td className="px-1 py-1.5">
      <input
        value={value}
        disabled={disabled}
        onFocus={(e) => e.target.select()}
        onChange={(e) => onChange(e.target.value)}
        className={`${width} rounded border border-transparent bg-transparent px-1 py-1 text-right text-sm tabular-nums hover:border-neutral-200 focus:border-sky-400 focus:bg-white focus:outline-none disabled:text-neutral-500`}
      />
    </td>
  );
}

// O/X 토글 셀 (1전스/2전스 등)
function OXCell({
  on,
  disabled,
  onToggle,
}: {
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <td className="px-1 py-1.5 text-center">
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        title={on ? "O (보유)" : "X (미보유)"}
        className={[
          "h-6 w-6 rounded text-xs font-bold",
          on
            ? "bg-emerald-500 text-white"
            : "border border-neutral-300 bg-white text-neutral-400",
          disabled ? "cursor-default" : "transition hover:opacity-80",
        ].join(" ")}
      >
        {on ? "O" : "X"}
      </button>
    </td>
  );
}

function NumCell({
  value,
  delta,
  disabled,
  width = "w-14",
  onChange,
}: {
  value: number;
  delta?: number;
  disabled: boolean;
  width?: string;
  onChange: (v: number) => void;
}) {
  return (
    <td className="px-1 py-1.5">
      <input
        type="number"
        value={value}
        disabled={disabled}
        onFocus={(e) => e.target.select()}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${width} rounded border border-transparent bg-transparent px-1 py-1 text-right text-sm tabular-nums [appearance:textfield] hover:border-neutral-200 focus:border-sky-400 focus:bg-white focus:outline-none disabled:text-neutral-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
      <DeltaBadge value={delta} />
    </td>
  );
}

// 전월 대비 증감 뱃지 (▲상승 / ▼하락 / – 변동없음)
function DeltaBadge({ value, pct }: { value?: number; pct?: boolean }) {
  if (value === undefined || value === null) return null;
  // 퍼센트 값(템컬렉)은 소수 2자리 + %p, 정수 스탯은 천단위 구분
  const rounded = pct ? Math.round(value * 100) / 100 : value;
  if (rounded === 0)
    return <div className="text-right text-[11px] text-neutral-400">±0</div>;
  const up = rounded > 0;
  const text = pct
    ? `${Math.abs(rounded).toFixed(2)}%p`
    : Math.abs(rounded).toLocaleString();
  return (
    <div
      className={`text-right text-[11px] font-medium ${up ? "text-red-500" : "text-blue-500"}`}
    >
      {up ? "▲" : "▼"} {text}
    </div>
  );
}

function Th({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`px-2 py-2.5 font-semibold ${right ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function SortArrow({
  active,
  dir,
}: {
  active: boolean;
  dir?: "asc" | "desc";
}) {
  return (
    <span className={active ? "text-sky-600" : "text-neutral-300"}>
      {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
    </span>
  );
}

function SortTh({
  label,
  k,
  sort,
  onSort,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" } | null;
  onSort: (k: SortKey) => void;
}) {
  return (
    <th className="px-2 py-2.5 text-right font-semibold">
      <button
        onClick={() => onSort(k)}
        className="inline-flex items-center gap-1 font-semibold hover:text-sky-600"
      >
        {label}
        <SortArrow active={sort?.key === k} dir={sort?.dir} />
      </button>
    </th>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs text-neutral-500">
      <span>{label}</span>
      {children}
    </label>
  );
}

const cellInput =
  "rounded border border-transparent bg-transparent px-2 py-1 text-sm hover:border-neutral-200 focus:border-sky-400 focus:bg-white focus:outline-none disabled:text-neutral-500";
const modalInput =
  "w-full rounded border border-neutral-300 px-2.5 py-2 text-sm focus:border-sky-400 focus:outline-none";
const btnGhost =
  "rounded border border-neutral-300 bg-neutral-50 px-4 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50";
const btnPrimary =
  "rounded bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50";
