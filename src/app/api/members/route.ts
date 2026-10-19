import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requireManager, requireAdmin, AuthError } from "@/lib/guard";

export const dynamic = "force-dynamic";

// 목록 조회 (군 필터 옵션)
export async function GET(req: NextRequest) {
  try {
    await requireManager();
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const guildId = req.nextUrl.searchParams.get("guildId");
  const members = await prisma.member.findMany({
    where: guildId ? { guildId: Number(guildId) } : undefined,
    include: { guild: true },
    orderBy: [{ role: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ members });
}

const createSchema = z.object({
  name: z.string().trim().min(1, "캐릭터 이름을 입력하세요.").max(50),
  password: z.string().min(4, "초기 비밀번호는 4자 이상이어야 합니다.").max(200),
  job: z.string().trim().max(50).optional().nullable(),
  role: z.enum(["ADMIN", "COMMANDER", "MEMBER"]).default("MEMBER"),
  guildId: z.number().int().positive().optional().nullable(),
  attack: z.number().int().min(0).default(0),
  defense: z.number().int().min(0).default(0),
  accuracy: z.number().int().min(0).default(0),
});

// 신규 길드원 등록
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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // ADMIN 권한 부여는 관리자만 가능
  if (data.role === "ADMIN" && me.role !== "ADMIN") {
    return NextResponse.json(
      { message: "관리자 권한은 관리자만 부여할 수 있습니다." },
      { status: 403 }
    );
  }

  const exists = await prisma.member.findUnique({ where: { name: data.name } });
  if (exists) {
    return NextResponse.json(
      { message: "이미 존재하는 캐릭터 이름입니다." },
      { status: 409 }
    );
  }

  const member = await prisma.member.create({
    data: {
      name: data.name,
      passwordHash: await hashPassword(data.password),
      job: data.job ?? null,
      role: data.role,
      guildId: data.guildId ?? null,
      attack: data.attack,
      defense: data.defense,
      accuracy: data.accuracy,
    },
    include: { guild: true },
  });

  return NextResponse.json({ member }, { status: 201 });
}
