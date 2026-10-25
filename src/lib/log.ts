import { prisma } from "@/lib/db";

// 멤버 변경 전/후 비교 → "템컬렉 97.41→97.46, 공격 100→120" 형태
const FIELD_LABEL: Record<string, string> = {
  name: "캐릭명",
  job: "직업",
  role: "권한",
  guildId: "소속",
  attack: "공격",
  defense: "방어",
  accuracy: "명중",
  legendSkill: "전설스킬",
  myth1: "신화성의",
  myth2: "신화사역마",
  myth3: "신화공명",
  skill1: "1전스",
  skill2: "2전스",
  pvpKills: "쟁탈전",
  itemCollection: "템컬렉",
  equipImage: "장비이미지",
  heavenImage: "헤븐이미지",
  bossKills: "보스",
};
const ROLE_KO: Record<string, string> = {
  ADMIN: "관리자",
  COMMANDER: "운영진",
  MEMBER: "길드원",
};
function fmtVal(k: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "-";
  if (k === "role") return ROLE_KO[String(v)] ?? String(v);
  if (typeof v === "boolean") return v ? "O" : "X";
  if (k === "equipImage" || k === "heavenImage") return "있음";
  return String(v);
}

export function memberDiff(
  before: Record<string, unknown>,
  changes: Record<string, unknown>
): string {
  const parts: string[] = [];
  for (const k of Object.keys(FIELD_LABEL)) {
    if (!(k in changes)) continue;
    const nv = changes[k];
    const ov = before[k];
    if (k === "bossKills") {
      // JSON 비교: 다르면 "보스 변경"
      const o = typeof ov === "string" ? ov : JSON.stringify(ov ?? {});
      const n = typeof nv === "string" ? nv : JSON.stringify(nv ?? {});
      if (o !== n) parts.push("보스 변경");
      continue;
    }
    if (k === "equipImage" || k === "heavenImage") {
      if (!!ov !== !!nv) parts.push(`${FIELD_LABEL[k]} ${nv ? "등록" : "삭제"}`);
      continue;
    }
    if (String(ov ?? "") === String(nv ?? "")) continue;
    parts.push(`${FIELD_LABEL[k]} ${fmtVal(k, ov)}→${fmtVal(k, nv)}`);
  }
  return parts.join(", ");
}

// 활동 로그 기록 (실패해도 본 작업에 영향 없도록 try/catch)
export async function logActivity(a: {
  actorId?: number | null;
  actorName: string;
  action: string;
  detail?: string;
  targetMemberId?: number | null;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        actorId: a.actorId ?? null,
        actorName: a.actorName,
        action: a.action,
        detail: a.detail ?? "",
        targetMemberId: a.targetMemberId ?? null,
      },
    });
  } catch {
    // 로깅 실패는 무시
  }
}
