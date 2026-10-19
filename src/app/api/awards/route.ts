import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManager, AuthError } from "@/lib/guard";

export const dynamic = "force-dynamic";

// 낙찰 통계: 낙찰자가 지정된 모든 이벤트 아이템 (운영진 이상)
export async function GET() {
  try {
    await requireManager();
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const awarded = await prisma.eventItem.findMany({
    where: { winnerId: { not: null } },
    include: {
      item: true,
      event: { select: { id: true, name: true, createdAt: true } },
      winner: { select: { id: true, name: true, guildId: true } },
    },
    orderBy: { id: "desc" },
  });

  const awards = awarded
    .filter((a) => a.winner)
    .map((a) => ({
      eventItemId: a.id,
      itemName: a.item.name,
      category: a.item.category,
      rarity: a.item.rarity,
      eventId: a.event.id,
      eventName: a.event.name,
      eventDate: a.event.createdAt.toISOString(),
      winnerId: a.winner!.id,
      winnerName: a.winner!.name,
      winnerGuildId: a.winner!.guildId,
    }));

  return NextResponse.json({ awards });
}
