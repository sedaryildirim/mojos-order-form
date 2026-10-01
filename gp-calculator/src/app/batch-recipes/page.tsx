"use client";

import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { useEffect, useMemo, useState } from "react";
import { ListSkeleton, LoadError } from "@/components/Skeleton";
import { formatTHB } from "@/lib/currency";
import { TARGET_GP_PCT } from "@/lib/costing";
import { useViewMode } from "@/lib/use-view-mode";
import { ViewToggle } from "@/components/ViewToggle";

interface BatchRow {
  id: string;
  name: string;
  category: string;
  yieldQuantity: string;
  yieldUnit: "EACH" | "G" | "ML";
  totalCost: number | null;
  costPerUnit: number | null;
  portions: number | null;
  costPerPortion: number | null;
  sellingPrice: string | null;
  gpPct: number | null;
  costError: boolean;
  isDraft: boolean;
  attention: string[];
  lines: { id: string; ingredient: { name: string } }[];
}

export default function BatchRecipesPage() {
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [mode, setMode] = useViewMode("batches");

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    fetch("/api/batch-recipes")
      .then((r) => {
        if (!r.ok) throw new Error("bad response");
        return r.json();
      })
      .then((d) => {
        setBatches(d);
        setLoading(false);
      })
      .catch(() => {
        setLoadError(true);
        setLoading(false);
      });
  }, [reloadKey]);

  const filtered = useMemo(
    () =>
      batches.filter(
        (b) =>
          (!search || b.name.toLowerCase().includes(search.toLowerCase())) &&
          (!attentionOnly || b.attention.length > 0)
      ),
    [batches, search, attentionOnly]
  );

  return (
    <main>
      <PageTitle title="Batch recipes" />
      <div>
        <div>
          <h1>Batch recipes</h1>
          <p>
            Things you make in house, like bread and buns. Each batch becomes an ingredient you can use in dishes,
            priced from what goes into it.
          </p>
        </div>
        <Link href="/batch-recipes/new">New batch recipe</Link>
      </div>

      <div>
        <div>
          <label htmlFor="search">Search</label>
          <input id="search" placeholder="Batch name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <ViewToggle mode={mode} onChange={setMode} />
        <label>
          <input type="checkbox" checked={attentionOnly} onChange={(e) => setAttentionOnly(e.target.checked)} />
          Needs updating only
          {batches.some((b) => b.attention.length > 0) && (
            <span>({batches.filter((b) => b.attention.length > 0).length} need updating)</span>
          )}
        </label>
      </div>

      {loading && <ListSkeleton label="Loading batch recipes" />}
      {loadError && <LoadError what="batch recipes" onRetry={() => setReloadKey((k) => k + 1)} />}
      {!loading && !loadError && filtered.length === 0 && (
        <p>
          {batches.length === 0 ? "No batch recipes yet. Add one for anything you make in house, like bread or sauces." : "No batch recipes match. Clear the search to see more."}
        </p>
      )}

      {!loading && mode === "table" && filtered.length > 0 && <BatchTable rows={filtered} />}

      {!loading &&
        mode === "cards" &&
        Array.from(
          filtered.reduce((m, b) => m.set(b.category, [...(m.get(b.category) ?? []), b]), new Map<string, BatchRow[]>())
        )
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([cat, items]) => (
            <section key={cat}>
              <h2>{cat}</h2>
              <div>
                {items.map((b) => (
                  <BatchCard key={b.id} batch={b} />
                ))}
              </div>
            </section>
          ))}
    </main>
  );
}

