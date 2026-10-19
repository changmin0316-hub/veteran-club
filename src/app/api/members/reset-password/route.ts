import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requireManager, AuthError } from "@/lib/guard";

export const dynamic = "force-dynamic";

// 초기화 임시 비밀번호
const TEMP_PASSWORD = "0000";

const schema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "대상을 선택하세요."),
});

export async function POST(req: NextRequest) {
  let me;
  try {
    me = await requireManager();
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." },
      { status: 400 }
    );
  }

  const targets = await prisma.member.findMany({
    where: { id: { in: parsed.data.ids } },
    select: { id: true, name: true, role: true },
  });

  // 관리자이 아니면 ADMIN 대상 초기화 불가
  if (me.role !== "ADMIN" && targets.some((t) => t.role === "ADMIN")) {
    return NextResponse.json(
      { message: "관리자 계정의 비밀번호는 초기화할 수 없습니다." },
      { status: 403 }
    );
  }

  const hash = await hashPassword(TEMP_PASSWORD);
  await prisma.member.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { passwordHash: hash },
  });

  return NextResponse.json({
    message: "ok",
    tempPassword: TEMP_PASSWORD,
    count: targets.length,
    names: targets.map((t) => t.name),
  });
}
