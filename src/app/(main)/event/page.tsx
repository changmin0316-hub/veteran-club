import { prisma } from "@/lib/db";
import EventClient, {
  type EventRow,
  type WeekOpt,
  type GuildOpt,
} from "./EventClient";
import { requireManagerPage } from "@/lib/page-guard";

export const dynamic = "force-dynamic";

export default async function EventPage() {
  await requireManagerPage();
  const [events, weeks, guilds] = await Promise.all([
    prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } }, week: true, guild: true },
    }),
    prisma.week.findMany({ orderBy: { number: "desc" } }),
    prisma.guild.findMany({ orderBy: { order: "asc" } }),
  ]);

  const rows: EventRow[] = events.map((e) => ({
    id: e.id,
    name: e.name,
    active: e.active,
    weekId: e.weekId,
    weekName: e.week?.name ?? (e.week ? `${e.week.number}주차` : null),
    guildId: e.guildId,
    guildName: e.guild?.name ?? null,
    itemCount: e._count.items,
    createdAt: e.createdAt.toISOString(),
  }));

  const weekOpts: WeekOpt[] = weeks.map((w) => ({
    id: w.id,
    label: w.name ?? `${w.number}주차`,
  }));

  const guildOpts: GuildOpt[] = guilds.map((g) => ({
    id: g.id,
    order: g.order,
    name: g.name,
  }));

  return <EventClient initialRows={rows} weeks={weekOpts} guilds={guildOpts} />;
}
