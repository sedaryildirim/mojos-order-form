"use client";

import Link from "next/link";
import { PageTitle } from "@/components/layout/PageTitle";
import { useEffect, useMemo, useState } from "react";
import { formatTHB } from "@/lib/costing/currency";
import { comparableName } from "@/lib/costing/ingredient-compare";
import { packLabel, unitPrice } from "@/lib/costing/unit-price";
import { useViewMode } from "@/lib/client/use-view-mode";
import { ListSkeleton, LoadError } from "@/components/layout/Skeleton";
import { ViewToggle } from "@/components/ui/ViewToggle";

interface IngredientRow {
  id: string;
  name: string;
  category: string;
  packPrice: string;
  packQuantity: string;
  purchaseUnit: string;
  yieldPct: string;
  photoUrl: string | null;
  supplierId: string;
  supplier: { id: string; name: string; archived: boolean };
  estimateNote: string | null;
  archived: boolean;
}

interface CheaperOption {
  supplier: string;
  pctCheaper: number;
}

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [supplierFilter, setSupplierFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [mode, setMode] = useViewMode("ingredients");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then(setSuppliers);
  }, []);

  // Load the full unfiltered set once, just to derive the list of categories for the filter dropdown.
  useEffect(() => {
    fetch("/api/ingredients")
      .then((r) => r.json())
      .then((all: IngredientRow[]) => {
        setCategories(Array.from(new Set(all.map((i) => i.category))).sort());
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (supplierFilter) params.set("supplierId", supplierFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (showArchived) params.set("includeArchived", "true");
    setLoadError(false);
    fetch(`/api/ingredients?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("bad response");
        return r.json();
      })
      .then((d) => {
        setIngredients(d);
        setLoading(false);
      })
      .catch(() => {
        setLoadError(true);
        setLoading(false);
      });
  }, [supplierFilter, categoryFilter, showArchived, reloadKey]);

  const filtered = ingredients.filter(
    (i) =>
      (!search || i.name.toLowerCase().includes(search.toLowerCase())) && (!attentionOnly || i.estimateNote !== null)
  );

  // For each ingredient: the cheapest same-named item from another supplier, if it is meaningfully cheaper.
  const cheaperElsewhere = useMemo(() => {
    const byName = new Map<string, IngredientRow[]>();
    for (const i of ingredients) {
      const key = `${comparableName(i.name)}|${i.purchaseUnit}`;
      byName.set(key, [...(byName.get(key) ?? []), i]);
    }
    const unitPrice = (i: IngredientRow) => Number(i.packPrice) / Number(i.packQuantity) / (Number(i.yieldPct) / 100);
    const result = new Map<string, CheaperOption>();
    for (const group of Array.from(byName.values())) {
      if (group.length < 2) continue;
      for (const i of group) {
        const best = group
          .filter((o: IngredientRow) => o.supplierId !== i.supplierId && !o.estimateNote && o.supplier.name !== "House-Made")
          .sort((a: IngredientRow, b: IngredientRow) => unitPrice(a) - unitPrice(b))[0];
        if (best && unitPrice(best) < unitPrice(i) * 0.95) {
          result.set(i.id, { supplier: best.supplier.name, pctCheaper: Math.round((1 - unitPrice(best) / unitPrice(i)) * 100) });
        }
      }
    }
    return result;
  }, [ingredients]);

  const grouped = useMemo(() => {
    const groups = new Map<string, IngredientRow[]>();
    for (const i of filtered) {
      const list = groups.get(i.category) ?? [];
      list.push(i);
      groups.set(i.category, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <main>
      <PageTitle title="Ingredients" />
      <div>
        <h1>Ingredients</h1>
        <div>
          <Link href="/ingredients/import">
            Import prices
          </Link>
          <a
            href="/api/ingredients/export"
          >
            Download template
          </a>
          <Link href="/ingredients/new">
            New ingredient
          </Link>
        </div>
      </div>

      <div>
        <div>
          <label htmlFor="search">
            Search
          </label>
          <input
            id="search"
            placeholder="Ingredient name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="supplierFilter">
            Supplier
          </label>
          <select
            id="supplierFilter"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
          >
            <option value="">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="categoryFilter">
            Category
          </label>
          <select
            id="categoryFilter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <ViewToggle mode={mode} onChange={setMode} />
        <label>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
        <label>
          <input type="checkbox" checked={attentionOnly} onChange={(e) => setAttentionOnly(e.target.checked)} />
          Guessed prices only
        </label>
        {!loading && (
          <span>
            {filtered.length} of {ingredients.length} ingredients
            {ingredients.some((i) => i.estimateNote) &&
              ` · ${ingredients.filter((i) => i.estimateNote).length} with guessed prices`}
          </span>
        )}
      </div>

      {loading && <ListSkeleton label="Loading ingredients" />}
      {loadError && <LoadError what="ingredients" onRetry={() => setReloadKey((k) => k + 1)} />}
      {!loading && !loadError && filtered.length === 0 && (
        <p>No ingredients match these filters. Clear a filter or the search to see more.</p>
      )}

      {!loading && mode === "table" && filtered.length > 0 && <IngredientTable rows={filtered} cheaper={cheaperElsewhere} />}

      {!loading &&
        mode === "cards" &&
        (categoryFilter
          ? [[categoryFilter, filtered]] as [string, IngredientRow[]][]
          : grouped
        ).map(([category, itemsInGroup]) => (
          <section key={category}>
            <h2>
              {category}
            </h2>
            <div>
              {itemsInGroup.map((i) => (
                <IngredientCard key={i.id} ingredient={i} cheaper={cheaperElsewhere.get(i.id)} />
              ))}
            </div>
          </section>
        ))}
    </main>
  );
}

function IngredientCard({ ingredient, cheaper }: { ingredient: IngredientRow; cheaper?: CheaperOption }) {
  const yieldPct = Number(ingredient.yieldPct);

  return (
    <Link
      href={`/ingredients/${ingredient.id}`}
    >
      {ingredient.photoUrl && (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ingredient.photoUrl} alt={ingredient.name} />
        </div>
      )}

      <div>
        <div>
          <h3>{ingredient.name}</h3>
          {ingredient.archived && (
            <span>
              archived
            </span>
          )}
          {ingredient.supplier.archived && (
            <span>
              archived
            </span>
          )}
        </div>
        <p>
          {ingredient.supplier.name}
          {ingredient.estimateNote && (
            <span>
              {ingredient.estimateNote}
            </span>
          )}
        </p>

        {cheaper && (
          <p>
            {cheaper.pctCheaper}% cheaper at {cheaper.supplier}
          </p>
        )}

        <div>
          <div data-stat>
            <div>Pack price</div>
            <div>{formatTHB(Number(ingredient.packPrice))}</div>
          </div>
          <div data-stat>
            <div>Pack size</div>
            <div>
              {packLabel(Number(ingredient.packQuantity), ingredient.purchaseUnit)}
            </div>
          </div>
          {yieldPct < 100 && (
            <div>
              <span>
                Yield {yieldPct}%
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

type SortKey = "name" | "price" | "unit";

function IngredientTable({ rows, cheaper }: { rows: IngredientRow[]; cheaper: Map<string, CheaperOption> }) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [asc, setAsc] = useState(true);

  const sorted = useMemo(() => {
    const val = (i: IngredientRow) =>
      sortKey === "name"
        ? i.name.toLowerCase()
        : sortKey === "price"
          ? Number(i.packPrice)
          : unitPrice({ purchaseUnit: i.purchaseUnit, packQuantity: Number(i.packQuantity), packPrice: Number(i.packPrice), yieldPct: Number(i.yieldPct) }).value;
    return [...rows].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const c = x < y ? -1 : x > y ? 1 : 0;
      return asc ? c : -c;
    });
  }, [rows, sortKey, asc]);

  function header(key: SortKey, label: string) {
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
            {header("name", "Ingredient")}
            <th scope="col">Supplier</th>
            <th scope="col">Pack</th>
            {header("price", "Price")}
            {header("unit", "Unit price")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((i) => {
            const up = unitPrice({ purchaseUnit: i.purchaseUnit, packQuantity: Number(i.packQuantity), packPrice: Number(i.packPrice), yieldPct: Number(i.yieldPct) });
            const c = cheaper.get(i.id);
            return (
              <tr key={i.id}>
                <td>
                  <Link href={`/ingredients/${i.id}`}>
                    {i.name}
                  </Link>
                  {i.estimateNote && (
                    <span>{i.estimateNote}</span>
                  )}
                  {i.archived && (
                    <span>archived</span>
                  )}
                  {c && <div>{c.pctCheaper}% cheaper at {c.supplier}</div>}
                </td>
                <td>{i.supplier.name}</td>
                <td>
                  {packLabel(Number(i.packQuantity), i.purchaseUnit)}
                </td>
                <td>{formatTHB(Number(i.packPrice))}</td>
                <td>
                  <data value={up.value} data-amount>{formatTHB(up.value)}</data> <span>{up.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
