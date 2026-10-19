import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { requireUser, AuthError } from "@/lib/guard";

export const dynamic = "force-dynamic";

function handleAuth(e: unknown) {
  if (e instanceof AuthError)
    return NextResponse.json({ message: e.message }, { status: e.status });
  throw e;
}

// 내 정보 조회
export async function GET() {
  let me;
  try {
    me = await requireUser();
  } catch (e) {
    return handleAuth(e);
  }
  const member = await prisma.member.findUnique({
    where: { id: me.memberId },
    select: {
      id: true,
      name: true,
      job: true,
      role: true,
      attack: true,
      defense: true,
      accuracy: true,
      legendSkill: true,
      myth1: true,
      myth2: true,
      bossKills: true,
      guildId: true,
      equipImage: true,
      heavenImage: true,
    },
  });
  return NextResponse.json({ member });
}

const schema = z.object({
  job: z.string().trim().max(50).nullable().optional(),
  attack: z.number().int().min(0).optional(),
  defense: z.number().int().min(0).optional(),
  accuracy: z.number().int().min(0).optional(),
  legendSkill: z.boolean().optional(),
  myth1: z.number().int().min(0).optional(),
  myth2: z.number().int().min(0).optional(),
  bossKills: z.record(z.string(), z.boolean()).optional(),
  // 이미지(data URL) 또는 null(삭제). 과도한 용량 방지 위해 상한 설정.
  equipImage: z.string().max(3_000_000).nullable().optional(),
  heavenImage: z.string().max(3_000_000).nullable().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(4, "새 비밀번호는 4자 이상이어야 합니다.").max(200).optional(),
});

// 내 정보 수정
export async function PATCH(req: NextRequest) {
  let me;
  try {
    me = await requireUser();
  } catch (e) {
    return handleAuth(e);
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." },
      { status: 400 }
    );
  }
  const d = parsed.data;

  const member = await prisma.member.findUnique({ where: { id: me.memberId } });
  if (!member) {
    return NextResponse.json({ message: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (d.job !== undefined) data.job = d.job;
  if (d.attack !== undefined) data.attack = d.attack;
  if (d.defense !== undefined) data.defense = d.defense;
  if (d.accuracy !== undefined) data.accuracy = d.accuracy;
  if (d.legendSkill !== undefined) data.legendSkill = d.legendSkill;
  if (d.myth1 !== undefined) data.myth1 = d.myth1;
  if (d.myth2 !== undefined) data.myth2 = d.myth2;
  if (d.bossKills !== undefined) data.bossKills = JSON.stringify(d.bossKills);
  if (d.equipImage !== undefined) data.equipImage = d.equipImage;
  if (d.heavenImage !== undefined) data.heavenImage = d.heavenImage;

  // 비밀번호 변경 시 현재 비밀번호 확인
  if (d.newPassword) {
    const ok =
      d.currentPassword !== undefined &&
      (await verifyPassword(d.currentPassword, member.passwordHash));
    if (!ok) {
      return NextResponse.json(
        { message: "현재 비밀번호가 올바르지 않습니다." },
        { status: 400 }
      );
    }
    data.passwordHash = await hashPassword(d.newPassword);
  }

  await prisma.member.update({ where: { id: me.memberId }, data });
  return NextResponse.json({ message: "ok" });
}
