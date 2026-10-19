"use client";

import { useMemo, useState } from "react";

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
}
export type StatDeltaMap = Record<number, StatDelta | null>;

const ROLE_LABEL: Record<RoleValue, string> = {
  ADMIN: "원장",
  COMMANDER: "사단장",
  MEMBER: "길드원",
};

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
  deltas,
  myRole,
}: {
  initialRows: MemberRow[];
  guilds: GuildOpt[];
  bosses: BossOpt[];
  deltas: StatDeltaMap;
  myRole: RoleValue;
}) {
  const isAdmin = myRole === "ADMIN";

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

  const visible = useMemo(() => {
    const q = search.trim();
    return rows.filter(
      (r) =>
        (activeGuild === "all" || r.guildId === activeGuild) &&
        (!q || r.name.includes(q) || (r.job ?? "").includes(q))
    );
  }, [rows, activeGuild, search]);

  // 요약 집계
  const summary = useMemo(() => {
    const byRole = { ADMIN: 0, COMMANDER: 0, MEMBER: 0 } as Record<RoleValue, number>;
    let totalSum = 0;
    for (const r of rows) {
      byRole[r.role] = (byRole[r.role] ?? 0) + 1;
      totalSum += r.attack + r.defense + r.accuracy;
    }
    return {
      count: rows.length,
      byRole,
      avgTotal: rows.length ? Math.round(totalSum / rows.length) : 0,
    };
  }, [rows]);

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
          value={`원장 ${summary.byRole.ADMIN} · 사단장 ${summary.byRole.COMMANDER}`}
          sub={`길드원 ${summary.byRole.MEMBER}명`}
        />
        <StatCard label="평균 3대" value={summary.avgTotal.toLocaleString()} tone="amber" />
      </div>

      <p className="mb-3 rounded-lg bg-neutral-100 px-4 py-2.5 text-xs text-neutral-500">
        체크박스 선택 후 <b className="text-neutral-700">비번초기화</b> · 값 수정 후{" "}
        <b className="text-neutral-700">저장</b>. 스탯 옆 ▲빨강=상승 / ▼파랑=하락(전월 대비).
      </p>

      {/* 필터 · 검색 · 액션 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
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
        <div className="flex gap-1.5">
          <button onClick={resetPasswords} disabled={busy} className={btnGhost}>
            비번초기화
          </button>
          <button onClick={() => setShowAdd(true)} disabled={busy} className={btnGhost}>
            등록
          </button>
          <button
            onClick={saveAll}
            disabled={busy || dirtyIds.length === 0}
            className={btnPrimary}
          >
            저장{dirtyIds.length > 0 ? ` (${dirtyIds.length})` : ""}
          </button>
        </div>
      </div>

      {msg && (
        <div className="mb-3 rounded border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700">
          {msg}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
              <th className="sticky left-0 z-20 w-10 bg-neutral-50 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={
                    visible.length > 0 &&
                    visible.every((v) => selected.has(v.id))
                  }
                  onChange={toggleAll}
                />
              </th>
              <th className="sticky left-10 z-20 bg-neutral-50 px-3 py-2.5 text-left font-semibold">
                캐릭명
              </th>
              <Th>직업</Th>
              <Th>소속</Th>
              {bosses.map((b) => (
                <th
                  key={b.id}
                  className="whitespace-nowrap px-2 py-2.5 text-center text-xs font-semibold"
                  title={b.name}
                >
                  {b.name}
                </th>
              ))}
              <Th right>공격</Th>
              <Th right>방어</Th>
              <Th right>명중</Th>
              <Th right>총합</Th>
              <Th>권한</Th>
              <th className="w-12 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const editable = canEditRow(r);
              return (
                <tr
                  key={r.id}
                  className="border-b border-neutral-50 hover:bg-neutral-50"
                >
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                    />
                  </td>
                  <td className="sticky left-10 z-10 bg-white px-3 py-2 font-medium">
                    {r.name}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={r.job}
                      disabled={!editable}
                      onChange={(e) => patch(r.id, { job: e.target.value })}
                      className={cellInput}
                      placeholder="직업"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={r.guildId ?? ""}
                      disabled={!editable}
                      onChange={(e) =>
                        patch(r.id, {
                          guildId: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className={cellInput}
                    >
                      <option value="">미지정</option>
                      {guilds.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.order}군 - {g.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  {bosses.map((b) => {
                    const on = !!r.bossKills[b.id];
                    return (
                      <td key={b.id} className="px-2 py-2 text-center">
                        <button
                          type="button"
                          disabled={!editable}
                          onClick={() => toggleBoss(r.id, b.id)}
                          title={`${b.name} · ${on ? "처치" : "미처치"}`}
                          className={[
                            "h-7 w-9 rounded text-sm font-bold transition",
                            on
                              ? "bg-emerald-500 text-white"
                              : "border border-neutral-300 bg-white text-neutral-400",
                            editable ? "hover:opacity-80" : "cursor-default",
                          ].join(" ")}
                        >
                          {on ? "✓" : "✕"}
                        </button>
                      </td>
                    );
                  })}
                  <NumCell
                    value={r.attack}
                    delta={deltas[r.id]?.attack}
                    disabled={!editable}
                    onChange={(v) => patch(r.id, { attack: v })}
                  />
                  <NumCell
                    value={r.defense}
                    delta={deltas[r.id]?.defense}
                    disabled={!editable}
                    onChange={(v) => patch(r.id, { defense: v })}
                  />
                  <NumCell
                    value={r.accuracy}
                    delta={deltas[r.id]?.accuracy}
                    disabled={!editable}
                    onChange={(v) => patch(r.id, { accuracy: v })}
                  />
                  <td className="px-3 py-2 text-right font-semibold">
                    <div>{(r.attack + r.defense + r.accuracy).toLocaleString()}</div>
                    <DeltaBadge value={deltas[r.id]?.total} />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={r.role}
                      disabled={!editable}
                      onChange={(e) =>
                        patch(r.id, { role: e.target.value as RoleValue })
                      }
                      className={cellInput}
                    >
                      <option value="MEMBER">{ROLE_LABEL.MEMBER}</option>
                      <option value="COMMANDER">{ROLE_LABEL.COMMANDER}</option>
                      {isAdmin && (
                        <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
                      )}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {editable && (
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
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={10 + bosses.length} className="py-8 text-center text-neutral-400">
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
                <option value="MEMBER">길드원</option>
                <option value="COMMANDER">사단장</option>
                {isAdmin && <option value="ADMIN">원장</option>}
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

function NumCell({
  value,
  delta,
  disabled,
  onChange,
}: {
  value: number;
  delta?: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <td className="px-3 py-2">
      <input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${cellInput} text-right`}
      />
      <DeltaBadge value={delta} />
    </td>
  );
}

// 전월 대비 증감 뱃지 (▲상승 / ▼하락 / – 변동없음)
function DeltaBadge({ value }: { value?: number }) {
  if (value === undefined || value === null) return null;
  if (value === 0)
    return <div className="text-right text-[11px] text-neutral-400">±0</div>;
  const up = value > 0;
  return (
    <div
      className={`text-right text-[11px] font-medium ${up ? "text-red-500" : "text-blue-500"}`}
    >
      {up ? "▲" : "▼"} {Math.abs(value).toLocaleString()}
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
      className={`px-3 py-2.5 font-semibold ${right ? "text-right" : "text-left"}`}
    >
      {children}
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
  "w-full rounded border border-transparent bg-transparent px-2 py-1 text-sm hover:border-neutral-200 focus:border-sky-400 focus:bg-white focus:outline-none disabled:text-neutral-400";
const modalInput =
  "w-full rounded border border-neutral-300 px-2.5 py-2 text-sm focus:border-sky-400 focus:outline-none";
const btnGhost =
  "rounded border border-neutral-300 bg-neutral-50 px-4 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50";
const btnPrimary =
  "rounded bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50";
