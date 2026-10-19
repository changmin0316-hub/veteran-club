import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import UserClient from "./UserClient";

export const dynamic = "force-dynamic";

export default async function UserPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const [member, bosses] = await Promise.all([
    prisma.member.findUnique({ where: { id: me.memberId } }),
    prisma.bossMonster.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  if (!member) redirect("/login");

  let bossKills: Record<string, boolean> = {};
  try {
    bossKills = JSON.parse(member.bossKills || "{}");
  } catch {
    bossKills = {};
  }

  return (
    <UserClient
      profile={{
        name: member.name,
        job: member.job ?? "",
        attack: member.attack,
        defense: member.defense,
        accuracy: member.accuracy,
        legendSkill: member.legendSkill,
        myth1: member.myth1,
        myth2: member.myth2,
        bossKills,
        equipImage: member.equipImage ?? null,
        heavenImage: member.heavenImage ?? null,
      }}
      bosses={bosses.map((b) => ({ id: b.id, name: b.name }))}
    />
  );
}
