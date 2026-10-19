import { prisma } from "@/lib/db";
import { requireManagerPage } from "@/lib/page-guard";
import AwardsClient, { type Award, type GuildOpt } from "./AwardsClient";

export const dynamic = "force-dynamic";

export default async function AwardsPage() {
  await requireManagerPage();

  const [awarded, guilds] = await Promise.all([
    prisma.eventItem.findMany({
      where: { winnerId: { not: null } },
      include: {
        item: true,
        event: { select: { id: true, name: true, createdAt: true } },
        winner: { select: { id: true, name: true, guildId: true } },
      },
      orderBy: { id: "desc" },
    }),
    prisma.guild.findMany({ orderBy: { order: "asc" } }),
  ]);

  const awards: Award[] = awarded
    .filter((a) => a.winner)
    .map((a) => ({
      eventItemId: a.id,
      itemName: a.item.name,
      category: a.item.category,
      rarity: a.item.rarity,
      eventName: a.event.name,
      eventDate: a.event.createdAt.toISOString(),
      winnerId: a.winner!.id,
      winnerName: a.winner!.name,
      winnerGuildId: a.winner!.guildId,
    }));

  const guildOpts: GuildOpt[] = guilds.map((g) => ({
    id: g.id,
    order: g.order,
    name: g.name,
  }));

  return <AwardsClient awards={awards} guilds={guildOpts} />;
}
