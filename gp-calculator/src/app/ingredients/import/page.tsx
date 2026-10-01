"use client";

import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { useState } from "react";
import { TARGET_GP_PCT } from "@/lib/costing";
import { formatTHB } from "@/lib/currency";
import { useRememberedName } from "@/lib/use-remembered-name";

interface RecalcSummary {
  dishId: string;
  dishName: string;
  versionNumber: number;
  oldCost: number;
  newCost: number;
  sellingPrice: number | null;
  gpPct: number | null;
}

interface PreviewDish {
  dishId: string;
  name: string;
  oldCost: number;
  newCost: number;
  oldGpPct: number | null;
  newGpPct: number | null;
}

interface PreviewBody {
  created: number;
  updated: number;
  confirmed: number;
  unchanged: number;
  skipped: { row: number; reason: string }[];
  dishes: PreviewDish[];
}

interface ImportResultBody {
  created: number;
  updated: number;
  confirmed: number;
  skipped: { row: number; reason: string }[];
  recalculatedDishes: RecalcSummary[];
}

export default function ImportIngredientsPage() {
  const [createdBy, setCreatedBy] = useState("");
  useRememberedName(createdBy, setCreatedBy);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResultBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewBody | null>(null);

  const ready = Boolean(file) && createdBy.trim() !== "";

  // Step 1 checks the file and shows what would change; nothing is saved until "Apply import".
  async function send(dryRun: boolean) {
    if (!file || !createdBy.trim() || busy) return;
    setError(null);
    setResult(null);
    if (dryRun) setPreview(null);
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("createdBy", createdBy);
      if (dryRun) formData.append("dryRun", "true");
      const res = await fetch("/api/ingredients/import", { method: "POST", body: formData });
      const body = await res.json();
      if (res.ok) {
        if (dryRun) setPreview(body);
        else {
          setPreview(null);
          setResult(body);
        }
      } else setError(body?.error ?? "The import failed. Check the file and try again.");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const belowTarget = (result?.recalculatedDishes ?? [])
    .filter((d) => d.gpPct !== null && d.gpPct * 100 < TARGET_GP_PCT)
    .sort((a, b) => (a.gpPct ?? 0) - (b.gpPct ?? 0));

  return (
    <main>
      <PageTitle title="Import prices" />
      <div>
        <h1>Import prices</h1>
        <a href="/api/ingredients/export">
          Download current ingredients
        </a>
      </div>

      <ol>
        <li>Download the current ingredients as a spreadsheet.</li>
        <li>Change prices or pack sizes, and add rows for new ingredients.</li>
        <li>
          To confirm an estimated price, put the real supplier in that row&apos;s supplier column.
        </li>
        <li>Upload the file and preview the changes. Nothing is saved until you apply them, and dishes that use a changed price are then recosted automatically.</li>
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(true);
        }}
      >
        <div>
          <label htmlFor="import-file">Spreadsheet (.xlsx or .csv)</label>
          <input
            id="import-file"
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
              setResult(null);
            }}
          />
          <p>
            Columns: name, category, supplier, purchaseUnit (G, ML or EACH), packQuantity, packPrice, yieldPct.
          </p>
        </div>
        <button type="submit" disabled={!ready || busy}>
          {busy && !preview ? "Checking…" : "Preview changes"}
        </button>
        {!ready && !busy && (
          <p>Choose a file and enter your name to import.</p>
        )}
      </form>

      {error && (
        <p role="alert">
          {error}
        </p>
      )}

      {preview && !result && (
        <section aria-live="polite" aria-labelledby="preview-title">
          <h2 id="preview-title">
            Check before applying
          </h2>
          <p>
            {preview.created} would be created, {preview.updated} updated ({preview.unchanged} of those with no change),{" "}
            {preview.skipped.length} skipped.
            {preview.confirmed > 0 &&
              ` ${preview.confirmed} estimated price${preview.confirmed === 1 ? "" : "s"} would be confirmed as real.`}
          </p>
          {preview.dishes.length > 0 ? (
            <div>
              <p>
                {preview.dishes.length} dish{preview.dishes.length === 1 ? "" : "es"} would be recosted:
              </p>
              <ul>
                {preview.dishes.slice(0, 15).map((d) => {
                  const below = d.newGpPct !== null && d.newGpPct * 100 < TARGET_GP_PCT;
                  return (
                    <li key={d.dishId}>
                      <span>{d.name}</span>
                      <span>
                        cost {formatTHB(d.oldCost)} to {formatTHB(d.newCost)}
                        {d.newGpPct !== null && (
                          <span>
                            , GP {(d.newGpPct * 100).toFixed(0)}%{below ? " (below target)" : ""}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {preview.dishes.length > 15 && <p>and {preview.dishes.length - 15} more.</p>}
            </div>
          ) : (
            <p>No dish costs would change.</p>
          )}
          {preview.skipped.length > 0 && (
            <div>
              <p>These rows would be skipped:</p>
              <ul>
                {preview.skipped.map((s) => (
                  <li key={s.row}>
                    Row {s.row}: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <button type="button" disabled={busy} onClick={() => send(false)}>
              {busy ? "Importing…" : "Apply import"}
            </button>
            <button type="button" onClick={() => setPreview(null)}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {result && (
        <div aria-live="polite">
          <p>
            {result.created} created, {result.updated} updated, {result.skipped.length} skipped.
            {result.confirmed > 0 &&
              ` ${result.confirmed} estimated price${result.confirmed === 1 ? "" : "s"} confirmed as real.`}
          </p>

          {belowTarget.length > 0 && (
            <div role="alert">
              <p>
                Below your {TARGET_GP_PCT}% GP target after this import
              </p>
              <ul>
                {belowTarget.map((d) => (
                  <li key={d.dishId}>
                    <Link href={`/dishes/${d.dishId}`}>
                      {d.dishName}
                    </Link>
                    : GP {((d.gpPct ?? 0) * 100).toFixed(1)}% at a price of {formatTHB(d.sellingPrice ?? 0)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.recalculatedDishes.length > 0 && (
            <div>
              <p>
                {result.recalculatedDishes.length} dish
                {result.recalculatedDishes.length === 1 ? "" : "es"} recosted with the new prices:
              </p>
              <ul>
                {result.recalculatedDishes.map((d) => (
                  <li key={d.dishId}>
                    <Link href={`/dishes/${d.dishId}`}>
                      {d.dishName}
                    </Link>
                    : cost <span>{formatTHB(d.oldCost)}</span> to{" "}
                    <span>{formatTHB(d.newCost)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.skipped.length > 0 && (
            <div>
              <p>Rows that could not be imported:</p>
              <ul>
                {result.skipped.map((s) => (
                  <li key={s.row}>
                    Row {s.row}: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
