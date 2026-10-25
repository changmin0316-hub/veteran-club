import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, AuthError } from "@/lib/guard";
import { logActivity } from "@/lib/log";

export const dynamic = "force-dynamic";

function handleAuth(e: unknown) {
  if (e instanceof AuthError)
    return NextResponse.json({ message: e.message }, { status: e.status });
  throw e;
}

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  active: z.boolean().optional(),
  weekId: z.number().int().positive().nullable().optional(),
  guildId: z.number().int().positive().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let me;
  try {
    me = await requireManager();
  } catch (e) {
    return handleAuth(e);
  }
  const { id } = await params;
  const eventId = Number(id);
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." },
      { status: 400 }
    );
  }
  const event = await prisma.event.update({
    where: { id: eventId },
    data: parsed.data,
    include: { _count: { select: { items: true } }, week: true },
  });
  await logActivity({
    actorId: me.memberId,
    actorName: me.name,
    action: "분배 이벤트 수정",
    detail: `${event.name} 변경`,
  });
  return NextResponse.json({ event });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let me;
  try {
    me = await requireManager();
  } catch (e) {
    return handleAuth(e);
  }
  const { id } = await params;
  const ev = await prisma.event.findUnique({ where: { id: Number(id) }, select: { name: true } });
  await prisma.event.delete({ where: { id: Number(id) } });
  await logActivity({
    actorId: me.memberId,
    actorName: me.name,
    action: "분배 이벤트 삭제",
    detail: `${ev?.name ?? id} 삭제`,
  });
  return NextResponse.json({ message: "ok" });
}
