import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import BidClient, { type BidItem } from "./BidClient";

export const dynamic = "force-dynamic";

export default async function ItemRequestPage() {
  const me = await getCurrentUser();

  const activeEvent = await prisma.event.findFirst({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    include: {
      week: true,
      items: {
        include: { item: true, _count: { select: { bids: true } } },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!activeEvent) {
    return (
      <section>
        <h2 className="mb-3 text-base font-bold">진행중인 이벤트</h2>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
          진행중인 이벤트가 없습니다.
        </div>
      </section>
    );
  }

  const myBids = me
    ? await prisma.bid.findMany({
        where: { memberId: me.memberId, eventItem: { eventId: activeEvent.id } },
        select: { eventItemId: true },
      })
    : [];
  const myBidSet = new Set(myBids.map((b) => b.eventItemId));

  const items: BidItem[] = activeEvent.items.map((ei) => ({
    eventItemId: ei.id,
    name: ei.item.name,
    rarity: ei.item.rarity,
    bidCount: ei._count.bids,
    mine: myBidSet.has(ei.id),
  }));

  // 출석 연동 이벤트: 해당 주차 출석이 있어야 입찰 자격이 있음
  let attendanceLinked = false;
  let eligible = true;
  if (activeEvent.weekId && me) {
    attendanceLinked = true;
    const attended = await prisma.attendanceRecord.findFirst({
      where: { weekId: activeEvent.weekId, memberId: me.memberId, count: { gt: 0 } },
      select: { id: true },
    });
    eligible = !!attended;
  }

  const linkedWeekName = activeEvent.week
    ? activeEvent.week.name ?? `${activeEvent.week.number}주차`
    : null;

  return (
    <BidClient
      eventId={activeEvent.id}
      eventName={activeEvent.name}
      eventCreatedAt={activeEvent.createdAt.toISOString()}
      initialItems={items}
      attendanceLinked={attendanceLinked}
      eligible={eligible}
      linkedWeekName={linkedWeekName}
    />
  );
}