function BatchCard({ batch }: { batch: BatchRow }) {
  const qty = Number(batch.yieldQuantity);
  const unitText = batch.yieldUnit === "G" ? "g" : "ml";
  const yieldText =
    batch.yieldUnit === "EACH"
      ? `${qty} portions`
      : batch.portions !== null
        ? `${Math.floor(batch.portions)} portions (${qty} ${unitText})`
        : `${qty} ${unitText}`;
  // Prefer cost per portion; fall back to per 100 g / ml when the portion size isn't known.
  const perLabel = batch.costPerPortion !== null ? "Per portion" : batch.yieldUnit === "G" ? "Per 100 g" : "Per 100 ml";
  const perValue = batch.costPerPortion ?? batch.costPerUnit;
  const names = batch.lines.map((l) => l.ingredient.name);
  const preview = names.slice(0, 4).join(", ");
  const extra = names.length - 4;

  return (
    <Link
      href={`/batch-recipes/${batch.id}`}
    >
      <div>
        <h3>{batch.name}</h3>
        {batch.isDraft && (
          <span>Needs ingredients</span>
        )}
      </div>
      <p>{batch.category} · makes {yieldText}</p>
      {batch.attention.length > 0 && (
        <p>
          {batch.isDraft
            ? "Needs updating: no ingredients yet"
            : `Needs updating: estimated price for ${batch.attention.slice(0, 3).join(", ")}${
                batch.attention.length > 3 ? ` +${batch.attention.length - 3} more` : ""
              }`}
        </p>
      )}
      {!batch.isDraft && (
        <p>
          {preview}
          {extra > 0 && `, +${extra} more`}
        </p>
      )}
      {batch.sellingPrice !== null && (
        <p>
          Menu price <span>{formatTHB(Number(batch.sellingPrice))}</span>
          {batch.gpPct !== null && (
            <span>
              GP {(batch.gpPct * 100).toFixed(0)}%{batch.gpPct * 100 < TARGET_GP_PCT ? " (below target)" : ""}
            </span>
          )}
        </p>
      )}
      <div>
        <div data-stat>
          <div>Batch cost</div>
          <div>
            {batch.costError ? "Check units" : batch.totalCost !== null ? formatTHB(batch.totalCost) : "Not set"}
          </div>
        </div>
        <div data-stat>
          <div>{perLabel}</div>
          <div>
            {perValue !== null ? formatTHB(perValue) : "Not set"}
          </div>
        </div>
      </div>
    </Link>
  );
}

type BatchSort = "name" | "cost" | "portion" | "gp";

function BatchTable({ rows }: { rows: BatchRow[] }) {
  const [sortKey, setSortKey] = useState<BatchSort>("name");
  const [asc, setAsc] = useState(true);

  const sorted = useMemo(() => {
    const val = (b: BatchRow) =>
      sortKey === "name" ? b.name.toLowerCase() : sortKey === "cost" ? b.totalCost ?? -1 : sortKey === "portion" ? b.costPerPortion ?? -1 : b.gpPct ?? -1;
    return [...rows].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const c = x < y ? -1 : x > y ? 1 : 0;
      return asc ? c : -c;
    });
  }, [rows, sortKey, asc]);

  function header(key: BatchSort, label: string) {
    const active = sortKey === key;
    return (
      <th scope="col" aria-sort={active ? (asc ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          onClick={() => {
            if (active) setAsc(!asc);
            else {
              setSortKey(key);
              setAsc(true);
            }
          }}
        >
          {label}
          <span aria-hidden="true">{active ? (asc ? "▲" : "▼") : ""}</span>
        </button>
      </th>
    );
  }

  return (
    <div>
      <table>
        <thead>
          <tr>
            {header("name", "Batch")}
            <th scope="col">Category</th>
            <th scope="col">Makes</th>
            {header("cost", "Batch cost")}
            {header("portion", "Per portion")}
            <th scope="col">Menu price</th>
            {header("gp", "GP")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((b) => {
            const qty = Number(b.yieldQuantity);
            const makes = b.yieldUnit === "EACH" ? `${qty} portions` : b.portions !== null ? `${Math.floor(b.portions)} portions` : `${qty} ${b.yieldUnit === "G" ? "g" : "ml"}`;
            const flagged = b.attention.length > 0;
            return (
              <tr key={b.id}>
                <td>
                  <Link href={`/batch-recipes/${b.id}`}>
                    {b.name}
                  </Link>
                  {flagged && (
                    <span>
                      {b.isDraft ? "Needs ingredients" : "Estimated price"}
                    </span>
                  )}
                </td>
                <td>{b.category}</td>
                <td>{makes}</td>
                <td>{b.costError ? "Check units" : b.totalCost !== null ? formatTHB(b.totalCost) : "n/a"}</td>
                <td>{b.costPerPortion !== null ? formatTHB(b.costPerPortion) : "n/a"}</td>
                <td>{b.sellingPrice !== null ? formatTHB(Number(b.sellingPrice)) : "not set"}</td>
                <td>
                  {b.gpPct !== null ? `${(b.gpPct * 100).toFixed(0)}%${b.gpPct * 100 < TARGET_GP_PCT ? " (below target)" : ""}` : "n/a"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
