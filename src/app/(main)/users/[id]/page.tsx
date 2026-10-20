import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireManagerPage } from "@/lib/page-guard";
import { getCurrentUser } from "@/lib/session";
import UserClient from "../../user/UserClient";

export const dynamic = "force-dynamic";

export default async function MemberEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireManagerPage();
  const me = await getCurrentUser();
  const { id } = await params;
  const memberId = Number(id);
  if (!Number.isInteger(memberId)) notFound();

  const [member, bosses] = await Promise.all([
    prisma.member.findUnique({ where: { id: memberId } }),
    prisma.bossMonster.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  if (!member) notFound();

  let bossKills: Record<string, boolean> = {};
  try {
    bossKills = JSON.parse(member.bossKills || "{}");
  } catch {
    bossKills = {};
  }

  return (
    <UserClient
      targetMemberId={member.id}
      canEditName={me?.role === "ADMIN"}
      canDelete={me?.role === "ADMIN"}
      profile={{
        name: member.name,
        job: member.job ?? "",
        attack: member.attack,
        defense: member.defense,
        accuracy: member.accuracy,
        legendSkill: member.legendSkill,
        myth1: member.myth1,
        myth2: member.myth2,
        myth3: member.myth3,
        skill1: member.skill1,
        skill2: member.skill2,
        pvpKills: member.pvpKills,
        itemCollection: member.itemCollection,
        bossKills,
        equipImage: member.equipImage ?? null,
        heavenImage: member.heavenImage ?? null,
      }}
      bosses={bosses.map((b) => ({ id: b.id, name: b.name }))}
    />
  );
}
