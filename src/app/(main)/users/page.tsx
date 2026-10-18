import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import UsersClient, {
  type MemberRow,
  type GuildOpt,
  type BossOpt,
  type StatDeltaMap,
} from "./UsersClient";
import { ensureMonthlySnapshot, getStatDeltas } from "@/lib/stats";

export const dynamic = "force-dynamic";

function parseBossKills(raw: string): Record<string, boolean> {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

export default async function UsersPage() {
  const me = await getCurrentUser();

  // 이번 달(1일 기준) 스냅샷 보장 후 전월 대비 증감 계산
  await ensureMonthlySnapshot();

  const [members, guilds, bosses, deltaMap] = await Promise.all([
    prisma.member.findMany({
      include: { guild: true },
      orderBy: [{ role: "desc" }, { name: "asc" }],
    }),
    prisma.guild.findMany({ orderBy: { order: "asc" } }),
    prisma.bossMonster.findMany({ orderBy: { sortOrder: "asc" } }),
    getStatDeltas(),
  ]);

  const deltas: StatDeltaMap = {};
  for (const [memberId, d] of deltaMap) deltas[memberId] = d;

  const rows: MemberRow[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    job: m.job ?? "",
    role: m.role as MemberRow["role"],
    guildId: m.guildId,
    attack: m.attack,
    defense: m.defense,
    accuracy: m.accuracy,
    bossKills: parseBossKills(m.bossKills),
  }));

  const guildOpts: GuildOpt[] = guilds.map((g) => ({
    id: g.id,
    order: g.order,
    name: g.name,
    count: members.filter((m) => m.guildId === g.id).length,
  }));

  const bossOpts: BossOpt[] = bosses.map((b) => ({ id: b.id, name: b.name }));

  return (
    <UsersClient
      initialRows={rows}
      guilds={guildOpts}
      bosses={bossOpts}
      deltas={deltas}
      myRole={(me?.role ?? "MEMBER") as MemberRow["role"]}
    />
  );
}
