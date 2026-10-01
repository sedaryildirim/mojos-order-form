import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatTHB } from "@/lib/currency";
import { gpFromSellingPrice, roundUpToMenuPrice, suggestedPriceFromTargetGp, TARGET_GP_PCT } from "@/lib/costing";
import { dishAttention, findEstimatedIngredientIds } from "@/lib/estimates";
import { loadBatch, presentBatch } from "@/lib/batch";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Menu cost sheet" };
export const dynamic = "force-dynamic";

export default async function MenuSheetPage() {
  const dishes = await prisma.dish.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { lines: true } } },
  });
  const attention = dishAttention(dishes, await findEstimatedIngredientIds());

  const batchIds = await prisma.batchRecipe.findMany({ where: { sellingPrice: { not: null } }, orderBy: { name: "asc" }, select: { id: true } });
  const sweets = (await Promise.all(batchIds.map((b) => loadBatch(b.id)))).filter((b) => b !== null).map((b) => presentBatch(b!));

  const groups = new Map<string, typeof dishes>();
  for (const d of dishes) groups.set(d.category, [...(groups.get(d.category) ?? []), d]);

  return (
    <main>
      <div>
        <div>
          <Link href="/dishes">
            ← All dishes
          </Link>
          <h1>Menu cost sheet</h1>
        </div>
        <PrintButton />
      </div>
      <h1>KAIF menu cost sheet</h1>
      <p>
        Cost, price and GP for every dish. Suggested price is for {TARGET_GP_PCT}% GP, rounded up to the next ฿5. Rows
        marked * use estimated prices, so their figures are approximate.
      </p>

      {Array.from(groups.entries()).map(([category, items]) => (
        <section key={category}>
          <h2>{category}</h2>
          <div>
          <table>
            <thead>
              <tr>
                <th>Dish</th>
                <th>Cost</th>
                <th>Price</th>
                <th>GP</th>
                <th>Suggested</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => {
                const v = d.versions[0];
                const cost = v ? Number(v.costSnapshot) : null;
                const price = v?.sellingPrice ? Number(v.sellingPrice) : null;
                const gp = cost !== null ? gpFromSellingPrice(cost, price) : null;
                const flagged = attention.has(d.id);
                return (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/dishes/${d.id}`}>
                        {d.name}
                      </Link>
                      {flagged && <span>*</span>}
                    </td>
                    <td>{cost !== null ? formatTHB(cost) : "n/a"}</td>
                    <td>{price !== null ? formatTHB(price) : "not set"}</td>
                    <td>
                      {gp ? `${(gp.gpPct * 100).toFixed(0)}%${gp.gpPct * 100 < TARGET_GP_PCT ? " (below target)" : ""}` : "n/a"}
                    </td>
                    <td>
                      {cost !== null ? formatTHB(roundUpToMenuPrice(suggestedPriceFromTargetGp(cost, TARGET_GP_PCT))) : "n/a"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </section>
      ))}
      {sweets.length > 0 && (
        <section>
          <h2>Cakes &amp; sweets</h2>
          <div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Cost per portion</th>
                <th>Price</th>
                <th>GP</th>
              </tr>
            </thead>
            <tbody>
              {sweets.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link href={`/batch-recipes/${b.id}`}>
                      {b.name}
                    </Link>
                  </td>
                  <td>{b.costPerPortion !== null ? formatTHB(b.costPerPortion) : "n/a"}</td>
                  <td>{formatTHB(Number(b.sellingPrice))}</td>
                  <td>
                    {b.gpPct !== null ? `${(b.gpPct * 100).toFixed(0)}%${b.gpPct * 100 < TARGET_GP_PCT ? " (below target)" : ""}` : "n/a"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      )}
    </main>
  );
}
