import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, requireAdmin, AuthError } from "@/lib/guard";
import { logActivity, memberDiff } from "@/lib/log";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().trim().min(1, "캐릭터명을 입력하세요.").max(30).optional(),
  job: z.string().trim().max(50).optional().nullable(),
  role: z.enum(["ADMIN", "COMMANDER", "MEMBER"]).optional(),
  guildId: z.number().int().positive().nullable().optional(),
  attack: z.number().int().min(0).optional(),
  defense: z.number().int().min(0).optional(),
  accuracy: z.number().int().min(0).optional(),
  legendSkill: z.boolean().optional(),
  bossKills: z.record(z.string(), z.boolean()).optional(),
  myth1: z.string().trim().max(20).optional(),
  myth2: z.string().trim().max(20).optional(),
  myth3: z.string().trim().max(20).optional(),
  skill1: z.boolean().optional(),
  skill2: z.boolean().optional(),
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

  // 캐릭터명(로그인 ID) 변경은 관리자만. 중복 체크.
  if (data.name !== undefined && data.name !== target.name) {
    if (me.role !== "ADMIN") {
      return NextResponse.json(
        { message: "캐릭터명은 관리자만 변경할 수 있습니다." },
        { status: 403 }
      );
    }
    const dup = await prisma.member.findUnique({ where: { name: data.name } });
    if (dup && dup.id !== memberId) {
      return NextResponse.json(
        { message: "이미 사용 중인 캐릭터명입니다." },
        { status: 409 }
      );
    }
  }

  const { bossKills, name, ...rest } = data;
  // 변경 없으면 name 제외 (관리자가 아닌 경우 그대로 두기 위함)
  const nameUpdate =
    me.role === "ADMIN" && name !== undefined && name !== target.name
      ? { name }
      : {};
  const member = await prisma.member.update({
    where: { id: memberId },
    data: {
      ...rest,
      ...nameUpdate,
      ...(bossKills !== undefined
        ? { bossKills: JSON.stringify(bossKills) }
        : {}),
    },
    include: { guild: true },
  });

  const changes = {
    ...rest,
    ...nameUpdate,
    ...(bossKills !== undefined ? { bossKills: JSON.stringify(bossKills) } : {}),
  };
  const diff = memberDiff(target as unknown as Record<string, unknown>, changes);
  await logActivity({
    actorId: me.memberId,
    actorName: me.name,
    action: "길드원 정보 수정",
    detail: `${target.name}: ${diff || "변경 없음"}`,
    targetMemberId: memberId,
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
    me = await requireAdmin();
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
  if (target.id === me.memberId) {
    return NextResponse.json(
      { message: "본인 계정은 삭제할 수 없습니다." },
      { status: 400 }
    );
  }

  await prisma.member.delete({ where: { id: memberId } });
  await logActivity({
    actorId: me.memberId,
    actorName: me.name,
    action: "길드원 삭제",
    detail: `${target.name} 삭제`,
  });
  return NextResponse.json({ message: "ok" });
}
