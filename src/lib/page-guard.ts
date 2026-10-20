import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

// 서버 컴포넌트용 가드: 권한 없으면 리다이렉트.

/** 로그인만 필요. 미로그인 시 로그인으로. */
export async function requireUserPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  return me;
}

/** 운영진(COMMANDER) 이상만 접근. 아니면 홈으로. */
export async function requireManagerPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "ADMIN" && me.role !== "COMMANDER") redirect("/");
  return me;
}

/** 관리자(ADMIN) 전용. 아니면 홈으로. */
export async function requireAdminPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "ADMIN") redirect("/");
  return me;
}
