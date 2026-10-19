import { prisma } from "@/lib/db";
import { requireManagerPage } from "@/lib/page-guard";
import { computeSettlement } from "@/lib/settlement";
import AwardsClient, {
  type Award,
  type GuildOpt,
  type PayStat,
  type DonationRow,
  type PayoutRow,
  type MemberOpt,
} from "./AwardsClient";

export const dynamic = "force-dynamic";

export default async function AwardsPage() {
  await requireManagerPage();

  const [awarded, guilds, weeks, donations, payouts, members] = await Promise.all([
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
    prisma.donation.findMany({
      include: { member: { select: { id: true, name: true, guildId: true } } },
      orderBy: { id: "desc" },
    }),
    prisma.payout.findMany({
      include: { member: { select: { id: true, name: true, guildId: true } } },
      orderBy: { id: "desc" },
    }),
    prisma.member.findMany({
      select: { id: true, name: true, guildId: true },
      orderBy: [{ role: "desc" }, { name: "asc" }],
    }),
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

  const donationRows: DonationRow[] = donations.map((d) => ({
    id: d.id,
    itemName: d.itemName,
    occasion: d.occasion,
    memberId: d.memberId,
    memberName: d.member.name,
    guildId: d.member.guildId,
    quantity: d.quantity,
  }));

  const payoutRows: PayoutRow[] = payouts.map((p) => ({
    id: p.id,
    itemName: p.itemName,
    occasion: p.occasion,
    memberId: p.memberId,
    memberName: p.member.name,
    guildId: p.member.guildId,
    quantity: p.quantity,
  }));

  const memberOpts: MemberOpt[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    guildId: m.guildId,
  }));

  return (
    <AwardsClient
      awards={awards}
      guilds={guildOpts}
      payStats={payStats}
      donations={donationRows}
      payouts={payoutRows}
      members={memberOpts}
    />
  );
}
