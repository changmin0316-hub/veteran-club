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
  const guilds = await prisma.matchGuild.findMany({
    orderBy: [{ server: "asc" }, { grade: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ guilds });
}

const createSchema = z.object({
  server: z.string().trim().min(1, "서버명을 입력하세요.").max(50),
  name: z.string().trim().min(1, "길드 이름을 입력하세요.").max(50),
  side: z.enum(["아군", "적군", "중립"]).default("중립"),
  grade: z.number().int().min(1).max(3).default(1),
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
  const guild = await prisma.matchGuild.create({ data: parsed.data });
  return NextResponse.json({ guild }, { status: 201 });
}

// 서버별 길드 리스트 리셋 (?server=서버명)
export async function DELETE(req: NextRequest) {
  try {
    await requireManager();
  } catch (e) {
    return handleAuth(e);
  }
  const server = req.nextUrl.searchParams.get("server");
  if (!server) {
    return NextResponse.json({ message: "서버를 지정하세요." }, { status: 400 });
  }
  const r = await prisma.matchGuild.deleteMany({ where: { server } });
  return NextResponse.json({ ok: true, deleted: r.count });
}
