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
  const weeks = await prisma.week.findMany({ orderBy: { number: "desc" } });
  return NextResponse.json({ weeks });
}

const createSchema = z.object({
  // 이름은 자유 텍스트(예: "10월 3주차 - 쟁"). 순번(number)은 서버가 자동 부여.
  name: z.string().trim().min(1, "주차 이름을 입력하세요.").max(100),
  number: z.number().int().positive().optional(),
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
  // 순번(number)은 지정값이 없으면 기존 최대값 +1 로 자동 부여(정렬/고유키용).
  let number = parsed.data.number;
  if (number == null) {
    const max = await prisma.week.aggregate({ _max: { number: true } });
    number = (max._max.number ?? 0) + 1;
  } else {
    const dup = await prisma.week.findUnique({ where: { number } });
    if (dup) {
      return NextResponse.json({ message: "이미 있는 순번입니다." }, { status: 409 });
    }
  }
  const week = await prisma.week.create({
    data: { number, name: parsed.data.name },
  });
  await logActivity({
    actorId: me.memberId,
    actorName: me.name,
    action: "주차 등록",
    detail: week.name ?? `${week.number}주차`,
  });
  return NextResponse.json({ week }, { status: 201 });
}
