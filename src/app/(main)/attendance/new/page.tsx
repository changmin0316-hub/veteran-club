import { prisma } from "@/lib/db";
import AttendanceNewClient, {
  type Opt,
  type MemberOpt,
} from "./AttendanceNewClient";

export const dynamic = "force-dynamic";

export default async function AttendanceNewPage({
  searchParams,
}: {
  searchParams: Promise<{ squad?: string }>;
}) {
  const { squad } = await searchParams;

  const [weeks, guilds, categories, members] = await Promise.all([
    prisma.week.findMany({ orderBy: { number: "desc" } }),
    prisma.guild.findMany({ orderBy: { order: "asc" } }),
    prisma.attendanceCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.member.findMany({
      orderBy: [{ guildId: "asc" }, { name: "asc" }],
      select: { id: true, name: true, guildId: true },
    }),
  ]);

  return (
    <AttendanceNewClient
      weeks={weeks.map((w): Opt => ({ id: w.id, label: w.name ?? `${w.number}주차`, settled: w.settled }))}
      guilds={guilds.map((g) => ({ id: g.id, order: g.order, name: g.name }))}
      categories={categories.map(
        (c): Opt => ({ id: c.id, label: c.name, weight: c.weight })
      )}
      members={members.map(
        (m): MemberOpt => ({ id: m.id, name: m.name, guildId: m.guildId })
      )}
      defaultGuildId={squad ? Number(squad) : (guilds[0]?.id ?? null)}
    />
  );
}
