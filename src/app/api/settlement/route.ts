import { NextRequest, NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/guard";
import { computeSettlement } from "@/lib/settlement";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let me;
  try {
    me = await requireUser();
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ message: e.message }, { status: e.status });
    throw e;
  }
  const isManager = me.role === "ADMIN" || me.role === "COMMANDER";

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

  // 길드원(비관리자)에게는 분배율·분배금 등 금전 정보를 제거하고 출석 정보만 제공
  if (!isManager) {
    return NextResponse.json({
      ...result,
      pool: 0,
      excludeAmount: 0,
      distributable: 0,
      totalScore: 0,
      rows: result.rows.map((r) => ({ ...r, shareRatio: 0, share: 0, extra: 0 })),
    });
  }

  return NextResponse.json(result);
}
