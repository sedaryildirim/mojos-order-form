import { DiffLine } from "@/lib/diff";
import { formatTHB } from "@/lib/currency";
import { gpFromSellingPrice } from "@/lib/costing";

export function VersionCompare({
  oldVersion,
  newVersion,
  diffs,
}: {
  oldVersion: { versionNumber: number; costSnapshot: string; sellingPrice: string | null };
  newVersion: { versionNumber: number; costSnapshot: string; sellingPrice: string | null };
  diffs: DiffLine[];
}) {
  const oldCost = Number(oldVersion.costSnapshot);
  const newCost = Number(newVersion.costSnapshot);
  const oldGp = gpFromSellingPrice(oldCost, oldVersion.sellingPrice ? Number(oldVersion.sellingPrice) : null);
  const newGp = gpFromSellingPrice(newCost, newVersion.sellingPrice ? Number(newVersion.sellingPrice) : null);

  function formatSignedTHB(delta: number): string {
    return `${delta >= 0 ? "+" : "-"}${formatTHB(Math.abs(delta))}`;
  }

  function formatSignedPct(delta: number): string {
    return `${delta >= 0 ? "+" : "-"}${Math.abs(delta * 100).toFixed(1)}%`;
  }

  const costDelta = newCost - oldCost;
  const gpThbDelta = oldGp && newGp ? newGp.gpThb - oldGp.gpThb : null;
  const gpPctDelta = oldGp && newGp ? newGp.gpPct - oldGp.gpPct : null;

  return (
    <div>
      <div>
        <div>
          <h2>v{oldVersion.versionNumber}</h2>
          <p>Cost: {formatTHB(oldCost)}</p>
          <p>GP฿: {oldGp ? formatTHB(oldGp.gpThb) : "not set"}</p>
          <p>GP: {oldGp ? `${(oldGp.gpPct * 100).toFixed(1)}%` : "not set"}</p>
        </div>
        <div>
          <h2>v{newVersion.versionNumber}</h2>
          <p>Cost: {formatTHB(newCost)}</p>
          <p>GP฿: {newGp ? formatTHB(newGp.gpThb) : "not set"}</p>
          <p>GP: {newGp ? `${(newGp.gpPct * 100).toFixed(1)}%` : "not set"}</p>
        </div>
      </div>
      <div>
        <h2>Change</h2>
        <p>Cost: {formatSignedTHB(costDelta)}</p>
        <p>GP฿: {gpThbDelta !== null ? formatSignedTHB(gpThbDelta) : "n/a"}</p>
        <p>GP%: {gpPctDelta !== null ? formatSignedPct(gpPctDelta) : "n/a"}</p>
      </div>
      <ul>
        {diffs.map((d, i) => (
          <li key={i}>
            {d.ingredientName}: {d.status}
            {d.status === "changed" && ` (${d.oldQuantity} → ${d.newQuantity} ${d.unit})`}
          </li>
        ))}
      </ul>
    </div>
  );
}
