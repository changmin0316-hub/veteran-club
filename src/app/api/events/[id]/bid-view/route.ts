import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/guard";

export const dynamic = "force-dynamic";

// 특정 이벤트의 입찰 화면 데이터 (아이템 목록 + 내 신청 + 출석 자격)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let me;
  try {
    me = await requireUser();
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const { id } = await params;
  const eventId = Number(id);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      week: true,
      items: {
        include: { item: true, _count: { select: { bids: true } } },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!event) {
    return NextResponse.json({ message: "이벤트를 찾을 수 없습니다." }, { status: 404 });
  }

  const myBids = await prisma.bid.findMany({
    where: { memberId: me.memberId, eventItem: { eventId } },
    select: { eventItemId: true },
  });
  const myBidSet = new Set(myBids.map((b) => b.eventItemId));

  let attendanceLinked = false;
  let eligible = true;
  let linkedWeekName: string | null = null;
  if (event.weekId) {
    attendanceLinked = true;
    linkedWeekName = event.week
      ? event.week.name ?? `${event.week.number}주차`
      : null;
    const attended = await prisma.attendanceRecord.findFirst({
      where: { weekId: event.weekId, memberId: me.memberId, count: { gt: 0 } },
      select: { id: true },
    });
    eligible = !!attended;
  }

  return NextResponse.json({
    eventId: event.id,
    eventName: event.name,
    eventCreatedAt: event.createdAt.toISOString(),
    active: event.active,
    attendanceLinked,
    eligible,
    linkedWeekName,
    items: event.items.map((ei) => ({
      eventItemId: ei.id,
      name: ei.item.name,
      rarity: ei.item.rarity,
      bidCount: ei._count.bids,
      mine: myBidSet.has(ei.id),
    })),
  });
}
