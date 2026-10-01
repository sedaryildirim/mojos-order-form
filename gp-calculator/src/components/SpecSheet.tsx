import Link from "next/link";
import { formatTHB } from "@/lib/currency";
import { gpFromSellingPrice, roundUpToMenuPrice, suggestedPriceFromTargetGp, TARGET_GP_PCT } from "@/lib/costing";

export interface SpecSheetVersion {
  dish: { name: string };
  versionNumber: number;
  notes?: string | null;
  photoUrl?: string | null;
  costSnapshot: string;
  sellingPrice?: string | null;
  targetGpPct?: string | null;
  lines: { id: string; ingredientId?: string; ingredientNameSnapshot: string; quantity: string; unit: string; lineCostSnapshot: string }[];
}

export function SpecSheet({
  version,
  flags = {},
  showVersion = true,
  showShare = false,
  summary = "bottom",
  beforeTable,
  lineHref,
}: {
  version: SpecSheetVersion;
  // ingredientId -> why this line's price can't be trusted yet
  flags?: Record<string, string>;
  showVersion?: boolean;
  // adds each line's share of the dish cost, with the biggest one in bold
  showShare?: boolean;
  // "top" puts the cost, price and GP figures above the ingredient list (the dish page); "bottom" is the print/share layout
  summary?: "top" | "bottom";
  // notices shown between the headline figures and the ingredient list
  beforeTable?: React.ReactNode;
  // where clicking an ingredient goes (the edit screen); omit for the public share view
  lineHref?: (ingredientId: string) => string;
}) {
  const totalLineCost = version.lines.reduce((s, l) => s + Number(l.lineCostSnapshot), 0);
  const cost = Number(version.costSnapshot);
  const sellingPrice = version.sellingPrice ? Number(version.sellingPrice) : null;
  const targetGpPct = version.targetGpPct ? Number(version.targetGpPct) : null;
  const gp = gpFromSellingPrice(cost, sellingPrice);
  const suggestedPrice = targetGpPct !== null ? suggestedPriceFromTargetGp(cost, targetGpPct) : null;

  return (
    <article>
      <h1>{version.dish.name}{showVersion ? ` (v${version.versionNumber})` : ""}</h1>
      {version.notes && <p>{version.notes}</p>}
      {version.photoUrl && <img src={version.photoUrl} alt={version.dish.name} />}

      {summary === "top" && (
        <dl>
          <TopStat label="Cost" value={formatTHB(cost)} />
          <TopStat label="Menu price" value={sellingPrice !== null ? formatTHB(sellingPrice) : "Not set"} muted={sellingPrice === null} />
          <TopStat
            label="GP"
            value={gp ? `${(gp.gpPct * 100).toFixed(0)}%` : "n/a"}
            note={gp ? (gp.gpPct * 100 >= TARGET_GP_PCT ? "On target" : "Below target") : undefined}
            tone={gp ? (gp.gpPct * 100 >= TARGET_GP_PCT ? "good" : "low") : undefined}
            muted={!gp}
          />
          <TopStat
            label={`Price for ${TARGET_GP_PCT}% GP`}
            value={cost > 0 ? formatTHB(roundUpToMenuPrice(suggestedPriceFromTargetGp(cost, TARGET_GP_PCT))) : "n/a"}
          />
        </dl>
      )}

      {beforeTable}

      <div>
      <table>
        <thead>
          <tr><th scope="col">Ingredient</th><th scope="col">Quantity</th><th scope="col">Cost</th>{showShare && <th scope="col">Share</th>}</tr>
        </thead>
        <tbody>
          {version.lines.map((line) => {
            const flag = line.ingredientId ? flags[line.ingredientId] : undefined;
            return (
              <tr key={line.id}>
                <td>
                  {line.ingredientId && lineHref ? (
                    <Link href={lineHref(line.ingredientId)}>
                      {line.ingredientNameSnapshot}
                    </Link>
                  ) : (
                    line.ingredientNameSnapshot
                  )}
                  {flag && (
                    <span>{flag}</span>
                  )}
                </td>
                <td>{Number(line.quantity).toString().replace(/\.0+$/, "")} {line.unit}</td>
                <td>
                  {formatTHB(Number(line.lineCostSnapshot))}
                </td>
                {showShare && (
                  <td>
                    {totalLineCost > 0 ? `${Math.round((Number(line.lineCostSnapshot) / totalLineCost) * 100)}%` : ""}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      {summary === "bottom" && <div>
        <p>Cost: {formatTHB(cost)}</p>
        {sellingPrice && <p>Selling price: {formatTHB(sellingPrice)}</p>}
        {gp ? <p>GP: {formatTHB(gp.gpThb)} ({(gp.gpPct * 100).toFixed(1)}%)</p> : <p>GP: not set</p>}
        {suggestedPrice !== null && <p>Suggested price for {targetGpPct}% target GP: {formatTHB(suggestedPrice)}</p>}
      </div>}
    </article>
  );
}

function TopStat({ label, value, note, tone, muted }: { label: string; value: string; note?: string; tone?: "good" | "low"; muted?: boolean }) {
  return (
    <div data-tone={tone} data-muted={muted ? "true" : undefined}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {note && <dd>{note}</dd>}
    </div>
  );
}
