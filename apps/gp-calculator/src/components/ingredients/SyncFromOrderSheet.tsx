"use client";

import { useState } from "react";
import { apiError, safeFetch } from "@/lib/client/api";
import { formatTHB } from "@/lib/costing/currency";

interface Entry {
  name: string;
  supplier: string;
}
interface SyncReportBody {
  applied: boolean;
  created: Entry[];
  priceChanged: (Entry & { oldPrice: number; newPrice: number })[];
  unchanged: number;
  removed: Entry[];
  archivedBecauseUsed: Entry[];
  needsPackSize: Entry[];
  packMismatch: (Entry & { gpPack: string; sheetPack: string; sheetPrice: number })[];
  notRecosted: string[];
  // A preview names the dish `name`; an applied sync names it `dishName`.
  dishes: { dishId: string; name?: string; dishName?: string; sellingPrice: number | null; oldCost: number; newCost: number }[];
}

// Pulls the Kaif order sheet's items and prices into the ingredient list. The first call only previews;
// nothing is saved until apply.
export function useOrderSheetSync(onSynced?: () => void) {
  const [report, setReport] = useState<SyncReportBody | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(apply: boolean) {
    setBusy(true);
    setError(null);
    const res = await safeFetch("/api/sync/order-sheet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apply }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await apiError(res, "The sync failed. Nothing was changed."));
      return;
    }
    setReport(await res.json());
    if (apply) onSynced?.();
  }

  return {
    report,
    busy,
    error,
    preview: () => run(false),
    apply: () => run(true),
    close: () => {
      setReport(null);
      setError(null);
    },
  };
}

type OrderSheetSync = ReturnType<typeof useOrderSheetSync>;

// The button sits in the page's action row.
export function SyncButton({ sync }: { sync: OrderSheetSync }) {
  return (
    <button type="button" disabled={sync.busy} onClick={sync.preview}>
      {sync.busy && !sync.report ? "Checking the order sheet…" : "Sync from order sheet"}
    </button>
  );
}

const names = (xs: Entry[]) => xs.map((x) => `${x.name} (${x.supplier})`).join(", ");

// The result sits in its own block under the page header.
export function SyncPanel({ sync }: { sync: OrderSheetSync }) {
  const { report, busy, error } = sync;
  if (!report && !error) return null;
  return (
    <section aria-label="Order sheet sync">
      {error && <p role="alert">{error}</p>}
      {report && (
        <>
          <h2>{report.applied ? "Synced from the order sheet" : "Preview: nothing has changed yet"}</h2>
          <p>
            {report.created.length} new · {report.priceChanged.length} price changes · {report.unchanged} unchanged · {report.removed.length} removed
            · {report.archivedBecauseUsed.length} archived (still used by a recipe) · {report.packMismatch.length} left alone (unit differs)
          </p>
          {report.priceChanged.length > 0 && (
            <table data-sync>
              <thead>
                <tr>
                  <th scope="col">Price change</th>
                  <th scope="col">Supplier</th>
                  <th scope="col" data-num>Was</th>
                  <th scope="col" data-num>Now</th>
                </tr>
              </thead>
              <tbody>
                {report.priceChanged.map((p) => (
                  <tr key={`${p.supplier}:${p.name}`}>
                    <td>{p.name}</td>
                    <td>{p.supplier}</td>
                    <td data-num>{formatTHB(p.oldPrice)}</td>
                    <td data-num>{formatTHB(p.newPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {report.dishes.length > 0 && (
            <table data-sync>
              <thead>
                <tr>
                  <th scope="col">{report.applied ? "Dishes recalculated" : "Dishes that would change"}</th>
                  <th scope="col" data-num>Menu price</th>
                  <th scope="col" data-num>Cost was</th>
                  <th scope="col" data-num>Cost now</th>
                </tr>
              </thead>
              <tbody>
                {report.dishes.map((d) => (
                  <tr key={d.dishId}>
                    <td>{d.name ?? d.dishName}</td>
                    <td data-num>{d.sellingPrice !== null ? formatTHB(d.sellingPrice) : "Not set"}</td>
                    <td data-num>{formatTHB(d.oldCost)}</td>
                    <td data-num>{formatTHB(d.newCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {report.archivedBecauseUsed.length > 0 && <p>Archived because a recipe still uses them: {names(report.archivedBecauseUsed)}</p>}
          {report.notRecosted.length > 0 && (
            <p role="alert">Not recalculated, because a recipe line no longer fits its ingredient&apos;s unit: {report.notRecosted.join(", ")}</p>
          )}
          {report.needsPackSize.length > 0 && <p>New items that need a pack size: {names(report.needsPackSize)}</p>}
          {!report.applied && (
            <button type="button" disabled={busy} onClick={sync.apply}>
              Apply
            </button>
          )}
        </>
      )}
      <button type="button" onClick={sync.close}>
        Close
      </button>
    </section>
  );
}
