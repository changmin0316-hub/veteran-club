import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import UsersClient, {
  type MemberRow,
  type GuildOpt,
  type BossOpt,
  type BaselineMap,
} from "./UsersClient";
import { ensureMonthlySnapshot, getStatBaseline } from "@/lib/stats";

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

  const [members, guilds, bosses, baseMap] = await Promise.all([
    prisma.member.findMany({
      include: { guild: true },
      orderBy: [{ role: "desc" }, { name: "asc" }],
    }),
    prisma.guild.findMany({ orderBy: { order: "asc" } }),
    prisma.bossMonster.findMany({ orderBy: { sortOrder: "asc" } }),
    getStatBaseline(),
  ]);

  // 전월 말일 기준선(멤버별). 클라이언트에서 현재 입력값과 비교해 증감을 실시간 계산.
  const baseline: BaselineMap = {};
  for (const [memberId, b] of baseMap) baseline[memberId] = b;

  const rows: MemberRow[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    job: m.job ?? "",
    role: m.role as MemberRow["role"],
    guildId: m.guildId,
    attack: m.attack,
    defense: m.defense,
    accuracy: m.accuracy,
    myth1: m.myth1,
    myth2: m.myth2,
    skill1: m.skill1,
    skill2: m.skill2,
    pvpKills: m.pvpKills,
    itemCollection: m.itemCollection,
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
      baseline={baseline}
      myRole={(me?.role ?? "MEMBER") as MemberRow["role"]}
    />
  );
}
