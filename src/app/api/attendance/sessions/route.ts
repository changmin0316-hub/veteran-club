import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManager, AuthError } from "@/lib/guard";

export const dynamic = "force-dynamic";

// 특정 주차의 출석 등록 세션 목록 (최신순)
export async function GET(req: NextRequest) {
  try {
    await requireManager();
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }
  const weekId = Number(req.nextUrl.searchParams.get("weekId"));
  if (!Number.isInteger(weekId)) {
    return NextResponse.json({ sessions: [] });
  }

  const [sessions, categories, guilds, members] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: { weekId },
      orderBy: { createdAt: "desc" },
      include: { members: true },
    }),
    prisma.attendanceCategory.findMany({ select: { id: true, name: true } }),
    prisma.guild.findMany({ select: { id: true, order: true, name: true } }),
    prisma.member.findMany({ select: { id: true, name: true, guildId: true } }),
  ]);

  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const guildName = new Map(guilds.map((g) => [g.id, `${g.order}군`]));
  const memberName = new Map(members.map((m) => [m.id, m.name]));

  return NextResponse.json({
    roster: members
      .map((m) => ({ id: m.id, name: m.name, guildId: m.guildId }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    sessions: sessions.map((s) => ({
      id: s.id,
      time: s.time,
      plays: s.plays,
      actorName: s.actorName,
      createdAt: s.createdAt.toISOString(),
      categoryId: s.categoryId,
      categoryName: catName.get(s.categoryId) ?? "?",
      guildId: s.guildId,
      guildName: s.guildId ? guildName.get(s.guildId) ?? "-" : "전체",
      members: s.members
        .map((m) => ({ id: m.memberId, name: memberName.get(m.memberId) ?? "?" }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })),
  });
}
