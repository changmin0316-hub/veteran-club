import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/page-guard";
import LogsClient, { type LogRow, type MemberOpt } from "./LogsClient";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  await requireAdminPage();

  const [logs, members] = await Promise.all([
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    prisma.member.findMany({
      select: { id: true, name: true },
      orderBy: [{ role: "desc" }, { name: "asc" }],
    }),
  ]);

  const rows: LogRow[] = logs.map((l) => ({
    id: l.id,
    actorId: l.actorId,
    actorName: l.actorName,
    action: l.action,
    detail: l.detail,
    targetMemberId: l.targetMemberId,
    createdAt: l.createdAt.toISOString(),
  }));

  const memberOpts: MemberOpt[] = members.map((m) => ({ id: m.id, name: m.name }));

  return <LogsClient rows={rows} members={memberOpts} />;
}
