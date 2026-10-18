import { prisma } from "@/lib/db";
import ItemClient, { type ItemRow } from "./ItemClient";

export const dynamic = "force-dynamic";

export default async function ItemPage() {
  const [items, total] = await Promise.all([
    prisma.item.findMany({ orderBy: { name: "asc" }, take: 50 }),
    prisma.item.count(),
  ]);

  const rows: ItemRow[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    rarity: i.rarity,
    category: i.category,
    basePrice: i.basePrice,
  }));

  return <ItemClient initialRows={rows} total={total} />;
}
