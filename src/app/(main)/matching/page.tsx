import { prisma } from "@/lib/db";
import { requireManagerPage } from "@/lib/page-guard";
import MatchingClient, { type MatchGuildRow } from "./MatchingClient";

export const dynamic = "force-dynamic";

export default async function MatchingPage() {
  await requireManagerPage();
  const guilds = await prisma.matchGuild.findMany({
    orderBy: [{ server: "asc" }, { grade: "desc" }, { name: "asc" }],
  });
  const rows: MatchGuildRow[] = guilds.map((g) => ({
    id: g.id,
    server: g.server,
    name: g.name,
    side: g.side as MatchGuildRow["side"],
    grade: g.grade,
  }));
  return <MatchingClient initial={rows} />;
}
