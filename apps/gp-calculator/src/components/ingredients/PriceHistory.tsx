"use client";

import { useEffect, useState } from "react";
import { formatTHB } from "@/lib/costing/currency";
import { packLabel, unitPrice } from "@/lib/costing/unit-price";

interface Entry {
  id: string;
  recordedAt: string;
  recordedBy: string;
  supplierName: string;
  purchaseUnit: string;
  packQuantity: number;
  packPrice: number;
  yieldPct: number;
  changePct: number | null;
}

export function PriceHistory({ ingredientId, refreshKey = 0 }: { ingredientId: string; refreshKey?: number }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    fetch(`/api/ingredients/${ingredientId}/history`)
      .then((r) => {
        if (!r.ok) throw new Error("bad response");
        return r.json();
      })
      .then(setEntries)
      .catch(() => setFailed(true));
  }, [ingredientId, refreshKey]);

  if (failed) return <p>Price history could not be loaded.</p>;
  if (!entries) return null;

  return (
    <section aria-labelledby="price-history">
      <h2 id="price-history">
        Price history
      </h2>
      {entries.length <= 1 ? (
        <p>
          No price changes recorded yet. Each change to the price, pack size or supplier is added here.
        </p>
      ) : null}
      <div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Supplier</th>
              <th>Pack</th>
              <th>Pack price</th>
              <th>Unit price</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const up = unitPrice(e);
              const pct = e.changePct === null ? null : Math.round(e.changePct * 100);
              return (
                <tr key={e.id}>
                  <td>
                    {new Date(e.recordedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    <div>{e.recordedBy === "baseline" ? "starting price" : e.recordedBy}</div>
                  </td>
                  <td>{e.supplierName}</td>
                  <td>
                    {packLabel(e.packQuantity, e.purchaseUnit)}
                  </td>
                  <td>{formatTHB(e.packPrice)}</td>
                  <td>
                    {formatTHB(up.value)} <span>{up.label}</span>
                  </td>
                  <td
                  >
                    {pct === null ? "First entry" : pct === 0 ? "No change" : pct > 0 ? `Up ${pct}%` : `Down ${Math.abs(pct)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
