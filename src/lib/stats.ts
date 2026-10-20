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
  itemCollection: number;
}

/**
 * 이번 달(1일 기준) 스냅샷이 없으면 현재 스탯으로 생성한다(멱등).
 * 매월 1일 자동 생성이 이상적이며(크론 권장), 없을 경우 그 달 첫 조회 시점의
 * 값을 기준선으로 캡처한다.
 */
export async function ensureMonthlySnapshot(): Promise<void> {
  const ym = ymOf();
  const members = await prisma.member.findMany({
    select: { id: true, attack: true, defense: true, accuracy: true, itemCollection: true },
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
      itemCollection: m.itemCollection,
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
    select: { id: true, attack: true, defense: true, accuracy: true, itemCollection: true },
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
          itemCollection: m.itemCollection,
        },
        update: {
          attack: m.attack,
          defense: m.defense,
          accuracy: m.accuracy,
          itemCollection: m.itemCollection,
        },
      })
    )
  );
  return members.length;
}

/**
 * 전월 말일 기준선(= 이번 달 스냅샷)을 멤버별로 반환.
 * 이번 달 1일(크론) 또는 그 달 첫 조회 시점에 캡처된 "전월 말일까지 저장된" 값.
 */
export async function getStatBaseline(): Promise<
  Map<number, { attack: number; defense: number; accuracy: number; itemCollection: number }>
> {
  const ym = ymOf();
  const base = await prisma.monthlyStat.findMany({ where: { ym } });
  return new Map(
    base.map((s) => [
      s.memberId,
      {
        attack: s.attack,
        defense: s.defense,
        accuracy: s.accuracy,
        itemCollection: s.itemCollection,
      },
    ])
  );
}

/**
 * 증감: 현재 저장된 실시간 스탯 − 전월 말일 기준선(이번 달 스냅샷).
 * 기준선이 없는 멤버는 null(비교 불가). 길드원이 값을 수정·저장하면 즉시 반영된다.
 */
export async function getStatDeltas(): Promise<Map<number, StatDelta | null>> {
  const ym = ymOf();

  const [base, members] = await Promise.all([
    prisma.monthlyStat.findMany({ where: { ym } }),
    prisma.member.findMany({
      select: { id: true, attack: true, defense: true, accuracy: true, itemCollection: true },
    }),
  ]);

  const baseMap = new Map(base.map((s) => [s.memberId, s]));

  const result = new Map<number, StatDelta | null>();
  for (const m of members) {
    const b = baseMap.get(m.id);
    if (!b) {
      result.set(m.id, null);
      continue;
    }
    result.set(m.id, {
      attack: m.attack - b.attack,
      defense: m.defense - b.defense,
      accuracy: m.accuracy - b.accuracy,
      total:
        m.attack + m.defense + m.accuracy - (b.attack + b.defense + b.accuracy),
      itemCollection: m.itemCollection - b.itemCollection,
    });
  }
  return result;
}
