import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManager, AuthError } from "@/lib/guard";
import { getStatDeltas } from "@/lib/stats";

export const dynamic = "force-dynamic";

// 이벤트 입찰 결과: 아이템별 신청자 목록 + 낙찰자
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireManager();
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const { id } = await params;
  const eventId = Number(id);

  const items = await prisma.eventItem.findMany({
    where: { eventId },
    orderBy: { id: "asc" },
    include: {
      item: true,
      winner: { select: { id: true, name: true, guildId: true } },
      bids: {
        orderBy: { createdAt: "asc" },
        include: {
          member: {
            select: {
              id: true,
              name: true,
              guildId: true,
              job: true,
              attack: true,
              defense: true,
              accuracy: true,
            },
          },
        },
      },
    },
  });

  // 전월 대비 총합 증감
  const deltaMap = await getStatDeltas();

  // 참석율: 전체 주차 중 해당 길드원이 출석(기록 count>0)한 주차 비율
  const [weeks, attRecords] = await Promise.all([
    prisma.week.findMany({ select: { id: true } }),
    prisma.attendanceRecord.findMany({
      where: { count: { gt: 0 } },
      select: { memberId: true, weekId: true },
    }),
  ]);
  const totalWeeks = weeks.length;
  const attendedWeeks = new Map<number, Set<number>>();
  for (const r of attRecords) {
    if (!attendedWeeks.has(r.memberId))
      attendedWeeks.set(r.memberId, new Set());
    attendedWeeks.get(r.memberId)!.add(r.weekId);
  }
  const attendanceRateOf = (memberId: number) =>
    totalWeeks > 0 ? (attendedWeeks.get(memberId)?.size ?? 0) / totalWeeks : 0;

  return NextResponse.json({
    items: items.map((ei) => ({
      eventItemId: ei.id,
      itemName: ei.item.name,
      rarity: ei.item.rarity,
      basePrice: ei.item.basePrice,
      winnerId: ei.winnerId,
      bidders: ei.bids.map((b) => ({
        memberId: b.member.id,
        name: b.member.name,
        guildId: b.member.guildId,
        job: b.member.job,
        statTotal: b.member.attack + b.member.defense + b.member.accuracy,
        statDelta: deltaMap.get(b.member.id)?.total ?? null,
        attendanceRate: attendanceRateOf(b.member.id),
      })),
    })),
  });
}
