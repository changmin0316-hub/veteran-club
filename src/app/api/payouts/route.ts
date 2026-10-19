import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, AuthError } from "@/lib/guard";

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
  const payouts = await prisma.payout.findMany({
    include: { member: { select: { id: true, name: true, guildId: true } } },
    orderBy: { id: "desc" },
  });
  return NextResponse.json({ payouts });
}

const createSchema = z.object({
  itemName: z.string().trim().min(1, "아이템명을 입력하세요.").max(100),
  occasion: z.string().trim().max(50).optional(),
  memberId: z.number().int().positive("길드원을 선택하세요."),
  quantity: z.number().int().positive("수량은 1개 이상이어야 합니다.").max(100000),
});

export async function POST(req: NextRequest) {
  try {
    await requireManager();
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
  const { itemName, occasion, memberId, quantity } = parsed.data;
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    return NextResponse.json({ message: "존재하지 않는 길드원입니다." }, { status: 404 });
  }
  const payout = await prisma.payout.create({
    data: { itemName, occasion: occasion || null, memberId, quantity },
    include: { member: { select: { id: true, name: true, guildId: true } } },
  });
  return NextResponse.json({ payout }, { status: 201 });
}
