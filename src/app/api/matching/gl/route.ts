import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/guard";

export const dynamic = "force-dynamic";

// 매칭 보드가 사용할 길드 목록을 [서버, 세력, 길드이름, 관계(A/N/E)] 형태로 반환
const SIDE_TO_REL: Record<string, string> = { 아군: "A", 중립: "N", 적군: "E" };

export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }
  const guilds = await prisma.matchGuild.findMany({
    orderBy: [{ server: "asc" }, { faction: "asc" }, { name: "asc" }],
  });
  const gl = guilds
    .filter((g) => g.faction)
    .map((g) => [g.server, g.faction, g.name, SIDE_TO_REL[g.side] ?? "N"]);
  return NextResponse.json({ gl });
}
