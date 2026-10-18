import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type Role = "ADMIN" | "COMMANDER" | "MEMBER";

export interface SessionData {
  memberId?: number;
  name?: string;
  role?: Role;
}

const password = process.env.SESSION_PASSWORD;
if (!password || password.length < 32) {
  // 개발 중 조기 경고. 운영에서는 32자 이상 강력한 키 필수.
  console.warn(
    "[session] SESSION_PASSWORD 가 없거나 32자 미만입니다. .env 를 확인하세요."
  );
}

export const sessionOptions: SessionOptions = {
  password: password ?? "insecure-dev-password-please-change-0000000000",
  cookieName: "veteran_club_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // 7일
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session.memberId) return null;
  return {
    memberId: session.memberId,
    name: session.name!,
    role: session.role ?? "MEMBER",
  };
}
