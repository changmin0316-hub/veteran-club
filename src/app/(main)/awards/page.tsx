import { prisma } from "@/lib/db";
import { requireManagerPage } from "@/lib/page-guard";
import { computeSettlement } from "@/lib/settlement";
import AwardsClient, {
  type Award,
  type GuildOpt,
  type PayStat,
} from "./AwardsClient";

export const dynamic = "force-dynamic";

export default async function AwardsPage() {
  await requireManagerPage();

  const [awarded, guilds, weeks] = await Promise.all([
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
    prisma.week.findMany({ orderBy: { number: "desc" } }),
  ]);

  // 주차별 분배금 집계 (길드원별 합계)
  const settlements = await Promise.all(
    weeks.map((w) => computeSettlement(w.id))
  );
  const payMap = new Map<
    number,
    {
      name: string;
      guildId: number | null;
      total: number;
      weeks: { label: string; share: number }[];
    }
  >();
  weeks.forEach((w, i) => {
    const res = settlements[i];
    if (!res) return;
    const label = w.name ?? `${w.number}주차`;
    for (const r of res.rows) {
      if (r.share <= 0) continue;
      if (!payMap.has(r.memberId))
        payMap.set(r.memberId, {
          name: r.name,
          guildId: r.guildId,
          total: 0,
          weeks: [],
        });
      const e = payMap.get(r.memberId)!;
      e.total += r.share;
      e.weeks.push({ label, share: r.share });
    }
  });
  const payStats: PayStat[] = [...payMap.entries()]
    .map(([memberId, v]) => ({ memberId, ...v }))
    .sort((a, b) => b.total - a.total);

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

  return <AwardsClient awards={awards} guilds={guildOpts} payStats={payStats} />;
}
