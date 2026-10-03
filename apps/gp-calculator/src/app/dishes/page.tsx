"use client";

import Link from "next/link";
import { PageTitle } from "@/components/layout/PageTitle";
import { useEffect, useMemo, useState } from "react";
import { formatTHB } from "@/lib/costing/currency";
import { useViewMode } from "@/lib/client/use-view-mode";
import { ListSkeleton, LoadError } from "@/components/layout/Skeleton";
import { ViewToggle } from "@/components/ui/ViewToggle";
import { gpFromSellingPrice, roundUpToMenuPrice, suggestedPriceFromTargetGp, TARGET_GP_PCT } from "@/lib/costing/costing";

interface VersionLine {
  id: string;
  ingredientNameSnapshot: string;
}

interface Version {
  id: string;
  versionNumber: number;
  costSnapshot: string;
  sellingPrice: string | null;
  photoUrl: string | null;
  source: string;
  lines: VersionLine[];
}

interface DishRow {
  id: string;
  name: string;
  category: string;
  badge: string | null;
  versions: Version[];
  attention: string[];
}

export default function DishesPage() {
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [show, setShow] = useState<"all" | "low" | "guessed">("all");
  const [mode, setMode] = useViewMode("dishes");

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    fetch("/api/dishes")
      .then((r) => {
        if (!r.ok) throw new Error("bad response");
        return r.json();
      })
      .then((d) => {
        setDishes(d);
        setLoading(false);
      })
      .catch(() => {
        setLoadError(true);
        setLoading(false);
      });
  }, [reloadKey]);

  const categories = useMemo(
    () => Array.from(new Set(dishes.map((d) => d.category))).sort(),
    [dishes]
  );

  const filtered = dishes.filter((d) => {
    if (categoryFilter && d.category !== categoryFilter) return false;
    if (show === "guessed" && d.attention.length === 0) return false;
    if (show === "low") {
      const v = d.versions[0];
      const gp = v ? gpFromSellingPrice(Number(v.costSnapshot), v.sellingPrice ? Number(v.sellingPrice) : null) : null;
      if (!gp || gp.gpPct * 100 >= TARGET_GP_PCT) return false;
    }
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = useMemo(() => {
    const groups = new Map<string, DishRow[]>();
    for (const d of filtered) {
      const list = groups.get(d.category) ?? [];
      list.push(d);
      groups.set(d.category, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <main>
      <PageTitle title="Dishes" />
      <div>
        <h1>Dishes</h1>
        <div>
          <Link href="/dishes/menu">
            Menu cost sheet
          </Link>
          <Link href="/dishes/new">
            New dish
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
            placeholder="Dish name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
        <div>
          <label htmlFor="show">Show</label>
          <select id="show" value={show} onChange={(e) => setShow(e.target.value as "all" | "low" | "guessed")}>
            <option value="all">All dishes</option>
            <option value="low">Below {TARGET_GP_PCT}% GP</option>
            <option value="guessed">Guessed prices</option>
          </select>
        </div>
        <ViewToggle mode={mode} onChange={setMode} />
        {!loading && (
          <span>
            {filtered.length} of {dishes.length} dishes
            {dishes.some((d) => d.attention.length > 0) &&
              ` · ${dishes.filter((d) => d.attention.length > 0).length} with guessed prices`}
          </span>
        )}
      </div>

      {loading && <ListSkeleton label="Loading dishes" />}
      {loadError && <LoadError what="dishes" onRetry={() => setReloadKey((k) => k + 1)} />}

      {!loading && !loadError && filtered.length === 0 && (
        <p>No dishes match these filters. Clear a filter or the search to see more.</p>
      )}

      {!loading && mode === "table" && filtered.length > 0 && <DishTable rows={filtered} />}

      {!loading &&
        mode === "cards" &&
        (categoryFilter
          ? [[categoryFilter, filtered]] as [string, DishRow[]][]
          : grouped
        ).map(([category, dishesInGroup]) => (
          <section key={category}>
            <h2>
              {category}
            </h2>
            <div>
              {dishesInGroup.map((d) => (
                <DishCard key={d.id} dish={d} />
              ))}
            </div>
          </section>
        ))}
    </main>
  );
}

function DishCard({ dish }: { dish: DishRow }) {
  const latest = dish.versions[0];
  const cost = latest ? Number(latest.costSnapshot) : null;
  const sellingPrice = latest?.sellingPrice ? Number(latest.sellingPrice) : null;
  const gp = cost !== null ? gpFromSellingPrice(cost, sellingPrice) : null;

  const needsUpdate = dish.attention.length > 0;
  const noRecipe = dish.attention[0] === "No recipe yet";
  const lineNames = latest?.lines.map((l) => l.ingredientNameSnapshot) ?? [];
  const preview = lineNames.slice(0, 4).join(", ");
  const extra = lineNames.length - 4;

  return (
    <Link
      href={`/dishes/${dish.id}`}
    >
      {latest?.photoUrl && (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={latest.photoUrl} alt={dish.name} />
        </div>
      )}

      <div>
        <div>
          <h3>{dish.name}</h3>
          {(dish.badge || latest) && (
            <span>
              {dish.badge && <data data-badge={dish.badge}>{dish.badge}</data>}
              {latest && (
                <span>
                  v{latest.versionNumber}
                </span>
              )}
            </span>
          )}
        </div>

        {needsUpdate && (
          <p>
            {noRecipe
              ? "No recipe yet"
              : `Guessed prices: ${dish.attention.slice(0, 3).join(", ")}${
                  dish.attention.length > 3 ? ` +${dish.attention.length - 3} more` : ""
                }`}
          </p>
        )}

        {latest && (
          <>
            <p>
              {preview}
              {extra > 0 && `, +${extra} more`}
            </p>

            <div>
                  <Stat label="Cost" value={formatTHB(cost!)} />
                  <Stat label="Menu price" value={sellingPrice !== null ? formatTHB(sellingPrice) : "Not set"} muted={sellingPrice === null} />
                  <Stat
                    label="GP"
                    value={gp ? `${(gp.gpPct * 100).toFixed(0)}%` : "n/a"}
                    muted={!gp}
                    tone={gp ? (gp.gpPct * 100 >= TARGET_GP_PCT ? "good" : "low") : undefined}
                    note={gp ? (gp.gpPct * 100 >= TARGET_GP_PCT ? "On target" : "Below target") : undefined}
                  />
                  <Stat
                    label={`Menu price for ${TARGET_GP_PCT}% GP`}
                    value={formatTHB(roundUpToMenuPrice(suggestedPriceFromTargetGp(cost!, TARGET_GP_PCT)))}
                  />
                </div>
              </>
        )}
      </div>
    </Link>
  );
}

function Stat({
  label,
  value,
  muted,
  tone,
  note,
}: {
  label: string;
  value: string;
  muted?: boolean;
  tone?: "good" | "low";
  note?: string;
}) {
  return (
    <div data-stat data-tone={tone} data-muted={muted ? "true" : undefined}>
      <div>{label}</div>
      <div>{value}</div>
      {note && <div>{note}</div>}
    </div>
  );
}

type DishSort = "name" | "cost" | "price" | "gp" | "suggested";

function DishTable({ rows }: { rows: DishRow[] }) {
  const [sortKey, setSortKey] = useState<DishSort>("name");
  const [asc, setAsc] = useState(true);

  const enriched = useMemo(
    () =>
      rows.map((d) => {
        const v = d.versions[0];
        const cost = v ? Number(v.costSnapshot) : null;
        const price = v?.sellingPrice ? Number(v.sellingPrice) : null;
        const gp = cost !== null ? gpFromSellingPrice(cost, price) : null;
        return { d, cost, price, gp };
      }),
    [rows]
  );

  const sorted = useMemo(() => {
    const val = (r: (typeof enriched)[number]) =>
      sortKey === "name" ? r.d.name.toLowerCase() : sortKey === "cost" ? r.cost ?? -1 : sortKey === "price" ? r.price ?? -1 : sortKey === "suggested" ? (r.cost ?? 0) : r.gp ? r.gp.gpPct : -1;
    return [...enriched].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const c = x < y ? -1 : x > y ? 1 : 0;
      return asc ? c : -c;
    });
  }, [enriched, sortKey, asc]);

  function header(key: DishSort, label: string) {
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
            {header("name", "Dish")}
            <th scope="col">Category</th>
            {header("cost", "Cost")}
            {header("price", "Menu price")}
            {header("gp", "GP")}
            {header("suggested", `Menu price for ${TARGET_GP_PCT}% GP`)}
            <th scope="col">Guessed prices</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ d, cost, price, gp }) => {
            const flagged = d.attention.length > 0;
            const noRecipe = d.attention[0] === "No recipe yet";
            return (
              <tr key={d.id}>
                <td>
                  <Link href={`/dishes/${d.id}`}>
                    {d.name}
                  </Link>
                  {d.badge && <data data-badge={d.badge}>{d.badge}</data>}
                </td>
                <td>{d.category}</td>
                <td>{cost !== null ? formatTHB(cost) : "n/a"}</td>
                <td>{price !== null ? formatTHB(price) : "not set"}</td>
                <td data-gp={gp ? (gp.gpPct * 100 < TARGET_GP_PCT ? "low" : "good") : undefined}>
                  {gp ? `${(gp.gpPct * 100).toFixed(0)}%${gp.gpPct * 100 < TARGET_GP_PCT ? " (below target)" : " (on target)"}` : "n/a"}
                </td>
                <td>
                  {cost !== null && cost > 0 ? formatTHB(roundUpToMenuPrice(suggestedPriceFromTargetGp(cost, TARGET_GP_PCT))) : "n/a"}
                </td>
                <td>{noRecipe ? "No recipe" : flagged ? d.attention.length : "None"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
