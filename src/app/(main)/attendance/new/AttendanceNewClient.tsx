"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface Opt {
  id: number;
  label: string;
  weight?: number;
  settled?: boolean;
}
export interface MemberOpt {
  id: number;
  name: string;
  guildId: number | null;
}

export default function AttendanceNewClient({
  weeks,
  guilds,
  categories,
  members,
  defaultGuildId,
}: {
  weeks: Opt[];
  guilds: { id: number; order: number; name: string }[];
  categories: Opt[];
  members: MemberOpt[];
  defaultGuildId: number | null;
}) {
  const router = useRouter();

  const [weekId, setWeekId] = useState<number | "">(weeks[0]?.id ?? "");
  const [guildId, setGuildId] = useState<number | "">(defaultGuildId ?? "");
  const [time, setTime] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [plays, setPlays] = useState<number>(1);

  const [attendees, setAttendees] = useState<Set<number>>(new Set());
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [imageName, setImageName] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const squadMembers = useMemo(
    () => members.filter((m) => (guildId ? m.guildId === guildId : true)),
    [members, guildId]
  );

  const category = categories.find((c) => c.id === categoryId);
  const reflected = category?.weight != null ? category.weight * (plays || 0) : null;

  function toggle(id: number) {
    setAttendees((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function allToggle() {
    setAttendees((s) =>
      s.size === squadMembers.length
        ? new Set()
        : new Set(squadMembers.map((m) => m.id))
    );
  }

  async function handleImage(file: File) {
    setImageName(file.name);
    setOcrBusy(true);
    setOcrProgress(0);
    setErr(null);
    setMsg(null);
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const { data } = await Tesseract.recognize(file, "kor+eng", {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") setOcrProgress(m.progress);
        },
      });
      const text = (data.text ?? "").replace(/\s/g, "");
      // 이미지에서 소속 길드원 캐릭터명을 찾아 자동 체크
      const matched = squadMembers.filter((m) =>
        text.includes(m.name.replace(/\s/g, ""))
      );
      setAttendees((s) => {
        const n = new Set(s);
        matched.forEach((m) => n.add(m.id));
        return n;
      });
      setMsg(
        matched.length
          ? `이미지에서 ${matched.length}명 자동 인식 (확인 후 저장)`
          : "이미지에서 캐릭터명을 찾지 못했습니다. 아래에서 직접 선택하세요."
      );
    } catch {
      setErr("이미지 인식에 실패했습니다. 참석자를 직접 선택하세요.");
    } finally {
      setOcrBusy(false);
    }
  }

  const selectedSettled = weeks.find((w) => w.id === weekId)?.settled ?? false;

  async function save() {
    setErr(null);
    setMsg(null);
    if (!weekId) return setErr("주차를 선택하세요.");
    if (selectedSettled)
      return setErr("분배 완료된 주차는 출석 입력이 불가합니다.");
    if (!categoryId) return setErr("카테고리를 선택하세요.");
    if (!plays || plays < 1) return setErr("참여횟수를 1 이상 입력하세요.");
    if (attendees.size === 0) return setErr("참석자를 선택하세요.");
    setBusy(true);
    try {
      const res = await fetch("/api/attendance/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekId: Number(weekId),
          categoryId: Number(categoryId),
          memberIds: [...attendees],
          delta: Number(plays),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "저장 실패");
      router.push("/attendance");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "오류");
      setBusy(false);
    }
  }

  return (
    <section>
      {/* 상단 폼 (원본과 동일: 주차·소속·시간·카테고리·참여횟수) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Field label="주차">
          <select value={weekId} onChange={(e) => setWeekId(Number(e.target.value))} className={input}>
            {weeks.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
                {w.settled ? " (완료)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="소속">
          <select value={guildId} onChange={(e) => setGuildId(Number(e.target.value))} className={input}>
            {guilds.map((g) => (
              <option key={g.id} value={g.id}>
                {g.order}군 - {g.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="시간">
          <input
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="시간때 ex: 0907 1300"
            className={input}
          />
        </Field>
        <Field label="카테고리">
          <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} className={input}>
            <option value="">출석 카테고리</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="참여횟수">
          <input
            type="number"
            min={1}
            value={plays}
            onChange={(e) => setPlays(Number(e.target.value))}
            placeholder="횟수 ex: 1"
            className={input}
          />
        </Field>
      </div>

      {selectedSettled && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          ✔ 분배 완료된 주차입니다. 출석 입력이 잠겨 있습니다.
        </div>
      )}

      <div className="mt-3 rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-500">
        <p>현재 운영 기준은 횟수제입니다. 카테고리별 적용횟수에 따라 반영됩니다.</p>
        <p>
          최종 반영값은 카테고리 적용횟수 × 참여횟수로 계산됩니다.
          {reflected != null && (
            <span className="ml-1 font-medium text-sky-600">
              (현재: {category?.weight} × {plays || 0} = {reflected})
            </span>
          )}
        </p>
      </div>

      {/* 출석 이미지 추가 (OCR 참석자 자동 인식) */}
      <div className="mt-4 rounded-lg border border-dashed border-neutral-300 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-neutral-700">출석 이미지 추가</p>
            <p className="text-xs text-neutral-500">
              출석 스크린샷을 올리면 소속 길드원 캐릭터명을 자동 인식해 참석자로 체크합니다.
              {imageName && <span className="ml-1 text-neutral-400">({imageName})</span>}
            </p>
          </div>
          <label className="cursor-pointer rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            {ocrBusy ? "인식 중..." : "+ 이미지 추가"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={ocrBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImage(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {ocrBusy && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.round(ocrProgress * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* 참석자 선택 */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold">
            참석자 선택{" "}
            <span className="text-neutral-400">
              ({attendees.size}/{squadMembers.length})
            </span>
          </span>
          <button onClick={allToggle} className="text-xs text-sky-600 hover:underline">
            {attendees.size === squadMembers.length ? "전체 해제" : "전체 선택"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-neutral-200 bg-white p-3 sm:grid-cols-4">
          {squadMembers.map((m) => {
            const on = attendees.has(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggle(m.id)}
                className={[
                  "rounded px-3 py-2 text-left text-sm transition",
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
          {squadMembers.length === 0 && (
            <p className="col-span-4 py-6 text-center text-sm text-neutral-400">
              해당 소속에 길드원이 없습니다.
            </p>
          )}
        </div>
      </div>

      {msg && <p className="mt-3 text-sm text-emerald-600">{msg}</p>}
      {err && <p className="mt-3 text-sm text-red-500">{err}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={() => router.push("/attendance")}
          disabled={busy}
          className="rounded border border-neutral-300 bg-neutral-50 px-5 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          취소
        </button>
        <button
          onClick={save}
          disabled={busy || selectedSettled}
          className="rounded bg-sky-600 px-6 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy ? "저장 중..." : "저장"}
        </button>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-neutral-500">
      <span>{label}</span>
      {children}
    </label>
  );
}

const input =
  "w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none";
