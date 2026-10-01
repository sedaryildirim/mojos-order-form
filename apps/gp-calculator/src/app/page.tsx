import Link from "next/link";
import { formatTHB } from "@/lib/costing/currency";
import { TARGET_GP_PCT } from "@/lib/costing/costing";
import { getHomeSummary } from "@/lib/reports/home";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const s = await getHomeSummary();

  return (
    <main>
      <h1>GP Calculator</h1>
      <p>
        Costs and gross profit (GP) for {s.dishCount} dishes, {s.ingredientCount} ingredients and {s.supplierCount} suppliers. GP is the menu price minus what a dish costs, as a share of the price.
      </p>

      <div data-home-grid>
      <section aria-labelledby="low-gp">
        <h2 id="low-gp">
          Below {TARGET_GP_PCT}% GP
        </h2>
        {s.lowGp.length === 0 ? (
          <p>Every priced dish is at or above target.</p>
        ) : (
          <div>
            <table>
              <thead>
                <tr>
                  <th>Dish</th>
                  <th>Cost</th>
                  <th>Menu price</th>
                  <th>GP</th>
                </tr>
              </thead>
              <tbody>
                {s.lowGp.slice(0, 10).map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/dishes/${d.id}`}>
                        {d.name}
                      </Link>
                    </td>
                    <td>{formatTHB(d.cost)}</td>
                    <td>{formatTHB(d.price)}</td>
                    <td>
                      {(d.gpPct * 100).toFixed(0)}% low
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {s.lowGp.length > 10 && (
          <p>
            and {s.lowGp.length - 10} more.{" "}
            <Link href="/dishes">
              See all dishes
            </Link>
          </p>
        )}
        {s.unpricedDishes > 0 && (
          <p>{s.unpricedDishes} dishes have no menu price yet.</p>
        )}
      </section>

      <section aria-labelledby="status">
        <h2 id="status">Status</h2>
        <ul>
          <li>
            <span>
              {s.estimatedIngredients} ingredients still use a guessed price, so {s.dishesNeedingUpdate} dishes and{" "}
              {s.batchesNeedingUpdate} batch recipes are approximate.
            </span>
            <span>
              <Link href="/ingredients">Ingredients</Link> · <Link href="/dishes">Dishes</Link> ·{" "}
              <Link href="/batch-recipes">Batch recipes</Link>
            </span>
          </li>
          {s.recentlyChanged.length > 0 && (
            <li>
              <span>
                {s.recentlyChanged.length} dish{s.recentlyChanged.length === 1 ? "" : "es"} had {s.recentlyChanged.length === 1 ? "its" : "their"} cost updated in the last 14 days.
              </span>
              <span>
                {s.recentlyChanged.slice(0, 4).map((d, i) => (
                  <span key={d.id}>
                    {i > 0 && " · "}
                    <Link
                      href={`/dishes/${d.id}`}
                      title={`${d.oldCost !== null ? `${formatTHB(d.oldCost)} to ` : ""}${formatTHB(d.newCost)}`}
                    >
                      {d.name}
                    </Link>
                  </span>
                ))}
                {s.recentlyChanged.length > 4 && ` · and ${s.recentlyChanged.length - 4} more`}
              </span>
            </li>
          )}
        </ul>
      </section>
      </div>
    </main>
  );
}
