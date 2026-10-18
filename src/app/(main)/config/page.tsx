import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import ConfigClient from "./ConfigClient";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const me = await getCurrentUser();
  const [weeks, categories, guilds, bosses] = await Promise.all([
    prisma.week.findMany({ orderBy: { number: "desc" } }),
    prisma.attendanceCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.guild.findMany({ orderBy: { order: "asc" } }),
    prisma.bossMonster.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <ConfigClient
      isAdmin={me?.role === "ADMIN"}
      initialWeeks={weeks.map((w) => ({
        id: w.id,
        number: w.number,
        name: w.name ?? `${w.number}주차`,
      }))}
      initialCategories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        weight: c.weight,
        sortOrder: c.sortOrder,
      }))}
      initialGuilds={guilds.map((g) => ({
        id: g.id,
        order: g.order,
        name: g.name,
      }))}
      initialBosses={bosses.map((b) => ({
        id: b.id,
        name: b.name,
        sortOrder: b.sortOrder,
      }))}
    />
  );
}
