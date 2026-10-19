import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import AttendanceClient from "./AttendanceClient";
import type { WeekOpt, GuildOpt } from "../settlement-types";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const me = await getCurrentUser();
  const isManager = me?.role === "ADMIN" || me?.role === "COMMANDER";

  const [weeks, guilds] = await Promise.all([
    prisma.week.findMany({ orderBy: { number: "desc" } }),
    prisma.guild.findMany({ orderBy: { order: "asc" } }),
  ]);

  const weekOpts: WeekOpt[] = weeks.map((w) => ({
    id: w.id,
    label: w.name ?? `${w.number}주차`,
  }));
  const guildOpts: GuildOpt[] = guilds.map((g) => ({
    id: g.id,
    order: g.order,
    name: g.name,
  }));

  return (
    <AttendanceClient
      weeks={weekOpts}
      guilds={guildOpts}
      isManager={isManager}
      myName={me?.name ?? null}
    />
  );
}
