import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, AuthError } from "@/lib/guard";
import { logActivity } from "@/lib/log";

export const dynamic = "force-dynamic";

const schema = z.object({
  guildId: z.number().int().positive(),
  ratio: z.number().int().min(0).max(100),
});

// 주차 x 군별 제외 분배금 비율(%) 설정
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let me;
  try {
    me = await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const { id } = await params;
  const weekId = Number(id);
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "입력값을 확인하세요." }, { status: 400 });
  }
  const { guildId, ratio } = parsed.data;

  const wk = await prisma.week.findUnique({ where: { id: weekId } });
  if (!wk) {
    return NextResponse.json({ message: "주차를 찾을 수 없습니다." }, { status: 404 });
  }
  if (wk.settled) {
    return NextResponse.json(
      { message: "분배 완료된 주차는 정산 입력이 불가합니다." },
      { status: 409 }
    );
  }

  await prisma.weekGuildExclude.upsert({
    where: { weekId_guildId: { weekId, guildId } },
    create: { weekId, guildId, ratio },
    update: { ratio },
  });

  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  await logActivity({
    actorId: me.memberId,
    actorName: me.name,
    action: "제외 분배금 비율",
    detail: `주차 ${weekId} · ${guild ? `${guild.order}군` : `군 ${guildId}`} ${ratio}%`,
  });

  return NextResponse.json({ message: "ok", ratio });
}
