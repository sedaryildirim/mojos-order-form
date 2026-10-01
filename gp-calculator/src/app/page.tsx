import Link from "next/link";
import { formatTHB } from "@/lib/currency";
import { TARGET_GP_PCT } from "@/lib/costing";
import { getHomeSummary } from "@/lib/home";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const s = await getHomeSummary();

  return (
    <main>
      <h1>GP Calculator</h1>
      <p>
        Costs and gross profit (GP) for {s.dishCount} dishes, {s.ingredientCount} ingredients and {s.supplierCount} suppliers.
      </p>

      <div>
        <Link href="/suppliers">
          Update supplier prices
        </Link>
        <Link href="/orders">
          Build an order list
        </Link>
      </div>

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
                  <th>Price</th>
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

      <section aria-labelledby="estimates">
        <h2 id="estimates">
          Estimated prices to replace
        </h2>
        <p>
          {s.estimatedIngredients} ingredients still use a guessed price. That makes {s.dishesNeedingUpdate} dishes and{" "}
          {s.batchesNeedingUpdate} batch recipes approximate.
        </p>
        <div>
          <Link href="/dishes">
            Dishes to update
          </Link>
          <Link href="/batch-recipes">
            Batch recipes to update
          </Link>
          <Link href="/ingredients">
            Estimated ingredients
          </Link>
        </div>
      </section>

      {s.recentlyChanged.length > 0 && (
        <section aria-labelledby="changed">
          <h2 id="changed">
            Recosted in the last 14 days
          </h2>
          <ul>
            {s.recentlyChanged.map((d) => (
              <li key={d.id}>
                <Link href={`/dishes/${d.id}`}>
                  {d.name}
                </Link>
                <span>
                  {d.oldCost !== null ? `${formatTHB(d.oldCost)} to ` : ""}
                  {formatTHB(d.newCost)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
