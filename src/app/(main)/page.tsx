import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import BidClient, { type BidView, type EventOpt } from "./BidClient";

export const dynamic = "force-dynamic";

export default async function ItemRequestPage() {
  const me = await getCurrentUser();

  // 진행중(active) 이벤트 전체 — 드롭다운용
  const activeEvents = await prisma.event.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  if (activeEvents.length === 0) {
    return (
      <section>
        <h2 className="mb-3 text-base font-bold">진행중인 이벤트</h2>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
          진행중인 이벤트가 없습니다.
        </div>
      </section>
    );
  }

  const events: EventOpt[] = activeEvents.map((e) => ({ id: e.id, name: e.name }));

  // 기본 선택 = 가장 최근 이벤트. 초기 렌더용 데이터를 서버에서 구성.
  const initial = await buildBidView(events[0].id, me?.memberId);

  return <BidClient events={events} initialView={initial} />;
}

async function buildBidView(
  eventId: number,
  memberId?: number
): Promise<BidView> {
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
    return {
      eventId,
      eventName: "",
      eventCreatedAt: new Date().toISOString(),
      attendanceLinked: false,
      eligible: true,
      linkedWeekName: null,
      items: [],
    };
  }

  const myBids = memberId
    ? await prisma.bid.findMany({
        where: { memberId, eventItem: { eventId } },
        select: { eventItemId: true },
      })
    : [];
  const myBidSet = new Set(myBids.map((b) => b.eventItemId));

  let attendanceLinked = false;
  let eligible = true;
  let linkedWeekName: string | null = null;
  if (event.weekId && memberId) {
    attendanceLinked = true;
    linkedWeekName = event.week
      ? event.week.name ?? `${event.week.number}주차`
      : null;
    const attended = await prisma.attendanceRecord.findFirst({
      where: { weekId: event.weekId, memberId, count: { gt: 0 } },
      select: { id: true },
    });
    eligible = !!attended;
  }

  return {
    eventId: event.id,
    eventName: event.name,
    eventCreatedAt: event.createdAt.toISOString(),
    attendanceLinked,
    eligible,
    linkedWeekName,
    items: event.items.map((ei) => ({
      eventItemId: ei.id,
      name: ei.item.name,
      rarity: ei.item.rarity,
      basePrice: ei.item.basePrice,
      bidCount: ei._count.bids,
      mine: myBidSet.has(ei.id),
    })),
  };
}
