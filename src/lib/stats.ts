import { prisma } from "@/lib/db";

export function ymOf(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function prevYm(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1); // m은 1-based → 전월
  return ymOf(d);
}

export interface StatDelta {
  attack: number;
  defense: number;
  accuracy: number;
  total: number;
}

/**
 * 이번 달(1일 기준) 스냅샷이 없으면 현재 스탯으로 생성한다(멱등).
 * 매월 1일 자동 생성이 이상적이며(크론 권장), 없을 경우 그 달 첫 조회 시점의
 * 값을 기준선으로 캡처한다.
 */
export async function ensureMonthlySnapshot(): Promise<void> {
  const ym = ymOf();
  const members = await prisma.member.findMany({
    select: { id: true, attack: true, defense: true, accuracy: true },
  });
  const existing = await prisma.monthlyStat.findMany({
    where: { ym },
    select: { memberId: true },
  });
  const have = new Set(existing.map((e) => e.memberId));
  const toCreate = members.filter((m) => !have.has(m.id));
  if (toCreate.length === 0) return;
  await prisma.monthlyStat.createMany({
    data: toCreate.map((m) => ({
      memberId: m.id,
      ym,
      attack: m.attack,
      defense: m.defense,
      accuracy: m.accuracy,
    })),
  });
}

/**
 * 이번 달 스냅샷을 현재 스탯으로 기록한다.
 * force=true 면 기존 값도 덮어쓴다(매월 1일 0시 크론이 정확한 기준선을 남기도록).
 * 반환: 기록된 멤버 수.
 */
export async function recordMonthlySnapshot(force = false): Promise<number> {
  if (!force) {
    const before = await prisma.monthlyStat.count({ where: { ym: ymOf() } });
    await ensureMonthlySnapshot();
    const after = await prisma.monthlyStat.count({ where: { ym: ymOf() } });
    return after - before;
  }
  const ym = ymOf();
  const members = await prisma.member.findMany({
    select: { id: true, attack: true, defense: true, accuracy: true },
  });
  await prisma.$transaction(
    members.map((m) =>
      prisma.monthlyStat.upsert({
        where: { memberId_ym: { memberId: m.id, ym } },
        create: {
          memberId: m.id,
          ym,
          attack: m.attack,
          defense: m.defense,
          accuracy: m.accuracy,
        },
        update: { attack: m.attack, defense: m.defense, accuracy: m.accuracy },
      })
    )
  );
  return members.length;
}

/**
 * 전월 대비 증감: 이번 달 스냅샷 − 전월 스냅샷.
 * 전월 스냅샷이 없는 멤버는 null(비교 불가).
 */
export async function getStatDeltas(): Promise<Map<number, StatDelta | null>> {
  const ym = ymOf();
  const prev = prevYm(ym);

  const [cur, old] = await Promise.all([
    prisma.monthlyStat.findMany({ where: { ym } }),
    prisma.monthlyStat.findMany({ where: { ym: prev } }),
  ]);

  const curMap = new Map(cur.map((s) => [s.memberId, s]));
  const oldMap = new Map(old.map((s) => [s.memberId, s]));

  const result = new Map<number, StatDelta | null>();
  for (const [memberId, c] of curMap) {
    const o = oldMap.get(memberId);
    if (!o) {
      result.set(memberId, null);
      continue;
    }
    result.set(memberId, {
      attack: c.attack - o.attack,
      defense: c.defense - o.defense,
      accuracy: c.accuracy - o.accuracy,
      total:
        c.attack + c.defense + c.accuracy - (o.attack + o.defense + o.accuracy),
    });
  }
  return result;
}
