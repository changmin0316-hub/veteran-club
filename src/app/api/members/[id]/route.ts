import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, AuthError } from "@/lib/guard";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  job: z.string().trim().max(50).optional().nullable(),
  role: z.enum(["ADMIN", "COMMANDER", "MEMBER"]).optional(),
  guildId: z.number().int().positive().nullable().optional(),
  attack: z.number().int().min(0).optional(),
  defense: z.number().int().min(0).optional(),
  accuracy: z.number().int().min(0).optional(),
  legendSkill: z.boolean().optional(),
  bossKills: z.record(z.string(), z.boolean()).optional(),
  myth1: z.number().int().min(0).optional(),
  myth2: z.number().int().min(0).optional(),
  pvpKills: z.number().int().min(0).optional(),
  itemCollection: z.number().min(0).max(100).optional(),
  equipImage: z.string().max(3_000_000).nullable().optional(),
  heavenImage: z.string().max(3_000_000).nullable().optional(),
});

// 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let me;
  try {
    me = await requireManager();
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const { id } = await params;
  const memberId = Number(id);
  if (!Number.isInteger(memberId)) {
    return NextResponse.json({ message: "잘못된 대상입니다." }, { status: 400 });
  }

  const target = await prisma.member.findUnique({ where: { id: memberId } });
  if (!target) {
    return NextResponse.json({ message: "길드원을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // 관리자이 아니면: ADMIN 대상 수정 불가, ADMIN 권한 부여 불가
  if (me.role !== "ADMIN") {
    if (target.role === "ADMIN") {
      return NextResponse.json(
        { message: "관리자 계정은 관리자만 수정할 수 있습니다." },
        { status: 403 }
      );
    }
    if (data.role === "ADMIN") {
      return NextResponse.json(
        { message: "관리자 권한은 관리자만 부여할 수 있습니다." },
        { status: 403 }
      );
    }
  }

  const { bossKills, ...rest } = data;
  const member = await prisma.member.update({
    where: { id: memberId },
    data: {
      ...rest,
      ...(bossKills !== undefined
        ? { bossKills: JSON.stringify(bossKills) }
        : {}),
    },
    include: { guild: true },
  });

  return NextResponse.json({ member });
}

// 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let me;
  try {
    me = await requireManager();
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const { id } = await params;
  const memberId = Number(id);
  const target = await prisma.member.findUnique({ where: { id: memberId } });
  if (!target) {
    return NextResponse.json({ message: "길드원을 찾을 수 없습니다." }, { status: 404 });
  }
  if (target.role === "ADMIN" && me.role !== "ADMIN") {
    return NextResponse.json(
      { message: "관리자 계정은 삭제할 수 없습니다." },
      { status: 403 }
    );
  }
  if (target.id === me.memberId) {
    return NextResponse.json(
      { message: "본인 계정은 삭제할 수 없습니다." },
      { status: 400 }
    );
  }

  await prisma.member.delete({ where: { id: memberId } });
  return NextResponse.json({ message: "ok" });
}
