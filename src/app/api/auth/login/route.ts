import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { getSession, type Role } from "@/lib/session";
import { checkRateLimit, recordFailure, resetAttempts } from "@/lib/ratelimit";

const schema = z.object({
  id: z.string().trim().min(1, "캐릭터 이름을 입력하세요.").max(50),
  password: z.string().min(1, "비밀번호를 입력하세요.").max(200),
});

export async function POST(req: NextRequest) {
  // 폼은 FormData 또는 JSON 모두 허용
  let id = "";
  let password = "";
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = await req.json();
      id = body.id ?? "";
      password = body.password ?? "";
    } else {
      const form = await req.formData();
      id = String(form.get("id") ?? "");
      password = String(form.get("password") ?? "");
    }
  } catch {
    return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  }

  const parsed = schema.safeParse({ id, password });
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." },
      { status: 400 }
    );
  }

  // 로그인 시도 제한 (IP + 아이디 기준)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rlKey = `${ip}:${parsed.data.id}`;
  const rl = checkRateLimit(rlKey);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        message: `로그인 시도가 많습니다. ${rl.retryAfterSec}초 후 다시 시도하세요.`,
      },
      { status: 429 }
    );
  }

  const member = await prisma.member.findUnique({
    where: { name: parsed.data.id },
  });

  // 존재하지 않아도 동일한 응답/지연으로 사용자 열거 방지
  const ok =
    member !== null &&
    (await verifyPassword(parsed.data.password, member.passwordHash));

  if (!ok || !member) {
    recordFailure(rlKey);
    return NextResponse.json(
      { message: "캐릭터 이름 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  resetAttempts(rlKey);

  const session = await getSession();
  session.memberId = member.id;
  session.name = member.name;
  session.role = member.role as Role;
  await session.save();

  return NextResponse.json({ message: "ok", ref: "/" }, { status: 200 });
}
