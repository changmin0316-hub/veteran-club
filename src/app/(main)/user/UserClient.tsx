"use client";

import { useState } from "react";

const JOBS = [
  "엘리멘탈리스트",
  "디바인캐스터",
  "데스브링어",
  "건슬링어",
  "워로드",
  "뱅가드",
  "나이트레인저",
];

interface Profile {
  name: string;
  job: string;
  attack: number;
  defense: number;
  accuracy: number;
  legendSkill: boolean;
  myth1: number;
  myth2: number;
  bossKills: Record<string, boolean>;
}

export default function UserClient({
  profile,
  bosses,
}: {
  profile: Profile;
  bosses: { id: number; name: string }[];
}) {
  const [form, setForm] = useState<Profile>(profile);
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // OCR
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [ocrMsg, setOcrMsg] = useState<string | null>(null);

  function set<K extends keyof Profile>(k: K, v: Profile[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleOcr(file: File) {
    setOcrBusy(true);
    setOcrProgress(0);
    setOcrMsg(null);
    setOcrText(null);
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const { data } = await Tesseract.recognize(file, "kor+eng", {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") setOcrProgress(m.progress);
        },
      });
      const text = data.text ?? "";
      setOcrText(text);
      const parsed = parseStats(text);
      const applied: string[] = [];
      if (parsed.attack != null) {
        set("attack", parsed.attack);
        applied.push(`공격 ${parsed.attack}`);
      }
      if (parsed.defense != null) {
        set("defense", parsed.defense);
        applied.push(`방어 ${parsed.defense}`);
      }
      if (parsed.accuracy != null) {
        set("accuracy", parsed.accuracy);
        applied.push(`명중 ${parsed.accuracy}`);
      }
      setOcrMsg(
        applied.length
          ? `인식 완료: ${applied.join(" · ")} (확인 후 저장하세요)`
          : "숫자를 인식하지 못했습니다. 아래 인식 결과를 참고해 직접 입력하세요."
      );
    } catch {
      setOcrMsg("OCR 처리에 실패했습니다. 다시 시도하거나 직접 입력하세요.");
    } finally {
      setOcrBusy(false);
    }
  }

  function toggleBoss(id: number) {
    setForm((f) => ({
      ...f,
      bossKills: { ...f.bossKills, [id]: !f.bossKills[id] },
    }));
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const payload: Record<string, unknown> = {
        job: form.job || null,
        attack: form.attack,
        defense: form.defense,
        accuracy: form.accuracy,
        myth1: form.myth1,
        myth2: form.myth2,
        bossKills: form.bossKills,
      };
      if (newPassword) {
        payload.newPassword = newPassword;
        payload.currentPassword = currentPassword;
      }
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "저장 실패");
      setNewPassword("");
      setCurrentPassword("");
      setMsg("저장되었습니다.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  const total = form.attack + form.defense + form.accuracy;

  return (
    <section className="max-w-2xl">
      <h2 className="mb-4 text-base font-bold">내 정보 변경</h2>

      <div className="grid gap-4 rounded-lg border border-neutral-200 bg-white p-5">
        <Field label="캐릭터 이름">
          <input
            value={form.name}
            disabled
            className="w-full rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="현재 비밀번호 (변경 시)">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="변경할 때만 입력"
              className={input}
            />
          </Field>
          <Field label="변경할 비밀번호">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="비워두면 변경 안 함"
              className={input}
            />
          </Field>
        </div>

        {/* OCR 스탯 자동입력 */}
        <div className="rounded-lg border border-dashed border-sky-200 bg-sky-50/40 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-sm font-medium text-neutral-700">
                OCR 스탯 자동입력
              </p>
              <p className="text-xs text-neutral-500">
                캐릭터 스탯 스크린샷을 올리면 공격·방어·명중을 자동 인식합니다.
              </p>
            </div>
            <label className="ml-auto cursor-pointer rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
              {ocrBusy ? "인식 중..." : "이미지 선택"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={ocrBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleOcr(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {ocrBusy && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full bg-sky-500 transition-all"
                style={{ width: `${Math.round(ocrProgress * 100)}%` }}
              />
            </div>
          )}
          {ocrMsg && (
            <p className="mt-2 text-sm text-sky-700">{ocrMsg}</p>
          )}
          {ocrText && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-neutral-400">
                인식 원문 보기
              </summary>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-neutral-500">
                {ocrText}
              </pre>
            </details>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="직업">
            <select
              value={form.job}
              onChange={(e) => set("job", e.target.value)}
              className={input}
            >
              <option value="">미지정</option>
              {JOBS.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </Field>
          <NumField label="공격력" value={form.attack} onChange={(v) => set("attack", v)} />
          <NumField label="방어" value={form.defense} onChange={(v) => set("defense", v)} />
          <NumField label="명중" value={form.accuracy} onChange={(v) => set("accuracy", v)} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumField label="신화성의" value={form.myth1} onChange={(v) => set("myth1", v)} />
          <NumField label="신화사역마" value={form.myth2} onChange={(v) => set("myth2", v)} />
          <Field label="3대 총합">
            <div className="rounded border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm font-semibold">
              {total.toLocaleString()}
            </div>
          </Field>
        </div>

        {/* 명예의전당 - 보스 */}
        <div>
          <p className="mb-2 text-xs font-semibold text-neutral-500">
            명예의전당 - 보스몬스터 (처치 토글)
          </p>
          {bosses.length === 0 ? (
            <p className="text-sm text-neutral-400">
              등록된 보스가 없습니다. (설정 → 보스에서 추가)
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {bosses.map((b) => {
                const on = !!form.bossKills[b.id];
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleBoss(b.id)}
                    className={[
                      "rounded px-3 py-2 text-sm transition",
                      on
                        ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300"
                        : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200",
                    ].join(" ")}
                  >
                    {on ? "✓ " : ""}
                    {b.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {msg && <p className="text-sm text-emerald-600">{msg}</p>}
        {err && <p className="text-sm text-red-500">{err}</p>}

        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={busy}
            className="rounded bg-sky-600 px-6 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {busy ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </section>
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

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={input}
      />
    </Field>
  );
}

const input =
  "w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none";

// OCR 인식 텍스트에서 공격/방어/명중 숫자 추출
function parseStats(text: string): {
  attack: number | null;
  defense: number | null;
  accuracy: number | null;
} {
  const norm = text.replace(/,/g, "").replace(/\s+/g, " ");
  const pick = (labels: string[]): number | null => {
    for (const lb of labels) {
      // 라벨 뒤 또는 라벨 앞의 숫자(2~7자리)를 탐색
      const after = norm.match(new RegExp(lb + "\\s*[:：]?\\s*(\\d{2,7})"));
      if (after) return Number(after[1]);
      const before = norm.match(new RegExp("(\\d{2,7})\\s*" + lb));
      if (before) return Number(before[1]);
    }
    return null;
  };
  return {
    attack: pick(["공격력", "공격", "ATK", "Attack"]),
    defense: pick(["방어력", "방어", "DEF", "Defense"]),
    accuracy: pick(["명중률", "명중", "ACC", "Accuracy"]),
  };
}
