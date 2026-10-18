import { prisma } from "@/lib/db";
import RequestClient, { type EventOpt, type GuildOpt } from "./RequestClient";

export const dynamic = "force-dynamic";

export default async function RequestPage() {
  const [events, guilds] = await Promise.all([
    prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, active: true },
    }),
    prisma.guild.findMany({ orderBy: { order: "asc" } }),
  ]);

  return (
    <RequestClient
      events={events.map((e): EventOpt => ({ id: e.id, name: e.name, active: e.active }))}
      guilds={guilds.map((g): GuildOpt => ({ id: g.id, order: g.order, name: g.name }))}
    />
  );
}
