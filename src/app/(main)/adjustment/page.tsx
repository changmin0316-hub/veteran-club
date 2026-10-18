import { prisma } from "@/lib/db";
import AdjustmentClient from "./AdjustmentClient";
import type { WeekOpt, GuildOpt } from "../settlement-types";

export const dynamic = "force-dynamic";

export default async function AdjustmentPage() {
  const [weeks, guilds] = await Promise.all([
    prisma.week.findMany({ orderBy: { number: "desc" } }),
    prisma.guild.findMany({ orderBy: { order: "asc" } }),
  ]);

  return (
    <AdjustmentClient
      weeks={weeks.map((w): WeekOpt => ({ id: w.id, label: w.name ?? `${w.number}주차` }))}
      guilds={guilds.map((g): GuildOpt => ({ id: g.id, order: g.order, name: g.name }))}
    />
  );
}
