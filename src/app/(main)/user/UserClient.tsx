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
  pvpKills: number;
  bossKills: Record<string, boolean>;
  equipImage: string | null;
  heavenImage: string | null;
}

type ImgKind = "equipImage" | "heavenImage";

export default function UserClient({
  profile,
  bosses,
  targetMemberId,
}: {
  profile: Profile;
  bosses: { id: number; name: string }[];
  // 지정 시: 관리자/운영진이 해당 길드원 정보를 수정하는 모드
  targetMemberId?: number;
}) {
  const isManagerEdit = targetMemberId != null;
  const [form, setForm] = useState<Profile>(profile);
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [imgBusy, setImgBusy] = useState<ImgKind | null>(null);

  function set<K extends keyof Profile>(k: K, v: Profile[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // 이미지 선택 → 리사이즈/압축 후 data URL 저장
  async function handleImage(kind: ImgKind, file: File) {
    setImgBusy(kind);
    setErr(null);
    try {
      const dataUrl = await resizeToDataUrl(file, 1000, 0.72);
      set(kind, dataUrl);
    } catch {
      setErr("이미지를 불러오지 못했습니다. 다른 이미지를 시도하세요.");
    } finally {
      setImgBusy(null);
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
        pvpKills: form.pvpKills,
        bossKills: form.bossKills,
        equipImage: form.equipImage,
        heavenImage: form.heavenImage,
      };
      // 본인 모드일 때만 비밀번호 변경 지원
      if (!isManagerEdit && newPassword) {
        payload.newPassword = newPassword;
        payload.currentPassword = currentPassword;
      }
      const endpoint = isManagerEdit
        ? `/api/members/${targetMemberId}`
        : "/api/me";
      const res = await fetch(endpoint, {
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
      <div className="mb-4 flex items-center gap-2">
        {isManagerEdit && (
          <a
            href="/users"
            className="rounded border border-neutral-300 bg-neutral-50 px-2.5 py-1 text-sm text-neutral-600 hover:bg-neutral-100"
          >
            ← 목록
          </a>
        )}
        <h2 className="text-base font-bold">
          {isManagerEdit ? `${form.name} 정보 변경` : "내 정보 변경"}
        </h2>
      </div>

      <div className="grid gap-4 rounded-lg border border-neutral-200 bg-white p-5">
        <Field label="캐릭터 이름">
          <input
            value={form.name}
            disabled
            className="w-full rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500"
          />
        </Field>

        {!isManagerEdit && (
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
        )}
        {isManagerEdit && (
          <p className="rounded bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
            비밀번호는 길드원 목록의 <b>비번초기화</b>로 처리하세요.
          </p>
        )}

        {/* 이미지 첨부 (장비 / 헤븐스톤) */}
        <div>
          <p className="mb-2 text-xs font-semibold text-neutral-500">이미지 첨부</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ImageSlot
              label="첨부파일1 · 장비 이미지"
              value={form.equipImage}
              busy={imgBusy === "equipImage"}
              onPick={(f) => handleImage("equipImage", f)}
              onRemove={() => set("equipImage", null)}
            />
            <ImageSlot
              label="첨부파일2 · 헤븐스톤 이미지"
              value={form.heavenImage}
              busy={imgBusy === "heavenImage"}
              onPick={(f) => handleImage("heavenImage", f)}
              onRemove={() => set("heavenImage", null)}
            />
          </div>
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
          <NumField label="쟁탈전 킬수" value={form.pvpKills} onChange={(v) => set("pvpKills", v)} />
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

// 이미지 첨부 슬롯 (미리보기 + 교체/삭제)
function ImageSlot({
  label,
  value,
  busy,
  onPick,
  onRemove,
}: {
  label: string;
  value: string | null;
  busy: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <p className="mb-2 text-xs font-medium text-neutral-600">{label}</p>
      {value ? (
        <div className="group relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label}
            className="max-h-56 w-full rounded border border-neutral-100 object-contain"
          />
          <div className="mt-2 flex gap-2">
            <label className="flex-1 cursor-pointer rounded border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-center text-xs text-neutral-700 hover:bg-neutral-100">
              {busy ? "처리 중..." : "이미지 교체"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPick(f);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100"
            >
              삭제
            </button>
          </div>
        </div>
      ) : (
        <label className="flex h-40 cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed border-neutral-300 text-sm text-neutral-400 hover:border-sky-300 hover:text-sky-500">
          {busy ? "처리 중..." : "+ 이미지 선택"}
          <span className="mt-1 text-xs text-neutral-300">클릭하여 첨부</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}

// 이미지를 최대 변 maxDim 이하로 리사이즈 후 JPEG data URL 로 변환
function resizeToDataUrl(
  file: File,
  maxDim: number,
  quality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas unavailable"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
