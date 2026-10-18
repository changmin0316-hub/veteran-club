import { NextRequest, NextResponse } from "next/server";
import { requireManager, AuthError } from "@/lib/guard";
import { computeSettlement } from "@/lib/settlement";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireManager();
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }

  const weekId = Number(req.nextUrl.searchParams.get("weekId"));
  const guildIdParam = req.nextUrl.searchParams.get("guildId");
  const guildId = guildIdParam ? Number(guildIdParam) : null;

  if (!Number.isInteger(weekId)) {
    return NextResponse.json({ message: "주차를 지정하세요." }, { status: 400 });
  }

  const result = await computeSettlement(weekId, guildId);
  if (!result) {
    return NextResponse.json({ message: "주차를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(result);
}
