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

export async function GET() {
  try {
    await requireManager();
  } catch (e) {
    return handleAuth(e);
  }
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } }, week: true, guild: true },
  });
  return NextResponse.json({ events });
}

const createSchema = z.object({
  name: z.string().trim().min(1, "이벤트 이름을 입력하세요.").max(100),
  weekId: z.number().int().positive().nullable().optional(),
  guildId: z.number().int().positive().nullable().optional(),
});

export async function POST(req: NextRequest) {
  let me;
  try {
    me = await requireManager();
  } catch (e) {
    return handleAuth(e);
  }
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." },
      { status: 400 }
    );
  }
  const event = await prisma.event.create({
    data: {
      name: parsed.data.name,
      weekId: parsed.data.weekId ?? null,
      guildId: parsed.data.guildId ?? null,
      active: true,
    },
    include: { _count: { select: { items: true } }, week: true, guild: true },
  });
  await logActivity({
    actorId: me.memberId,
    actorName: me.name,
    action: "분배 등록(이벤트)",
    detail: `${event.name} 생성`,
  });
  return NextResponse.json({ event }, { status: 201 });
}
