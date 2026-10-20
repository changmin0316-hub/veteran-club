import { prisma } from "@/lib/db";

export interface SettlementRow {
  memberId: number;
  name: string;
  guildId: number | null;
  statTotal: number; // 3대 스탯 합
  applied: number; // 적용 횟수(출석 총 횟수)
  score: number; // 가중 출석 점수
  attendanceRate: number; // 출석율 (0~1, 최고점 대비)
  shareRatio: number; // 분배율 (0~1, 포함 인원 점수 합 대비)
  extra: number; // 추가 분배금(수동 지급)
  share: number; // 분배금 (비율분배 + 추가분배금)
  excluded: boolean; // 분배 제외 여부
  paid: boolean; // 분배금 선지급 완료 표시
  counts: Record<number, number>; // categoryId -> count
}

export interface SettlementResult {
  week: { id: number; number: number; name: string | null; excludeRatio: number; diamond: number; settled: boolean };
  categories: { id: number; name: string; weight: number }[];
  rows: SettlementRow[];
  pool: number; // 길드 정산금(다이아)
  excludeAmount: number; // 제외금액(힐비)
  distributable: number; // 실제 분배 재원
  totalScore: number; // 포함 인원 점수 합
}

/** 특정 주차의 정산을 계산한다. guildId 지정 시 해당 군만. */
export async function computeSettlement(
  weekId: number,
  guildId?: number | null
): Promise<SettlementResult | null> {
  const week = await prisma.week.findUnique({ where: { id: weekId } });
  if (!week) return null;

  const [categories, members, records, exclusions, extraPays, paidMarks] =
    await Promise.all([
      prisma.attendanceCategory.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.member.findMany({
        where: guildId ? { guildId } : undefined,
        orderBy: [{ guildId: "asc" }, { name: "asc" }],
      }),
      prisma.attendanceRecord.findMany({ where: { weekId } }),
      prisma.settlementExclusion.findMany({ where: { weekId } }),
      prisma.extraPay.findMany({ where: { weekId } }),
      prisma.settlementPaid.findMany({ where: { weekId } }),
    ]);

  const weightById = new Map(categories.map((c) => [c.id, c.weight]));
  const excludedSet = new Set(exclusions.map((e) => e.memberId));
  const extraById = new Map(extraPays.map((e) => [e.memberId, e.amount]));
  const paidSet = new Set(paidMarks.map((p) => p.memberId));

  // 멤버별 카테고리 카운트 집계
  const countsByMember = new Map<number, Record<number, number>>();
  for (const r of records) {
    if (!countsByMember.has(r.memberId)) countsByMember.set(r.memberId, {});
    countsByMember.get(r.memberId)![r.categoryId] = r.count;
  }

  const base = members.map((m) => {
    const counts = countsByMember.get(m.id) ?? {};
    let applied = 0;
    let score = 0;
    for (const [cid, cnt] of Object.entries(counts)) {
      applied += cnt;
      score += cnt * (weightById.get(Number(cid)) ?? 0);
    }
    return {
      member: m,
      counts,
      applied,
      score,
      excluded: excludedSet.has(m.id),
    };
  });

  const maxScore = Math.max(0, ...base.map((b) => b.score));
  const totalScore = base
    .filter((b) => !b.excluded)
    .reduce((s, b) => s + b.score, 0);

  const pool = week.diamond;
  const excludeAmount = Math.floor((pool * week.excludeRatio) / 100);
  const distributable = pool - excludeAmount;

  const rows: SettlementRow[] = base.map((b) => {
    const shareRatio =
      b.excluded || totalScore <= 0 ? 0 : b.score / totalScore;
    const extra = extraById.get(b.member.id) ?? 0;
    return {
      memberId: b.member.id,
      name: b.member.name,
      guildId: b.member.guildId,
      statTotal: b.member.attack + b.member.defense + b.member.accuracy,
      applied: b.applied,
      score: b.score,
      attendanceRate: maxScore > 0 ? b.score / maxScore : 0,
      shareRatio,
      extra,
      share: Math.floor(distributable * shareRatio) + extra,
      excluded: b.excluded,
      paid: paidSet.has(b.member.id),
      counts: b.counts,
    };
  });

  return {
    week: {
      id: week.id,
      number: week.number,
      name: week.name,
      excludeRatio: week.excludeRatio,
      diamond: week.diamond,
      settled: week.settled,
    },
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      weight: c.weight,
    })),
    rows,
    pool,
    excludeAmount,
    distributable,
    totalScore,
  };
}
